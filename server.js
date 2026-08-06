// ============================================================
// Clinic Platform — Node.js Server
// ============================================================
import express from 'express';
import session from 'express-session';
import FileStoreFactory from 'session-file-store';
import Database from 'better-sqlite3';
import multer from 'multer';
import { randomBytes, createHash } from 'crypto';
import { existsSync, mkdirSync, unlinkSync, renameSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const FileStore = FileStoreFactory(session);
const PORT = process.env.PORT || 3000;

// ── DB SETUP ─────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || join(__dirname, 'data', 'clinic.db');
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    oidc_sub TEXT UNIQUE,
    email TEXT,
    name TEXT,
    role TEXT DEFAULT 'viewer',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS presentations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    password_hash TEXT,
    is_public INTEGER DEFAULT 1,
    owner_id INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    presentation_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT DEFAULT '',
    data TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size INTEGER,
    scope TEXT DEFAULT 'private',
    presentation_id INTEGER,
    uploaded_by INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_public INTEGER DEFAULT 1,
    owner_id INTEGER,
    current_question_id INTEGER,
    results_revealed INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    question_text TEXT NOT NULL DEFAULT '',
    options TEXT NOT NULL DEFAULT '[]',
    correct_index INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quiz_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    voter_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(question_id, voter_id),
    FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
  );
`);

// Schema migration: add Bunny Stream columns to an existing `videos` table without
// rebuilding it (ALTER TABLE ADD COLUMN is safe/cheap in SQLite; guard against re-running).
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn('videos', 'provider', "provider TEXT DEFAULT 'local'");
ensureColumn('videos', 'bunny_video_id', 'bunny_video_id TEXT');
ensureColumn('videos', 'playback_url', 'playback_url TEXT');
ensureColumn('videos', 'duration_sec', 'duration_sec INTEGER');
// Separate from results_revealed: the correct-answer highlight is a second, deliberate
// reveal step so it never shows on the (audience-visible) presenter screen alongside
// the vote tally until the host explicitly reveals it.
ensureColumn('quizzes', 'answer_revealed', 'answer_revealed INTEGER DEFAULT 0');

// ── MIDDLEWARE ────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  store: new FileStore({ path: '/opt/clinic-platform/data/sessions', ttl: 86400, retries: 0 }),
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 86400000 * 7 }
}));

// Video storage
const VIDEO_DIR = process.env.VIDEO_DIR || join(__dirname, 'videos');
mkdirSync(join(VIDEO_DIR, 'shared'), { recursive: true });
mkdirSync(join(VIDEO_DIR, 'presentations'), { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const scope = req.body.scope || 'private';
    const isSharedRoute = req.path === '/api/videos/shared';
    const dir = (scope === 'shared' || isSharedRoute)
      ? join(VIDEO_DIR, 'shared')
      : join(VIDEO_DIR, 'presentations', req.params.slug || 'temp');
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // 2GB max

// Bunny.net Stream — remote video library
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '';
const BUNNY_API_KEY = process.env.BUNNY_API_KEY || '';
const BUNNY_PULL_ZONE = process.env.BUNNY_PULL_ZONE || ''; // hostname only, e.g. vz-xxxxxxx.b-cdn.net
const BUNNY_MP4_RESOLUTIONS = [1080, 720, 480, 360, 240]; // probed high to low; first that 200s wins

// A video row's playable URL: Bunny rows already carry a verified absolute playback_url;
// local rows are served by this app from disk under a path built from scope/filename.
function videoUrl(v, slug) {
  if (v.provider === 'bunny' && v.playback_url) return v.playback_url;
  return v.scope === 'shared' ? `/videos/shared/${v.filename}` : `/videos/p/${slug}/${v.filename}`;
}

// ── AUTH HELPERS ──────────────────────────────────────────────
function hashPassword(pw) {
  return createHash('sha256').update(pw + process.env.PW_SALT || 'clinic-salt').digest('hex');
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.role === 'admin') return next();
  res.status(403).json({ error: 'Admin required' });
}

function requireEditor(req, res, next) {
  if (req.session?.user?.role === 'admin' || req.session?.user?.role === 'creator') return next();
  res.status(403).json({ error: 'Login required' });
}

// ── OIDC AUTH (Pocket ID) ─────────────────────────────────────
const OIDC_BASE = process.env.OIDC_ISSUER || 'https://auth.santahouse.me';
const CLIENT_ID = process.env.OIDC_CLIENT_ID || '';
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.OIDC_REDIRECT_URI || 'https://clinic.santahouse.me/auth/callback';
// Extra hostnames this app also answers to (e.g. a second domain proxied to the same
// LXC) that have ALSO been registered as redirect URIs on the Pocket ID client. Without
// this, the login flow always bounces back to REDIRECT_URI's host regardless of which
// domain the user started on — session cookies are per-domain, so that mismatch is what
// produces "Invalid state" when logging in from any host other than the primary one.
const EXTRA_OIDC_HOSTS = (process.env.OIDC_EXTRA_HOSTS || '').split(',').map(h => h.trim()).filter(Boolean);
const ALLOWED_OIDC_HOSTS = [new URL(REDIRECT_URI).host, ...EXTRA_OIDC_HOSTS];

// Picks the redirect_uri matching the domain the request actually came in on, from an
// explicit allowlist — never trusts the Host header blindly for building this URL.
function redirectUriForRequest(req) {
  const host = req.get('host');
  return (host && ALLOWED_OIDC_HOSTS.includes(host)) ? `https://${host}/auth/callback` : REDIRECT_URI;
}

app.get('/auth/login', (req, res) => {
  const state = randomBytes(16).toString('hex');
  req.session.oauthState = state;
  req.session.returnTo = req.query.returnTo || '/admin';
  // Remember exactly which redirect_uri we used — the token exchange in /auth/callback
  // must send back this same value (OAuth2 requires an exact match).
  req.session.oauthRedirectUri = redirectUriForRequest(req);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: req.session.oauthRedirectUri,
    scope: 'openid profile email groups',
    state
  });
  res.redirect(`${OIDC_BASE}/authorize?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (state !== req.session.oauthState) return res.status(400).send('Invalid state');
    const redirectUri = req.session.oauthRedirectUri || REDIRECT_URI;

    const tokenRes = await fetch(`${OIDC_BASE}/api/oidc/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: redirectUri
      })
    });
    const tokens = await tokenRes.json();
    const userRes = await fetch(`${OIDC_BASE}/api/oidc/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const profile = await userRes.json();

    // Map Pocket ID groups to roles
    const groups = profile.groups || [];
    let role = 'viewer';
    if (groups.includes('clinic-admin')) role = 'admin';
    else if (groups.includes('clinic-creator')) role = 'creator';

    // Upsert user — update role if it comes from a group, preserve manual role overrides
    const existing = db.prepare('SELECT * FROM users WHERE oidc_sub=?').get(profile.sub);
    if (existing) {
      // Only update role from groups if groups are present — allows manual role override when no groups set
      const newRole = groups.length > 0 ? role : existing.role;
      db.prepare(`
        UPDATE users SET email=?, name=?, role=? WHERE oidc_sub=?
      `).run(profile.email, profile.name || profile.preferred_username, newRole, profile.sub);
    } else {
      db.prepare(`
        INSERT INTO users (oidc_sub, email, name, role) VALUES (?, ?, ?, ?)
      `).run(profile.sub, profile.email, profile.name || profile.preferred_username, role);
    }

    const user = db.prepare('SELECT * FROM users WHERE oidc_sub=?').get(profile.sub);
    req.session.user = user;
    res.redirect(req.session.returnTo || '/admin');
  } catch (e) {
    console.error('Auth error:', e);
    res.status(500).send('Authentication failed');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ── API: PRESENTATIONS ────────────────────────────────────────
// List all public presentations (for landing page)
app.get('/api/presentations', (req, res) => {
  const rows = db.prepare(`
    SELECT id, slug, title, description, is_public, created_at, updated_at
    FROM presentations WHERE is_public=1 ORDER BY updated_at DESC
  `).all();
  res.json(rows);
});

// Get single presentation metadata (no auth needed for public)
app.get('/api/presentations/:slug', (req, res) => {
  const p = db.prepare('SELECT * FROM presentations WHERE slug=?').get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Not found' });
  // Never return password hash
  const { password_hash, ...safe } = p;
  res.json({ ...safe, has_password: !!password_hash });
});

// Verify presentation password
app.post('/api/presentations/:slug/verify', (req, res) => {
  const p = db.prepare('SELECT * FROM presentations WHERE slug=?').get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (!p.password_hash) return res.json({ ok: true });
  const hash = hashPassword(req.body.password);
  if (hash !== p.password_hash) return res.status(401).json({ error: 'Wrong password' });
  // Store unlocked presentations in session
  if (!req.session.unlocked) req.session.unlocked = [];
  if (!req.session.unlocked.includes(req.params.slug)) req.session.unlocked.push(req.params.slug);
  req.session.save(err => {
    if (err) return res.status(500).json({ error: 'Session error' });
    res.json({ ok: true, redirect: `/p/${req.params.slug}` });
  });
});

// Get slides for a presentation
app.get('/api/presentations/:slug/slides', (req, res) => {
  const p = db.prepare('SELECT * FROM presentations WHERE slug=?').get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Not found' });
  // Enforce password: admins/creators bypass; others must have unlocked via session
  const isPrivileged = ['admin','creator'].includes(req.session?.user?.role);
  if (p.password_hash && !isPrivileged) {
    const unlocked = req.session?.unlocked || [];
    if (!unlocked.includes(req.params.slug)) {
      return res.status(401).json({ error: 'Password required' });
    }
  }
  const slides = db.prepare('SELECT * FROM slides WHERE presentation_id=? ORDER BY position').all(p.id);
  res.json(slides.map(s => ({ ...s, data: JSON.parse(s.data || '{}') })));
});

// Save slides (editor only)
app.put('/api/presentations/:slug/slides', requireEditor, (req, res) => {
  const p = db.prepare('SELECT * FROM presentations WHERE slug=?').get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const slides = req.body.slides;
  const saveSlides = db.transaction((slides) => {
    db.prepare('DELETE FROM slides WHERE presentation_id=?').run(p.id);
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      db.prepare(`
        INSERT INTO slides (presentation_id, position, type, title, data)
        VALUES (?, ?, ?, ?, ?)
      `).run(p.id, i, s.type, s.title || '', JSON.stringify(s.data || {}));
    }
    db.prepare('UPDATE presentations SET updated_at=unixepoch() WHERE id=?').run(p.id);
  });
  saveSlides(slides);
  res.json({ ok: true });
});

// Create presentation (admin only)
app.post('/api/presentations', requireAdmin, (req, res) => {
  const { title, description, password, is_public, slug } = req.body;
  const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const hash = password ? hashPassword(password) : null;
  try {
    const result = db.prepare(`
      INSERT INTO presentations (slug, title, description, password_hash, is_public, owner_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(finalSlug, title, description || '', hash, is_public ? 1 : 0, req.session.user?.id);
    res.json({ ok: true, id: result.lastInsertRowid, slug: finalSlug });
  } catch (e) {
    res.status(400).json({ error: 'Slug already exists' });
  }
});

// Update presentation metadata
app.patch('/api/presentations/:slug', requireEditor, (req, res) => {
  const p = db.prepare('SELECT * FROM presentations WHERE slug=?').get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const { title, description, password, is_public } = req.body;
  const hash = password ? hashPassword(password) : p.password_hash;
  db.prepare(`
    UPDATE presentations SET title=?, description=?, password_hash=?, is_public=?, updated_at=unixepoch()
    WHERE id=?
  `).run(title || p.title, description ?? p.description, hash, is_public !== undefined ? (is_public ? 1 : 0) : p.is_public, p.id);
  res.json({ ok: true });
});

// Delete presentation
app.delete('/api/presentations/:slug', requireAdmin, (req, res) => {
  const p = db.prepare('SELECT * FROM presentations WHERE slug=?').get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM presentations WHERE id=?').run(p.id);
  res.json({ ok: true });
});

// ── API: VIDEOS ───────────────────────────────────────────────
// List videos (shared + this presentation's private)
app.get('/api/presentations/:slug/videos', (req, res) => {
  const p = db.prepare('SELECT * FROM presentations WHERE slug=?').get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const videos = db.prepare(`
    SELECT * FROM videos WHERE scope='shared' OR presentation_id=?
    ORDER BY created_at DESC
  `).all(p.id);
  res.json(videos.map(v => ({ ...v, url: videoUrl(v, req.params.slug) })));
});

// List shared videos only (admin)
app.get('/api/videos/shared', requireAdmin, (req, res) => {
  const videos = db.prepare("SELECT * FROM videos WHERE scope='shared' ORDER BY created_at DESC").all();
  res.json(videos.map(v => ({ ...v, url: videoUrl(v) })));
});

// Upload shared video directly (admin)
app.post('/api/videos/shared', requireAdmin, upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const result = db.prepare(`
    INSERT INTO videos (filename, original_name, size, scope, presentation_id, uploaded_by)
    VALUES (?, ?, ?, 'shared', NULL, ?)
  `).run(req.file.filename, req.file.originalname, req.file.size, req.session.user?.id);
  res.json({ ok: true, id: result.lastInsertRowid, filename: req.file.filename });
});

// Upload video
app.post('/api/presentations/:slug/videos', requireEditor, upload.single('video'), (req, res) => {
  const p = db.prepare('SELECT * FROM presentations WHERE slug=?').get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const scope = req.body.scope || 'private';
  const result = db.prepare(`
    INSERT INTO videos (filename, original_name, size, scope, presentation_id, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.file.filename, req.file.originalname, req.file.size, scope, scope === 'private' ? p.id : null, req.session.user?.id);
  res.json({ ok: true, id: result.lastInsertRowid, filename: req.file.filename, scope });
});

// Stream video
app.get('/videos/:scope/:filename', (req, res) => {
  const { scope, filename } = req.params;
  const filePath = join(VIDEO_DIR, scope === 'shared' ? 'shared' : `presentations/${scope}`, filename);
  if (!existsSync(filePath)) return res.status(404).send('Not found');
  res.sendFile(filePath);
});

// Stream video by presentation slug
app.get('/videos/p/:slug/:filename', (req, res) => {
  const filePath = join(VIDEO_DIR, 'presentations', req.params.slug, req.params.filename);
  if (!existsSync(filePath)) return res.status(404).send('Not found');
  res.sendFile(filePath);
});

// Scan shared folder for unregistered videos
app.post('/api/videos/scan', requireAdmin, (req, res) => {
  const sharedDir = join(VIDEO_DIR, 'shared');
  const videoExts = ['.mp4', '.mov', '.mkv', '.avi', '.m4v', '.wmv'];
  let added = 0;
  try {
    mkdirSync(sharedDir, { recursive: true });
    const files = readdirSync(sharedDir);
    files.forEach(filename => {
      const ext = extname(filename).toLowerCase();
      if (!videoExts.includes(ext)) return;
      const existing = db.prepare("SELECT id FROM videos WHERE filename=? AND scope='shared'").get(filename);
      if (existing) return;
      const size = statSync(join(sharedDir, filename)).size;
      db.prepare(`INSERT INTO videos (filename, original_name, size, scope, presentation_id, uploaded_by) VALUES (?, ?, ?, 'shared', NULL, NULL)`)
        .run(filename, filename, size);
      added++;
    });
    res.json({ ok: true, added, message: added > 0 ? `Found and registered ${added} new clip${added > 1 ? 's' : ''}` : 'No new clips found' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Sync the shared library from Bunny.net Stream
app.post('/api/videos/bunny-sync', requireAdmin, async (req, res) => {
  if (!BUNNY_LIBRARY_ID || !BUNNY_API_KEY || !BUNNY_PULL_ZONE) {
    return res.status(400).json({ error: 'Bunny Stream is not configured — set BUNNY_LIBRARY_ID, BUNNY_API_KEY, and BUNNY_PULL_ZONE in .env' });
  }
  try {
    // 1) Pull the full video list from Bunny, paginating.
    const itemsPerPage = 100;
    let page = 1, totalItems = Infinity;
    const bunnyVideos = [];
    while ((page - 1) * itemsPerPage < totalItems) {
      const r = await fetch(
        `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos?page=${page}&itemsPerPage=${itemsPerPage}&orderBy=date`,
        { headers: { AccessKey: BUNNY_API_KEY, accept: 'application/json' } }
      );
      if (!r.ok) throw new Error(`Bunny API error (list): ${r.status}`);
      const data = await r.json();
      bunnyVideos.push(...(data.items || []));
      totalItems = data.totalItems ?? bunnyVideos.length;
      page++;
    }

    // 2) For each finished video, probe candidate MP4 fallback URLs and use whichever
    // resolution actually exists — MP4 fallback is only generated for videos uploaded
    // after the library setting was turned on, so this can't be assumed from metadata.
    const seenGuids = new Set();
    let added = 0, updated = 0, skipped = [];
    for (const bv of bunnyVideos) {
      if (bv.status !== 4) continue; // not finished processing yet
      seenGuids.add(bv.guid);

      let playbackUrl = null;
      if (bv.hasMP4Fallback) {
        const probes = await Promise.all(BUNNY_MP4_RESOLUTIONS.map(async (height) => {
          const url = `https://${BUNNY_PULL_ZONE}/${bv.guid}/play_${height}p.mp4`;
          try {
            const hr = await fetch(url, { method: 'HEAD' });
            return hr.ok ? { height, url } : null;
          } catch (e) { return null; }
        }));
        const best = probes.filter(Boolean).sort((a, b) => b.height - a.height)[0];
        if (best) playbackUrl = best.url;
      }
      if (!playbackUrl) { skipped.push(bv.title || bv.guid); continue; }

      const existing = db.prepare('SELECT id FROM videos WHERE bunny_video_id=?').get(bv.guid);
      if (existing) {
        db.prepare(`UPDATE videos SET original_name=?, size=?, playback_url=?, duration_sec=? WHERE id=?`)
          .run(bv.title || bv.guid, bv.storageSize || 0, playbackUrl, bv.length || 0, existing.id);
        updated++;
      } else {
        db.prepare(`
          INSERT INTO videos (filename, original_name, size, scope, presentation_id, uploaded_by, provider, bunny_video_id, playback_url, duration_sec)
          VALUES (?, ?, ?, 'shared', NULL, ?, 'bunny', ?, ?, ?)
        `).run(bv.guid, bv.title || bv.guid, bv.storageSize || 0, req.session.user?.id, bv.guid, playbackUrl, bv.length || 0);
        added++;
      }
    }

    // 3) Drop local rows for Bunny videos that no longer exist in the library.
    const existingBunnyRows = db.prepare("SELECT id, bunny_video_id FROM videos WHERE provider='bunny'").all();
    let removed = 0;
    for (const row of existingBunnyRows) {
      if (!seenGuids.has(row.bunny_video_id)) {
        db.prepare('DELETE FROM videos WHERE id=?').run(row.id);
        removed++;
      }
    }

    res.json({ ok: true, added, updated, removed, skipped });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete video
app.delete('/api/videos/:id', requireEditor, (req, res) => {
  const v = db.prepare('SELECT * FROM videos WHERE id=?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Not found' });
  try {
    const dir = v.scope === 'shared' ? 'shared' : `presentations/${v.presentation_id}`;
    unlinkSync(join(VIDEO_DIR, dir, v.filename));
  } catch (e) { /* file may already be gone */ }
  db.prepare('DELETE FROM videos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: USERS (admin) ────────────────────────────────────────
app.get('/api/users', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC').all());
});

app.patch('/api/users/:id/role', requireAdmin, (req, res) => {
  db.prepare('UPDATE users SET role=? WHERE id=?').run(req.body.role, req.params.id);
  res.json({ ok: true });
});

// ── API: QUIZZES ────────────────────────────────────────────────
// List all public quizzes (for landing page)
app.get('/api/quizzes', (req, res) => {
  const rows = db.prepare(`
    SELECT id, slug, title, description, is_public, created_at, updated_at
    FROM quizzes WHERE is_public=1 ORDER BY updated_at DESC
  `).all();
  res.json(rows);
});

// Get single quiz metadata (no auth — needed by the public voter page too)
app.get('/api/quizzes/:slug', (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  res.json(q);
});

// Create quiz (admin only)
app.post('/api/quizzes', requireAdmin, (req, res) => {
  const { title, description, slug } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  try {
    const result = db.prepare(`
      INSERT INTO quizzes (slug, title, description, owner_id)
      VALUES (?, ?, ?, ?)
    `).run(finalSlug, title, description || '', req.session.user?.id);
    res.json({ ok: true, id: result.lastInsertRowid, slug: finalSlug });
  } catch (e) {
    res.status(400).json({ error: 'Slug already exists' });
  }
});

// Update quiz metadata
app.patch('/api/quizzes/:slug', requireEditor, (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const { title, description, is_public } = req.body;
  db.prepare(`
    UPDATE quizzes SET title=?, description=?, is_public=?, updated_at=unixepoch() WHERE id=?
  `).run(title ?? q.title, description ?? q.description, is_public !== undefined ? (is_public ? 1 : 0) : q.is_public, q.id);
  res.json({ ok: true });
});

// Delete quiz
app.delete('/api/quizzes/:slug', requireAdmin, (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM quizzes WHERE id=?').run(q.id);
  res.json({ ok: true });
});

// Get questions (editor only — options/correct answer are authoring data)
app.get('/api/quizzes/:slug/questions', requireEditor, (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const questions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY position').all(q.id);
  res.json(questions.map(qq => ({ ...qq, options: JSON.parse(qq.options || '[]') })));
});

// Save questions (whole-array replace, mirrors the slides save pattern). Ends any
// live session, since old question ids (and their votes) no longer exist after this.
app.put('/api/quizzes/:slug/questions', requireEditor, (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const questions = req.body.questions || [];
  const save = db.transaction((questions) => {
    db.prepare('DELETE FROM quiz_questions WHERE quiz_id=?').run(q.id);
    for (let i = 0; i < questions.length; i++) {
      const qq = questions[i];
      const correctIndex = (qq.correct_index === null || qq.correct_index === undefined || qq.correct_index === '')
        ? null : qq.correct_index;
      db.prepare(`
        INSERT INTO quiz_questions (quiz_id, position, question_text, options, correct_index)
        VALUES (?, ?, ?, ?, ?)
      `).run(q.id, i, qq.question_text || '', JSON.stringify(qq.options || []), correctIndex);
    }
    db.prepare('UPDATE quizzes SET updated_at=unixepoch(), current_question_id=NULL, results_revealed=0 WHERE id=?').run(q.id);
  });
  save(questions);
  res.json({ ok: true });
});

// Start a new live session: wipes prior votes and puts the first question live.
app.post('/api/quizzes/:slug/start', requireEditor, (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const questions = db.prepare('SELECT id FROM quiz_questions WHERE quiz_id=? ORDER BY position').all(q.id);
  if (!questions.length) return res.status(400).json({ error: 'Add at least one question first' });
  const ids = questions.map(x => x.id);
  const start = db.transaction(() => {
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM quiz_votes WHERE question_id IN (${placeholders})`).run(...ids);
    db.prepare('UPDATE quizzes SET current_question_id=?, results_revealed=0, answer_revealed=0 WHERE id=?').run(ids[0], q.id);
  });
  start();
  res.json({ ok: true });
});

// Move to the next/previous question. Does not touch votes.
app.post('/api/quizzes/:slug/goto', requireEditor, (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const questions = db.prepare('SELECT id FROM quiz_questions WHERE quiz_id=? ORDER BY position').all(q.id);
  if (!questions.length) return res.status(400).json({ error: 'No questions' });
  const ids = questions.map(x => x.id);
  let idx = ids.indexOf(q.current_question_id);
  if (idx === -1) idx = 0;
  if (req.body.direction === 'next') idx = Math.min(ids.length - 1, idx + 1);
  else if (req.body.direction === 'prev') idx = Math.max(0, idx - 1);
  db.prepare('UPDATE quizzes SET current_question_id=?, results_revealed=0, answer_revealed=0 WHERE id=?').run(ids[idx], q.id);
  res.json({ ok: true, currentQuestionId: ids[idx], position: idx + 1, total: ids.length });
});

// Toggle (or explicitly set) whether the vote tally is revealed for the current
// question. Hiding the tally also hides the correct-answer reveal (see below) — it
// wouldn't make sense to leave that showing on its own.
app.post('/api/quizzes/:slug/reveal', requireEditor, (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const revealed = req.body.revealed !== undefined ? (req.body.revealed ? 1 : 0) : (q.results_revealed ? 0 : 1);
  const answerRevealed = revealed ? q.answer_revealed : 0;
  db.prepare('UPDATE quizzes SET results_revealed=?, answer_revealed=? WHERE id=?').run(revealed, answerRevealed, q.id);
  res.json({ ok: true, revealed: !!revealed, answerRevealed: !!answerRevealed });
});

// Toggle (or explicitly set) whether the CORRECT ANSWER is highlighted, separate from
// (and only available after) the vote tally reveal above. This is what keeps the
// presenter's own (audience-visible) screen from spoiling the answer while voting or
// while just showing the tally.
app.post('/api/quizzes/:slug/reveal-answer', requireEditor, (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  if (!q.results_revealed) return res.status(409).json({ error: 'Show results before revealing the correct answer' });
  const question = db.prepare('SELECT * FROM quiz_questions WHERE id=?').get(q.current_question_id);
  if (!question || question.correct_index === null) return res.status(400).json({ error: 'This question has no correct answer to reveal' });
  const answerRevealed = req.body.revealed !== undefined ? (req.body.revealed ? 1 : 0) : (q.answer_revealed ? 0 : 1);
  db.prepare('UPDATE quizzes SET answer_revealed=? WHERE id=?').run(answerRevealed, q.id);
  res.json({ ok: true, answerRevealed: !!answerRevealed });
});

// End the live session — back to lobby, voters see "waiting for host".
app.post('/api/quizzes/:slug/end', requireEditor, (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE quizzes SET current_question_id=NULL, results_revealed=0, answer_revealed=0 WHERE id=?').run(q.id);
  res.json({ ok: true });
});

// Public live state — polled by the voter page. Hides vote counts and the correct
// answer until the host reveals them; optionally echoes back the caller's own vote.
app.get('/api/quizzes/:slug/live', (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const questions = db.prepare('SELECT id FROM quiz_questions WHERE quiz_id=? ORDER BY position').all(q.id);
  const total = questions.length;

  if (!q.current_question_id) {
    return res.json({ live: false, title: q.title, total });
  }
  const position = questions.findIndex(x => x.id === q.current_question_id);
  const question = db.prepare('SELECT * FROM quiz_questions WHERE id=?').get(q.current_question_id);
  const options = JSON.parse(question.options || '[]');
  const payload = {
    live: true,
    questionId: question.id,
    text: question.question_text,
    options,
    position: position + 1,
    total,
    revealed: !!q.results_revealed,
    hasCorrectAnswer: question.correct_index !== null
  };
  if (req.query.voterId) {
    const mine = db.prepare('SELECT option_index FROM quiz_votes WHERE question_id=? AND voter_id=?')
      .get(question.id, req.query.voterId);
    payload.yourVote = mine ? mine.option_index : null;
  }
  if (q.results_revealed) {
    const rows = db.prepare('SELECT option_index, COUNT(*) as n FROM quiz_votes WHERE question_id=? GROUP BY option_index').all(question.id);
    const counts = options.map((_, i) => rows.find(r => r.option_index === i)?.n || 0);
    payload.counts = counts;
    payload.total_votes = counts.reduce((a, b) => a + b, 0);
    // Correct answer is a second, separate reveal step — never sent until the host
    // has explicitly revealed it, even though the tally is already showing.
    if (q.answer_revealed) payload.correct_index = question.correct_index;
  }
  res.json(payload);
});

// Host-facing live state — always includes live vote counts (even before the tally is
// revealed to the audience, so the host can gauge participation). The correct answer
// itself is redacted until answer_revealed, same as the voter-facing endpoint — the
// presenter view is shown on a projector, so it's just as public as the voter's screen.
app.get('/api/quizzes/:slug/host-state', requireEditor, (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const questions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY position').all(q.id);
  const position = questions.findIndex(x => x.id === q.current_question_id);
  const current = position >= 0 ? questions[position] : null;
  let counts = null, totalVotes = 0, currentSafe = null;
  if (current) {
    const options = JSON.parse(current.options || '[]');
    const rows = db.prepare('SELECT option_index, COUNT(*) as n FROM quiz_votes WHERE question_id=? GROUP BY option_index').all(current.id);
    counts = options.map((_, i) => rows.find(r => r.option_index === i)?.n || 0);
    totalVotes = counts.reduce((a, b) => a + b, 0);
    currentSafe = {
      id: current.id,
      question_text: current.question_text,
      options,
      hasCorrectAnswer: current.correct_index !== null,
      correct_index: q.answer_revealed ? current.correct_index : null
    };
  }
  res.json({
    quiz: q,
    total: questions.length,
    position: position >= 0 ? position + 1 : 0,
    current: currentSafe,
    counts, totalVotes,
    revealed: !!q.results_revealed,
    answerRevealed: !!q.answer_revealed
  });
});

// Cast or change a vote. Public — no auth. One vote per (question, voterId); only
// accepted while that question is the live one and results aren't revealed yet.
app.post('/api/quizzes/:slug/vote', (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE slug=?').get(req.params.slug);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const { questionId, voterId, optionIndex } = req.body;
  if (!voterId || typeof optionIndex !== 'number') return res.status(400).json({ error: 'Missing voterId or optionIndex' });
  if (questionId !== q.current_question_id) return res.status(409).json({ error: 'This question is no longer live' });
  if (q.results_revealed) return res.status(409).json({ error: 'Voting is closed for this question' });
  const question = db.prepare('SELECT * FROM quiz_questions WHERE id=? AND quiz_id=?').get(questionId, q.id);
  if (!question) return res.status(404).json({ error: 'Question not found' });
  const options = JSON.parse(question.options || '[]');
  if (optionIndex < 0 || optionIndex >= options.length) return res.status(400).json({ error: 'Invalid option' });
  db.prepare(`
    INSERT INTO quiz_votes (question_id, voter_id, option_index) VALUES (?, ?, ?)
    ON CONFLICT(question_id, voter_id) DO UPDATE SET option_index=excluded.option_index
  `).run(questionId, voterId, optionIndex);
  res.json({ ok: true });
});

// ── API: SESSION ──────────────────────────────────────────────
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, user: req.session.user, unlocked: req.session.unlocked || [] });
});

// ── STATIC + PAGE ROUTES ──────────────────────────────────────
app.use('/assets', express.static(join(__dirname, 'public', 'assets')));

// Landing page
app.get('/', (req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));

// Standalone volleyball rotation trainer (not tied to a presentation)
app.get('/rotation', (req, res) => res.sendFile(join(__dirname, 'public', 'rotation', 'index.html')));

// Viewer
app.get('/p/:slug', (req, res) => res.sendFile(join(__dirname, 'public', 'viewer', 'index.html')));

// Editor — requires Pocket ID session
app.get('/edit/:slug', (req, res) => {
  if (!req.session.user || !['admin', 'creator'].includes(req.session.user.role)) {
    return res.redirect(`/auth/login?returnTo=/edit/${req.params.slug}`);
  }
  res.sendFile(join(__dirname, 'public', 'edit', 'index.html'));
});

// Quiz question editor — requires Pocket ID session
app.get('/quiz/:slug/edit', (req, res) => {
  if (!req.session.user || !['admin', 'creator'].includes(req.session.user.role)) {
    return res.redirect(`/auth/login?returnTo=/quiz/${req.params.slug}/edit`);
  }
  res.sendFile(join(__dirname, 'public', 'quiz', 'edit.html'));
});

// Quiz host/present view — requires Pocket ID session
app.get('/quiz/:slug/present', (req, res) => {
  if (!req.session.user || !['admin', 'creator'].includes(req.session.user.role)) {
    return res.redirect(`/auth/login?returnTo=/quiz/${req.params.slug}/present`);
  }
  res.sendFile(join(__dirname, 'public', 'quiz', 'present.html'));
});

// Quiz voter page — public, no auth (this is what the QR code points to)
app.get('/quiz/:slug/vote', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'quiz', 'vote.html'));
});

// Admin dashboard
app.get('/admin', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/auth/login?returnTo=/admin');
  }
  res.sendFile(join(__dirname, 'public', 'admin', 'index.html'));
});

// ── START ─────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`Clinic server running on port ${PORT}`));
