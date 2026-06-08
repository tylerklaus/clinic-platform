// Clinic Platform — Slide Renderer (shared between viewer and editor)

const FPS = 29.97;
const NAVY = '#1B1B2F';
const GOLD = '#F26522';

/* ── SLIDE RENDERER ── */

// Design system constants (resolved at render time from sc)
// Layout: every slide has a 10px left orange stripe, 64px navy top bar, consistent padding
// Typography: eyebrow 11px/700/tracking, heading 36-80px/800, body 18-22px/400
// Colors: NAVY bg or white bg, GOLD accents, white text on dark, #1a1a1a on light

function topBar(sc, labelText, rightEl) {
  const bar = el('div',`position:absolute;top:0;left:0;right:0;height:${64*sc}px;background:${NAVY};display:flex;align-items:center;padding:0 ${32*sc}px;gap:${14*sc}px;`);
  const stripe = el('div',`width:${10*sc}px;height:${36*sc}px;background:${GOLD};border-radius:${2*sc}px;flex-shrink:0;`);
  const lbl = el('span',`font-size:${11*sc}px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:${3*sc}px;text-transform:uppercase;`);
  lbl.textContent = labelText;
  bar.append(stripe, lbl);
  if (rightEl) { rightEl.style.marginLeft = 'auto'; bar.appendChild(rightEl); }
  return bar;
}

function pill(sc, text, dark) {
  const p = el('span',`font-size:${11*sc}px;font-weight:700;padding:${4*sc}px ${14*sc}px;border-radius:${20*sc}px;white-space:nowrap;`);
  p.textContent = text;
  if (dark) { p.style.background = GOLD; p.style.color = '#fff'; }
  else { p.style.border = `1px solid rgba(242,101,34,0.5)`; p.style.color = GOLD; }
  return p;
}

function noteFooter(sc, label, text) {
  const bar = el('div',`position:absolute;left:0;right:0;bottom:0;height:${72*sc}px;background:#fff;border-top:${3*sc}px solid ${GOLD};display:flex;align-items:center;padding:0 ${32*sc}px;gap:${14*sc}px;`);
  const dot = el('div',`width:${8*sc}px;height:${8*sc}px;border-radius:50%;background:${GOLD};flex-shrink:0;`);
  const right = el('div',`flex:1;min-width:0;`);
  const lbl = el('div',`font-size:${10*sc}px;font-weight:700;color:${GOLD};letter-spacing:${2*sc}px;text-transform:uppercase;margin-bottom:${2*sc}px;`);
  lbl.textContent = label || "Officials' Note";
  const txt = el('div',`font-size:${13*sc}px;color:#666;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`);
  txt.textContent = text || 'Add a key takeaway for officials here.';
  right.append(lbl, txt);
  bar.append(dot, right);
  return bar;
}

function renderSlideContent(slide, container) {
  container.innerHTML = '';
  const w = container.offsetWidth || parseInt(document.getElementById('slide-frame').style.width) || 960;
  const h = container.offsetHeight || parseInt(document.getElementById('slide-frame').style.height) || 540;
  const sc = w / 960;
  const d = slide.data || {};

  const s = document.createElement('div');
  s.style.cssText = `width:${w}px;height:${h}px;position:relative;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif;`;

  // ── TITLE ─────────────────────────────────────────────────────────────
  if (slide.type === 'title') {
    s.style.background = NAVY;
    // Left stripe
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${28*sc}px;background:${GOLD};`));
    // Geometric circles top-right
    s.appendChild(el('div',`position:absolute;right:${-90*sc}px;top:${-90*sc}px;width:${400*sc}px;height:${400*sc}px;border-radius:50%;border:${6*sc}px solid rgba(242,101,34,0.2);`));
    s.appendChild(el('div',`position:absolute;right:${-20*sc}px;top:${-20*sc}px;width:${240*sc}px;height:${240*sc}px;border-radius:50%;border:${5*sc}px solid rgba(242,101,34,0.14);`));
    s.appendChild(el('div',`position:absolute;right:${50*sc}px;top:${50*sc}px;width:${120*sc}px;height:${120*sc}px;border-radius:50%;border:${3*sc}px solid rgba(242,101,34,0.08);`));
    const L = 60;
    if (titleLogoSrc) {
      // Logo-dominant layout: logo takes right ~55% of slide, text left column
      const logoWrap = el('div',`position:absolute;right:${40*sc}px;top:${50*sc}px;bottom:${50*sc}px;width:${360*sc}px;display:flex;align-items:center;justify-content:center;`);
      const img = document.createElement('img');
      img.src = titleLogoSrc;
      img.style.cssText = `max-width:${340*sc}px;max-height:${h - 120*sc}px;width:auto;height:auto;object-fit:contain;`;
      logoWrap.appendChild(img);
      s.appendChild(logoWrap);
      // Subtle vertical divider
      s.appendChild(el('div',`position:absolute;right:${408*sc}px;top:${60*sc}px;bottom:${60*sc}px;width:${1*sc}px;background:rgba(255,255,255,0.08);`));
      // Left text column
      const ew = el('div',`position:absolute;left:${L*sc}px;top:${40*sc}px;right:${428*sc}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`);
      ew.textContent = d.eyebrow || 'IHSA · Boys Volleyball';
      const tt = el('div',`position:absolute;left:${L*sc}px;top:${h*0.20}px;right:${428*sc}px;font-size:${54*sc}px;font-weight:800;color:#fff;line-height:0.95;letter-spacing:${-0.5*sc}px;`);
      tt.style.wordBreak='break-word';
      tt.textContent = d.title || slide.title;
      const divL = el('div',`position:absolute;left:${L*sc}px;bottom:${108*sc}px;width:${40*sc}px;height:${4*sc}px;background:${GOLD};border-radius:2px;`);
      const sub = el('div',`position:absolute;left:${L*sc}px;bottom:${48*sc}px;right:${428*sc}px;font-size:${16*sc}px;color:rgba(255,255,255,0.4);line-height:1.5;`);
      sub.style.whiteSpace='pre-line';
      sub.textContent = d.subtitle || slide.body || '';
      s.append(ew, tt, divL, sub);
    } else {
      // No logo — full width title layout
      const ew = el('div',`position:absolute;left:${L*sc}px;top:${40*sc}px;font-size:${12*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`);
      ew.textContent = d.eyebrow || 'IHSA · Boys Volleyball';
      const tt = el('div',`position:absolute;left:${L*sc}px;top:${h*0.20}px;right:${140*sc}px;font-size:${78*sc}px;font-weight:800;color:#fff;line-height:0.92;letter-spacing:${-1*sc}px;`);
      tt.style.wordBreak='break-word';
      tt.textContent = d.title || slide.title;
      const div = el('div',`position:absolute;left:${L*sc}px;bottom:${108*sc}px;width:${48*sc}px;height:${4*sc}px;background:${GOLD};border-radius:2px;`);
      const sub = el('div',`position:absolute;left:${L*sc}px;bottom:${48*sc}px;right:${140*sc}px;font-size:${19*sc}px;color:rgba(255,255,255,0.45);line-height:1.5;`);
      sub.style.whiteSpace='pre-line';
      sub.textContent = d.subtitle || slide.body || '';
      s.append(ew, tt, div, sub);
    }

  // ── VIDEO / SCENARIO ──────────────────────────────────────────────────
  } else if (slide.type === 'video') {
    s.style.background = '#EFEFED';
    // Left orange panel
    const panel = el('div',`position:absolute;left:0;top:0;bottom:0;width:${360*sc}px;background:${GOLD};display:flex;flex-direction:column;justify-content:flex-end;padding:${40*sc}px ${36*sc}px;`);
    // Dark notch top of panel
    panel.appendChild(el('div',`position:absolute;top:0;left:0;right:0;height:${5*sc}px;background:rgba(0,0,0,0.2);`));
    const scenLabel = el('div',`font-size:${11*sc}px;font-weight:700;color:rgba(255,255,255,0.65);letter-spacing:${3*sc}px;text-transform:uppercase;margin-bottom:${10*sc}px;`);
    scenLabel.textContent = d.vidTitle || slide.title;
    const bigTxt = el('div',`font-size:${56*sc}px;font-weight:900;color:#fff;line-height:0.88;letter-spacing:${-1*sc}px;text-transform:uppercase;margin-bottom:${24*sc}px;`);
    bigTxt.style.whiteSpace='pre-line';
    bigTxt.textContent = d.panelText || 'You\nMake\nthe\nCall';
    // Bottom pill on panel
    const ctaBadge = el('div',`display:inline-block;background:${NAVY};color:#fff;font-size:${14*sc}px;font-weight:700;padding:${9*sc}px ${22*sc}px;border-radius:${4*sc}px;letter-spacing:${0.3*sc}px;`);
    ctaBadge.textContent = d.vidCta || "What's your call?";
    panel.append(scenLabel, bigTxt, ctaBadge);
    // Right content area
    const eyeLbl = el('div',`position:absolute;left:${392*sc}px;top:${36*sc}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`);
    eyeLbl.textContent = d.vidEyebrow || 'Situation';
    const ruleLine = el('div',`position:absolute;left:${392*sc}px;top:${62*sc}px;right:${32*sc}px;height:${1*sc}px;background:rgba(0,0,0,0.1);`);
    const bodyTxt = el('div',`position:absolute;left:${392*sc}px;top:${82*sc}px;right:${32*sc}px;bottom:${32*sc}px;font-size:${20*sc}px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;overflow:hidden;`);
    bodyTxt.textContent = d.vidBody || slide.body || '';
    s.append(panel, eyeLbl, ruleLine, bodyTxt);

  // ── ANSWER REVEAL ─────────────────────────────────────────────────────
  } else if (slide.type === 'reveal') {
    s.style.background = '#EFEFED';
    // Full-width dark top half
    const darkHalf = el('div',`position:absolute;top:0;left:0;right:0;height:${h*0.48}px;background:${NAVY};`);
    // Left orange stripe on dark half
    darkHalf.appendChild(el('div',`position:absolute;top:0;left:0;width:${10*sc}px;bottom:0;background:${GOLD};`));
    const eyebrow = el('div',`position:absolute;top:${22*sc}px;left:${32*sc}px;font-size:${11*sc}px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:${3*sc}px;text-transform:uppercase;`);
    eyebrow.textContent = d.revEyebrow || 'The Call · Answer';
    const ruling = el('div',`position:absolute;top:${46*sc}px;left:${32*sc}px;right:${32*sc}px;font-size:${54*sc}px;font-weight:800;color:#fff;line-height:0.95;letter-spacing:${-0.5*sc}px;overflow:hidden;`);
    ruling.style.maxHeight = `${130*sc}px`;
    ruling.textContent = d.revRuling || slide.title;
    // Rule pill straddling the boundary
    const rulPill = el('div',`position:absolute;top:${h*0.48 - 16*sc}px;left:${32*sc}px;background:${GOLD};color:#fff;font-size:${11*sc}px;font-weight:700;padding:${4*sc}px ${16*sc}px;border-radius:${20*sc}px;letter-spacing:${0.5*sc}px;`);
    rulPill.textContent = d.revRule || slide.rule || 'NFHS Rule';
    // Explanation text in light area
    const expl = el('div',`position:absolute;left:${32*sc}px;right:${32*sc}px;top:${h*0.48 + 24*sc}px;bottom:${84*sc}px;font-size:${18*sc}px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;overflow:hidden;`);
    expl.textContent = d.revBody || slide.body || '';
    s.append(darkHalf, eyebrow, ruling, rulPill, expl, noteFooter(sc, d.revNoteLabel, d.revNote));

  // ── EMBED / SLIDO ─────────────────────────────────────────────────────
  } else if (slide.type === 'embed') {
    s.style.background = NAVY;
    const bar = topBar(sc, d.embHeader || slide.title || 'Live Poll', null);
    const area = el('div',`position:absolute;left:0;right:0;top:${64*sc}px;bottom:0;display:flex;align-items:center;justify-content:center;`);
    if (d.embHtml) {
      const wrap = el('div',`width:100%;height:100%;`);
      wrap.innerHTML = d.embHtml;
      wrap.querySelectorAll('iframe').forEach(f=>{ f.style.width='100%'; f.style.height=`${h-64*sc}px`; f.style.border='none'; });
      area.appendChild(wrap);
    } else {
      const ph = el('div',`text-align:center;color:rgba(255,255,255,0.3);font-size:${15*sc}px;line-height:2;`);
      ph.innerHTML = 'Paste Slido or embed HTML in the editor';
      area.appendChild(ph);
    }
    s.append(bar, area);

  // ── RULE CHANGE ───────────────────────────────────────────────────────
  } else if (slide.type === 'rulechange') {
    s.style.background = '#EFEFED';
    const rPill = pill(sc, d.rcRule || 'Rule', true);
    s.appendChild(topBar(sc, 'Rule Change', rPill));
    // Heading
    const hd = el('div',`position:absolute;left:${32*sc}px;top:${82*sc}px;right:${32*sc}px;font-size:${32*sc}px;font-weight:800;color:${NAVY};line-height:1.1;`);
    hd.textContent = d.rcHeading || slide.title;
    // Two columns
    const gap = 12*sc, cw = (w - 64*sc - gap) / 2;
    const mk = (left, hdrTxt, bodyTxt, isNew) => {
      const col = el('div',`position:absolute;left:${left}px;top:${142*sc}px;width:${cw}px;bottom:${32*sc}px;background:#fff;border-radius:${8*sc}px;overflow:hidden;${isNew ? `border-top:${4*sc}px solid ${GOLD};` : 'border-top:4px solid #ccc;'}`);
      const ch = el('div',`padding:${10*sc}px ${16*sc}px ${8*sc}px;font-size:${10*sc}px;font-weight:700;letter-spacing:${1.5*sc}px;text-transform:uppercase;color:${isNew ? GOLD : '#999'};`);
      ch.textContent = hdrTxt;
      const cb = el('div',`padding:${14*sc}px ${16*sc}px;font-size:${17*sc}px;color:${isNew?'#111':'#777'};line-height:1.65;white-space:pre-wrap;${isNew?'font-weight:500;':''}`);
      cb.textContent = bodyTxt;
      col.append(ch, cb);
      return col;
    };
    s.append(hd, mk(32*sc, 'Previous', d.rcOld||'', false), mk(32*sc+cw+gap, 'New Rule', d.rcNew||'', true));
    // Arrow between
    const arw = el('div',`position:absolute;left:${32*sc+cw}px;width:${gap}px;top:${142*sc}px;bottom:${32*sc}px;display:flex;align-items:center;justify-content:center;font-size:${22*sc}px;color:${GOLD};font-weight:900;`);
    arw.textContent='→';
    // Bottom note
    const nb = el('div',`position:absolute;left:0;right:0;bottom:0;height:${0}px;`); // replaced by note if present
    if (d.rcNote) {
      const nb2 = el('div',`position:absolute;left:${32*sc}px;bottom:${8*sc}px;font-size:${12*sc}px;color:#999;font-style:italic;`);
      nb2.textContent = d.rcNote;
      s.appendChild(nb2);
    }
    s.appendChild(arw);

  // ── POINTS OF EMPHASIS ────────────────────────────────────────────────
  } else if (slide.type === 'emphasis') {
    s.style.background = NAVY;
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${10*sc}px;background:${GOLD};`));
    const seasonL = el('div',`position:absolute;left:${32*sc}px;top:${30*sc}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`);
    seasonL.textContent = d.emSeason || 'IHSA Boys Volleyball';
    const hd2 = el('div',`position:absolute;left:${32*sc}px;top:${52*sc}px;right:${60*sc}px;font-size:${40*sc}px;font-weight:800;color:#fff;line-height:1;`);
    hd2.textContent = d.emHeader || 'Points of Emphasis';
    s.appendChild(el('div',`position:absolute;left:${32*sc}px;top:${118*sc}px;right:${32*sc}px;height:${1*sc}px;background:rgba(255,255,255,0.1);`));
    const items=[
      [d.em1||'',d.em1d||''],[d.em2||'',d.em2d||''],[d.em3||'',d.em3d||''],[d.em4||'',d.em4d||'']
    ].filter(([t])=>t.trim());
    const avail = h - 140*sc, itemH = Math.min(avail / Math.max(items.length,1), 98*sc);
    items.forEach(([t1,t2],i)=>{
      const row = el('div',`position:absolute;left:${32*sc}px;right:${32*sc}px;top:${128*sc + i*itemH}px;height:${itemH}px;display:flex;align-items:center;gap:${20*sc}px;`);
      const num = el('div',`width:${40*sc}px;height:${40*sc}px;border-radius:${6*sc}px;background:${GOLD};display:flex;align-items:center;justify-content:center;font-size:${18*sc}px;font-weight:800;color:#fff;flex-shrink:0;`);
      num.textContent=String(i+1);
      const right2=el('div',``);
      const rt=el('div',`font-size:${21*sc}px;font-weight:700;color:#fff;line-height:1.15;`);
      rt.textContent=t1;
      right2.appendChild(rt);
      if(t2){const rd=el('div',`font-size:${14*sc}px;color:rgba(255,255,255,0.45);margin-top:${2*sc}px;`);rd.textContent=t2;right2.appendChild(rd);}
      row.append(num,right2);
      s.appendChild(row);
    });
    s.append(seasonL,hd2);

  // ── MECHANICS ─────────────────────────────────────────────────────────
  } else if (slide.type === 'mechanics') {
    s.style.background = '#EFEFED';
    const mPill = d.mechSub ? pill(sc, d.mechSub, false) : null;
    s.appendChild(topBar(sc, d.mechHeader || slide.title, mPill));
    // Diagram box
    const dBox = el('div',`position:absolute;left:${32*sc}px;top:${80*sc}px;width:${368*sc}px;bottom:${32*sc}px;background:#fff;border-radius:${8*sc}px;overflow:hidden;`);
    const mechImg = mechImageSrc[currentSlide];
    if (mechImg) {
      const mi=document.createElement('img');
      mi.src=mechImg;
      mi.style.cssText=`width:100%;height:100%;object-fit:contain;display:block;`;
      dBox.appendChild(mi);
    } else {
      dBox.style.background='#e8e8e4';
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('width',String(Math.round(180*sc)));
      svg.setAttribute('height',String(Math.round(130*sc)));
      svg.setAttribute('viewBox','0 0 180 130');
      svg.style.cssText='display:block;margin:auto;margin-top:30%;';
      svg.innerHTML='<rect x="8" y="8" width="164" height="114" fill="none" stroke="#bbb" stroke-width="2" rx="2"/><line x1="90" y1="8" x2="90" y2="122" stroke="#ccc" stroke-width="1.5"/><line x1="8" y1="45" x2="172" y2="45" stroke="#ddd" stroke-width="1" stroke-dasharray="4"/><line x1="8" y1="85" x2="172" y2="85" stroke="#ddd" stroke-width="1" stroke-dasharray="4"/><circle cx="50" cy="65" r="7" fill="'+GOLD+'" opacity="0.7"/><circle cx="130" cy="65" r="7" fill="'+NAVY+'" opacity="0.6"/>';
      const lbl=el('div',`text-align:center;font-size:${11*sc}px;color:#bbb;margin-top:${8*sc}px;`);
      lbl.textContent='Upload diagram in editor';
      dBox.append(svg,lbl);
    }
    // Points
    const pts=(d.mechPoints||'').split('\n').filter(p=>p.trim());
    const ptArea=el('div',`position:absolute;left:${416*sc}px;right:${32*sc}px;top:${80*sc}px;bottom:${80*sc}px;display:flex;flex-direction:column;justify-content:center;gap:${12*sc}px;`);
    pts.forEach(pt=>{
      const r=el('div',`display:flex;align-items:flex-start;gap:${14*sc}px;`);
      const dot=el('div',`width:${10*sc}px;height:${10*sc}px;border-radius:50%;background:${GOLD};flex-shrink:0;margin-top:${6*sc}px;`);
      const t=el('div',`font-size:${18*sc}px;color:#1a1a1a;line-height:1.5;`);
      t.textContent=pt;
      r.append(dot,t);
      ptArea.appendChild(r);
    });
    s.append(dBox, ptArea, noteFooter(sc, 'Note', d.mechNote||''));

  // ── DISCUSSION ────────────────────────────────────────────────────────
  } else if (slide.type === 'discussion') {
    s.style.background = NAVY;
    // Orange half-circle left edge decoration
    s.appendChild(el('div',`position:absolute;left:${-120*sc}px;top:50%;transform:translateY(-50%);width:${280*sc}px;height:${280*sc}px;border-radius:50%;border:${6*sc}px solid rgba(242,101,34,0.22);`));
    s.appendChild(el('div',`position:absolute;left:${-60*sc}px;top:50%;transform:translateY(-50%);width:${160*sc}px;height:${160*sc}px;border-radius:50%;border:${5*sc}px solid rgba(242,101,34,0.14);`));
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${10*sc}px;background:${GOLD};`));
    // Top label row
    const dRow=el('div',`position:absolute;left:${32*sc}px;top:${32*sc}px;display:flex;align-items:center;gap:${12*sc}px;`);
    const dLbl=el('div',`font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`);
    dLbl.textContent='Discussion';
    dRow.appendChild(dLbl);
    if(d.discTime){const tb=el('div',`font-size:${11*sc}px;padding:${3*sc}px ${12*sc}px;border-radius:${20*sc}px;border:1px solid rgba(242,101,34,0.35);color:rgba(255,255,255,0.45);`);tb.textContent=d.discTime;dRow.appendChild(tb);}
    // Question
    const qEl=el('div',`position:absolute;left:${32*sc}px;right:${80*sc}px;top:${72*sc}px;font-size:${36*sc}px;font-weight:800;color:#fff;line-height:1.18;`);
    qEl.textContent=d.discQ||'Discussion question goes here.';
    // Context
    const ctxEl=el('div',`position:absolute;left:${32*sc}px;right:${80*sc}px;bottom:${36*sc}px;font-size:${15*sc}px;color:rgba(255,255,255,0.4);line-height:1.6;`);
    ctxEl.textContent=d.discCtx||'';
    // Big ? top-right
    const qm=el('div',`position:absolute;right:${28*sc}px;top:${10*sc}px;font-size:${220*sc}px;font-weight:900;color:rgba(242,101,34,0.12);line-height:1;pointer-events:none;`);
    qm.textContent='?';
    s.append(dRow,qEl,ctxEl,qm);

  // ── CASEBOOK ──────────────────────────────────────────────────────────
  } else if (slide.type === 'casebook') {
    s.style.background = '#EFEFED';
    const phase=(container===document.getElementById('slide-inner'))?cbPhase:1;
    const cPill = d.cbCite ? pill(sc, d.cbCite, false) : null;
    s.appendChild(topBar(sc, phase===0 ? 'Casebook · Situation' : 'Casebook · Ruling', cPill));
    if (phase===0) {
      const sb=el('div',`position:absolute;left:${32*sc}px;top:${80*sc}px;right:${32*sc}px;bottom:${64*sc}px;background:#fff;border-radius:${8*sc}px;overflow:hidden;`);
      const sh=el('div',`padding:${12*sc}px ${20*sc}px;background:#f0f0ee;font-size:${10*sc}px;font-weight:700;color:#aaa;letter-spacing:${2*sc}px;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;`);
      const shtxt=el('span','');shtxt.textContent='Situation';
      const hint=el('span',`font-size:${11*sc}px;color:#ccc;font-weight:400;letter-spacing:0;text-transform:none;`);hint.textContent='Advance for ruling →';
      sh.append(shtxt,hint);
      const st=el('div',`padding:${28*sc}px ${32*sc}px;font-size:${22*sc}px;color:#222;line-height:1.7;white-space:pre-wrap;`);
      st.textContent=d.cbSit||'';
      sb.append(sh,st);
      const hb=el('div',`position:absolute;left:0;right:0;bottom:0;height:${56*sc}px;background:${NAVY};display:flex;align-items:center;justify-content:center;`);
      const hbTxt=el('span',`font-size:${13*sc}px;color:rgba(255,255,255,0.3);letter-spacing:${0.5*sc}px;`);
      hbTxt.textContent='What is the ruling?';
      hb.appendChild(hbTxt);
      s.append(sb,hb);
    } else {
      const cw2=(w-80*sc)/2;
      const mkCol=(left,hdrT,body2,isRuling)=>{
        const col=el('div',`position:absolute;left:${left}px;top:${80*sc}px;width:${cw2}px;bottom:${72*sc}px;background:#fff;border-radius:${8*sc}px;overflow:hidden;${isRuling?`border-top:${4*sc}px solid ${GOLD}`:''}`);
        const ch=el('div',`padding:${10*sc}px ${16*sc}px;font-size:${10*sc}px;font-weight:700;letter-spacing:${2*sc}px;text-transform:uppercase;color:${isRuling?GOLD:'#aaa'};background:${isRuling?'rgba(242,101,34,0.06)':'#f5f5f3'};`);
        ch.textContent=hdrT;
        const cb2=el('div',`padding:${16*sc}px;font-size:${17*sc}px;color:${isRuling?'#111':'#666'};line-height:1.65;white-space:pre-wrap;${isRuling?'font-weight:500;':''}`);
        cb2.textContent=body2;
        col.append(ch,cb2);
        return col;
      };
      s.append(mkCol(32*sc,'Situation',d.cbSit||'',false), mkCol(32*sc+cw2+16*sc,'Ruling',d.cbRuling||'',true));
      s.appendChild(noteFooter(sc, 'Key Principle', d.cbPrinciple||''));
    }

  // ── STAT ──────────────────────────────────────────────────────────────
  } else if (slide.type === 'stat') {
    s.style.background = NAVY;
    // Decorative right panel
    const rPanel=el('div',`position:absolute;right:0;top:0;bottom:0;width:${380*sc}px;background:rgba(242,101,34,0.07);border-left:${2*sc}px solid rgba(242,101,34,0.15);display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:${48*sc}px ${44*sc}px;`);
    const stBodyEl=el('div',`font-size:${17*sc}px;color:rgba(255,255,255,0.55);line-height:1.7;white-space:pre-wrap;`);
    stBodyEl.textContent=d.stBody||'';
    if(d.stSource){const src=el('div',`font-size:${11*sc}px;color:rgba(255,255,255,0.22);font-style:italic;margin-top:${16*sc}px;`);src.textContent=d.stSource;rPanel.appendChild(src);}
    rPanel.appendChild(stBodyEl);
    // Left content
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${10*sc}px;background:${GOLD};`));
    const eyeL=el('div',`position:absolute;left:${32*sc}px;top:${36*sc}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`);
    eyeL.textContent=d.stTitle||slide.title||'Did You Know?';
    s.appendChild(el('div',`position:absolute;left:${32*sc}px;top:${64*sc}px;width:${40*sc}px;height:${3*sc}px;background:${GOLD};border-radius:2px;`));
    const bigN=el('div',`position:absolute;left:${28*sc}px;top:${80*sc}px;font-size:${130*sc}px;font-weight:900;color:#fff;line-height:0.88;letter-spacing:${-2*sc}px;right:${400*sc}px;overflow:hidden;`);
    bigN.textContent=d.stStat||'—';
    const stLbl2=el('div',`position:absolute;left:${32*sc}px;bottom:${56*sc}px;right:${400*sc}px;font-size:${18*sc}px;color:${GOLD};font-weight:600;line-height:1.4;`);
    stLbl2.textContent=d.stLabel||'';
    s.append(eyeL,bigN,stLbl2,rPanel);
  }

  container.appendChild(s);
}
function el(tag, css) {
  const d = document.createElement(tag);
  d.style.cssText = css;
  return d;
}
