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

// Helper: make an element inline-editable in editor context
// dataKey maps to slide.data[key]; placeholderText shown when empty
function editable(elem, dataKey, placeholderText) {
  elem.dataset.key = dataKey;
  if (placeholderText) elem.dataset.placeholder = placeholderText;
  return elem;
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
      const ew = editable(el('div',`position:absolute;left:${L*sc}px;top:${40*sc}px;right:${428*sc}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`),'eyebrow','IHSA · Boys Volleyball');
      ew.textContent = d.eyebrow || 'IHSA · Boys Volleyball';
      const tt = editable(el('div',`position:absolute;left:${L*sc}px;top:${h*0.20}px;right:${428*sc}px;font-size:${54*sc}px;font-weight:800;color:#fff;line-height:0.95;letter-spacing:${-0.5*sc}px;`),'title','Presentation Title');
      tt.style.wordBreak='break-word';
      tt.textContent = d.title || slide.title;
      const divL = el('div',`position:absolute;left:${L*sc}px;bottom:${108*sc}px;width:${40*sc}px;height:${4*sc}px;background:${GOLD};border-radius:2px;`);
      const sub = editable(el('div',`position:absolute;left:${L*sc}px;bottom:${48*sc}px;right:${428*sc}px;font-size:${16*sc}px;color:rgba(255,255,255,0.4);line-height:1.5;`),'subtitle','Subtitle or date');
      sub.style.whiteSpace='pre-line';
      sub.textContent = d.subtitle || slide.body || '';
      s.append(ew, tt, divL, sub);
    } else {
      // No logo — full width title layout
      const ew = editable(el('div',`position:absolute;left:${L*sc}px;top:${40*sc}px;font-size:${12*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`),'eyebrow','IHSA · Boys Volleyball');
      ew.textContent = d.eyebrow || 'IHSA · Boys Volleyball';
      const tt = editable(el('div',`position:absolute;left:${L*sc}px;top:${h*0.20}px;right:${140*sc}px;font-size:${78*sc}px;font-weight:800;color:#fff;line-height:0.92;letter-spacing:${-1*sc}px;`),'title','Presentation Title');
      tt.style.wordBreak='break-word';
      tt.textContent = d.title || slide.title;
      const div = el('div',`position:absolute;left:${L*sc}px;bottom:${108*sc}px;width:${48*sc}px;height:${4*sc}px;background:${GOLD};border-radius:2px;`);
      const sub = editable(el('div',`position:absolute;left:${L*sc}px;bottom:${48*sc}px;right:${140*sc}px;font-size:${19*sc}px;color:rgba(255,255,255,0.45);line-height:1.5;`),'subtitle','Subtitle or date');
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
    const scenLabel = editable(el('div',`font-size:${11*sc}px;font-weight:700;color:rgba(255,255,255,0.65);letter-spacing:${3*sc}px;text-transform:uppercase;margin-bottom:${10*sc}px;`),'vidTitle','Situation Label');
    scenLabel.textContent = d.vidTitle || slide.title;
    const bigTxt = editable(el('div',`font-size:${56*sc}px;font-weight:900;color:#fff;line-height:0.88;letter-spacing:${-1*sc}px;text-transform:uppercase;margin-bottom:${24*sc}px;`),'panelText','You\nMake\nthe\nCall');
    bigTxt.style.whiteSpace='pre-line';
    bigTxt.textContent = d.panelText || 'You\nMake\nthe\nCall';
    // Bottom pill on panel
    const ctaBadge = editable(el('div',`display:inline-block;background:${NAVY};color:#fff;font-size:${14*sc}px;font-weight:700;padding:${9*sc}px ${22*sc}px;border-radius:${4*sc}px;letter-spacing:${0.3*sc}px;`),'vidCta',"What's your call?");
    ctaBadge.textContent = d.vidCta || "What's your call?";
    panel.append(scenLabel, bigTxt, ctaBadge);
    // Right content area
    const eyeLbl = editable(el('div',`position:absolute;left:${392*sc}px;top:${36*sc}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`),'vidEyebrow','Situation');
    eyeLbl.textContent = d.vidEyebrow || 'Situation';
    const ruleLine = el('div',`position:absolute;left:${392*sc}px;top:${62*sc}px;right:${32*sc}px;height:${1*sc}px;background:rgba(0,0,0,0.1);`);
    const bodyTxt = editable(el('div',`position:absolute;left:${392*sc}px;top:${82*sc}px;right:${32*sc}px;bottom:${32*sc}px;font-size:${20*sc}px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;overflow:hidden;`),'vidBody','Describe the situation here...');
    bodyTxt.textContent = d.vidBody || slide.body || '';
    s.append(panel, eyeLbl, ruleLine, bodyTxt);

  // ── ANSWER REVEAL ─────────────────────────────────────────────────────
  } else if (slide.type === 'reveal') {
    s.style.background = '#EFEFED';
    // Full-width dark top half
    const darkHalf = el('div',`position:absolute;top:0;left:0;right:0;height:${h*0.48}px;background:${NAVY};`);
    // Left orange stripe on dark half
    darkHalf.appendChild(el('div',`position:absolute;top:0;left:0;width:${10*sc}px;bottom:0;background:${GOLD};`));
    const eyebrow = editable(el('div',`position:absolute;top:${22*sc}px;left:${32*sc}px;font-size:${11*sc}px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:${3*sc}px;text-transform:uppercase;`),'revEyebrow','The Call · Answer');
    eyebrow.textContent = d.revEyebrow || 'The Call · Answer';
    const ruling = editable(el('div',`position:absolute;top:${46*sc}px;left:${32*sc}px;right:${32*sc}px;font-size:${54*sc}px;font-weight:800;color:#fff;line-height:0.95;letter-spacing:${-0.5*sc}px;overflow:hidden;`),'revRuling','The Ruling');
    ruling.style.maxHeight = `${130*sc}px`;
    ruling.textContent = d.revRuling || slide.title;
    // Rule pill straddling the boundary
    const rulPill = editable(el('div',`position:absolute;top:${h*0.48 - 16*sc}px;left:${32*sc}px;background:${GOLD};color:#fff;font-size:${11*sc}px;font-weight:700;padding:${4*sc}px ${16*sc}px;border-radius:${20*sc}px;letter-spacing:${0.5*sc}px;`),'revRule','NFHS Rule');
    rulPill.textContent = d.revRule || slide.rule || 'NFHS Rule';
    // Explanation text in light area
    const expl = editable(el('div',`position:absolute;left:${32*sc}px;right:${32*sc}px;top:${h*0.48 + 24*sc}px;bottom:${84*sc}px;font-size:${18*sc}px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;overflow:hidden;`),'revBody','Explanation of the ruling...');
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
    const hd = editable(el('div',`position:absolute;left:${32*sc}px;top:${82*sc}px;right:${32*sc}px;font-size:${32*sc}px;font-weight:800;color:${NAVY};line-height:1.1;`),'rcHeading','Rule Change Heading');
    hd.textContent = d.rcHeading || slide.title;

    // Layout: heading at top, then rule card, then penalty bar, then rationale bar at bottom
    // The ruleCard sits between heading and penalty bar
    const ruleCard = el('div',`position:absolute;left:${32*sc}px;top:${142*sc}px;right:${32*sc}px;bottom:${160*sc}px;background:#fff;border-radius:${8*sc}px;border-top:${4*sc}px solid ${GOLD};overflow:hidden;display:flex;`);
    const rcImg = d.rcImage || null;
    const ruleCardHdr = el('div',`padding:${10*sc}px ${16*sc}px ${8*sc}px;font-size:${10*sc}px;font-weight:700;letter-spacing:${1.5*sc}px;text-transform:uppercase;color:${GOLD};`);
    ruleCardHdr.textContent = 'New Rule';
    const ruleCardBody = editable(el('div',`padding:${14*sc}px ${18*sc}px;font-size:${19*sc}px;color:#111;line-height:1.65;white-space:pre-wrap;font-weight:500;`),'rcNew','New rule text goes here...');
    ruleCardBody.textContent = d.rcNew || '';
    const textCol = el('div',`width:${rcImg ? 480*sc+'px' : '100%'};display:flex;flex-direction:column;`);
    textCol.append(ruleCardHdr, ruleCardBody);
    ruleCard.appendChild(textCol);
    if (rcImg) {
      const photoCol = el('div',`flex:1;background:#f0f0ee;display:flex;align-items:center;justify-content:center;overflow:hidden;border-left:1px solid #e8e8e8;`);
      const photo = document.createElement('img');
      photo.src = rcImg;
      photo.style.cssText = `width:100%;height:100%;object-fit:contain;`;
      photoCol.appendChild(photo);
      ruleCard.appendChild(photoCol);
    }

    // ── Penalty bar (between rule card and rationale) ──
    const penBar = el('div',`position:absolute;left:0;right:0;bottom:${58*sc}px;height:${100*sc}px;background:rgba(242,101,34,0.08);border-top:${2*sc}px solid rgba(242,101,34,0.25);border-bottom:${2*sc}px solid rgba(242,101,34,0.25);display:flex;align-items:flex-start;padding:${8*sc}px ${32*sc}px;gap:${6*sc}px;flex-direction:column;`);
    const penLbl = el('div',`font-size:${10*sc}px;font-weight:700;color:${GOLD};letter-spacing:${2*sc}px;text-transform:uppercase;`);
    penLbl.textContent = 'Penalty';
    const penTxt = editable(el('div',`font-size:${15*sc}px;color:#333;font-weight:500;`),'rcPenalty','Describe the penalty...');
    penTxt.textContent = d.rcPenalty || '';
    penBar.append(penLbl, penTxt);

    // ── Rationale bar at bottom ──
    const ratBar = el('div',`position:absolute;left:0;right:0;bottom:0;height:${58*sc}px;background:#fff;border-top:${2*sc}px solid #eee;display:flex;align-items:center;padding:0 ${32*sc}px;gap:${10*sc}px;`);
    const ratLbl = el('div',`font-size:${10*sc}px;font-weight:700;color:${GOLD};letter-spacing:${2*sc}px;text-transform:uppercase;flex-shrink:0;`);
    ratLbl.textContent = 'Rationale';
    const ratTxt = editable(el('div',`font-size:${13*sc}px;color:#555;font-style:italic;flex:1;`),'rcNote','Why this rule changed...');
    ratTxt.textContent = d.rcNote || '';
    ratBar.append(ratLbl, ratTxt);

    s.append(hd, ruleCard, penBar, ratBar);

  // ── POINTS OF EMPHASIS ────────────────────────────────────────────────
  } else if (slide.type === 'emphasis') {
    s.style.background = NAVY;
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${10*sc}px;background:${GOLD};`));
    const seasonL = editable(el('div',`position:absolute;left:${32*sc}px;top:${30*sc}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`),'emSeason','IHSA Boys Volleyball');
    seasonL.textContent = d.emSeason || 'IHSA Boys Volleyball';
    const hd2 = editable(el('div',`position:absolute;left:${32*sc}px;top:${52*sc}px;right:${60*sc}px;font-size:${40*sc}px;font-weight:800;color:#fff;line-height:1;`),'emHeader','Points of Emphasis');
    hd2.textContent = d.emHeader || 'Points of Emphasis';
    s.appendChild(el('div',`position:absolute;left:${32*sc}px;top:${118*sc}px;right:${32*sc}px;height:${1*sc}px;background:rgba(255,255,255,0.1);`));
    // Filter out hidden items; em1hide..em4hide are boolean flags
    const allItems=[
      {t:d.em1||'',desc:d.em1d||'',hidden:d.em1hide},
      {t:d.em2||'',desc:d.em2d||'',hidden:d.em2hide},
      {t:d.em3||'',desc:d.em3d||'',hidden:d.em3hide},
      {t:d.em4||'',desc:d.em4d||'',hidden:d.em4hide}
    ];
    // In editor context (when container is slide-inner), show hidden items grayed out
    // In viewer, only show non-hidden items with content
    const isEditor = typeof isEditorMode !== 'undefined' && isEditorMode;
    const items = isEditor
      ? allItems.filter(it=>it.t.trim()) // show all that have text, editor dims hidden
      : allItems.filter(it=>it.t.trim() && !it.hidden);
    const avail = h - 140*sc, itemH = Math.min(avail / Math.max(items.length,1), 98*sc);
    items.forEach((item,i)=>{
      const opacity = (isEditor && item.hidden) ? '0.3' : '1';
      const row = el('div',`position:absolute;left:${32*sc}px;right:${32*sc}px;top:${128*sc + i*itemH}px;height:${itemH}px;display:flex;align-items:center;gap:${20*sc}px;opacity:${opacity};`);
      const num = el('div',`width:${40*sc}px;height:${40*sc}px;border-radius:${6*sc}px;background:${GOLD};display:flex;align-items:center;justify-content:center;font-size:${18*sc}px;font-weight:800;color:#fff;flex-shrink:0;`);
      num.textContent=String(i+1);
      const right2=el('div',``);
      const rt=el('div',`font-size:${21*sc}px;font-weight:700;color:#fff;line-height:1.15;`);
      rt.textContent=item.t;
      right2.appendChild(rt);
      if(item.desc){const rd=el('div',`font-size:${14*sc}px;color:rgba(255,255,255,0.45);margin-top:${2*sc}px;`);rd.textContent=item.desc;right2.appendChild(rd);}
      row.append(num,right2);
      s.appendChild(row);
    });
    s.append(seasonL,hd2);

  // ── MECHANICS ─────────────────────────────────────────────────────────
  } else if (slide.type === 'mechanics') {
    s.style.background = '#EFEFED';
    const mPill = d.mechSub ? pill(sc, d.mechSub, false) : null;
    // Top bar with editable label via mechHeader
    s.appendChild(topBar(sc, d.mechHeader || slide.title || 'Mechanics', mPill));
    // Editable title below top bar
    const mechTitle = editable(el('div',`position:absolute;left:${416*sc}px;top:${72*sc}px;right:${32*sc}px;font-size:${22*sc}px;font-weight:800;color:${NAVY};line-height:1.1;`),'mechTitle','Position or Mechanic Name');
    mechTitle.textContent = d.mechTitle || '';
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
      const lbl2=el('div',`text-align:center;font-size:${11*sc}px;color:#bbb;margin-top:${8*sc}px;`);
      lbl2.textContent='Upload diagram in editor';
      dBox.append(svg,lbl2);
    }
    // Points — stored as newline-separated in mechPoints; editable as a block
    const pts=(d.mechPoints||'').split('\n').filter(p=>p.trim());
    const ptArea=el('div',`position:absolute;left:${416*sc}px;right:${32*sc}px;top:${108*sc}px;bottom:${80*sc}px;display:flex;flex-direction:column;justify-content:center;gap:${12*sc}px;`);
    if (pts.length) {
      pts.forEach(pt=>{
        const r=el('div',`display:flex;align-items:flex-start;gap:${14*sc}px;`);
        const dot=el('div',`width:${10*sc}px;height:${10*sc}px;border-radius:50%;background:${GOLD};flex-shrink:0;margin-top:${6*sc}px;`);
        const t=el('div',`font-size:${18*sc}px;color:#1a1a1a;line-height:1.5;`);
        t.textContent=pt;
        r.append(dot,t);
        ptArea.appendChild(r);
      });
    } else {
      // Placeholder so the area is clickable/editable
      const placeholder=editable(el('div',`font-size:${17*sc}px;color:#bbb;font-style:italic;padding:${8*sc}px 0;`),'mechPoints','Add bullet points here (one per line)...');
      placeholder.textContent='Add bullet points here (one per line)...';
      ptArea.appendChild(placeholder);
    }
    // Make the whole ptArea carry the data-key for click-to-edit
    ptArea.dataset.key='mechPoints';
    s.append(dBox, mechTitle, ptArea, noteFooter(sc, 'Note', d.mechNote||''));

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
    const qEl=editable(el('div',`position:absolute;left:${32*sc}px;right:${80*sc}px;top:${72*sc}px;font-size:${36*sc}px;font-weight:800;color:#fff;line-height:1.18;`),'discQ','Discussion question goes here.');
    qEl.textContent=d.discQ||'Discussion question goes here.';
    // Context
    const ctxEl=editable(el('div',`position:absolute;left:${32*sc}px;right:${80*sc}px;bottom:${36*sc}px;font-size:${15*sc}px;color:rgba(255,255,255,0.4);line-height:1.6;`),'discCtx','Additional context...');
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
      // ── Phase 0: Situation only ──
      const sb=el('div',`position:absolute;left:${32*sc}px;top:${80*sc}px;right:${32*sc}px;bottom:${64*sc}px;background:#fff;border-radius:${8*sc}px;overflow:hidden;`);
      const sh=el('div',`padding:${12*sc}px ${20*sc}px;background:#f0f0ee;font-size:${10*sc}px;font-weight:700;color:#aaa;letter-spacing:${2*sc}px;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;`);
      const shtxt=el('span','');shtxt.textContent='Situation';
      const hint=el('span',`font-size:${11*sc}px;color:#ccc;font-weight:400;letter-spacing:0;text-transform:none;`);hint.textContent='Advance for ruling →';
      sh.append(shtxt,hint);
      const st=editable(el('div',`padding:${28*sc}px ${32*sc}px;font-size:${22*sc}px;color:#222;line-height:1.7;white-space:pre-wrap;`),'cbSit','Describe the situation...');
      st.textContent=d.cbSit||'';
      sb.append(sh,st);
      const hb=el('div',`position:absolute;left:0;right:0;bottom:0;height:${56*sc}px;background:${NAVY};display:flex;align-items:center;justify-content:center;`);
      const hbTxt=el('span',`font-size:${13*sc}px;color:rgba(255,255,255,0.3);letter-spacing:${0.5*sc}px;`);
      hbTxt.textContent='What is the ruling?';
      hb.appendChild(hbTxt);
      s.append(sb,hb);

    } else {
      // ── Phase 1: Situation | Ruling + Comment layout ──
      // Left col: situation (greyed)
      const leftW = (w - 80*sc) * 0.42;
      const rightW = (w - 80*sc) * 0.58;
      const leftCol=el('div',`position:absolute;left:${32*sc}px;top:${80*sc}px;width:${leftW}px;bottom:${8*sc}px;background:#fff;border-radius:${8*sc}px;overflow:hidden;`);
      const lch=el('div',`padding:${10*sc}px ${16*sc}px;font-size:${10*sc}px;font-weight:700;letter-spacing:${2*sc}px;text-transform:uppercase;color:#aaa;background:#f5f5f3;`);
      lch.textContent='Situation';
      const lcb=editable(el('div',`padding:${14*sc}px ${16*sc}px;font-size:${15*sc}px;color:#888;line-height:1.6;white-space:pre-wrap;`),'cbSit','Describe the situation...');
      lcb.textContent=d.cbSit||'';
      leftCol.append(lch,lcb);

      // Right col: ruling (accent) + comment
      const rightX = 32*sc + leftW + 16*sc;
      const rightCol=el('div',`position:absolute;left:${rightX}px;top:${80*sc}px;width:${rightW}px;bottom:${8*sc}px;display:flex;flex-direction:column;gap:${10*sc}px;`);

      // Ruling card
      const rulingCard=el('div',`background:#fff;border-radius:${8*sc}px;border-top:${4*sc}px solid ${GOLD};flex:0 0 auto;overflow:hidden;`);
      const rch=el('div',`padding:${8*sc}px ${16*sc}px;font-size:${10*sc}px;font-weight:700;letter-spacing:${2*sc}px;text-transform:uppercase;color:${GOLD};background:rgba(242,101,34,0.06);`);
      rch.textContent='Ruling';
      const rcb=editable(el('div',`padding:${12*sc}px ${16*sc}px;font-size:${18*sc}px;color:#111;line-height:1.55;white-space:pre-wrap;font-weight:600;`),'cbRuling','State the ruling...');
      rcb.textContent=d.cbRuling||'';
      rulingCard.append(rch,rcb);

      // Comment card (rationale/why)
      const commentCard=el('div',`background:#fff;border-radius:${8*sc}px;flex:1;overflow:hidden;border-left:${3*sc}px solid rgba(0,0,0,0.06);`);
      const cch=el('div',`padding:${8*sc}px ${16*sc}px;font-size:${10*sc}px;font-weight:700;letter-spacing:${2*sc}px;text-transform:uppercase;color:#888;background:#f8f8f6;`);
      cch.textContent='Comment';
      const ccb=editable(el('div',`padding:${12*sc}px ${16*sc}px;font-size:${15*sc}px;color:#555;line-height:1.65;white-space:pre-wrap;font-style:italic;`),'cbComment','Explain why this is the ruling...');
      ccb.textContent=d.cbComment||'';
      commentCard.append(cch,ccb);

      rightCol.append(rulingCard, commentCard);
      s.append(leftCol, rightCol);
    }

  // ── STATE TITLE ───────────────────────────────────────────────────────
  } else if (slide.type === 'statetitle') {
    s.style.background = NAVY;
    // Left gold stripe
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${10*sc}px;background:${GOLD};`));
    // Decorative circles top-right (softer)
    s.appendChild(el('div',`position:absolute;right:${-60*sc}px;top:${-60*sc}px;width:${320*sc}px;height:${320*sc}px;border-radius:50%;border:${5*sc}px solid rgba(242,101,34,0.12);`));
    s.appendChild(el('div',`position:absolute;right:${20*sc}px;top:${20*sc}px;width:${160*sc}px;height:${160*sc}px;border-radius:50%;border:${3*sc}px solid rgba(242,101,34,0.07);`));

    // Right sidebar panel (narrow, for supplemental info)
    const sideW = 220*sc;
    const sidePanel=el('div',`position:absolute;right:0;top:0;bottom:0;width:${sideW}px;background:rgba(255,255,255,0.04);border-left:${1*sc}px solid rgba(255,255,255,0.07);display:flex;flex-direction:column;justify-content:center;padding:${32*sc}px ${20*sc}px;gap:${16*sc}px;`);
    const sideLabel=el('div',`font-size:${9*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;margin-bottom:${4*sc}px;`);
    sideLabel.textContent='Details';
    const sideTxt=editable(el('div',`font-size:${13*sc}px;color:rgba(255,255,255,0.5);line-height:1.7;white-space:pre-wrap;`),'stSideText','Location, date, or other details...');
    sideTxt.textContent=d.stSideText||'';
    sidePanel.append(sideLabel, sideTxt);

    // Main left content area
    const mainRight = sideW + 32*sc;
    const eyeW=editable(el('div',`position:absolute;left:${28*sc}px;top:${40*sc}px;right:${mainRight}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`),'stEyebrow','IHSA · Boys Volleyball');
    eyeW.textContent=d.stEyebrow||'IHSA · Boys Volleyball';

    const mainTitle=editable(el('div',`position:absolute;left:${28*sc}px;top:${h*0.22}px;right:${mainRight}px;font-size:${62*sc}px;font-weight:800;color:#fff;line-height:0.93;letter-spacing:${-1*sc}px;word-break:break-word;`),'stTitle','State Title');
    mainTitle.textContent=d.stTitle||slide.title||'State Title';

    const divBar=el('div',`position:absolute;left:${28*sc}px;bottom:${88*sc}px;width:${44*sc}px;height:${4*sc}px;background:${GOLD};border-radius:2px;`);

    // Body text — reasonable size (not giant)
    const bodyEl=editable(el('div',`position:absolute;left:${28*sc}px;bottom:${28*sc}px;right:${mainRight}px;font-size:${15*sc}px;color:rgba(255,255,255,0.4);line-height:1.6;white-space:pre-line;`),'stBody','Subtitle or supporting text...');
    bodyEl.textContent=d.stBody||'';

    s.append(sidePanel, eyeW, mainTitle, divBar, bodyEl);

  // ── STAT ──────────────────────────────────────────────────────────────
  } else if (slide.type === 'stat') {
    s.style.background = NAVY;
    // Decorative right panel
    const rPanel=el('div',`position:absolute;right:0;top:0;bottom:0;width:${380*sc}px;background:rgba(242,101,34,0.07);border-left:${2*sc}px solid rgba(242,101,34,0.15);display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:${48*sc}px ${44*sc}px;`);
    const stBodyEl=editable(el('div',`font-size:${17*sc}px;color:rgba(255,255,255,0.55);line-height:1.7;white-space:pre-wrap;`),'stBody','Supporting body text...');
    stBodyEl.textContent=d.stBody||'';
    if(d.stSource){const src=editable(el('div',`font-size:${11*sc}px;color:rgba(255,255,255,0.22);font-style:italic;margin-top:${16*sc}px;`),'stSource','Source');src.textContent=d.stSource;rPanel.appendChild(src);}
    rPanel.appendChild(stBodyEl);
    // Left content
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${10*sc}px;background:${GOLD};`));
    const eyeL=editable(el('div',`position:absolute;left:${32*sc}px;top:${36*sc}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`),'stTitle','Did You Know?');
    eyeL.textContent=d.stTitle||slide.title||'Did You Know?';
    s.appendChild(el('div',`position:absolute;left:${32*sc}px;top:${64*sc}px;width:${40*sc}px;height:${3*sc}px;background:${GOLD};border-radius:2px;`));
    const bigN=editable(el('div',`position:absolute;left:${28*sc}px;top:${80*sc}px;font-size:${130*sc}px;font-weight:900;color:#fff;line-height:0.88;letter-spacing:${-2*sc}px;right:${400*sc}px;overflow:hidden;`),'stStat','—');
    bigN.textContent=d.stStat||'—';
    const stLbl2=editable(el('div',`position:absolute;left:${32*sc}px;bottom:${56*sc}px;right:${400*sc}px;font-size:${18*sc}px;color:${GOLD};font-weight:600;line-height:1.4;`),'stLabel','Stat label');
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
