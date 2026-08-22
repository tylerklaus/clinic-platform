// Clinic Platform — Slide Renderer (shared between viewer and editor)

const FPS = 29.97;
const NAVY = '#1B1B2F';
const GOLD = '#F26522';

/* ── SLIDE RENDERER ── */

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

function editable(elem, dataKey, placeholderText) {
  elem.dataset.key = dataKey;
  if (placeholderText) elem.dataset.placeholder = placeholderText;
  return elem;
}

// Mark an element as a reveal line (nth, 0-indexed).
// When step-reveal is active the viewer hides these and shows them one at a time.
function revealLine(elem, n) {
  elem.dataset.revealLine = String(n);
  return elem;
}

// Shrinks every inline font-size within `box` (including `box` itself) proportionally
// until its content fits inside its own bounds, or a floor ratio is hit. `box` must
// already be attached to the document — it needs live layout to measure overflow.
function autoFitText(box) {
  const sized = [];
  if (box.style.fontSize) sized.push({ node: box, base: parseFloat(box.style.fontSize) });
  box.querySelectorAll('*').forEach(child => {
    if (child.style.fontSize) sized.push({ node: child, base: parseFloat(child.style.fontSize) });
  });
  if (!sized.length) return;
  const MIN_RATIO = 0.55, STEP = 0.94;
  let ratio = 1, guard = 0;
  while (guard++ < 40 && ratio > MIN_RATIO) {
    const overflowing = box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1;
    if (!overflowing) break;
    ratio *= STEP;
    sized.forEach(s => { s.node.style.fontSize = (s.base * ratio) + 'px'; });
  }
}

// Runs autoFitText on every element marked data-autofit within the given (attached) root.
function runAutoFit(root) {
  root.querySelectorAll('[data-autofit]').forEach(autoFitText);
}

function renderSlideContent(slide, container) {
  container.innerHTML = '';
  const w = container.offsetWidth || parseInt(document.getElementById('slide-frame').style.width) || 960;
  const h = container.offsetHeight || parseInt(document.getElementById('slide-frame').style.height) || 540;
  const sc = w / 960;
  const d = slide.data || {};

  const s = document.createElement('div');
  s.style.cssText = `width:${w}px;height:${h}px;position:relative;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif;`;
  // stepReveal set per slide type below

  // ── TITLE ─────────────────────────────────────────────────────────────
  if (slide.type === 'title') {
    s.style.background = NAVY;
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${28*sc}px;background:${GOLD};`));
    s.appendChild(el('div',`position:absolute;right:${-90*sc}px;top:${-90*sc}px;width:${400*sc}px;height:${400*sc}px;border-radius:50%;border:${6*sc}px solid rgba(242,101,34,0.2);`));
    s.appendChild(el('div',`position:absolute;right:${-20*sc}px;top:${-20*sc}px;width:${240*sc}px;height:${240*sc}px;border-radius:50%;border:${5*sc}px solid rgba(242,101,34,0.14);`));
    s.appendChild(el('div',`position:absolute;right:${50*sc}px;top:${50*sc}px;width:${120*sc}px;height:${120*sc}px;border-radius:50%;border:${3*sc}px solid rgba(242,101,34,0.08);`));
    const L = 60;
    if (titleLogoSrc) {
      const logoWrap = el('div',`position:absolute;right:${40*sc}px;top:${50*sc}px;bottom:${50*sc}px;width:${360*sc}px;display:flex;align-items:center;justify-content:center;`);
      const img = document.createElement('img');
      img.src = titleLogoSrc;
      img.style.cssText = `max-width:${340*sc}px;max-height:${h - 120*sc}px;width:auto;height:auto;object-fit:contain;`;
      logoWrap.appendChild(img);
      s.appendChild(logoWrap);
      s.appendChild(el('div',`position:absolute;right:${408*sc}px;top:${60*sc}px;bottom:${60*sc}px;width:${1*sc}px;background:rgba(255,255,255,0.08);`));
      const ew = editable(el('div',`position:absolute;left:${L*sc}px;top:${40*sc}px;right:${428*sc}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`),'eyebrow','IHSA · Boys Volleyball');
      ew.textContent = d.eyebrow || 'IHSA · Boys Volleyball';
      const tt = editable(el('div',`position:absolute;left:${L*sc}px;top:${h*0.20}px;right:${428*sc}px;font-size:${54*sc}px;font-weight:800;color:#fff;line-height:0.95;letter-spacing:${-0.5*sc}px;`),'title','Presentation Title');
      tt.style.wordBreak='break-word';
      tt.textContent = d.title || slide.title;
      const divL = el('div',`position:absolute;left:${L*sc}px;bottom:${108*sc}px;width:${40*sc}px;height:${4*sc}px;background:${GOLD};border-radius:2px;`);
      // subtitle: split into reveal lines
      const subLines = (d.subtitle || slide.body || '').split('\n');
      const subWrap = editable(el('div',`position:absolute;left:${L*sc}px;bottom:${48*sc}px;right:${428*sc}px;font-size:${16*sc}px;color:rgba(255,255,255,0.4);line-height:1.5;overflow:hidden;`),'subtitle','Subtitle or date');
      subWrap.dataset.autofit = '1';
      subLines.forEach((line) => {
        const ln = el('div','white-space:nowrap;'); ln.textContent = line;
        subWrap.appendChild(ln);
      });
      s.append(ew, tt, divL, subWrap);
    } else {
      const ew = editable(el('div',`position:absolute;left:${L*sc}px;top:${40*sc}px;font-size:${12*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`),'eyebrow','IHSA · Boys Volleyball');
      ew.textContent = d.eyebrow || 'IHSA · Boys Volleyball';
      const tt = editable(el('div',`position:absolute;left:${L*sc}px;top:${h*0.20}px;right:${140*sc}px;font-size:${78*sc}px;font-weight:800;color:#fff;line-height:0.92;letter-spacing:${-1*sc}px;`),'title','Presentation Title');
      tt.style.wordBreak='break-word';
      tt.textContent = d.title || slide.title;
      const div = el('div',`position:absolute;left:${L*sc}px;bottom:${108*sc}px;width:${48*sc}px;height:${4*sc}px;background:${GOLD};border-radius:2px;`);
      const subLines = (d.subtitle || slide.body || '').split('\n');
      const subWrap = editable(el('div',`position:absolute;left:${L*sc}px;bottom:${48*sc}px;right:${140*sc}px;font-size:${19*sc}px;color:rgba(255,255,255,0.45);line-height:1.5;overflow:hidden;`),'subtitle','Subtitle or date');
      subWrap.dataset.autofit = '1';
      subLines.forEach((line) => {
        const ln = el('div','white-space:nowrap;'); ln.textContent = line;
        subWrap.appendChild(ln);
      });
      s.append(ew, tt, div, subWrap);
    }

  // ── VIDEO / SCENARIO ──────────────────────────────────────────────────
  } else if (slide.type === 'video') {
    s.style.background = '#EFEFED';
    const panel = el('div',`position:absolute;left:0;top:0;bottom:0;width:${360*sc}px;background:${GOLD};display:flex;flex-direction:column;justify-content:flex-end;padding:${40*sc}px ${36*sc}px;`);
    panel.appendChild(el('div',`position:absolute;top:0;left:0;right:0;height:${5*sc}px;background:rgba(0,0,0,0.2);`));
    const scenLabel = editable(el('div',`font-size:${11*sc}px;font-weight:700;color:rgba(255,255,255,0.65);letter-spacing:${3*sc}px;text-transform:uppercase;margin-bottom:${10*sc}px;`),'vidTitle','Situation Label');
    scenLabel.textContent = d.vidTitle || slide.title;
    const bigTxt = editable(el('div',`font-size:${56*sc}px;font-weight:900;color:#fff;line-height:0.88;letter-spacing:${-1*sc}px;text-transform:uppercase;margin-bottom:${24*sc}px;overflow:hidden;`),'panelText','You\nMake\nthe\nCall');
    bigTxt.style.whiteSpace='pre';
    bigTxt.dataset.autofit = '1';
    bigTxt.textContent = d.panelText || 'You\nMake\nthe\nCall';
    const ctaBadge = editable(el('div',`display:inline-block;background:${NAVY};color:#fff;font-size:${14*sc}px;font-weight:700;padding:${9*sc}px ${22*sc}px;border-radius:${4*sc}px;letter-spacing:${0.3*sc}px;`),'vidCta',"What's your call?");
    ctaBadge.textContent = d.vidCta || "What's your call?";
    panel.append(scenLabel, bigTxt, ctaBadge);
    const eyeLbl = editable(el('div',`position:absolute;left:${392*sc}px;top:${36*sc}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`),'vidEyebrow','Situation');
    eyeLbl.textContent = d.vidEyebrow || 'Situation';
    const ruleLine = el('div',`position:absolute;left:${392*sc}px;top:${62*sc}px;right:${32*sc}px;height:${1*sc}px;background:rgba(0,0,0,0.1);`);
    // body: each line is a reveal line
    const bodyLines = (d.vidBody || slide.body || '').split('\n');
    const bodyWrap = editable(el('div',`position:absolute;left:${392*sc}px;top:${82*sc}px;right:${32*sc}px;bottom:${32*sc}px;font-size:${20*sc}px;color:#1a1a1a;line-height:1.7;overflow:hidden;`),'vidBody','Describe the situation here...');
    bodyWrap.dataset.autofit = '1';
    bodyLines.forEach((line) => {
      const ln = el('div','white-space:pre-wrap;'); ln.textContent = line;
      bodyWrap.appendChild(ln);
    });
    s.append(panel, eyeLbl, ruleLine, bodyWrap);

  // ── ANSWER REVEAL ─────────────────────────────────────────────────────
  } else if (slide.type === 'reveal') {
    s.style.background = '#EFEFED';
    const darkHalf = el('div',`position:absolute;top:0;left:0;right:0;height:${h*0.48}px;background:${NAVY};`);
    darkHalf.appendChild(el('div',`position:absolute;top:0;left:0;width:${10*sc}px;bottom:0;background:${GOLD};`));
    const eyebrow = editable(el('div',`position:absolute;top:${22*sc}px;left:${32*sc}px;font-size:${11*sc}px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:${3*sc}px;text-transform:uppercase;`),'revEyebrow','The Call · Answer');
    eyebrow.textContent = d.revEyebrow || 'The Call · Answer';
    const ruling = editable(el('div',`position:absolute;top:${46*sc}px;left:${32*sc}px;right:${32*sc}px;font-size:${54*sc}px;font-weight:800;color:#fff;line-height:0.95;letter-spacing:${-0.5*sc}px;overflow:hidden;`),'revRuling','The Ruling');
    ruling.style.maxHeight = `${130*sc}px`;
    ruling.dataset.autofit = '1';
    ruling.textContent = d.revRuling || slide.title;
    const rulPill = editable(el('div',`position:absolute;top:${h*0.48 - 16*sc}px;left:${32*sc}px;background:${GOLD};color:#fff;font-size:${11*sc}px;font-weight:700;padding:${4*sc}px ${16*sc}px;border-radius:${20*sc}px;letter-spacing:${0.5*sc}px;`),'revRule','NFHS Rule');
    rulPill.textContent = d.revRule || slide.rule || 'NFHS Rule';
    // explanation: each line is a reveal line
    const explLines = (d.revBody || slide.body || '').split('\n');
    const explWrap = editable(el('div',`position:absolute;left:${32*sc}px;right:${32*sc}px;top:${h*0.48 + 24*sc}px;bottom:${84*sc}px;font-size:${18*sc}px;color:#1a1a1a;line-height:1.7;overflow:hidden;`),'revBody','Explanation of the ruling...');
    explWrap.dataset.autofit = '1';
    explLines.forEach((line) => {
      const ln = el('div','white-space:pre-wrap;'); ln.textContent = line;
      explWrap.appendChild(ln);
    });
    s.append(darkHalf, eyebrow, ruling, rulPill, explWrap, noteFooter(sc, d.revNoteLabel, d.revNote));

  // ── RULE CHANGE ───────────────────────────────────────────────────────
  } else if (slide.type === 'rulechange') {
    s.style.background = '#EFEFED';
    const rPill = pill(sc, d.rcRule || 'Rule', true);
    s.appendChild(topBar(sc, 'Rule Change', rPill));
    const hd = editable(el('div',`position:absolute;left:${32*sc}px;top:${82*sc}px;right:${32*sc}px;font-size:${32*sc}px;font-weight:800;color:${NAVY};line-height:1.1;`),'rcHeading','Rule Change Heading');
    hd.textContent = d.rcHeading || slide.title;
    const ruleCardBottom = d.rcHidePenalty ? 58*sc : 160*sc;
    const ruleCard = el('div',`position:absolute;left:${32*sc}px;top:${142*sc}px;right:${32*sc}px;bottom:${ruleCardBottom}px;background:#fff;border-radius:${8*sc}px;border-top:${4*sc}px solid ${GOLD};overflow:hidden;display:flex;`);
    ruleCard.dataset.autofit = '1';
    const rcImg = d.rcImage || null;
    const ruleCardHdr = editable(el('div',`padding:${10*sc}px ${16*sc}px ${8*sc}px;font-size:${10*sc}px;font-weight:700;letter-spacing:${1.5*sc}px;text-transform:uppercase;color:${GOLD};`),'rcNewLabel','New Rule');
    ruleCardHdr.textContent = d.rcNewLabel || 'New Rule';
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
    const ratBar = el('div',`position:absolute;left:0;right:0;bottom:0;height:${58*sc}px;background:#fff;border-top:${2*sc}px solid #eee;display:flex;align-items:center;padding:0 ${32*sc}px;gap:${10*sc}px;overflow:hidden;`);
    ratBar.dataset.autofit = '1';
    const ratLbl = el('div',`font-size:${10*sc}px;font-weight:700;color:${GOLD};letter-spacing:${2*sc}px;text-transform:uppercase;flex-shrink:0;`);
    ratLbl.textContent = 'Rationale';
    const ratTxt = editable(el('div',`font-size:${13*sc}px;color:#555;font-style:italic;flex:1;`),'rcNote','Why this rule changed...');
    ratTxt.textContent = d.rcNote || '';
    ratBar.append(ratLbl, ratTxt);
    if (!d.rcHidePenalty) {
      const penBar = el('div',`position:absolute;left:0;right:0;bottom:${58*sc}px;height:${100*sc}px;background:rgba(242,101,34,0.08);border-top:${2*sc}px solid rgba(242,101,34,0.25);border-bottom:${2*sc}px solid rgba(242,101,34,0.25);display:flex;align-items:flex-start;padding:${8*sc}px ${32*sc}px;gap:${6*sc}px;flex-direction:column;overflow:hidden;`);
      penBar.dataset.autofit = '1';
      const penLbl = el('div',`font-size:${10*sc}px;font-weight:700;color:${GOLD};letter-spacing:${2*sc}px;text-transform:uppercase;`);
      penLbl.textContent = 'Penalty';
      const penTxt = editable(el('div',`font-size:${15*sc}px;color:#333;font-weight:500;`),'rcPenalty','Describe the penalty...');
      penTxt.textContent = d.rcPenalty || '';
      penBar.append(penLbl, penTxt);
      s.append(hd, ruleCard, penBar, ratBar);
    } else {
      s.append(hd, ruleCard, ratBar);
    }

  // ── POINTS OF EMPHASIS ────────────────────────────────────────────────
  } else if (slide.type === 'emphasis') {
    s.style.background = NAVY;
    if (d.stepReveal) s.dataset.stepReveal = '1';
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${10*sc}px;background:${GOLD};`));
    const seasonL = editable(el('div',`position:absolute;left:${32*sc}px;top:${30*sc}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`),'emSeason','IHSA Boys Volleyball');
    seasonL.textContent = d.emSeason || 'IHSA Boys Volleyball';
    const hd2 = editable(el('div',`position:absolute;left:${32*sc}px;top:${52*sc}px;right:${60*sc}px;font-size:${40*sc}px;font-weight:800;color:#fff;line-height:1;`),'emHeader','Points of Emphasis');
    hd2.textContent = d.emHeader || 'Points of Emphasis';
    s.appendChild(el('div',`position:absolute;left:${32*sc}px;top:${118*sc}px;right:${32*sc}px;height:${1*sc}px;background:rgba(255,255,255,0.1);`));
    const allItems=[
      {t:d.em1||'',desc:d.em1d||'',hidden:d.em1hide},
      {t:d.em2||'',desc:d.em2d||'',hidden:d.em2hide},
      {t:d.em3||'',desc:d.em3d||'',hidden:d.em3hide},
      {t:d.em4||'',desc:d.em4d||'',hidden:d.em4hide}
    ];
    const isEditor = typeof isEditorMode !== 'undefined' && isEditorMode;
    const items = isEditor
      ? allItems.filter(it=>it.t.trim())
      : allItems.filter(it=>it.t.trim() && !it.hidden);
    // Flex column instead of fixed per-row heights: rows size to their own content (so
    // an item with a longer description doesn't get clipped or overlap its neighbor),
    // and space-evenly redistributes the leftover vertical space when there are fewer
    // items — both "move" naturally instead of needing a manually computed itemH.
    const itemsWrap = el('div',`position:absolute;left:${32*sc}px;right:${32*sc}px;top:${128*sc}px;bottom:${32*sc}px;display:flex;flex-direction:column;justify-content:space-evenly;gap:${14*sc}px;overflow:hidden;`);
    itemsWrap.dataset.autofit = '1';
    items.forEach((item,i)=>{
      const row = el('div',`display:flex;align-items:center;gap:${20*sc}px;flex-shrink:0;`);
      if (isEditor && item.hidden) row.dataset.dim = '1';
      revealLine(row, i);
      const num = el('div',`width:${40*sc}px;height:${40*sc}px;border-radius:${6*sc}px;background:${GOLD};display:flex;align-items:center;justify-content:center;font-size:${18*sc}px;font-weight:800;color:#fff;flex-shrink:0;`);
      num.textContent=String(i+1);
      const right2=el('div',``);
      const rt=el('div',`font-size:${21*sc}px;font-weight:700;color:#fff;line-height:1.15;`);
      rt.textContent=item.t;
      right2.appendChild(rt);
      if(item.desc){const rd=el('div',`font-size:${14*sc}px;color:rgba(255,255,255,0.45);margin-top:${2*sc}px;`);rd.textContent=item.desc;right2.appendChild(rd);}
      row.append(num,right2);
      itemsWrap.appendChild(row);
    });
    s.append(seasonL,hd2,itemsWrap);

  // ── DISCUSSION ────────────────────────────────────────────────────────
  } else if (slide.type === 'discussion') {
    s.style.background = NAVY;
    if (d.stepReveal) s.dataset.stepReveal = '1';
    s.appendChild(el('div',`position:absolute;left:${-120*sc}px;top:50%;transform:translateY(-50%);width:${280*sc}px;height:${280*sc}px;border-radius:50%;border:${6*sc}px solid rgba(242,101,34,0.22);`));
    s.appendChild(el('div',`position:absolute;left:${-60*sc}px;top:50%;transform:translateY(-50%);width:${160*sc}px;height:${160*sc}px;border-radius:50%;border:${5*sc}px solid rgba(242,101,34,0.14);`));
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${10*sc}px;background:${GOLD};`));
    const dRow=el('div',`position:absolute;left:${32*sc}px;top:${32*sc}px;display:flex;align-items:center;gap:${12*sc}px;`);
    const dLbl=el('div',`font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`);
    dLbl.textContent='Discussion';
    dRow.appendChild(dLbl);
    if(d.discTime){const tb=el('div',`font-size:${11*sc}px;padding:${3*sc}px ${12*sc}px;border-radius:${20*sc}px;border:1px solid rgba(242,101,34,0.35);color:rgba(255,255,255,0.45);`);tb.textContent=d.discTime;dRow.appendChild(tb);}
    // Question — always visible (not a reveal line)
    const qEl=editable(el('div',`position:absolute;left:${32*sc}px;right:${80*sc}px;top:${72*sc}px;font-size:${32*sc}px;font-weight:800;color:#fff;line-height:1.18;`),'discQ','Discussion question goes here.');
    qEl.textContent=d.discQ||'Discussion question goes here.';
    // Bullet points from discCtx (one per line) — each is a reveal line
    const bullets=(d.discCtx||'').split('\n');
    const bulletArea=editable(el('div',`position:absolute;left:${32*sc}px;right:${80*sc}px;top:${148*sc}px;bottom:${28*sc}px;display:flex;flex-direction:column;justify-content:flex-start;gap:${10*sc}px;overflow:hidden;`),'discCtx','Add discussion points (one per line)...');
    bulletArea.dataset.autofit = '1';
    if(bullets.some(l=>l.trim())){
      bullets.forEach((b,i)=>{
        const row=el('div',`display:flex;align-items:flex-start;gap:${12*sc}px;`);
        revealLine(row, i);
        const txt=el('div',`font-size:${16*sc}px;color:rgba(255,255,255,0.6);line-height:1.5;`);
        txt.textContent=b;
        if (b.trim()) {
          const dot=el('div',`width:${8*sc}px;height:${8*sc}px;border-radius:50%;background:${GOLD};flex-shrink:0;margin-top:${7*sc}px;`);
          row.append(dot,txt);
        } else {
          row.style.minHeight = `${16*sc*1.5}px`;
          row.append(txt);
        }
        bulletArea.appendChild(row);
      });
    } else {
      const ph=el('div',`font-size:${15*sc}px;color:rgba(255,255,255,0.2);font-style:italic;`);
      ph.textContent='Add discussion points (one per line)...';
      bulletArea.appendChild(ph);
    }
    const qm=el('div',`position:absolute;right:${28*sc}px;top:${10*sc}px;font-size:${220*sc}px;font-weight:900;color:rgba(242,101,34,0.12);line-height:1;pointer-events:none;`);
    qm.textContent='?';
    s.append(dRow,qEl,bulletArea,qm);

  // ── CASEBOOK ──────────────────────────────────────────────────────────
  } else if (slide.type === 'casebook') {
    s.style.background = '#EFEFED';
    const phase=(container===document.getElementById('slide-inner'))?cbPhase:1;
    const cPill = d.cbCite ? pill(sc, d.cbCite, false) : null;
    s.appendChild(topBar(sc, phase===0 ? 'Casebook · Situation' : 'Casebook · Ruling', cPill));

    if (phase===0) {
      const sb=el('div',`position:absolute;left:${32*sc}px;top:${80*sc}px;right:${32*sc}px;bottom:${64*sc}px;background:#fff;border-radius:${8*sc}px;overflow:hidden;`);
      sb.dataset.autofit = '1';
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
      const leftW = (w - 80*sc) * 0.42;
      const rightW = (w - 80*sc) * 0.58;
      // Left col: situation — will slide in from left
      const leftCol=el('div',`position:absolute;left:${32*sc}px;top:${80*sc}px;width:${leftW}px;bottom:${8*sc}px;background:#fff;border-radius:${8*sc}px;overflow:hidden;`);
      leftCol.dataset.cbLeft = '1';
      leftCol.dataset.autofit = '1';
      const lch=el('div',`padding:${10*sc}px ${16*sc}px;font-size:${10*sc}px;font-weight:700;letter-spacing:${2*sc}px;text-transform:uppercase;color:#aaa;background:#f5f5f3;`);
      lch.textContent='Situation';
      const lcb=editable(el('div',`padding:${14*sc}px ${16*sc}px;font-size:${15*sc}px;color:#888;line-height:1.6;white-space:pre-wrap;`),'cbSit','Describe the situation...');
      lcb.textContent=d.cbSit||'';
      leftCol.append(lch,lcb);
      // Right col: ruling + comment — will slide in from right
      const rightX = 32*sc + leftW + 16*sc;
      const rightCol=el('div',`position:absolute;left:${rightX}px;top:${80*sc}px;width:${rightW}px;bottom:${8*sc}px;display:flex;flex-direction:column;gap:${10*sc}px;`);
      rightCol.dataset.cbRight = '1';
      const rulingCard=el('div',`background:#fff;border-radius:${8*sc}px;border-top:${4*sc}px solid ${GOLD};flex:0 0 auto;overflow:hidden;`);
      const rch=el('div',`padding:${8*sc}px ${16*sc}px;font-size:${10*sc}px;font-weight:700;letter-spacing:${2*sc}px;text-transform:uppercase;color:${GOLD};background:rgba(242,101,34,0.06);`);
      rch.textContent='Ruling';
      const rcb=editable(el('div',`padding:${12*sc}px ${16*sc}px;font-size:${18*sc}px;color:#111;line-height:1.55;white-space:pre-wrap;font-weight:600;`),'cbRuling','State the ruling...');
      rcb.textContent=d.cbRuling||'';
      rulingCard.append(rch,rcb);
      const commentCard=el('div',`background:#fff;border-radius:${8*sc}px;flex:1;overflow:hidden;border-left:${3*sc}px solid rgba(0,0,0,0.06);`);
      commentCard.dataset.autofit = '1';
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
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${10*sc}px;background:${GOLD};`));
    s.appendChild(el('div',`position:absolute;right:${-60*sc}px;top:${-60*sc}px;width:${320*sc}px;height:${320*sc}px;border-radius:50%;border:${5*sc}px solid rgba(242,101,34,0.12);`));
    s.appendChild(el('div',`position:absolute;right:${20*sc}px;top:${20*sc}px;width:${160*sc}px;height:${160*sc}px;border-radius:50%;border:${3*sc}px solid rgba(242,101,34,0.07);`));
    const sideW = 220*sc;
    const sidePanel=el('div',`position:absolute;right:0;top:0;bottom:0;width:${sideW}px;background:rgba(255,255,255,0.04);border-left:${1*sc}px solid rgba(255,255,255,0.07);display:flex;flex-direction:column;justify-content:center;padding:${32*sc}px ${20*sc}px;gap:${16*sc}px;overflow:hidden;`);
    sidePanel.dataset.autofit = '1';
    const sideLabel=el('div',`font-size:${9*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;margin-bottom:${4*sc}px;`);
    sideLabel.textContent='Details';
    const sideTxt=editable(el('div',`font-size:${13*sc}px;color:rgba(255,255,255,0.5);line-height:1.7;white-space:pre-wrap;`),'stSideText','Location, date, or other details...');
    sideTxt.textContent=d.stSideText||'';
    sidePanel.append(sideLabel, sideTxt);
    const mainRight = sideW + 32*sc;
    const eyeW=editable(el('div',`position:absolute;left:${28*sc}px;top:${40*sc}px;right:${mainRight}px;font-size:${11*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`),'stEyebrow','IHSA · Boys Volleyball');
    eyeW.textContent=d.stEyebrow||'IHSA · Boys Volleyball';
    const mainTitle=editable(el('div',`position:absolute;left:${28*sc}px;top:${h*0.22}px;right:${mainRight}px;font-size:${62*sc}px;font-weight:800;color:#fff;line-height:0.93;letter-spacing:${-1*sc}px;word-break:break-word;`),'stTitle','State Title');
    mainTitle.textContent=d.stTitle||slide.title||'State Title';
    const divBar=el('div',`position:absolute;left:${28*sc}px;bottom:${88*sc}px;width:${44*sc}px;height:${4*sc}px;background:${GOLD};border-radius:2px;`);
    // body lines as reveal lines
    const stBodyLines = (d.stBody||'').split('\n');
    const stBodyWrap=editable(el('div',`position:absolute;left:${28*sc}px;bottom:${28*sc}px;right:${mainRight}px;font-size:${15*sc}px;color:rgba(255,255,255,0.4);line-height:1.6;overflow:hidden;`),'stBody','Subtitle or supporting text...');
    stBodyWrap.dataset.autofit = '1';
    stBodyLines.forEach((line)=>{ const ln=el('div','white-space:nowrap;');ln.textContent=line;stBodyWrap.appendChild(ln); });
    s.append(sidePanel, eyeW, mainTitle, divBar, stBodyWrap);

  // ── VOLLEYBALL ROTATION TRAINER ─────────────────────────────────────────
  } else if (slide.type === 'volleyball') {
    s.style.background = '#0f172a';
    const vbtRoot = el('div','position:absolute;inset:0;');
    s.appendChild(vbtRoot);
    // Presentation viewer: drags/edits update the live view only — never persisted,
    // so the slide always resets to its saved layout the next time it's shown.
    if (window.VolleyballTrainer) window.VolleyballTrainer.mount(vbtRoot, d, sc, { onChange: null });

  // ── FULL PHOTO ────────────────────────────────────────────────────────
  } else if (slide.type === 'photo') {
    s.style.background = '#000';
    if (d.photoImage) {
      const img = document.createElement('img');
      img.src = d.photoImage;
      img.style.cssText = `width:100%;height:100%;object-fit:${d.photoFit === 'contain' ? 'contain' : 'cover'};display:block;`;
      s.appendChild(img);
    } else {
      const ph = el('div','position:absolute;inset:0;display:flex;align-items:center;justify-content:center;');
      const txt = el('div',`font-size:${15*sc}px;font-weight:600;color:rgba(255,255,255,0.25);`);
      txt.textContent = 'No photo uploaded';
      ph.appendChild(txt);
      s.appendChild(ph);
    }

  // ── JUMP TO PRESENTATION ─────────────────────────────────────────────
  // Not meant to be seen live — the viewer intercepts this type before ever
  // rendering it and jumps straight to the target deck. This is a fallback
  // in case it's ever reached anyway (e.g. manual reordering edge cases).
  } else if (slide.type === 'jump') {
    s.style.background = NAVY;
    const wrap = el('div','position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:40px;');
    const icon = el('div',`font-size:${56*sc}px;color:${GOLD};line-height:1;`);
    icon.textContent = '⇥';
    const eyebrow2 = el('div',`font-size:${12*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`);
    eyebrow2.textContent = d.jumpType === 'quiz' ? 'Jump to a quiz' : 'Jump to another presentation';
    const targetTitle = el('div',`font-size:${28*sc}px;font-weight:800;color:#fff;`);
    targetTitle.textContent = d.jumpTargetTitle || 'No target selected';
    wrap.append(icon, eyebrow2, targetTitle);
    s.appendChild(wrap);

  // ── CLOSING / THANK YOU ───────────────────────────────────────────────
  } else if (slide.type === 'closing') {
    s.style.background = NAVY;
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${10*sc}px;background:${GOLD};`));
    s.appendChild(el('div',`position:absolute;right:${-90*sc}px;top:${-90*sc}px;width:${400*sc}px;height:${400*sc}px;border-radius:50%;border:${6*sc}px solid rgba(242,101,34,0.2);`));
    s.appendChild(el('div',`position:absolute;right:${-20*sc}px;top:${-20*sc}px;width:${240*sc}px;height:${240*sc}px;border-radius:50%;border:${5*sc}px solid rgba(242,101,34,0.14);`));

    const centerWrap = el('div',`position:absolute;left:${60*sc}px;right:${60*sc}px;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${16*sc}px;text-align:center;`);

    const eyeC = editable(el('div',`font-size:${13*sc}px;font-weight:700;color:${GOLD};letter-spacing:${3*sc}px;text-transform:uppercase;`),'closeEyebrow','Thank You');
    eyeC.textContent = d.closeEyebrow || 'Thank You';

    const headC = editable(el('div',`font-size:${58*sc}px;font-weight:800;color:#fff;line-height:1.05;letter-spacing:${-0.5*sc}px;word-break:break-word;`),'closeHeading','Thank You');
    headC.textContent = d.closeHeading || slide.title || 'Thank You';

    const barC = el('div',`width:${48*sc}px;height:${4*sc}px;background:${GOLD};border-radius:2px;flex-shrink:0;`);

    const msgLines = (d.closeMessage || '').split('\n');
    const msgC = editable(el('div',`font-size:${18*sc}px;color:rgba(255,255,255,0.5);line-height:1.5;max-width:${560*sc}px;`),'closeMessage','Add a closing message...');
    msgLines.forEach((line) => {
      const ln = el('div','white-space:pre-wrap;'); ln.textContent = line;
      msgC.appendChild(ln);
    });

    // Contact lines never wrap — a long email should shrink to fit on one line
    // instead of breaking mid-address, so runAutoFit (below) can do its job.
    const contactLines = (d.closeContact || '').split('\n');
    const contactWrap = editable(el('div',`display:flex;flex-direction:column;align-items:center;gap:${8*sc}px;max-width:${640*sc}px;overflow:hidden;margin-top:${4*sc}px;`),'closeContact','Add your name, email, or other contact info (one per line)...');
    contactWrap.dataset.autofit = '1';
    if (contactLines.some(l => l.trim())) {
      contactLines.forEach((line) => {
        if (!line.trim()) return;
        const row = el('div','display:flex;align-items:center;gap:8px;');
        const dot = el('div',`width:${6*sc}px;height:${6*sc}px;border-radius:50%;background:${GOLD};flex-shrink:0;`);
        const txt = el('div',`font-size:${16*sc}px;color:rgba(255,255,255,0.7);white-space:nowrap;`);
        txt.textContent = line;
        row.append(dot, txt);
        contactWrap.appendChild(row);
      });
    }

    centerWrap.append(eyeC, headC, barC, msgC, contactWrap);
    s.appendChild(centerWrap);

  // ── BULLET LIST (optional image on the left) ──────────────────────────
  } else if (slide.type === 'bullets') {
    s.style.background = NAVY;
    if (d.stepReveal) s.dataset.stepReveal = '1';
    s.appendChild(el('div',`position:absolute;left:0;top:0;bottom:0;width:${10*sc}px;background:${GOLD};`));

    const hasImg = !!d.blImage;
    const leftMargin = 32*sc, imgColW = 340*sc;
    const contentLeft = hasImg ? (leftMargin + imgColW + 28*sc) : leftMargin;

    if (hasImg) {
      const imgCol = el('div',`position:absolute;left:${leftMargin}px;top:${32*sc}px;bottom:${32*sc}px;width:${imgColW}px;border-radius:${10*sc}px;overflow:hidden;background:#0a0a14;`);
      const img = document.createElement('img');
      img.src = d.blImage;
      img.style.cssText = `width:100%;height:100%;object-fit:cover;display:block;`;
      imgCol.appendChild(img);
      s.appendChild(imgCol);
    }

    const hd = editable(el('div',`position:absolute;left:${contentLeft}px;top:${36*sc}px;right:${32*sc}px;font-size:${38*sc}px;font-weight:800;color:#fff;line-height:1.05;word-break:break-word;`),'blHeadline','Headline');
    hd.textContent = d.blHeadline || slide.title || 'Headline';
    s.appendChild(hd);

    s.appendChild(el('div',`position:absolute;left:${contentLeft}px;right:${32*sc}px;top:${96*sc}px;height:${1*sc}px;background:rgba(255,255,255,0.12);`));

    // Empty bullets and empty sub-bullets are simply left out — no placeholder rows.
    const items = [
      { t: d.bl1||'', sub: d.bl1sub||'' },
      { t: d.bl2||'', sub: d.bl2sub||'' },
      { t: d.bl3||'', sub: d.bl3sub||'' },
      { t: d.bl4||'', sub: d.bl4sub||'' }
    ].filter(it => it.t.trim());

    // Flex column with space-evenly (same adaptive-spacing approach as the emphasis
    // slide): fewer bullets spread out to fill the space, and a longer item just grows
    // its own row instead of a fixed per-row height causing overlap.
    const listWrap = el('div',`position:absolute;left:${contentLeft}px;right:${32*sc}px;top:${118*sc}px;bottom:${32*sc}px;display:flex;flex-direction:column;justify-content:space-evenly;gap:${12*sc}px;overflow:hidden;`);
    listWrap.dataset.autofit = '1';
    items.forEach((item, i) => {
      const row = el('div','display:flex;flex-direction:column;gap:4px;flex-shrink:0;');
      revealLine(row, i);
      const mainRow = el('div',`display:flex;align-items:flex-start;gap:${12*sc}px;`);
      const dot = el('div',`width:${8*sc}px;height:${8*sc}px;border-radius:50%;background:${GOLD};flex-shrink:0;margin-top:${9*sc}px;`);
      const txt = el('div',`font-size:${22*sc}px;font-weight:600;color:#fff;line-height:1.3;`);
      txt.textContent = item.t;
      mainRow.append(dot, txt);
      row.appendChild(mainRow);
      if (item.sub.trim()) {
        const subRow = el('div',`display:flex;align-items:flex-start;gap:${12*sc}px;padding-left:${20*sc}px;`);
        const dash = el('div',`font-size:${16*sc}px;color:rgba(255,255,255,0.35);flex-shrink:0;`);
        dash.textContent = '–';
        const subTxt = el('div',`font-size:${16*sc}px;color:rgba(255,255,255,0.5);line-height:1.4;`);
        subTxt.textContent = item.sub;
        subRow.append(dash, subTxt);
        row.appendChild(subRow);
      }
      listWrap.appendChild(row);
    });
    s.appendChild(listWrap);
  }

  container.appendChild(s);
  runAutoFit(s);
}
function el(tag, css) {
  const d = document.createElement(tag);
  d.style.cssText = css;
  return d;
}
