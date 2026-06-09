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
`);

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

app.get('/auth/login', (req, res) => {
  const state = randomBytes(16).toString('hex');
  req.session.oauthState = state;
  req.session.returnTo = req.query.returnTo || '/admin';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email groups',
    state
  });
  res.redirect(`${OIDC_BASE}/authorize?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (state !== req.session.oauthState) return res.status(400).send('Invalid state');

    const tokenRes = await fetch(`${OIDC_BASE}/api/oidc/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI
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
  res.json(videos);
});

// List shared videos only (admin)
app.get('/api/videos/shared', requireAdmin, (req, res) => {
  res.json(db.prepare("SELECT * FROM videos WHERE scope='shared' ORDER BY created_at DESC").all());
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

// ── API: SESSION ──────────────────────────────────────────────
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, user: req.session.user, unlocked: req.session.unlocked || [] });
});

// ── STATIC + PAGE ROUTES ──────────────────────────────────────
app.use('/assets', express.static(join(__dirname, 'public', 'assets')));

// Landing page
app.get('/', (req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));

// Viewer
app.get('/p/:slug', (req, res) => res.sendFile(join(__dirname, 'public', 'viewer', 'index.html')));

// Editor — requires Pocket ID session
app.get('/edit/:slug', (req, res) => {
  if (!req.session.user || !['admin', 'creator'].includes(req.session.user.role)) {
    return res.redirect(`/auth/login?returnTo=/edit/${req.params.slug}`);
  }
  res.sendFile(join(__dirname, 'public', 'edit', 'index.html'));
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
