// Clinic Platform — Volleyball Rotation & Overlap Trainer (embeddable slide widget)
// Exposes window.VolleyballTrainer.mount(container, data, sc, opts)
//   container: element to render into (its innerHTML is fully owned/replaced)
//   data:      slide.data for a 'volleyball' slide (may be {} for a fresh slide)
//   sc:        scale factor (slideWidthPx / 960), matches the renderer's scaling convention
//   opts:      { onChange(newData) } — called after every user-driven state change.
//              Pass a falsy onChange to run read/drag-only (no persistence), e.g. in the
//              public presentation viewer where drags are live-only and never saved.

(function () {
  const CLOCKWISE = ['RB', 'MB', 'LB', 'LF', 'MF', 'RF'];
  const FRONT_ZONES = ['LF', 'MF', 'RF'];
  const ZONE_COORDS = {
    RF: { x: 25, y: 5 }, MF: { x: 15, y: 5 }, LF: { x: 5, y: 5 },
    LB: { x: 5, y: 20 }, MB: { x: 15, y: 20 }, RB: { x: 25, y: 20 }
  };
  const ZONE_NAMES = { RF: 'RIGHT FRONT', MF: 'MIDDLE FRONT', LF: 'LEFT FRONT', LB: 'LEFT BACK', MB: 'MIDDLE BACK', RB: 'RIGHT BACK' };
  // Which zones each zone is "bound by" for the overlap rule — the adjacent left/right
  // (same row) and front/back (same column) neighbors that must stay on the correct
  // side of this player. Matches the pairs enforced in checkOverlaps().
  const ADJACENCY = {
    LF: ['MF', 'LB'], MF: ['LF', 'RF', 'MB'], RF: ['MF', 'RB'],
    LB: ['MB', 'LF'], MB: ['LB', 'RB', 'MF'], RB: ['MB', 'RF']
  };
  // Canonical overlap rules — same pairs checkOverlaps() enforces. Shared here so the
  // live bound-mode line coloring and the "Check Overlaps" button never disagree.
  const RULES = [
    { a: 'LF', b: 'MF', type: 'left-of' }, { a: 'MF', b: 'RF', type: 'left-of' },
    { a: 'LB', b: 'MB', type: 'left-of' }, { a: 'MB', b: 'RB', type: 'left-of' },
    { a: 'LF', b: 'LB', type: 'front-of' }, { a: 'MF', b: 'MB', type: 'front-of' }, { a: 'RF', b: 'RB', type: 'front-of' }
  ];
  const COURT_SIZES = { compact: 8, standard: 12, large: 15, xlarge: 18 };
  const COURT_W = 30, COURT_L = 30;
  const NS = 'http://www.w3.org/2000/svg';

  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
.vbt-root{width:100%;height:100%;display:flex;gap:12px;padding:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;box-sizing:border-box;color:#0f172a;}
.vbt-root *{box-sizing:border-box;}
.vbt-panel{background:#f8fafc;border-radius:12px;padding:10px 12px;box-shadow:0 6px 18px rgba(0,0,0,.25);overflow:auto;flex-shrink:0;}
.vbt-controls{width:158px;display:flex;flex-direction:column;gap:8px;}
.vbt-lineup{width:190px;}
.vbt-court-card{flex:1 1 auto;min-width:0;background:#1e293b;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.25);overflow:auto;display:flex;align-items:center;justify-content:center;padding:8px;}
.vbt-h{font-size:11px;font-weight:700;margin:0 0 6px 0;color:#0f172a;border-bottom:1.5px solid #cbd5e1;padding-bottom:5px;text-transform:uppercase;letter-spacing:.4px;}
.vbt-label{font-size:10px;font-weight:600;color:#334155;display:block;margin-bottom:3px;}
.vbt-select{width:100%;padding:5px 6px;border-radius:6px;border:1px solid #cbd5e1;font-size:11px;font-family:inherit;margin-bottom:7px;background:#fff;color:#0f172a;}
.vbt-row{display:flex;gap:6px;margin-bottom:7px;}
.vbt-row .vbt-btn{flex:1;}
.vbt-btn{font-family:inherit;font-size:11px;padding:6px 7px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font-weight:600;color:#0f172a;}
.vbt-btn:hover{background:#eef2f7;}
.vbt-btn.vbt-primary{background:#2563eb;color:#fff;border-color:#2563eb;}
.vbt-btn.vbt-primary:hover{background:#1d4ed8;}
.vbt-check-row{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:600;color:#334155;margin-bottom:2px;}
.vbt-check-row input{width:13px;height:13px;flex-shrink:0;}
.vbt-hint{font-size:9.5px;font-weight:400;color:#64748b;margin:2px 0 7px 0;line-height:1.35;}
.vbt-legend{display:flex;flex-direction:column;gap:4px;font-size:10px;color:#334155;margin-top:4px;}
.vbt-legend div{display:flex;align-items:center;gap:6px;}
.vbt-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
.vbt-lineup-list{list-style:none;margin:0;padding:0;font-size:11px;}
.vbt-lineup-list li{display:flex;align-items:center;gap:6px;padding:5px 2px;border-bottom:1px solid #e2e8f0;}
.vbt-lineup-list li:last-child{border-bottom:none;}
.vbt-jersey-wrap{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;}
.vbt-jersey-input{width:24px;height:24px;border-radius:50%;border:none;text-align:center;font-weight:700;font-size:10.5px;color:#fff;background:transparent;-moz-appearance:textfield;padding:0;}
.vbt-jersey-input::-webkit-outer-spin-button,.vbt-jersey-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.vbt-jersey-wrap.vbt-libero .vbt-jersey-input{color:#1e293b;}
.vbt-setter-tag{position:absolute;top:-4px;right:-4px;background:#9333ea;color:#fff;font-size:7px;font-weight:800;width:12px;height:12px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid #f8fafc;}
.vbt-position-input{font-weight:600;color:#0f172a;font-size:10.5px;font-family:inherit;border:none;background:transparent;padding:1px 3px;border-radius:3px;width:100%;min-width:0;}
.vbt-position-input:hover,.vbt-position-input:focus{background:#e2e8f0;outline:none;}
.vbt-zone{color:#64748b;font-size:9px;}
.vbt-tag{font-size:8.5px;font-weight:700;padding:1px 5px;border-radius:7px;flex-shrink:0;}
.vbt-tag.vbt-tag-libero{color:#92400e;background:#fef3c7;}
.vbt-tag.vbt-tag-setter{color:#6b21a8;background:#f3e8ff;}
.vbt-status{margin-top:8px;padding:7px 8px;border-radius:6px;font-size:10.5px;font-weight:600;line-height:1.4;white-space:pre-line;}
.vbt-status.ok{background:#dcfce7;color:#166534;}
.vbt-status.bad{background:#fee2e2;color:#991b1b;}
.vbt-status.idle{background:#f1f5f9;color:#475569;}
.vbt-hidden-blur{filter:blur(5px);user-select:none;pointer-events:none;}
.vbt-court-card svg{touch-action:none;display:block;}
.vbt-player{cursor:grab;}
.vbt-player:active{cursor:grabbing;}
.vbt-player-body{filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));}
.vbt-player-head{fill:#f0c29c;}
.vbt-player-shadow{fill:rgba(0,0,0,.28);}
.vbt-player-label{fill:#fff;font-weight:800;text-anchor:middle;dominant-baseline:central;pointer-events:none;font-family:inherit;}
.vbt-zone-label{fill:#7c5a2e;font-weight:700;text-anchor:middle;opacity:.55;pointer-events:none;}
.vbt-violation-line{stroke:#dc2626;stroke-dasharray:6 5;}
.vbt-court-label{fill:#f8fafc;font-weight:700;letter-spacing:1px;}
`;
    document.head.appendChild(style);
  }

  function svgEl(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function div(cls, css) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    if (css) d.style.cssText = css;
    return d;
  }

  function zoneForLineupPosition(n, offset) {
    return CLOCKWISE[(offset + (n - 1)) % 6];
  }

  function computeFormation(rotationOffset) {
    const players = {};
    for (let n = 1; n <= 6; n++) {
      const zone = zoneForLineupPosition(n, rotationOffset);
      const c = ZONE_COORDS[zone];
      players[n] = { x: c.x, y: c.y, zone };
    }
    return players;
  }

  function normalizeState(raw) {
    raw = raw || {};
    const s = {
      rotationOffset: typeof raw.rotationOffset === 'number' ? raw.rotationOffset : 0,
      liberoSlot: raw.liberoSlot || 'none',
      setterNum: raw.setterNum || 'none',
      uniformColor: !!raw.uniformColor,
      courtSize: COURT_SIZES[raw.courtSize] ? raw.courtSize : 'standard',
      lineupHidden: !!raw.lineupHidden,
      jerseys: Object.assign({ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' }, raw.jerseys),
      positionNames: Object.assign(
        { 1: 'Position 1', 2: 'Position 2', 3: 'Position 3', 4: 'Position 4', 5: 'Position 5', 6: 'Position 6' },
        raw.positionNames
      )
    };
    const formation = computeFormation(s.rotationOffset);
    s.players = {};
    for (let n = 1; n <= 6; n++) {
      const saved = raw.players && raw.players[n];
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
        s.players[n] = { x: saved.x, y: saved.y, zone: formation[n].zone };
      } else {
        s.players[n] = formation[n];
      }
    }
    return s;
  }

  function cloneState(s) {
    return JSON.parse(JSON.stringify(s));
  }

  window.VolleyballTrainer = {
    mount(container, data, sc, opts) {
      injectStyles();
      opts = opts || {};
      sc = sc || 1;
      const notify = typeof opts.onChange === 'function' ? opts.onChange : null;

      let state = normalizeState(data);
      function emit() { if (notify) notify(cloneState(state)); }

      // ---- geometry: the whole widget is built at a fixed 960x540 "design canvas" and
      // scaled as one unit via a CSS transform below — nothing in here needs to know sc. ----
      const MARGIN_TOP = 70, MARGIN_RIGHT = 50, MARGIN_BOTTOM = 34, MARGIN_LEFT = 90;
      function pxPerFt() { return COURT_SIZES[state.courtSize]; }
      function dims() {
        const p = pxPerFt();
        return { svgW: MARGIN_LEFT + COURT_W * p + MARGIN_RIGHT, svgH: MARGIN_TOP + COURT_L * p + MARGIN_BOTTOM };
      }
      function ftToPx(x, y) {
        const p = pxPerFt();
        return { x: MARGIN_LEFT + x * p, y: MARGIN_TOP + y * p };
      }

      const DESIGN_W = 960, DESIGN_H = 540;
      container.innerHTML = '';
      const scaleWrap = div('', `position:relative;width:${DESIGN_W * sc}px;height:${DESIGN_H * sc}px;overflow:hidden;`);
      const root = div('vbt-root', `width:${DESIGN_W}px;height:${DESIGN_H}px;transform:scale(${sc});transform-origin:top left;`);
      scaleWrap.appendChild(root);

      // ── Controls column ─────────────────────────────────────────
      const controls = div('vbt-panel vbt-controls');
      controls.appendChild(Object.assign(document.createElement('div'), { className: 'vbt-h', textContent: 'Controls' }));

      const rotLabel = document.createElement('label'); rotLabel.className = 'vbt-label'; rotLabel.textContent = 'Rotation';
      const rotSelect = document.createElement('select'); rotSelect.className = 'vbt-select';
      for (let i = 0; i < 6; i++) {
        const o = document.createElement('option'); o.value = String(i); o.textContent = 'Rotation ' + (i + 1);
        rotSelect.appendChild(o);
      }
      controls.append(rotLabel, rotSelect);

      const rotateRow = div('vbt-row');
      const rotateBtn = document.createElement('button'); rotateBtn.className = 'vbt-btn'; rotateBtn.textContent = '↻ Rotate';
      const resetBtn = document.createElement('button'); resetBtn.className = 'vbt-btn'; resetBtn.textContent = 'Reset';
      rotateRow.append(rotateBtn, resetBtn);
      controls.appendChild(rotateRow);

      const liberoLabel = document.createElement('label'); liberoLabel.className = 'vbt-label'; liberoLabel.textContent = 'Libero replaces';
      const liberoSelect = document.createElement('select'); liberoSelect.className = 'vbt-select';
      controls.append(liberoLabel, liberoSelect);

      const setterLabel = document.createElement('label'); setterLabel.className = 'vbt-label'; setterLabel.textContent = 'Setter';
      const setterSelect = document.createElement('select'); setterSelect.className = 'vbt-select';
      controls.append(setterLabel, setterSelect);

      const sizeLabel = document.createElement('label'); sizeLabel.className = 'vbt-label'; sizeLabel.textContent = 'Court size';
      const sizeSelect = document.createElement('select'); sizeSelect.className = 'vbt-select';
      [['compact', 'Compact'], ['standard', 'Standard'], ['large', 'Large'], ['xlarge', 'Extra Large']].forEach(([v, t]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = t;
        sizeSelect.appendChild(o);
      });
      controls.append(sizeLabel, sizeSelect);

      const uniformRow = div('vbt-check-row');
      const uniformCheck = document.createElement('input'); uniformCheck.type = 'checkbox';
      const uniformLbl = document.createElement('label'); uniformLbl.textContent = 'Same color (except Libero)';
      uniformRow.append(uniformCheck, uniformLbl);
      const uniformHint = div('vbt-hint', ''); uniformHint.textContent = 'Hides the front/back row color cue.';
      controls.append(uniformRow, uniformHint);

      const checkBtn = document.createElement('button'); checkBtn.className = 'vbt-btn vbt-primary'; checkBtn.style.marginBottom = '6px';
      checkBtn.textContent = 'Check Overlaps';
      const hideBtn = document.createElement('button'); hideBtn.className = 'vbt-btn';
      hideBtn.textContent = 'Hide Lineup';
      controls.append(checkBtn, hideBtn);

      const legend = div('vbt-legend');
      [
        ['#2563eb', 'Front row'], ['#16a34a', 'Back row'], ['#f59e0b', 'Libero'],
        ['#9333ea', 'Setter (badge)'], ['#dc2626', 'Overlap violation'],
        ['#eab308', 'Double-clicked player'], ['#06b6d4', 'Bound-by neighbor']
      ].forEach(([color, text]) => {
        const row = div(); const dot = div('vbt-dot'); dot.style.background = color;
        const txt = document.createElement('span'); txt.textContent = text;
        row.append(dot, txt); legend.appendChild(row);
      });
      controls.appendChild(legend);
      const boundHint = div('vbt-hint', 'margin-top:6px;');
      boundHint.textContent = "Double-click any player to see who they're bound by. Double-click again, or double-click empty court, to clear.";
      controls.appendChild(boundHint);

      // ── Court column ────────────────────────────────────────────
      const courtCard = div('vbt-court-card');
      const svg = svgEl('svg', {});
      courtCard.appendChild(svg);

      // ── Lineup column ───────────────────────────────────────────
      const lineupPanel = div('vbt-panel vbt-lineup');
      lineupPanel.appendChild(Object.assign(document.createElement('div'), { className: 'vbt-h', textContent: 'Lineup Order' }));
      const lineupList = document.createElement('ul'); lineupList.className = 'vbt-lineup-list';
      lineupPanel.appendChild(lineupList);
      const status = div('vbt-status idle', ''); status.textContent = 'Set a rotation, drag players, then check.';
      lineupPanel.appendChild(status);

      root.append(controls, courtCard, lineupPanel);
      container.appendChild(scaleWrap);

      let violationLayer = null;
      let boundLayer = null; // holds the dashed "bound by" lines drawn from the inspected player
      let playerGroups = {}; // lineup num -> <g> element, for live updates during drag
      let boundSelection = null; // lineup slot (1-6) currently inspected via double-click, or null

      // ---- court drawing ----
      function drawCourt() {
        const { svgW, svgH } = dims();
        svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
        svg.setAttribute('width', svgW);
        svg.setAttribute('height', svgH);
        svg.innerHTML = '';

        const defs = svgEl('defs', {});
        const pattern = svgEl('pattern', { id: 'vbtNetMesh', width: 8, height: 8, patternUnits: 'userSpaceOnUse' });
        pattern.appendChild(svgEl('rect', { x: 0, y: 0, width: 8, height: 8, fill: '#e2e8f0', opacity: 0.15 }));
        pattern.appendChild(svgEl('path', { d: 'M0,8 L8,0', stroke: '#cbd5e1', 'stroke-width': 1 }));
        defs.appendChild(pattern);
        svg.appendChild(defs);

        svg.appendChild(svgEl('rect', { x: 0, y: 0, width: svgW, height: svgH, fill: '#1e293b' }));

        const p0 = ftToPx(0, 0), p1 = ftToPx(COURT_W, COURT_L);

        drawBench(p0, p1);

        svg.appendChild(svgEl('rect', { x: p0.x, y: p0.y, width: p1.x - p0.x, height: p1.y - p0.y, fill: '#e2b878', stroke: '#8a5a20', 'stroke-width': 1 }));
        svg.appendChild(svgEl('rect', { x: p0.x, y: p0.y, width: p1.x - p0.x, height: p1.y - p0.y, fill: 'none', stroke: '#ffffff', 'stroke-width': 3 }));

        const attackY = ftToPx(0, 10).y;
        svg.appendChild(svgEl('line', { x1: p0.x, y1: attackY, x2: p1.x, y2: attackY, stroke: '#ffffff', 'stroke-width': 2.2 }));
        const attackLabel = svgEl('text', { x: p1.x + 6, y: attackY + 4, class: 'vbt-court-label', 'font-size': 9 });
        attackLabel.textContent = "10' LINE";
        svg.appendChild(attackLabel);

        drawNet(p0, p1);

        const endLabel = svgEl('text', { x: (p0.x + p1.x) / 2, y: p1.y + 18, class: 'vbt-court-label', 'text-anchor': 'middle', 'font-size': 9 });
        endLabel.textContent = 'END LINE';
        svg.appendChild(endLabel);

        violationLayer = svgEl('g', {});
        svg.appendChild(violationLayer);

        boundLayer = svgEl('g', {});
        svg.appendChild(boundLayer);

        for (const z in ZONE_COORDS) {
          const c = ZONE_COORDS[z];
          const p = ftToPx(c.x, c.y);
          const t = svgEl('text', { x: p.x, y: p.y + 26, class: 'vbt-zone-label', 'font-size': 8 });
          t.textContent = z;
          svg.appendChild(t);
        }
      }

      function drawNet(p0, p1) {
        const netY = p0.y;
        const netTop = netY - 34;
        const g = svgEl('g', {});

        g.appendChild(svgEl('line', { x1: p0.x, y1: netTop - 16, x2: p0.x, y2: netTop, stroke: '#dc2626', 'stroke-width': 1.5 }));
        g.appendChild(svgEl('line', { x1: p1.x, y1: netTop - 16, x2: p1.x, y2: netTop, stroke: '#dc2626', 'stroke-width': 1.5 }));

        g.appendChild(svgEl('rect', { x: p0.x - 12, y: netTop - 8, width: 5, height: (netY - netTop) + 32, rx: 2, fill: '#1f2937' }));
        g.appendChild(svgEl('rect', { x: p1.x + 7, y: netTop - 8, width: 5, height: (netY - netTop) + 32, rx: 2, fill: '#1f2937' }));

        g.appendChild(svgEl('rect', { x: p0.x - 5, y: netTop + 5, width: (p1.x - p0.x) + 10, height: (netY - netTop) - 9, fill: 'url(#vbtNetMesh)', opacity: 0.9 }));
        g.appendChild(svgEl('rect', { x: p0.x - 7, y: netTop, width: (p1.x - p0.x) + 14, height: 5.5, rx: 2, fill: '#ffffff', stroke: '#94a3b8', 'stroke-width': 0.8 }));
        g.appendChild(svgEl('rect', { x: p0.x - 5, y: netY - 3, width: (p1.x - p0.x) + 10, height: 4, fill: '#111827' }));

        const midX = (p0.x + p1.x) / 2;
        g.appendChild(svgEl('line', { x1: midX, y1: netTop, x2: midX, y2: netY, stroke: '#94a3b8', 'stroke-width': 1, 'stroke-dasharray': '2 3' }));

        svg.appendChild(g);

        const netLabel = svgEl('text', { x: midX, y: netTop - 20, class: 'vbt-court-label', 'text-anchor': 'middle', 'font-size': 9 });
        netLabel.textContent = 'NET';
        svg.appendChild(netLabel);
      }

      function drawBench(p0, p1) {
        const attackY = ftToPx(0, 10).y;
        const benchX = 14;
        const benchW = Math.max(26, p0.x - 30);
        const benchY = attackY + 10;
        const benchH = Math.max(20, (p1.y - benchY) - 10);

        const g = svgEl('g', {});
        g.appendChild(svgEl('rect', { x: benchX, y: benchY, width: benchW, height: benchH, rx: 8, fill: '#5b3a20', stroke: '#3f2714', 'stroke-width': 1.5 }));
        svg.appendChild(g);

        const label = svgEl('text', { x: benchX + benchW / 2, y: benchY + benchH / 2, class: 'vbt-court-label', 'text-anchor': 'middle', 'font-size': 8.5 });
        label.textContent = 'BENCH';
        label.setAttribute('transform', `rotate(-90 ${benchX + benchW / 2} ${benchY + benchH / 2})`);
        svg.appendChild(label);
      }

      // ---- player logic ----
      function isFrontRow(n) { return FRONT_ZONES.includes(state.players[n].zone); }
      function isLiberoActive(n) { return state.liberoSlot !== 'none' && String(state.liberoSlot) === String(n) && !isFrontRow(n); }
      function colorFor(n) {
        if (isLiberoActive(n)) return '#f59e0b';
        if (state.uniformColor) return '#0d9488';
        return isFrontRow(n) ? '#2563eb' : '#16a34a';
      }

      // ---- bound-by inspection mode (double-click a player) ----
      function playerNumByZone(zone) {
        for (let n = 1; n <= 6; n++) { if (state.players[n].zone === zone) return n; }
        return null;
      }

      // True if the two given zones are still in legal order relative to each other,
      // based on the players currently occupying them.
      function pairLegal(zoneX, zoneY) {
        const rule = RULES.find(r => (r.a === zoneX && r.b === zoneY) || (r.a === zoneY && r.b === zoneX));
        if (!rule) return true;
        const numA = playerNumByZone(rule.a), numB = playerNumByZone(rule.b);
        if (numA === null || numB === null) return true;
        const pa = state.players[numA], pb = state.players[numB];
        return rule.type === 'left-of' ? (pa.x < pb.x) : (pa.y < pb.y);
      }

      // Ring styling for a given lineup number while bound mode is active — null if this
      // player isn't the selected player or one of their bound-by neighbors right now.
      function ringColorFor(num) {
        if (boundSelection === null || !state.players[boundSelection]) return null;
        const selZone = state.players[boundSelection].zone;
        const isSelected = String(boundSelection) === String(num);
        const neighborZones = ADJACENCY[selZone] || [];
        const isNeighbor = !isSelected && neighborZones.includes(state.players[num].zone);
        if (!isSelected && !isNeighbor) return null;
        const violated = isSelected
          ? neighborZones.some(nz => !pairLegal(selZone, nz))
          : !pairLegal(selZone, state.players[num].zone);
        return {
          stroke: violated ? '#dc2626' : (isSelected ? '#eab308' : '#06b6d4'),
          strokeWidth: (isSelected || violated) ? 3.5 : 3,
          dash: isSelected ? 'none' : (violated ? 'none' : '5 4')
        };
      }

      // Updates just one player's bound-ring in place (used during drag, so we don't
      // have to rebuild every token on every pointer move).
      function refreshBoundRing(num) {
        const g = playerGroups[num];
        if (!g) return;
        const existing = g.querySelector('.vbt-bound-ring');
        const spec = ringColorFor(num);
        if (!spec) { if (existing) existing.remove(); return; }
        if (existing) {
          existing.setAttribute('stroke', spec.stroke);
          existing.setAttribute('stroke-width', spec.strokeWidth);
          existing.setAttribute('stroke-dasharray', spec.dash);
        } else {
          const ring = svgEl('circle', {
            cx: 0, cy: -10, r: 30, fill: 'none', class: 'vbt-bound-ring',
            stroke: spec.stroke, 'stroke-width': spec.strokeWidth, 'stroke-dasharray': spec.dash, opacity: 0.9
          });
          g.insertBefore(ring, g.firstChild);
        }
      }

      // Draws dashed lines from the selected player to each player they're "bound by".
      // Lives in its own layer beneath the player tokens so the tokens stay on top.
      function drawBoundHighlight() {
        if (!boundLayer) return;
        boundLayer.innerHTML = '';
        if (boundSelection === null || !state.players[boundSelection]) return;
        const selZone = state.players[boundSelection].zone;
        const selP = ftToPx(state.players[boundSelection].x, state.players[boundSelection].y);
        const neighborZones = ADJACENCY[selZone] || [];
        for (let n = 1; n <= 6; n++) {
          if (String(n) === String(boundSelection)) continue;
          if (!neighborZones.includes(state.players[n].zone)) continue;
          const p = ftToPx(state.players[n].x, state.players[n].y);
          const legal = pairLegal(selZone, state.players[n].zone);
          boundLayer.appendChild(svgEl('line', {
            x1: selP.x, y1: selP.y, x2: p.x, y2: p.y,
            stroke: legal ? '#06b6d4' : '#dc2626',
            'stroke-width': legal ? 2.2 : 3,
            'stroke-dasharray': legal ? '6 4' : 'none',
            opacity: legal ? 0.85 : 0.95
          }));
        }
      }

      // Updates the status box with who the inspected player is bound by, while bound
      // mode is active.
      function updateBoundStatus() {
        if (boundSelection === null || !state.players[boundSelection]) return;
        const zone = state.players[boundSelection].zone;
        const neighborZones = ADJACENCY[zone] || [];
        const names = [];
        let anyViolation = false;
        for (let n = 1; n <= 6; n++) {
          if (!neighborZones.includes(state.players[n].zone)) continue;
          const legal = pairLegal(zone, state.players[n].zone);
          if (!legal) anyViolation = true;
          names.push(`Player ${state.jerseys[n]} (${ZONE_NAMES[state.players[n].zone]})${legal ? '' : ' ⚠ ILLEGAL'}`);
        }
        const tail = 'Double-click them again, or double-click the court, to clear.';
        const msg = `Player ${state.jerseys[boundSelection]} (${ZONE_NAMES[zone]}) is bound by: ${names.join(', ')}. ${tail}`;
        setStatus(anyViolation ? 'bad' : 'idle', anyViolation ? `✗ ${msg}` : msg);
      }

      const HEAD_R = 7, BODY_W = 26, BODY_H = 21;

      function buildPlayerToken(n) {
        const p = ftToPx(state.players[n].x, state.players[n].y);
        const isLibero = isLiberoActive(n);
        const isSetter = String(state.setterNum) === String(n);
        const fill = colorFor(n);
        const SHOULDER_Y = -BODY_H / 2;

        const g = svgEl('g', { class: 'vbt-player', 'data-num': n, transform: `translate(${p.x},${p.y})` });

        // Bound-by highlight ring: gold for the double-clicked player, cyan for the
        // neighbors they're bound by. Turns red the instant a bound pair goes illegal.
        const ringSpec = ringColorFor(n);
        if (ringSpec) {
          g.appendChild(svgEl('circle', {
            cx: 0, cy: -10, r: 30, fill: 'none', class: 'vbt-bound-ring',
            stroke: ringSpec.stroke, 'stroke-width': ringSpec.strokeWidth, 'stroke-dasharray': ringSpec.dash, opacity: 0.9
          }));
        }

        g.appendChild(svgEl('ellipse', { cx: 0, cy: BODY_H / 2 + 6, rx: 13, ry: 3.5, class: 'vbt-player-shadow' }));
        g.appendChild(svgEl('rect', { x: -BODY_W / 2 - 4, y: SHOULDER_Y + 2, width: 5, height: 14, rx: 2.5, fill }));
        g.appendChild(svgEl('rect', { x: BODY_W / 2 - 1, y: SHOULDER_Y + 2, width: 5, height: 14, rx: 2.5, fill }));

        const body = svgEl('rect', {
          x: -BODY_W / 2, y: -BODY_H / 2, width: BODY_W, height: BODY_H, rx: 7, ry: 7,
          class: 'vbt-player-body', fill,
          stroke: isSetter ? '#9333ea' : '#fff', 'stroke-width': isSetter ? 3 : 2
        });
        g.appendChild(body);

        g.appendChild(svgEl('circle', { cx: 0, cy: -BODY_H / 2 - HEAD_R - 1, r: HEAD_R, class: 'vbt-player-head', stroke: '#fff', 'stroke-width': 1.5 }));

        const label = svgEl('text', { x: 0, y: 1, class: 'vbt-player-label', 'font-size': 12 });
        label.textContent = isLibero ? 'L' : state.jerseys[n];
        g.appendChild(label);

        if (isSetter) {
          const bx = BODY_W / 2 - 2, by = -BODY_H / 2 - HEAD_R * 2 - 1;
          g.appendChild(svgEl('circle', { cx: bx, cy: by, r: 7, fill: '#9333ea', stroke: '#fff', 'stroke-width': 1.2 }));
          const bt = svgEl('text', { x: bx, y: by, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff', 'font-size': 8, 'font-weight': 800, 'pointer-events': 'none' });
          bt.textContent = 'S';
          g.appendChild(bt);
        }

        return g;
      }

      function render() {
        svg.querySelectorAll('.vbt-player').forEach(n => n.remove());
        if (violationLayer) violationLayer.innerHTML = '';
        drawBoundHighlight();
        playerGroups = {};
        for (let n = 1; n <= 6; n++) {
          const g = buildPlayerToken(n);
          svg.appendChild(g);
          attachDrag(g, n);
          playerGroups[n] = g;
        }
        renderLineupPanel();
        updateBoundStatus();
      }

      function renderLineupPanel() {
        lineupList.innerHTML = '';
        for (let n = 1; n <= 6; n++) {
          const zone = state.players[n].zone;
          const isLibero = isLiberoActive(n);
          const isSetter = String(state.setterNum) === String(n);
          const li = document.createElement('li');
          if (state.lineupHidden) li.classList.add('vbt-hidden-blur');

          const jerseyWrap = div('vbt-jersey-wrap' + (isLibero ? ' vbt-libero' : ''));
          jerseyWrap.style.background = colorFor(n);
          const input = document.createElement('input');
          input.type = 'text'; input.inputMode = 'numeric'; input.maxLength = 2;
          input.className = 'vbt-jersey-input';
          input.value = isLibero ? 'L' : state.jerseys[n];
          input.disabled = isLibero;
          input.addEventListener('change', (e) => {
            const v = e.target.value.trim();
            state.jerseys[n] = v === '' ? String(n) : v;
            populateSelects();
            render();
            emit();
          });
          jerseyWrap.appendChild(input);
          if (isSetter) {
            const tag = div('vbt-setter-tag'); tag.textContent = 'S';
            jerseyWrap.appendChild(tag);
          }

          const textWrap = div(); textWrap.style.flex = '1'; textWrap.style.minWidth = '0';
          const posRow = div(); posRow.style.cssText = 'display:flex;align-items:center;gap:4px;';
          const posInput = document.createElement('input');
          posInput.type = 'text'; posInput.className = 'vbt-position-input';
          posInput.value = state.positionNames[n];
          posInput.addEventListener('change', (e) => {
            const v = e.target.value.trim();
            state.positionNames[n] = v === '' ? `Position ${n}` : v;
            emit();
          });
          posRow.appendChild(posInput);
          if (isLibero) { const t = div('vbt-tag vbt-tag-libero'); t.textContent = 'Libero'; posRow.appendChild(t); }
          if (isSetter) { const t = div('vbt-tag vbt-tag-setter'); t.textContent = 'Setter'; posRow.appendChild(t); }
          textWrap.appendChild(posRow);
          const zoneDiv = div('vbt-zone'); zoneDiv.textContent = ZONE_NAMES[zone] || zone;
          textWrap.appendChild(zoneDiv);

          li.append(jerseyWrap, textWrap);
          lineupList.appendChild(li);
        }
      }

      function populateSelects() {
        [liberoSelect, setterSelect].forEach(sel => {
          const current = sel.value;
          sel.innerHTML = '';
          const noneOpt = document.createElement('option'); noneOpt.value = 'none'; noneOpt.textContent = 'None';
          sel.appendChild(noneOpt);
          for (let n = 1; n <= 6; n++) {
            const o = document.createElement('option'); o.value = n;
            o.textContent = `Player ${state.jerseys[n]} (Slot ${n})`;
            sel.appendChild(o);
          }
          if ([...sel.options].some(o => o.value === current)) sel.value = current;
        });
        liberoSelect.value = state.liberoSlot;
        setterSelect.value = state.setterNum;
      }

      // ---- drag (pointer-capture based, no window-level listeners to leak) ----
      function attachDrag(g, num) {
        function toFt(evt) {
          const { svgW, svgH } = dims();
          const rect = svg.getBoundingClientRect();
          const scaleX = svgW / rect.width, scaleY = svgH / rect.height;
          const px = (evt.clientX - rect.left) * scaleX;
          const py = (evt.clientY - rect.top) * scaleY;
          const p = pxPerFt();
          let x = (px - MARGIN_LEFT) / p;
          let y = (py - MARGIN_TOP) / p;
          x = Math.max(1.2, Math.min(COURT_W - 1.2, x));
          y = Math.max(1.2, Math.min(COURT_L - 1.2, y));
          return { x, y };
        }
        let dragging = false;
        g.addEventListener('pointerdown', (evt) => {
          dragging = true;
          g.setPointerCapture(evt.pointerId);
          evt.preventDefault();
        });
        g.addEventListener('pointermove', (evt) => {
          if (!dragging) return;
          const { x, y } = toFt(evt);
          state.players[num].x = x; state.players[num].y = y;
          const p = ftToPx(x, y);
          g.setAttribute('transform', `translate(${p.x},${p.y})`);
          renderLineupPanel();
          if (violationLayer) violationLayer.innerHTML = '';

          if (boundSelection !== null && state.players[boundSelection]) {
            // Bound mode: live red feedback the instant a bound pair crosses illegal —
            // no need to click Check Overlaps. Outside bound mode this never runs.
            drawBoundHighlight();
            const selZone = state.players[boundSelection].zone;
            const neighborZones = ADJACENCY[selZone] || [];
            if (String(num) === String(boundSelection)) {
              refreshBoundRing(num);
              for (let m = 1; m <= 6; m++) { if (neighborZones.includes(state.players[m].zone)) refreshBoundRing(m); }
            } else if (neighborZones.includes(state.players[num].zone)) {
              refreshBoundRing(num);
              refreshBoundRing(boundSelection);
            }
            updateBoundStatus();
          } else {
            setStatus('idle', 'Positions changed — click "Check Overlaps" to validate.');
          }
        });
        function end(evt) {
          if (!dragging) return;
          dragging = false;
          try { g.releasePointerCapture(evt.pointerId); } catch (e) {}
          emit();
        }
        g.addEventListener('pointerup', end);
        g.addEventListener('pointercancel', end);
        g.addEventListener('dblclick', (evt) => {
          evt.stopPropagation(); // don't let it bubble to the court's "clear selection" handler
          boundSelection = (String(boundSelection) === String(num)) ? null : num;
          render();
        });
      }

      // ---- overlap checking ----
      function checkOverlaps() {
        const pos = {};
        for (let n = 1; n <= 6; n++) pos[state.players[n].zone] = { num: n, x: state.players[n].x, y: state.players[n].y };
        const violations = [];
        function checkPair(a, b, rule) {
          if (!pos[a] || !pos[b]) return;
          if (rule === 'left-of') { if (!(pos[a].x < pos[b].x)) violations.push({ a: pos[a].num, b: pos[b].num, rule: `${a} must stay left of ${b}` }); }
          else if (rule === 'front-of') { if (!(pos[a].y < pos[b].y)) violations.push({ a: pos[a].num, b: pos[b].num, rule: `${a} must stay in front of ${b}` }); }
        }
        checkPair('LF', 'MF', 'left-of'); checkPair('MF', 'RF', 'left-of');
        checkPair('LB', 'MB', 'left-of'); checkPair('MB', 'RB', 'left-of');
        checkPair('LF', 'LB', 'front-of'); checkPair('MF', 'MB', 'front-of'); checkPair('RF', 'RB', 'front-of');

        if (violationLayer) violationLayer.innerHTML = '';
        if (violations.length === 0) {
          setStatus('ok', '✓ No overlap violations. Legal positioning for this rotation.');
        } else {
          const msgs = violations.map(v => `Player ${state.jerseys[v.a]} / Player ${state.jerseys[v.b]}: ${v.rule}`);
          setStatus('bad', '✗ Overlap violation(s):\n' + msgs.join('\n'));
          violations.forEach(v => {
            const p1 = ftToPx(state.players[v.a].x, state.players[v.a].y);
            const p2 = ftToPx(state.players[v.b].x, state.players[v.b].y);
            violationLayer.appendChild(svgEl('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: 'vbt-violation-line', 'stroke-width': 2.4 }));
          });
        }
      }

      function setStatus(kind, msg) {
        status.className = 'vbt-status ' + kind;
        status.textContent = msg;
      }

      // ---- wiring ----
      function resetToFormation() {
        state.players = computeFormation(state.rotationOffset);
        drawCourt(); render();
        setStatus('idle', 'Positions reset to standard rotation. Drag players, then check.');
        emit();
      }

      rotSelect.addEventListener('change', () => {
        state.rotationOffset = parseInt(rotSelect.value, 10);
        resetToFormation();
      });
      rotateBtn.addEventListener('click', () => {
        state.rotationOffset = (state.rotationOffset + 1) % 6;
        rotSelect.value = state.rotationOffset;
        resetToFormation();
      });
      resetBtn.addEventListener('click', resetToFormation);
      liberoSelect.addEventListener('change', () => { state.liberoSlot = liberoSelect.value; render(); emit(); });
      setterSelect.addEventListener('change', () => { state.setterNum = setterSelect.value; render(); emit(); });
      uniformCheck.addEventListener('change', () => { state.uniformColor = uniformCheck.checked; render(); emit(); });
      sizeSelect.addEventListener('change', () => { state.courtSize = sizeSelect.value; drawCourt(); render(); emit(); });
      checkBtn.addEventListener('click', checkOverlaps);
      hideBtn.addEventListener('click', () => {
        state.lineupHidden = !state.lineupHidden;
        hideBtn.textContent = state.lineupHidden ? 'Show Lineup' : 'Hide Lineup';
        renderLineupPanel();
      });

      // Double-clicking empty court (not a player) clears any bound-by highlight.
      // Player tokens call stopPropagation() so this only fires when the double-click
      // didn't land on a player.
      svg.addEventListener('dblclick', () => {
        if (boundSelection !== null) { boundSelection = null; render(); }
      });

      // ---- initial paint ----
      rotSelect.value = state.rotationOffset;
      sizeSelect.value = state.courtSize;
      uniformCheck.checked = state.uniformColor;
      populateSelects();
      drawCourt();
      render();
    }
  };
})();
