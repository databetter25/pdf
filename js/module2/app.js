/* 모듈 2 화면 컨트롤러: 누적분포함수
 * <body data-page="continuous|discrete|lab" data-root="../" data-current="m2c|m2d|m2l">
 */
(function () {
  'use strict';
  const RVL = window.RVL;
  const D = RVL.dist, H = RVL.hist, RNG = RVL.rng, E = RVL.ecdf, S = RVL.shell;
  const { $, $$, fNum, fInt, f4, clamp, N_LIST, nearestNIndex } = S;
  const body = document.body;
  const PAGE = body.dataset.page;
  const ROOT = body.dataset.root || '';
  const STEPS = PAGE === 'lab' ? null : RVL.steps2[PAGE];
  const ALL = ['dist', 'n', 'more', 'draw', 'top', 'overlays', 'ov-ecdf', 'ov-cdf', 'ov-dn', 'ov-band', 'ov-tangent', 'ov-toptheory', 'cursor', 'play', 'inverse', 'conv', 'seed'];
  const PLAY_SEQ = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
  const CONV_GRID = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6];
  const SHAPES = { continuous: ['exponential', 'normal', 'uniform', 'mixture'], discrete: ['binomial', 'dice', 'poisson'] };
  const RUG_MAX = 3000, DOTS_MAX = 300, INV_MAX = 20000;

  /* ───────── 상태 ───────── */
  const kindOfPage = PAGE === 'discrete' ? 'discrete' : 'continuous';
  const state = {
    step: 0, dist: kindOfPage === 'discrete' ? 'binomial' : 'exponential', params: null, n: 100, seed: 2026,
    top: 'rug', k: 30, showEcdf: true, showCdf: PAGE === 'lab', showTopTheory: false, showDn: false, showBand: false, showTangent: false,
    cursor: 'x', cx: 0.5, cp: 0.5, ca: 0, cb: 1, inclA: true, inclB: true, invMode: false, invCount: 0,
  };
  state.params = D.get(state.dist).defaults();
  let view, conv, lastModel = null;
  let playing = false, playTimer = null, playIdx = 0;
  let animTimers = [], animating = false, sweepRaf = null;
  let invBusy = false;

  const dist = () => D.get(state.dist);
  const kind = () => dist().type;
  const controls = () => (STEPS ? STEPS[state.step].controls : ALL);
  const cursors = () => (STEPS ? STEPS[state.step].cursors : ['x', 'p', 'interval']);

  /* ───────── 표본 ───────── */
  const streams = new Map();
  function stream(tag = 'main') {
    const key = tag + '|' + state.dist + '|' + JSON.stringify(state.params) + '|' + state.seed;
    let s = streams.get(key);
    if (!s) {
      const d = dist(), P = { ...state.params };
      if (tag === 'inv') {
        // 역변환: u를 저장하고 x = Q(u)
        const r = RNG.createRng(state.seed + 7919);
        s = { u: [], x: [], get(n) { while (this.u.length < n) { const u = r.random(); this.u.push(u); this.x.push(d.quantile(u, P)); } return this; } };
      } else {
        s = new RNG.SampleStream((rng) => d.sampler(rng, P), state.seed);
      }
      streams.set(key, s);
      if (streams.size > 6) streams.delete(streams.keys().next().value);
    }
    return s;
  }
  const sortCache = { key: null, arr: null };
  function sortedSamples(n) {
    const key = state.dist + JSON.stringify(state.params) + state.seed + '|' + n + '|' + state.invMode;
    if (sortCache.key !== key) {
      const src = state.invMode ? Float64Array.from(stream('inv').get(n).x.slice(0, n)) : stream().get(n);
      sortCache.arr = E.sorted(src, n);
      sortCache.key = key;
    }
    return sortCache.arr;
  }

  function domain() {
    const d = dist(), P = state.params;
    if (d.type === 'discrete') { const [a, b] = H.discreteRange(d, P); return { xmin: a, xmax: b, L: a - 1, U: b + 1 }; }
    const [L, U] = H.continuousRange(d, P);
    if (d.type === 'mixed') return { L: -0.06 * U, U };
    return { L, U };
  }

  /* 특수 커서 값 해석: 'median', 'q0.25', 'mode' */
  function resolveX(v) {
    const d = dist(), P = state.params;
    if (typeof v === 'number') return v;
    if (v === 'median') return d.quantile(0.5, P);
    if (v === 'mode') return modeX();
    if (typeof v === 'string' && v[0] === 'q') return d.quantile(+v.slice(1), P);
    return d.quantile(0.5, P);
  }
  function modeX() {
    const d = dist(), P = state.params, { L, U } = domain();
    if (d.type !== 'continuous') return d.quantile(0.5, P);
    let bx = L, by = -1;
    for (let i = 1; i < 400; i++) { const x = L + (U - L) * i / 400; const y = d.pdf(x, P); if (y > by && isFinite(y)) { by = y; bx = x; } }
    return bx;
  }

  /* ───────── 모델 ───────── */
  function computeModel(nShown) {
    const d = dist(), P = state.params, k = d.type;
    const dom = domain();
    const nTot = state.invMode ? Math.min(state.invCount, INV_MAX) : state.n;
    const n = nShown == null ? nTot : nShown;
    const s = n > 0 ? sortedSamples(n) : new Float64Array(0);
    const L = dom.L, U = dom.U;

    /* 이론 CDF */
    let cdf = null;
    if (state.showCdf) {
      const polys = [], jumps = [];
      if (k === 'continuous') {
        polys.push(d3.range(601).map((i) => { const x = L + (U - L) * i / 600; return [x, d.cdf(x, P)]; }));
      } else if (k === 'discrete') {
        for (let j = dom.xmin - 1; j <= dom.xmax; j++) {
          const F = d.cdf(j, P);
          polys.push([[Math.max(L, j), F], [Math.min(U, j + 1), F]]);
          const p = d.pmf(j, P);
          if (j >= dom.xmin && p > 1e-12) jumps.push({ x: j, lo: d.cdf(j - 1, P), hi: F, p });
        }
      } else {
        polys.push([[L, 0], [0, 0]]);
        polys.push(d3.range(601).map((i) => { const x = U * i / 600; return [x, d.cdf(x, P)]; }));
        for (const a of d.atoms(P)) jumps.push({ x: a.x, lo: d.cdfLeft(a.x, P), hi: d.cdf(a.x, P), p: a.p });
      }
      cdf = { show: state.showCdf, polys, jumps };
    }

    /* ECDF */
    let ecdf = null;
    if (state.showEcdf && n > 0) {
      const pts = [[L, 0]];
      if (n <= RUG_MAX || k === 'discrete') {
        let i = 0;
        while (i < n) { const v = s[i]; let j = i; while (j < n && s[j] === v) j++; pts.push([v, j / n]); i = j; }
      } else {
        const G = 900;
        for (let i = 0; i <= G; i++) { const x = L + (U - L) * i / G; pts.push([x, E.at(s, x)]); }
        if (k === 'mixed') { pts.push([0, E.at(s, 0)]); pts.push([-1e-9, E.at(s, -1e-9)]); pts.sort((a, b) => a[0] - b[0]); }
      }
      pts.push([U, 1]);
      ecdf = { points: pts };
    }
    const band = state.showBand && ecdf && controls().includes('ov-band') ? (() => {
      const eps = E.dkw(n);
      return ecdf.points.map(([x, y]) => [x, Math.max(0, y - eps), Math.min(1, y + eps)]);
    })() : null;

    let dn = null, dnRes = null;
    if (n > 0 && !state.invMode) dnRes = E.dn(s, d, P);
    if (state.showDn && dnRes && controls().includes('ov-dn')) dn = { x: dnRes.x, y1: dnRes.ecdf, y2: dnRes.cdf, d: dnRes.d };

    /* 커서 */
    const cur = { mode: cursors().length ? state.cursor : 'none' };
    let probs = null;
    if (cur.mode === 'x') {
      cur.x = clamp(state.cx, L, U);
      if (state.showEcdf && n) cur.ecdf = E.at(s, cur.x);
      if (state.showCdf) cur.cdf = d.cdf(cur.x, P);
    } else if (cur.mode === 'p') {
      cur.p = state.cp;
      if (state.showCdf) cur.qT = d.quantile(cur.p, P);
      if (state.showEcdf && n) cur.qE = E.quantile(s, cur.p);
    } else if (cur.mode === 'interval') {
      const a = Math.min(state.ca, state.cb), b = Math.max(state.ca, state.cb);
      cur.a = a; cur.b = b;
      const Fx = state.showCdf ? (x) => d.cdf(x, P) : (x) => E.at(s, x);
      const Fl = state.showCdf ? (x) => d.cdfLeft(x, P) : (x) => (s.length ? E.countLT(s, x) / s.length : 0);
      probs = {
        '≤≤': Fx(b) - Fl(a), '<≤': Fx(b) - Fx(a), '≤<': Fl(b) - Fl(a), '<<': Fl(b) - Fx(a),
      };
      const incl = k === 'continuous' ? [false, true] : [state.inclA, state.inclB];
      cur.Flo = incl[0] ? Fl(a) : Fx(a);
      cur.Fhi = incl[1] ? Fx(b) : Fl(b);
      const sym = (i) => (i ? '≤' : '<');
      cur.symA = sym(incl[0]); cur.symB = sym(incl[1]);
      cur.prob = cur.Fhi - cur.Flo;
      cur.label = `${f4(cur.prob)}`;
    }

    /* 위 그래프 */
    let top = null;
    if (!(STEPS && STEPS[state.step].noTop)) {
      let mode = state.top;
      const tp = { mode, yLabel: '' };
      const theoryCurve = () => {
        const src = k === 'mixed' ? d.pdfCont : d.pdf;
        const pts = d3.range(601).map((i) => { const x = Math.max(k === 'mixed' ? 0 : L, L + (U - L) * i / 600); let y = src(x, P); if (!isFinite(y)) y = 0; return [x, y]; });
        return pts;
      };
      if (mode === 'rug') {
        if (k === 'discrete') {
          if (n <= DOTS_MAX) {
            const cnt = new Map(), dots = [];
            for (let i = 0; i < n; i++) { const v = s[i]; const c = cnt.get(v) || 0; dots.push({ x: v, k: c }); cnt.set(v, c + 1); }
            tp.rug = { dots, maxStack: Math.max(6, ...cnt.values()), cut: cur.mode === 'x' ? cur.x : null };
            tp.yMax = 1;
            tp.mode = 'rug';
          } else mode = 'hist';
        } else if (n <= RUG_MAX) {
          tp.rug = { ticks: s, cut: cur.mode === 'x' ? cur.x : null };
          tp.yMax = 1;
        } else mode = 'hist';
        if (mode === 'hist') tp.rugNote = true;
      }
      if (mode === 'hist') {
        tp.mode = 'hist';
        if (k === 'discrete') {
          const cnt = new Map();
          for (let i = 0; i < n; i++) cnt.set(s[i], (cnt.get(s[i]) || 0) + 1);
          tp.bars = [...cnt.entries()].map(([v, c]) => ({ x0: v - 0.35, x1: v + 0.35, h: c / n, cls: shadeClass(v) }));
          tp.yLabel = '상대도수';
          if (state.showTopTheory) tp.stems = stemsPMF();
        } else {
          const kk = state.invMode ? H.ruleK('scott', s, Math.max(2, n), L, U) : state.k;
          const LL = k === 'mixed' ? 0 : L;
          const bins = H.continuousBins(LL, U, Math.max(5, kk));
          const { counts } = H.binCounts(s, n, bins);
          const h = H.heights(counts, Math.max(1, n), bins.width, 'density');
          tp.bars = Array.from(h, (v, j) => ({ x0: LL + j * bins.width, x1: LL + (j + 1) * bins.width, h: v }));
          tp.yLabel = '밀도';
          tp.binsK = bins.k;
          if (state.showTopTheory) tp.curve = theoryCurve();
          if (k === 'mixed' && state.showTopTheory) tp.stems = d.atoms(P).map((a) => ({ x: a.x, y: 0, label: `x = ${a.x}에 질량 ${a.p.toFixed(2)}` }));
        }
      } else if (mode === 'pdf') {
        tp.mode = 'pdf';
        if (k === 'discrete') { tp.stems = stemsPMF(); tp.yLabel = '확률 p(x)'; }
        else { tp.curve = theoryCurve(); tp.yLabel = k === 'mixed' ? '연속 부분의 밀도' : '밀도 f(x)'; }
      }
      // y 최대값
      let ym = 0;
      if (tp.bars) for (const b of tp.bars) ym = Math.max(ym, b.h);
      if (tp.curve) {
        const ys = tp.curve.map((p) => p[1]).sort((a, b) => a - b);
        const p98 = ys[Math.floor(ys.length * 0.98)];
        ym = Math.max(ym, p98 > 0 ? Math.min(ys[ys.length - 1], p98 * 2.5) : ys[ys.length - 1]);
      }
      if (tp.stems) for (const st of tp.stems) ym = Math.max(ym, st.y);
      if (k === 'mixed' && tp.stems) { const yy = ym * 0.92; tp.stems.forEach((st) => (st.y = yy)); }
      if (tp.mode !== 'rug') tp.yMax = Math.max(ym, 1e-9) * 1.1;
      if (tp.rug && tp.rug.dots) tp.yMax = 1;
      // 넓이 음영
      if (cur.mode === 'x' && tp.mode !== 'rug') tp.shade = { from: L, to: cur.x };
      if (cur.mode === 'interval') tp.shade = { from: cur.a, to: cur.b };
      if (cur.mode === 'p' && isFinite(cur.qT) && tp.mode !== 'rug') tp.shade = { from: L, to: cur.qT };
      if (tp.mode === 'rug' && tp.rug && tp.rug.ticks && n > RUG_MAX) tp.rug = null;
      // 접선 단계의 f(x)
      if (state.showTangent && cur.mode === 'x' && k === 'continuous' && controls().includes('ov-tangent')) {
        tp.mark = { x: cur.x, y: d.pdf(cur.x, P), label: `f(x) = ${d.pdf(cur.x, P).toFixed(3)}` };
      }
      if (tp.rugNote) tp.rug = null;
      tp.aria = `${d.name}의 ${tp.mode === 'rug' ? '표본 점' : tp.mode === 'hist' ? '히스토그램' : '이론 분포'}`;
      top = tp;
    }

    function shadeClass(v) {
      if (cur.mode === 'x') return v <= cur.x ? '' : 'out';
      if (cur.mode === 'interval') return inSet(v) ? '' : 'out';
      return '';
    }
    function inSet(v) {
      if (cur.mode !== 'interval') return false;
      const okA = cur.symA === '≤' ? v >= cur.a : v > cur.a;
      const okB = cur.symB === '≤' ? v <= cur.b : v < cur.b;
      return okA && okB;
    }
    function stemsPMF() {
      const out = [];
      for (let x = dom.xmin; x <= dom.xmax; x++) {
        const p = d.pmf(x, P);
        if (p < 1e-12) continue;
        const st = { x, y: p };
        if (cur.mode === 'x') { if (x <= cur.x) st.on = true; else st.off = true; }
        if (cur.mode === 'interval') { if (inSet(x)) st.on = true; else st.off = true; }
        if (cur.mode === 'x' && Math.abs(x - cur.x) < 1e-9) st.label = `p(${x}) = ${p.toFixed(4)}`;
        out.push(st);
      }
      return out;
    }
    // 이산형 구간 모드: 포함된 점프 강조
    if (cdf && cur.mode === 'interval' && k !== 'continuous') {
      cdf.jumps.forEach((j) => { j.cls = inSet(j.x) ? 'on' : 'off'; });
    }

    const tangent = state.showTangent && cur.mode === 'x' && k === 'continuous' && controls().includes('ov-tangent')
      ? { x: cur.x, y: d.cdf(cur.x, P), slope: d.pdf(cur.x, P), half: (U - L) * 0.12 } : null;

    return {
      kind: k, dist: d, P, n, s, xDomain: [L, U], dom, top, cdf, ecdf, band, dn, dnRes, cursor: cur, probs, tangent,
      xLabel: k === 'discrete' ? 'x (확률변수의 값)' : 'x', yLabel: '누적확률',
      aria: `${d.name}의 누적분포함수${ecdf ? '와 표본 ' + n + '개의 ECDF' : ''}`,
    };
  }

  /* ───────── 상태 변경 ───────── */
  function applyChanges(ch) {
    if ('dist' in ch && ch.dist !== state.dist) {
      const d = D.get(ch.dist);
      state.dist = ch.dist;
      state.params = d.fix({ ...d.defaults(), ...(ch.params || {}) });
      state.invCount = 0;
    } else if (ch.params) state.params = dist().fix({ ...state.params, ...ch.params });
    for (const key of ['n', 'seed', 'top', 'k', 'showEcdf', 'showCdf', 'showTopTheory', 'showDn', 'showBand', 'showTangent', 'cursor', 'cp', 'inclA', 'inclB', 'invMode', 'invCount']) {
      if (key in ch) state[key] = ch[key];
    }
    for (const key of ['cx', 'ca', 'cb']) if (key in ch) state[key] = resolveX(ch[key]);
    state.n = clamp(Math.round(state.n) || 10, 1, 1e6);
    state.k = clamp(Math.round(state.k) || 30, 5, 200);
    state.cp = clamp(+state.cp || 0.5, 0.001, 0.999);
    const { L, U } = domain();
    if (kind() === 'discrete' && state.cursor === 'interval') { state.ca = Math.round(state.ca); state.cb = Math.round(state.cb); }
    state.cx = clamp(isFinite(state.cx) ? state.cx : resolveX('median'), L, U);
    state.ca = clamp(isFinite(state.ca) ? state.ca : resolveX('q0.25'), L, U);
    state.cb = clamp(isFinite(state.cb) ? state.cb : resolveX('q0.75'), L, U);
    if (cursors().length && !cursors().includes(state.cursor)) state.cursor = cursors()[0];
  }
  function stopAll() {
    if (playing) { playing = false; clearTimeout(playTimer); updatePlayButtons(); }
    animating = false; animTimers.forEach(clearTimeout); animTimers = [];
    if (sweepRaf) { cancelAnimationFrame(sweepRaf); sweepRaf = null; }
  }
  function set(ch, opts = {}) {
    stopAll();
    S.toast('');
    const prev = state.dist;
    applyChanges(ch);
    if (state.dist !== prev) buildDistUI();
    render(opts);
  }

  /* ───────── 렌더링 ───────── */
  function render(opts = {}) {
    const m = computeModel(opts.nShown);
    lastModel = m;
    view.render(m, { duration: opts.duration ?? 200 });
    renderLegend(m);
    renderReadouts(m);
    syncControls(m);
    if (opts.nShown == null) { scheduleAux(); scheduleURL(); }
    return m;
  }

  function renderLegend(m) {
    const items = [];
    if (m.top) {
      if (m.top.mode === 'rug') items.push(`<li><span class="sw sw-bar"></span>표본 (커서 왼쪽은 진하게)</li>`);
      if (m.top.mode === 'hist') items.push(`<li><span class="sw sw-bar"></span>${m.kind === 'discrete' ? '상대도수' : `밀도 히스토그램 (구간 ${m.top.binsK}개)`}</li>`);
      if (m.top.curve || m.top.stems) items.push(`<li><span class="sw ${m.kind === 'discrete' ? 'sw-stem' : 'sw-theory'}"></span>${m.kind === 'discrete' ? '이론 확률질량함수' : '이론 밀도'}</li>`);
    }
    if (m.ecdf) items.push(`<li><span class="sw sw-ecdf"></span>ECDF F̂ₙ(x)${state.invMode ? ' (보낸 난수)' : ''}</li>`);
    if (m.cdf && m.cdf.show) items.push('<li><span class="sw sw-theory"></span>이론 CDF F(x)</li>');
    if (m.cdf && m.cdf.jumps && m.cdf.jumps.length && m.cdf.show) items.push('<li><span class="sw sw-pts"></span>○ 열린 점: 포함 안 함, ● 닫힌 점: 포함</li>');
    if (m.dn) items.push('<li><span class="sw sw-dn"></span>최대 거리 Dₙ</li>');
    if (m.band) items.push(`<li><span class="sw sw-band"></span>DKW 95% 띠 (± ${E.dkw(m.n).toFixed(3)})</li>`);
    if (m.tangent) items.push('<li><span class="sw sw-dn"></span>접선과 f(x)</li>');
    $('#legend').innerHTML = items.join('');
  }

  function renderReadouts(m) {
    const c = m.cursor, d = m.dist, P = m.P;
    const rows = [`<div class="ro"><dt>${state.invMode ? '보낸 난수' : 'n'}</dt><dd>${fInt(m.n)}</dd></div>`];
    if (c.mode === 'x') {
      rows.push(`<div class="ro"><dt>x</dt><dd>${fNum(c.x)}</dd></div>`);
      if (isFinite(c.ecdf)) rows.push(`<div class="ro"><dt>F̂ₙ(x) 표본</dt><dd class="c-e">${f4(c.ecdf)}</dd></div>`);
      if (isFinite(c.cdf)) rows.push(`<div class="ro"><dt>F(x) 이론</dt><dd class="c-t">${f4(c.cdf)}</dd></div>`);
      if (isFinite(c.ecdf) && isFinite(c.cdf)) { const df = c.ecdf - c.cdf; rows.push(`<div class="ro"><dt>차이</dt><dd>${Math.abs(df) < 5e-5 ? '0.0000' : (df > 0 ? '+' : '−') + f4(Math.abs(df))}</dd></div>`); }
      if (m.kind !== 'continuous' && state.showCdf) {
        const left = d.cdfLeft(c.x, P);
        rows.push(`<div class="ro"><dt>F(x⁻) = P(X &lt; x)</dt><dd>${f4(left)}</dd></div>`);
        rows.push(`<div class="ro"><dt>점프 F(x) − F(x⁻)</dt><dd>${f4(c.cdf - left)}</dd></div>`);
      }
      if (m.tangent) rows.push(`<div class="ro"><dt>기울기 = f(x)</dt><dd class="c-d">${f4(m.tangent.slope)}</dd></div>`);
    } else if (c.mode === 'p') {
      rows.push(`<div class="ro"><dt>p</dt><dd>${f4(c.p)}</dd></div>`);
      if (isFinite(c.qT)) rows.push(`<div class="ro"><dt>이론 분위수 Q(p)</dt><dd class="c-t">${fNum(c.qT)}</dd></div>`);
      if (isFinite(c.qE)) rows.push(`<div class="ro"><dt>표본 분위수</dt><dd class="c-e">${fNum(c.qE)}</dd></div>`);
    } else if (c.mode === 'interval') {
      const src = state.showCdf ? 'F' : 'F̂ₙ';
      const A = fNum(c.a), B = fNum(c.b);
      if (m.kind === 'continuous') {
        rows.push(`<div class="ro ro-area is-one"><dt>P(${A} &lt; X ≤ ${B}) = ${src}(b) − ${src}(a)</dt><dd>${f4(c.prob)}<small>연속형은 끝점 포함 여부와 관계없이 같습니다</small></dd></div>`);
      } else {
        const pr = m.probs;
        const rowP = (sa, sb, key) => `<tr${c.symA === sa && c.symB === sb ? ' class="cur"' : ''}><td>P(${A} ${sa} X ${sb} ${B})</td><td>${key}</td><td>${f4(pr[sa + sb])}</td></tr>`;
        rows.push(`<div class="ro ro-wide"><dt>끝점 규칙 네 가지 (${src} 기준)</dt><dd><table class="ptab">
          ${rowP('≤', '≤', `${src}(b) − ${src}(a⁻)`)}${rowP('<', '≤', `${src}(b) − ${src}(a)`)}${rowP('≤', '<', `${src}(b⁻) − ${src}(a⁻)`)}${rowP('<', '<', `${src}(b⁻) − ${src}(a)`)}
        </table></dd></div>`);
      }
    }
    if (m.dnRes && !state.invMode && controls().includes('ov-dn')) rows.push(`<div class="ro"><dt>최대 거리 Dₙ</dt><dd>${f4(m.dnRes.d)}<small>DKW 95%: ${E.dkw(Math.max(1, m.n)).toFixed(3)}</small></dd></div>`);
    $('#readouts').innerHTML = rows.join('');
    const live = $('#live');
    if (live) live.textContent = c.mode === 'x' && isFinite(c.cdf) ? `x = ${fNum(c.x)}, F(x) = ${f4(c.cdf)}` : '';
  }

  /* ───────── 보조: 수렴 그래프 ───────── */
  let auxTimer = null;
  function scheduleAux() { clearTimeout(auxTimer); auxTimer = setTimeout(renderAux, playing ? 40 : 150); }
  function renderAux() {
    const show = controls().includes('conv') && !state.invMode;
    $('#aux').hidden = !show;
    if (!show || !lastModel) return;
    const d = dist(), P = state.params, src = stream().get(state.n);
    const grid = CONV_GRID.filter((n) => n < state.n).concat([state.n]);
    const pts = grid.map((n) => ({ n, err: E.dn(E.sorted(src, n), d, P).d, current: n === state.n }));
    conv.render({ points: pts, yLabel: '최대 거리 Dₙ', refSlope: -0.5, refLabel: '기울기 −1/2' });
  }

  /* ───────── URL ───────── */
  let urlTimer = null;
  function scheduleURL() { clearTimeout(urlTimer); urlTimer = setTimeout(writeURL, 250); }
  function writeURL() {
    const q = new URLSearchParams();
    if (STEPS) q.set('step', state.step + 1);
    q.set('d', state.dist);
    q.set('p', Object.entries(state.params).map(([k, v]) => `${k}:${v}`).join(';'));
    q.set('n', state.n); q.set('seed', state.seed); q.set('top', state.top); q.set('k', state.k);
    const o = (state.showEcdf ? 'e' : '') + (state.showCdf ? 'c' : '') + (state.showDn ? 'd' : '') + (state.showBand ? 'b' : '') + (state.showTangent ? 't' : '') + (state.showTopTheory ? 'f' : '');
    q.set('o', o || '-');
    q.set('c', state.cursor);
    if (state.cursor === 'x') q.set('cx', +state.cx.toPrecision(6));
    if (state.cursor === 'p') q.set('cp', +state.cp.toPrecision(4));
    if (state.cursor === 'interval') { q.set('ca', +state.ca.toPrecision(6)); q.set('cb', +state.cb.toPrecision(6)); q.set('inc', (state.inclA ? 1 : 0) + '' + (state.inclB ? 1 : 0)); }
    if (state.invMode) q.set('inv', state.invCount);
    try { history.replaceState(null, '', '?' + q.toString()); } catch (e) { /* file:// */ }
  }
  function readURL() {
    const q = new URLSearchParams(location.search);
    const st = parseInt(q.get('step'), 10);
    if (STEPS && st >= 1 && st <= STEPS.length) state.step = st - 1;
    if (!q.has('d')) return false;
    const d = D.get(q.get('d'));
    if (!d || (PAGE !== 'lab' && (d.type === 'discrete') !== (PAGE === 'discrete'))) return false;
    state.dist = d.id;
    const P = d.defaults();
    (q.get('p') || '').split(';').forEach((kv) => { const [k, v] = kv.split(':'); if (k in P && isFinite(+v)) P[k] = +v; });
    state.params = d.fix(P);
    const num = (key, def) => (q.has(key) && isFinite(+q.get(key)) ? +q.get(key) : def);
    state.n = num('n', state.n); state.seed = num('seed', state.seed); state.k = num('k', state.k);
    if (['rug', 'hist', 'pdf'].includes(q.get('top'))) state.top = q.get('top');
    const o = q.get('o') || '';
    state.showEcdf = o.includes('e'); state.showCdf = o.includes('c'); state.showDn = o.includes('d');
    state.showBand = o.includes('b'); state.showTangent = o.includes('t'); state.showTopTheory = o.includes('f');
    if (['x', 'p', 'interval', 'none'].includes(q.get('c'))) state.cursor = q.get('c');
    state.cx = num('cx', state.cx); state.cp = num('cp', state.cp); state.ca = num('ca', state.ca); state.cb = num('cb', state.cb);
    const inc = q.get('inc') || '11'; state.inclA = inc[0] === '1'; state.inclB = inc[1] === '1';
    if (q.has('inv')) { state.invMode = true; state.invCount = num('inv', 0); }
    else if (STEPS && STEPS[state.step].init.invMode) state.invMode = true;
    applyChanges({});
    return true;
  }

  /* ───────── 동작 ───────── */
  function drawAnimated(count) {
    stopAll();
    applyChanges({ n: count });
    const src = stream().get(count);
    const delay = S.reduceMotion() ? 10 : clamp(3000 / count, 60, 260);
    animating = true;
    render({ nShown: 0, duration: 0 });
    let i = 0;
    const tick = () => {
      if (!animating) return;
      i++;
      view.dropTop(src[i - 1]);
      const shown = i;
      animTimers.push(setTimeout(() => { if (animating) render({ nShown: shown, duration: 0 }); }, S.reduceMotion() ? 0 : 240));
      if (i < count) animTimers.push(setTimeout(tick, delay));
      else animTimers.push(setTimeout(() => { animating = false; render({}); }, 400));
    };
    tick();
  }
  function play() {
    if (playing) { stopAll(); return; }
    stopAll();
    playing = true; playIdx = 0;
    updatePlayButtons();
    const tick = () => {
      if (!playing) return;
      applyChanges({ n: PLAY_SEQ[playIdx++] });
      render({ duration: 0 });
      if (playIdx >= PLAY_SEQ.length) {
        playing = false; updatePlayButtons();
        if (!state.showCdf) S.toast('이제 ‘이론 CDF 보기’를 눌러 계단과 비교해 보세요.');
        return;
      }
      playTimer = setTimeout(tick, +($('#sel-speed') ? $('#sel-speed').value : 800));
    };
    tick();
  }
  function updatePlayButtons() {
    const b = $('#btn-play');
    if (b) { b.textContent = playing ? '❚❚ 멈춤' : '▶ n을 키워 가며 보기'; b.setAttribute('aria-pressed', playing); }
    $$('[data-action-id="play"]').forEach((x) => { x.textContent = playing ? '❚❚ 멈춤' : '▶ ' + x.dataset.label; });
  }
  function sweep() {
    stopAll();
    const { L, U } = domain();
    const a = dist().quantile(0.001, state.params), b = dist().quantile(0.995, state.params);
    const x0 = Math.max(L, a), x1 = Math.min(U, b);
    const t0 = performance.now(), T = 3200;
    state.cursor = 'x';
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / T);
      applyChanges({ cx: x0 + (x1 - x0) * t });
      render({ duration: 0 });
      if (t < 1) sweepRaf = requestAnimationFrame(frame); else sweepRaf = null;
    };
    sweepRaf = requestAnimationFrame(frame);
  }
  function cycleShape() {
    const list = SHAPES[kind() === 'discrete' ? 'discrete' : 'continuous'];
    const i = list.indexOf(state.dist);
    const next = list[(i + 1) % list.length];
    const keepCx = STEPS ? STEPS[state.step].init.cx : null;
    set({ dist: next });
    if (keepCx != null && state.cursor === 'x') set({ cx: keepCx });
    if (STEPS && STEPS[state.step].init.ca != null) set({ ca: STEPS[state.step].init.ca, cb: STEPS[state.step].init.cb });
  }
  function inverse(count) {
    if (invBusy) return;
    stopAll();
    const s = stream('inv');
    if (state.invCount >= INV_MAX) { S.toast(`최대 ${fInt(INV_MAX)}개까지 보낼 수 있습니다. ‘처음부터’를 눌러 다시 시작하세요.`); return; }
    if (count === 1 && !S.reduceMotion()) {
      s.get(state.invCount + 1);
      const u = s.u[state.invCount], x = s.x[state.invCount];
      invBusy = true;
      view.inverseShot(u, Math.max(lastModel.xDomain[0], Math.min(lastModel.xDomain[1], x)), () => {
        invBusy = false;
        state.invCount += 1;
        render({ duration: 150 });
        view.dropTop(x);
        S.toast(`u = ${u.toFixed(3)} → x = Q(u) = ${fNum(x)}`);
      });
      return;
    }
    state.invCount = Math.min(INV_MAX, state.invCount + count);
    s.get(state.invCount);
    render({ duration: 200 });
  }
  function inverseReset() { stopAll(); state.invCount = 0; render({ duration: 200 }); S.toast(''); }

  const api = {
    set: (ch, o) => set(ch, { duration: 250, ...o }),
    drawAnimated, play, sweep, cycleShape, inverse, inverseReset,
    quantile: (p) => dist().quantile(p, state.params), modeX,
    goPage: (file, idx) => { location.href = file + '?step=' + (idx + 1); },
  };

  /* ───────── 레이아웃 ───────── */
  const META = {
    continuous: { crumb: '모듈 2 연속형', h1: '줄 세워 세기에서 누적분포함수로' },
    discrete: { crumb: '모듈 2 이산형', h1: '계단과 점프: 이산형 누적분포함수' },
    lab: { crumb: '모듈 2 자유 실험실', h1: '누적분포함수 자유 실험실' },
  };
  function buildLayout() {
    const meta = META[PAGE];
    document.getElementById('app').innerHTML = `
    <header class="site-header" id="hdr"></header>
    <main class="lab">
      ${S.stage({ crumb: meta.crumb, h1: meta.h1, steps: STEPS })}
      <div class="lab-grid">
        <section class="main" aria-label="그래프">
          <figure class="chart-card cdf-card">
            <ul class="legend" id="legend"></ul>
            <div id="top" class="chart-wrap"></div>
            <div id="bot" class="chart-wrap"></div>
            <p class="sr-only" aria-live="polite" id="live"></p>
            <dl class="readouts" id="readouts"></dl>
          </figure>
        </section>
        <div class="aux" id="aux" hidden>
          <figure class="aux-card">
            <figcaption><h3>수렴 그래프</h3><p>ECDF와 이론 CDF 사이의 최대 거리 Dₙ이 n에 따라 줄어드는 모습입니다. 점선은 1/√n 속도의 참고선입니다.</p></figcaption>
            <div id="conv"></div>
          </figure>
        </div>
        <div class="side">
          <article class="step-card" id="step-card" aria-live="polite"></article>
          <div class="controls" id="controls">
            <section class="ctl" data-ctl="dist">
              <h3>분포</h3>
              <select id="sel-dist" aria-label="분포 선택"></select>
              <div id="params" class="params"></div>
              <details class="dist-info"><summary>분포 정보</summary><div id="dist-info"></div></details>
            </section>
            <section class="ctl" data-ctl="n">
              <h3><label for="rng-n">표본 크기 n</label></h3>
              <div class="row"><input type="range" id="rng-n" min="0" max="${N_LIST.length - 1}" step="1"><input type="number" id="num-n" min="1" max="1000000" aria-label="n 직접 입력"></div>
              <div class="btn-row" data-ctl="more"><button type="button" data-more="1">+1</button><button type="button" data-more="10">+10</button><button type="button" data-more="100">+100</button><button type="button" data-more="1000">+1,000</button></div>
              <div class="btn-row" data-ctl="draw"><button type="button" id="btn-draw">하나씩 뽑기</button></div>
            </section>
            <section class="ctl" data-ctl="top">
              <h3>위 그래프</h3>
              <div class="seg" id="seg-top" role="group" aria-label="위 그래프">
                <button type="button" data-top="rug">표본 점</button><button type="button" data-top="hist">히스토그램</button><button type="button" data-top="pdf">이론 분포</button>
              </div>
              <div class="row cont-only" id="row-k" style="margin-top:8px"><input type="range" id="rng-k" min="5" max="200" step="1" aria-label="히스토그램 구간 수"><output id="out-k"></output></div>
            </section>
            <section class="ctl" data-ctl="cursor">
              <h3>커서</h3>
              <div class="seg" id="seg-cursor" role="group" aria-label="커서 모드">
                <button type="button" data-cursor="x">x로 읽기</button><button type="button" data-cursor="p">p로 읽기</button><button type="button" data-cursor="interval">구간</button>
              </div>
              <div class="btn-row" id="row-q"><button type="button" data-q="0.25">1사분위수</button><button type="button" data-q="0.5">중앙값</button><button type="button" data-q="0.75">3사분위수</button></div>
              <div class="btn-row disc-only" id="row-snap"><button type="button" data-snap="-1">x⁻</button><button type="button" data-snap="0">정수 x</button><button type="button" data-snap="1">x⁺</button></div>
              <div class="btn-row disc-only" id="row-incl">
                <label class="check"><input type="checkbox" id="chk-ia"> a 포함 (≤)</label>
                <label class="check"><input type="checkbox" id="chk-ib"> b 포함 (≤)</label>
              </div>
              <p class="hint">그래프 위를 끌면 커서가 움직입니다. 키보드: 그래프를 누른 뒤 ←/→ (Shift는 10배).</p>
            </section>
            <section class="ctl" data-ctl="overlays">
              <h3>겹쳐 그리기</h3>
              <label class="check" data-ctl="ov-ecdf"><input type="checkbox" id="chk-ecdf"> 표본의 ECDF (파랑 계단)</label>
              <label class="check" data-ctl="ov-cdf"><input type="checkbox" id="chk-cdf"> 이론 CDF (초록)</label>
              <label class="check" data-ctl="ov-dn"><input type="checkbox" id="chk-dn"> 최대 거리 Dₙ</label>
              <label class="check" data-ctl="ov-band"><input type="checkbox" id="chk-band"> DKW 95% 신뢰띠</label>
              <label class="check" data-ctl="ov-tangent"><input type="checkbox" id="chk-tangent"> 접선과 f(x) (연속형)</label>
              <label class="check" data-ctl="ov-toptheory"><input type="checkbox" id="chk-toptheory"> 위 히스토그램에 이론 분포</label>
            </section>
            <section class="ctl" data-ctl="play">
              <h3>극한 탐색</h3>
              <div class="btn-row"><button type="button" id="btn-play" class="primary"></button>
                <select id="sel-speed" aria-label="재생 속도"><option value="1300">느리게</option><option value="800" selected>보통</option><option value="400">빠르게</option></select></div>
              <p class="hint">n을 10에서 1,000,000까지 늘립니다.</p>
            </section>
            <section class="ctl" data-ctl="inverse">
              <h3>역변환 표본추출</h3>
              <div class="btn-row"><button type="button" data-inv="1" class="primary">균등난수 하나 보내기</button><button type="button" data-inv="100">+100</button><button type="button" data-inv="1000">+1,000</button><button type="button" id="btn-invreset">처음부터</button></div>
              <label class="check" id="lab-invmode"><input type="checkbox" id="chk-invmode"> 역변환 모드 (위 그래프에 보낸 난수를 쌓기)</label>
            </section>
            <section class="ctl" data-ctl="seed">
              <h3><label for="num-seed">난수 시드</label></h3>
              <div class="row"><input type="number" id="num-seed" min="1" max="999999"><button type="button" id="btn-reseed">새 난수로 다시 뽑기</button></div>
            </section>
          </div>
        </div>
      </div>
    </main>
    <footer class="site-footer"><p>확률변수 실험실 모듈 2. 모든 계산은 브라우저 안에서 이루어집니다.</p></footer>`;
    S.mountHeader($('#hdr'), { root: ROOT, current: body.dataset.current, tools: true });
  }

  function buildDistOptions() {
    const opt = (d) => `<option value="${d.id}">${d.name}</option>`;
    const sel = $('#sel-dist');
    if (PAGE === 'lab') {
      sel.innerHTML = `<optgroup label="연속형">${D.list.filter((d) => d.type === 'continuous').map(opt).join('')}</optgroup>
        <optgroup label="이산형">${D.list.filter((d) => d.type === 'discrete').map(opt).join('')}</optgroup>
        <optgroup label="혼합형">${D.list.filter((d) => d.type === 'mixed').map(opt).join('')}</optgroup>`;
    } else sel.innerHTML = D.list.filter((d) => d.type === kindOfPage).map(opt).join('');
  }
  function buildDistUI() {
    const d = dist();
    $('#sel-dist').value = d.id;
    $('#params').innerHTML = d.params.map((p) => `<label class="param"><span class="param-name">${p.label}</span>
      <input type="range" data-param="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}"><output data-param-out="${p.key}"></output></label>`).join('');
    $$('#params input[type=range]').forEach((el) => {
      let raf = null;
      el.addEventListener('input', () => { const v = +el.value; if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(() => set({ params: { [el.dataset.param]: v } }, { duration: 0 })); });
    });
    const info = $('#dist-info');
    info.innerHTML = `<p class="tex" data-tex="f"></p><dl><div><dt>지지집합</dt><dd data-tex="support"></dd></div><div><dt>평균</dt><dd data-tex="mean"></dd></div><div><dt>분산</dt><dd data-tex="variance"></dd></div></dl>`;
    $$('[data-tex]', info).forEach((el) => { try { katex.render(d.tex[el.dataset.tex], el, { throwOnError: false, displayMode: el.tagName === 'P' }); } catch (e) { el.textContent = d.tex[el.dataset.tex]; } });
    applyVisibility();
  }
  function applyVisibility() {
    const cs = controls();
    $$('#controls [data-ctl]').forEach((el) => {
      const c = el.dataset.ctl;
      el.hidden = c === 'overlays' ? !cs.some((x) => x.startsWith('ov-')) : !cs.includes(c);
    });
    const disc = kind() === 'discrete';
    $$('#controls .disc-only').forEach((el) => (el.hidden = !disc));
    $$('#controls .cont-only').forEach((el) => (el.hidden = disc));
    $$('#seg-cursor button').forEach((b) => (b.hidden = !cursors().includes(b.dataset.cursor)));
    $('#lab-invmode').hidden = !!STEPS;
  }
  function buildStepCard() {
    const card = $('#step-card');
    if (!STEPS) {
      card.innerHTML = `<p class="step-num">자유 실험실</p><h2>모든 조작이 열려 있습니다</h2>
        <p class="do">분포, n, 위 그래프, 커서, 겹쳐 그리기, 역변환 표본추출을 자유롭게 조합해 보세요.</p>
        <div class="see"><h4>해 볼 만한 실험</h4><ul>
          <li><b>상담 대기 시간 (혼합분포)</b>를 고르면 0에서 점프하고 그 뒤 매끄럽게 오르는 CDF가 나옵니다. PMF만으로도, PDF만으로도 나타낼 수 없지만 CDF 하나로는 완전히 나타납니다.</li>
          <li>DKW 신뢰띠를 켜고 ‘새 난수로 다시 뽑기’를 여러 번 누르세요. 이론 CDF가 띠를 벗어나는 일은 스무 번에 한 번 정도입니다.</li>
          <li>위 그래프를 히스토그램으로 두고 구간 수를 바꿔 보세요. 아래 ECDF는 바뀌지 않습니다.</li>
        </ul></div><p class="toast" id="toast" hidden></p>`;
      return;
    }
    S.buildStepCard(card, STEPS, state.step, api, goStep);
    updatePlayButtons();
  }
  function goStep(i) {
    if (!STEPS || i < 0 || i >= STEPS.length) return;
    stopAll();
    state.step = i;
    const init = { ...STEPS[i].init };
    const xs = {};
    for (const key of ['cx', 'ca', 'cb']) if (key in init) { xs[key] = init[key]; delete init[key]; }
    Object.assign(state, init);
    if (!init.invMode) state.invMode = false;
    applyChanges(xs);
    buildStepCard();
    applyVisibility();
    render({ duration: 300 });
  }

  function syncControls(m) {
    $('#rng-n').value = nearestNIndex(Math.max(10, state.n));
    if (document.activeElement !== $('#num-n')) $('#num-n').value = state.n;
    if (document.activeElement !== $('#num-seed')) $('#num-seed').value = state.seed;
    $$('#seg-top button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.top === state.top));
    $$('#seg-cursor button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cursor === state.cursor));
    $('#row-k').hidden = state.top !== 'hist' || kind() === 'discrete';
    $('#rng-k').value = state.k;
    $('#out-k').textContent = `구간 ${m.top && m.top.binsK ? m.top.binsK : state.k}개`;
    $('#row-q').hidden = !cursors().includes('p');
    $('#row-snap').hidden = kind() !== 'discrete' || state.cursor !== 'x';
    $('#row-incl').hidden = kind() !== 'discrete' || state.cursor !== 'interval';
    $('#chk-ia').checked = state.inclA; $('#chk-ib').checked = state.inclB;
    $('#chk-ecdf').checked = state.showEcdf; $('#chk-cdf').checked = state.showCdf; $('#chk-dn').checked = state.showDn;
    $('#chk-band').checked = state.showBand; $('#chk-tangent').checked = state.showTangent; $('#chk-toptheory').checked = state.showTopTheory;
    $('#chk-invmode').checked = state.invMode;
    $$('#params input[type=range]').forEach((el) => {
      const k = el.dataset.param;
      if (document.activeElement !== el) el.value = state.params[k];
      $(`[data-param-out="${k}"]`).textContent = state.params[k];
    });
  }

  function wire() {
    $('#sel-dist').addEventListener('change', (e) => { set({ dist: e.target.value }); applyVisibility(); });
    $('#rng-n').addEventListener('input', (e) => set({ n: N_LIST[+e.target.value] }, { duration: 0 }));
    $('#num-n').addEventListener('change', (e) => set({ n: +e.target.value }));
    $$('[data-more]').forEach((b) => b.addEventListener('click', () => set({ n: state.n + +b.dataset.more })));
    $('#btn-draw').addEventListener('click', () => drawAnimated(Math.min(state.n, 40)));
    $$('#seg-top button').forEach((b) => b.addEventListener('click', () => set({ top: b.dataset.top })));
    $('#rng-k').addEventListener('input', (e) => set({ k: +e.target.value }, { duration: 0 }));
    $$('#seg-cursor button').forEach((b) => b.addEventListener('click', () => {
      const ch = { cursor: b.dataset.cursor };
      if (ch.cursor === 'interval' && !(state.ca < state.cb)) { ch.ca = 'q0.25'; ch.cb = 'q0.75'; }
      set(ch);
    }));
    $$('[data-q]').forEach((b) => b.addEventListener('click', () => set({ cursor: 'p', cp: +b.dataset.q })));
    $$('[data-snap]').forEach((b) => b.addEventListener('click', () => set({ cx: Math.round(state.cx) + 0.001 * +b.dataset.snap })));
    $('#chk-ia').addEventListener('change', (e) => set({ inclA: e.target.checked }, { duration: 0 }));
    $('#chk-ib').addEventListener('change', (e) => set({ inclB: e.target.checked }, { duration: 0 }));
    const ov = [['#chk-ecdf', 'showEcdf'], ['#chk-cdf', 'showCdf'], ['#chk-dn', 'showDn'], ['#chk-band', 'showBand'], ['#chk-tangent', 'showTangent'], ['#chk-toptheory', 'showTopTheory']];
    ov.forEach(([sel, key]) => $(sel).addEventListener('change', (e) => set({ [key]: e.target.checked })));
    $('#btn-play').addEventListener('click', play);
    $$('[data-inv]').forEach((b) => b.addEventListener('click', () => { if (!state.invMode) set({ invMode: true, top: 'hist', showTopTheory: true }); inverse(+b.dataset.inv); }));
    $('#btn-invreset').addEventListener('click', inverseReset);
    $('#chk-invmode').addEventListener('change', (e) => set({ invMode: e.target.checked, top: e.target.checked ? 'hist' : state.top }));
    $('#num-seed').addEventListener('change', (e) => set({ seed: clamp(Math.round(+e.target.value) || 1, 1, 999999), invCount: 0 }));
    $('#btn-reseed').addEventListener('click', () => set({ seed: 1 + Math.floor(Math.random() * 999999), invCount: 0 }));
    // 그래프 키보드 조작
    ['#top', '#bot'].forEach((sel) => {
      const el = $(sel);
      el.tabIndex = 0;
      el.setAttribute('data-keys', '1');
      el.setAttribute('aria-label', '그래프. 좌우 화살표로 커서를 움직입니다');
      el.addEventListener('keydown', (e) => {
        const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        const { L, U } = domain();
        const stepX = (kind() === 'discrete' ? 0.5 : (U - L) / 100) * (e.shiftKey ? 10 : 1);
        if (state.cursor === 'x') set({ cx: state.cx + dir * stepX }, { duration: 0 });
        else if (state.cursor === 'p') set({ cp: state.cp + dir * (e.shiftKey ? 0.1 : 0.01) }, { duration: 0 });
        else if (state.cursor === 'interval') set({ cb: state.cb + dir * stepX }, { duration: 0 });
      });
    });
    S.wireTools({ onPresent: () => render({ duration: 0 }), beforeShare: writeURL });
    if (STEPS) { S.wireStepRail(goStep); S.wireStepKeys(goStep, () => state.step); }
  }

  function onPointer(kindP, v) {
    stopAll();
    const disc = kind() === 'discrete';
    if (kindP === 'x') applyChanges({ cx: v });
    else if (kindP === 'p') applyChanges({ cp: v });
    else if (kindP === 'a') applyChanges({ ca: disc ? Math.round(v) : v });
    else if (kindP === 'b') applyChanges({ cb: disc ? Math.round(v) : v });
    render({ duration: 0 });
  }

  function init() {
    buildLayout();
    buildDistOptions();
    view = new RVL.CdfView($('#top'), $('#bot'), { onPointer });
    conv = new RVL.ConvChart($('#conv'));
    const restored = readURL();
    buildDistUI();
    wire();
    if (STEPS && !restored) goStep(state.step);
    else {
      if (STEPS) {
        const init = STEPS[state.step].init;
        if (init.invMode) state.invMode = true;
      }
      buildStepCard(); applyVisibility(); render({ duration: 0 });
    }
    updatePlayButtons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
