/* 모듈 3 화면 컨트롤러 (PRD_module3)
 * <body data-page="discrete|continuous|lab" data-root="../" data-current="m3d|m3c|m3l">
 */
(function () {
  'use strict';
  const RVL = window.RVL;
  const S = RVL.shell, O = RVL.omega, Q = RVL.sqdist, X = RVL.expr, H = RVL.hist, RNG = RVL.rng;
  const { $, $$, f4, fInt, fNum, clamp, frac } = S;
  const body = document.body;
  const PAGE = body.dataset.page;
  const ROOT = body.dataset.root || '';
  const STEPS = PAGE === 'lab' ? null : RVL.steps3[PAGE];
  const ALL = ['space', 'xsel', 'expr', 'weights', 'event', 'event-cells', 'threshold', 'sqmode', 'trials', 'band', 'cdf', 'seed'];
  const SPACES_FOR = { discrete: ['dice2', 'coin3'], continuous: ['square', 'segment'], lab: ['dice2', 'coin3', 'dice1', 'square', 'segment'] };
  const MAX_TRIALS = 1e6, MAX_POINTS = 1e5;
  const EVENT_EX = {
    dice2: [['두 눈이 같다', (v) => v.a === v.b], ['첫째 주사위가 짝수', (v) => v.a % 2 === 0], ['두 눈의 합이 7', (v) => v.a + v.b === 7], ['두 눈의 합이 10 이상', (v) => v.a + v.b >= 10]],
    coin3: [['첫 번째가 앞면', (v) => v.c1 === 1], ['앞면이 정확히 두 번', (v) => v.c1 + v.c2 + v.c3 === 2], ['세 번 모두 같은 면', (v) => v.c1 === v.c2 && v.c2 === v.c3]],
    dice1: [['짝수', (v) => v.a % 2 === 0], ['4 이상', (v) => v.a >= 4]],
  };

  /* ───────────── 상태 ───────────── */
  const state = {
    step: 0, space: SPACES_FOR[PAGE][0], xid: 'auto', expr: '', w: [1, 1, 1, 1, 1, 1],
    showValues: true, ev: 'none', sel: [], selLabel: '', val: null, xt: null,
    trials: 0, seed: 2026, band: false, showCdf: false, sqmode: 'bands', strip: false, rect: null, right: true,
  };
  let exprError = '', ghost = null, exIdx = -1;
  let hoverCell = null, hoverValue = null, hoverPt = null, trialArrow = null;
  let grid, vchart, square, segment, hist, cdfmini, arrows;
  let sweepRaf = null, trialTimer = null;
  let lastModel = null;

  const space = () => O.SPACES[state.space];
  const isFinite_ = () => space().kind === 'finite';
  const controls = () => (STEPS ? STEPS[state.step].controls : ALL);
  function presets() {
    const sp = space();
    if (sp.kind === 'finite') return O.PRESETS[sp.id];
    if (sp.kind === 'square') return Q.SQUARE;
    return Q.SEGMENT.map((g) => ({ ...g, f: (o) => g.g(o.u) }));
  }
  function weightsArr() {
    const s = state.w.reduce((a, b) => a + b, 0) || 1;
    return state.w.map((v) => v / s);
  }
  const loaded = () => space().loaded && state.w.some((v) => Math.abs(v - state.w[0]) > 1e-12);

  /** 현재 확률변수 */
  function currentX() {
    const ps = presets();
    if (state.xid === 'custom') {
      const c = X.compile(state.expr, space().vars);
      exprError = c.error || '';
      if (c.f) return { id: 'custom', name: `사용자 정의: ${state.expr}`, tex: null, f: c.f, custom: true };
      return { ...ps[0], fallback: true };
    }
    exprError = '';
    return ps.find((p) => p.id === state.xid) || ps[0];
  }

  /* ───────────── 반복 실험 버퍼 ───────────── */
  const streams = { finite: null, points: null };
  function finiteStream() {
    const key = state.space + '|' + (loaded() ? weightsArr().join(',') : 'u') + '|' + state.seed;
    let s = streams.finite;
    if (!s || s.key !== key) {
      const rng = RNG.createRng(state.seed);
      s = streams.finite = { key, idx: new Int32Array(1024), len: 0, draw: O.outcomeSampler(space(), loaded() ? weightsArr() : null)(rng) };
    }
    return s;
  }
  function ensureFinite(n) {
    const s = finiteStream();
    if (n > s.idx.length) { let c = s.idx.length; while (c < n) c *= 2; const a = new Int32Array(c); a.set(s.idx.subarray(0, s.len)); s.idx = a; }
    for (let i = s.len; i < n; i++) s.idx[i] = s.draw();
    s.len = Math.max(s.len, n);
    return s;
  }
  function pointStream() {
    let s = streams.points;
    if (!s || s.seed !== state.seed) {
      s = streams.points = { seed: state.seed, rng: RNG.createRng(state.seed + 104729), U: new Float64Array(1024), V: new Float64Array(1024), len: 0 };
    }
    return s;
  }
  function ensurePoints(n) {
    const s = pointStream();
    if (n > s.U.length) {
      let c = s.U.length; while (c < n) c *= 2;
      const U = new Float64Array(c), V = new Float64Array(c);
      U.set(s.U.subarray(0, s.len)); V.set(s.V.subarray(0, s.len)); s.U = U; s.V = V;
    }
    for (let i = s.len; i < n; i++) { s.U[i] = s.rng.random(); s.V[i] = s.rng.random(); }
    s.len = Math.max(s.len, n);
    return s;
  }

  /* ───────────── 모델 ───────────── */
  function computeModel() {
    const sp = space();
    const xr = state.xid ? currentX() : null;
    const m = { sp, xr, kind: sp.kind };
    if (sp.kind === 'finite') {
      const probs = new Map(sp.outcomes.map((o) => [o.id, O.outcomeProb(sp, o, loaded() ? weightsArr() : null)]));
      m.probs = probs;
      if (xr) {
        const dist = O.distribution(sp, xr.f, loaded() ? weightsArr() : null);
        m.dist = dist;
        m.values = new Map();
        for (const o of sp.outcomes) { let v; try { v = xr.f(o.v); } catch (e) { v = NaN; } m.values.set(o.id, isFinite(v) ? +(+v).toPrecision(12) : NaN); }
        m.invalid = new Set(dist.invalid);
        m.cum = []; let c = 0;
        for (const d of dist.list) { c += d.p; m.cum.push(c); }
        m.F = (x) => { let s = 0; for (const d of dist.list) if (d.x <= x + 1e-9) s += d.p; return s; };
      }
      // 반복 실험
      const n = Math.min(state.trials, MAX_TRIALS);
      if (n > 0) {
        const s = ensureFinite(n);
        const cnt = new Float64Array(sp.outcomes.length);
        for (let i = 0; i < n; i++) cnt[s.idx[i]]++;
        m.outcomeCounts = cnt;
        if (xr) {
          const freq = new Map();
          sp.outcomes.forEach((o, i) => { const v = m.values.get(o.id); if (isFinite(v)) freq.set(v, (freq.get(v) || 0) + cnt[i] / n); });
          m.freq = freq;
        }
        m.n = n;
        m.lastOutcome = sp.outcomes[s.idx[n - 1]];
      } else m.n = 0;
      // 사건
      if (state.ev === 'cells') {
        m.sel = new Set(state.sel);
        m.eventP = state.sel.reduce((a, id) => a + probs.get(id), 0);
      } else if (xr && state.ev === 'eq' && state.val != null) {
        const e = m.dist.list.find((d) => Math.abs(d.x - state.val) < 1e-9);
        m.hl = new Set(e ? e.cells : []);
        m.eventP = e ? e.p : 0;
        m.hlValues = new Set(e ? [e.x] : []);
      } else if (xr && state.ev === 'le' && state.xt != null) {
        m.hl = new Set(O.preimage(sp, xr.f, 'le', state.xt));
        m.eventP = m.F(state.xt);
      }
    } else if (xr) {
      const preset = !xr.custom;
      let cont;
      if (preset) cont = { cdf: xr.cdf, pdf: (x) => xr.pdf(x), range: xr.range, invalidFrac: 0 };
      else { const gd = Q.gridDist(xr.f, sp.kind); cont = { cdf: gd.cdf, pdf: (x) => gd.pdf(x), range: gd.range, invalidFrac: gd.invalidFrac }; }
      m.cont = cont;
      const n = Math.min(state.trials, MAX_POINTS);
      const ps = n ? ensurePoints(n) : null;
      m.n = n;
      m.points = ps ? { U: ps.U, V: ps.V, n } : null;
      if (n) {
        const xs = new Float64Array(n);
        let k = 0;
        for (let i = 0; i < n; i++) { const v = xr.f(sp.kind === 'square' ? { u: ps.U[i], v: ps.V[i] } : { u: ps.U[i] }); if (isFinite(v)) xs[k++] = v; }
        m.xs = xs.subarray(0, k);
      } else m.xs = new Float64Array(0);
      if (state.xt == null || !isFinite(state.xt)) state.xt = mid();
      m.F = cont.cdf;
    } else {
      // N1: 확률변수 없이 점만
      const n = Math.min(state.trials, MAX_POINTS);
      const ps = n ? ensurePoints(n) : null;
      m.n = n;
      m.points = ps ? { U: ps.U, V: ps.V, n } : null;
    }
    return m;
  }

  function mid() {
    const xr = currentX();
    const sp = space();
    if (sp.kind === 'finite') {
      const d = O.distribution(sp, xr.f, loaded() ? weightsArr() : null).list;
      let c = 0;
      for (const e of d) { c += e.p; if (c >= 0.5 - 1e-9) return e.x; }
      return d.length ? d[0].x : 0;
    }
    const cont = xr.custom ? Q.gridDist(xr.f, sp.kind) : xr;
    const [lo, hi] = cont.range;
    let a = lo, b = hi;
    for (let i = 0; i < 60; i++) { const mm = (a + b) / 2; if (cont.cdf(mm) < 0.5) a = mm; else b = mm; }
    return +((a + b) / 2).toFixed(2);
  }

  /* ───────────── 상태 변경 ───────────── */
  function applyChanges(ch) {
    const prevSpace = state.space, prevX = state.xid, prevExpr = state.expr;
    const prevList = lastModel && lastModel.dist ? lastModel.dist.list : null;
    if ('space' in ch && ch.space !== state.space) {
      state.space = ch.space;
      if (!('xid' in ch)) ch.xid = state.xid === null ? null : 'auto';
      state.sel = []; state.selLabel = ''; exIdx = -1; ghost = null;
      if (!('trials' in ch)) state.trials = 0;
      if (!('val' in ch)) state.val = null;
      if (!('xt' in ch)) state.xt = null;
    }
    for (const k of ['xid', 'expr', 'w', 'showValues', 'ev', 'sel', 'selLabel', 'val', 'xt', 'trials', 'seed', 'band', 'showCdf', 'sqmode', 'strip', 'rect', 'right']) {
      if (k in ch) state[k] = ch[k];
    }
    if (state.xid === 'auto') state.xid = presets()[0].id;
    if (state.xid && state.xid !== 'custom' && !presets().some((p) => p.id === state.xid)) state.xid = presets()[0].id;
    if ((state.xid !== prevX || state.expr !== prevExpr) && state.space === prevSpace && prevList) ghost = prevList;
    if (state.xid !== prevX || state.space !== prevSpace || state.expr !== prevExpr) {
      if (!('val' in ch) || ch.val === 'mid') state.val = state.ev === 'eq' ? 'mid' : state.val;
      if (!('xt' in ch) || ch.xt === 'mid') state.xt = 'mid';
    }
    if (state.xid) {
      if (state.val === 'mid') state.val = mid();
      if (state.xt === 'mid') state.xt = mid();
      if (isFinite_() && state.val != null) {
        const vals = O.distribution(space(), currentX().f).list.map((d) => d.x);
        if (vals.length && !vals.some((v) => Math.abs(v - state.val) < 1e-9)) state.val = vals.reduce((b, v) => (Math.abs(v - state.val) < Math.abs(b - state.val) ? v : b), vals[0]);
      }
    }
    state.trials = clamp(Math.round(state.trials) || 0, 0, isFinite_() ? MAX_TRIALS : MAX_POINTS);
  }
  function stopAll() {
    if (sweepRaf) { cancelAnimationFrame(sweepRaf); sweepRaf = null; }
    clearTimeout(trialTimer);
    trialArrow = null;
  }
  function set(ch, opts = {}) {
    stopAll();
    const prevSpace = state.space, prevX = state.xid, prevExpr = state.expr;
    applyChanges(ch);
    const spaceChanged = state.space !== prevSpace;
    if (spaceChanged) buildSpaceViews();
    if (spaceChanged || state.xid !== prevX || state.expr !== prevExpr) { buildXOptions(); if (square && space().kind === 'square' && state.xid) square.setField(currentX().f); }
    render(opts);
    if (opts.replay) replayValues();
  }

  /* ───────────── 렌더링 ───────────── */
  function render(opts = {}) {
    const m = computeModel();
    lastModel = m;
    const sp = m.sp;
    const showRight = state.right && !!m.xr;
    $('#right').hidden = !showRight;
    $('#m3stage').classList.toggle('single', !showRight);
    $('#left-title').innerHTML = `표본공간 Ω: ${sp.name} <small>${sp.desc}</small>`;

    if (sp.kind === 'finite') {
      grid.render({
        space: sp, values: m.xr && state.showValues ? m.values : null, probs: m.probs, loaded: loaded(),
        hl: m.hl || null, sel: m.sel || null, invalid: m.invalid || null,
      });
      if (showRight) {
        const fracText = new Map();
        const unif = !loaded();
        for (const d of m.dist.list) fracText.set(d.x, unif ? frac(d.count, sp.outcomes.length).text : d.p.toFixed(3));
        vchart.render({
          list: m.dist.list, freq: m.freq || null, n: m.n, band: state.band && m.n > 0 && controls().includes('band'),
          hlValues: m.hlValues || null, leX: state.ev === 'le' ? state.xt : null, ghost: controls().includes('xsel') ? ghost : null,
          fracText, xLabel: `${m.xr.name}`, aria: `${m.xr.name}의 분포`,
        });
      }
    } else if (sp.kind === 'square') {
      const mode = !m.xr ? 'plain' : (STEPS ? STEPS[state.step].init.sqmode || state.sqmode : state.sqmode);
      square.render({
        mode, threshold: state.xt, strip: state.strip && mode === 'region' ? [state.xt, state.xt + stripH(m)] : null,
        points: m.points, rect: mode === 'plain' ? state.rect : null, hover: hoverPt ? { ...hoverPt, label: hoverLabel(m, hoverPt) } : null,
      });
      if (showRight) renderHist(m, mode);
    } else {
      segment.render({ g: m.xr.g || ((u) => m.xr.f({ u })), range: m.cont.range, label: m.xr.name });
      if (showRight) renderHist(m, 'none');
    }

    // 오른쪽 제목과 수식
    if (showRight) {
      const rt = $('#right-title');
      rt.innerHTML = `X의 분포 <span id="x-tex"></span>`;
      const tx = $('#x-tex');
      if (m.xr.tex && window.katex) { try { katex.render(m.xr.tex, tx, { throwOnError: false }); } catch (e) { tx.textContent = m.xr.name; } }
      else tx.textContent = m.xr.name;
    }
    // CDF 미니 그래프
    const showCdf = showRight && state.showCdf && controls().includes('cdf');
    $('#cdfmini').hidden = !showCdf;
    if (showCdf) renderCdfMini(m);

    renderLegend(m, showRight);
    renderEventLine(m);
    renderReadouts(m);
    syncControls(m);
    scheduleURL();
    requestAnimationFrame(drawArrows);
  }

  function stripH(m) { const r = m.cont ? m.cont.range : [0, 1]; return (r[1] - r[0]) / 40; }
  function hoverLabel(m, p) {
    if (!m.xr) return `(${p.u.toFixed(2)}, ${p.v.toFixed(2)})`;
    const v = m.xr.f({ u: p.u, v: p.v });
    return `(${p.u.toFixed(2)}, ${p.v.toFixed(2)}) → X = ${isFinite(v) ? v.toFixed(3) : '정의 안 됨'}`;
  }

  function renderHist(m, mode) {
    const [L, U] = m.cont.range;
    const n = m.xs.length;
    const k = n ? clamp(Math.round(Math.sqrt(n) * 1.1), 10, 50) : 30;
    const bins = H.continuousBins(L, U, k);
    const { counts } = H.binCounts(m.xs, n, bins);
    const heights = H.heights(counts, Math.max(1, m.points ? m.points.n : 1), bins.width, 'density');
    const N = 400, pts = [], ys = [];
    for (let i = 0; i < N; i++) {
      const x = L + (U - L) * (i + 0.5) / N;
      let y = m.cont.pdf(x);
      if (!isFinite(y)) y = 0;
      pts.push([x, y]); ys.push(y);
    }
    ys.sort((a, b) => a - b);
    const p98 = ys[Math.floor(0.98 * (N - 1))];
    const tmax = p98 > 0 ? Math.min(ys[N - 1], 2.5 * p98) : ys[N - 1];
    const region = mode === 'region';
    const iv = region ? { on: true, a: L, b: clamp(state.xt, L, U), bandLo: L, bandHi: clamp(state.xt, L, U) } : null;
    hist.render({
      kind: 'continuous', bins, heights, counts, n, mode: 'density', xDomain: [L, U],
      yMax: Math.max(d3.max(heights) || 0, tmax, 0.1) * 1.08, yLabel: '밀도', xLabel: m.xr.name,
      theory: { type: 'curve', points: pts }, showTheory: true, poly: null, ghost: null, band: null,
      interval: iv, barClass: iv ? Array.from({ length: bins.k }, (_, j) => (bins.origin + (j + 0.5) * bins.width <= iv.b ? 'in' : 'out')) : null,
      ariaLabel: `${m.xr.name} 값의 밀도 히스토그램과 이론 밀도`,
    }, { duration: 0, reveal: false });
  }

  function renderCdfMini(m) {
    if (m.kind === 'finite') {
      const list = m.dist.list;
      if (!list.length) return;
      const lo = list[0].x, hi = list[list.length - 1].x;
      let gap = Infinity; for (let i = 1; i < list.length; i++) gap = Math.min(gap, list[i].x - list[i - 1].x);
      if (!isFinite(gap)) gap = 1;
      const pad = Math.max(gap * 0.7, (hi - lo) * 0.04, 0.5);
      const dom = [lo - pad, hi + pad];
      const polys = [[[dom[0], 0], [list[0].x, 0]]];
      const jumps = [];
      let c = 0;
      list.forEach((d, i) => {
        jumps.push({ x: d.x, lo: c, hi: c + d.p });
        c += d.p;
        polys.push([[d.x, c], [i + 1 < list.length ? list[i + 1].x : dom[1], c]]);
      });
      let ecdf = null;
      if (m.n && m.freq) {
        const pts = [[dom[0], 0]]; let e = 0;
        for (const d of list) { e += m.freq.get(d.x) || 0; pts.push([d.x, e]); }
        pts.push([dom[1], e]);
        ecdf = { points: pts };
      }
      const cx = state.ev === 'le' ? state.xt : state.ev === 'eq' ? state.val : null;
      cdfmini.render({
        kind: list.every((d) => Number.isInteger(d.x)) ? 'discrete' : 'continuous', xDomain: dom, xLabel: 'x',
        cdf: { show: true, polys, jumps }, ecdf, aria: '누적분포함수',
        cursor: cx != null ? { mode: 'x', x: cx, cdf: m.F(cx), ecdf: ecdf ? ecdfAt(ecdf.points, cx) : NaN } : {},
      }, { duration: 0 });
    } else {
      const [L, U] = m.cont.range;
      const N = 300, curve = [];
      for (let i = 0; i <= N; i++) { const x = L + (U - L) * i / N; curve.push([x, m.cont.cdf(x)]); }
      let ecdf = null;
      if (m.xs.length) {
        const s = Float64Array.from(m.xs).sort();
        const step = Math.max(1, Math.floor(s.length / 1500));
        const pts = [[L, 0]];
        for (let i = 0; i < s.length; i += step) pts.push([s[i], (i + 1) / s.length]);
        pts.push([U, 1]);
        ecdf = { points: pts, sorted: s };
      }
      const xt = state.xt;
      cdfmini.render({
        kind: 'continuous', xDomain: [L, U], xLabel: m.xr.name, cdf: { show: true, polys: [curve], jumps: [] }, ecdf, aria: '누적분포함수',
        cursor: { mode: 'x', x: xt, cdf: m.cont.cdf(xt), ecdf: ecdf ? countLE(ecdf.sorted, xt) / ecdf.sorted.length : NaN },
      }, { duration: 0 });
    }
  }
  function ecdfAt(pts, x) { let v = 0; for (const p of pts) if (p[0] <= x + 1e-9) v = p[1]; return v; }
  function countLE(s, x) { let a = 0, b = s.length; while (a < b) { const mm = (a + b) >> 1; if (s[mm] <= x) a = mm + 1; else b = mm; } return a; }

  function renderLegend(m, showRight) {
    const it = [];
    if (m.kind === 'finite') {
      if (state.ev === 'cells' && state.sel.length) it.push('<li><span class="sw sw-sel"></span>고른 사건</li>');
      if (m.hl) it.push('<li><span class="sw sw-sel"></span>역상 (강조된 칸)</li>');
      if (showRight) {
        it.push('<li><span class="sw sw-stem"></span>이론 확률 P(X = x)</li>');
        if (m.n) it.push('<li><span class="sw sw-bar"></span>반복 실험의 상대도수</li>');
        if (state.band && m.n && controls().includes('band')) it.push('<li><span class="sw sw-band-whisker"></span>예상 변동 범위 (± 2 표준오차)</li>');
        if (ghost && controls().includes('xsel')) it.push('<li><span class="sw sw-ghost"></span>바로 전 확률변수</li>');
      }
      if (loaded()) it.push('<li><span class="sw sw-loaded"></span>칸이 진할수록 확률이 큼</li>');
    } else {
      if (m.sp.kind === 'square' && m.xr) {
        const mode = STEPS ? STEPS[state.step].init.sqmode || state.sqmode : state.sqmode;
        if (mode === 'bands') it.push('<li><span class="sw sw-bands"></span>X 값의 띠 (진할수록 큼)</li>');
        if (mode === 'region') it.push('<li><span class="sw sw-region"></span>{X ≤ x} 영역</li>');
        if (mode === 'region' && state.strip) it.push('<li><span class="sw sw-strip"></span>x를 조금 늘리면 더해지는 띠</li>');
      }
      if (m.sp.kind === 'square' && !m.xr) it.push('<li><span class="sw sw-sel"></span>고른 영역 (안의 점은 주황)</li>');
      if (showRight) it.push('<li><span class="sw sw-bar"></span>X 값의 밀도 히스토그램</li><li><span class="sw sw-theory"></span>이론 밀도 f(x)</li>');
    }
    $('#legend').innerHTML = it.join('');
  }

  function listCells(ids, max = 12) {
    const sp = space();
    const lab = ids.map((id) => sp.outcomes.find((o) => o.id === id).label);
    return lab.length > max ? lab.slice(0, max).join(', ') + `, … (${lab.length}개)` : lab.join(', ');
  }
  function probText(p, count) {
    const N = space().outcomes.length;
    if (loaded() || count == null) return f4(p);
    if (count === 0) return '0';
    const fr = frac(count, N).text;
    return `${count}/${N}${fr !== `${count}/${N}` ? ` = ${fr}` : ''} ≈ ${f4(p)}`;
  }

  function renderEventLine(m) {
    const el = $('#event-line');
    let html = '';
    if (m.kind === 'finite') {
      if (state.ev === 'cells') {
        html = state.sel.length
          ? `<b>${state.selLabel || '고른 사건'}</b> A = {${listCells(state.sel)}}, P(A) = ${probText(m.eventP, state.sel.length)}`
          : '칸을 눌러 사건을 만들어 보세요.';
      } else if (m.xr && state.ev === 'eq' && state.val != null) {
        const ids = [...(m.hl || [])];
        html = `{ω : X(ω) = ${RVL.fmtV(state.val)}} = {${listCells(ids)}}, P(X = ${RVL.fmtV(state.val)}) = ${probText(m.eventP, ids.length)}`;
      } else if (m.xr && state.ev === 'le' && state.xt != null) {
        const ids = [...(m.hl || [])];
        html = `{ω : X(ω) ≤ ${fNum(state.xt, 4)}}는 칸 ${ids.length}개, F(${fNum(state.xt, 4)}) = P(X ≤ ${fNum(state.xt, 4)}) = ${probText(m.eventP, ids.length)}`;
      } else if (m.xr) {
        html = `칸을 가리키면 그 결과에서 X 값으로 화살표가 이어집니다.${m.invalid && m.invalid.size ? ` <span class="warn">X가 정의되지 않는 결과가 ${m.invalid.size}개 있습니다. 확률변수는 모든 결과에서 값이 있어야 합니다.</span>` : ''}`;
      }
    } else if (m.sp.kind === 'square') {
      if (!m.xr) {
        const r = state.rect;
        if (r) {
          let inN = 0;
          if (m.points) for (let i = 0; i < m.n; i++) if (m.points.U[i] >= r.u0 && m.points.U[i] <= r.u1 && m.points.V[i] >= r.v0 && m.points.V[i] <= r.v1) inN++;
          const area = (r.u1 - r.u0) * (r.v1 - r.v0);
          html = `영역 [${r.u0.toFixed(2)}, ${r.u1.toFixed(2)}] × [${r.v0.toFixed(2)}, ${r.v1.toFixed(2)}]: 넓이 ${f4(area)}, 점 ${fInt(m.n)}개 중 ${fInt(inN)}개가 안에 있음 (비율 ${m.n ? f4(inN / m.n) : '—'})`;
        } else html = '정사각형 위를 끌어 영역을 그려 보세요.';
      } else {
        const mode = STEPS ? STEPS[state.step].init.sqmode || state.sqmode : state.sqmode;
        if (mode === 'region') {
          let inN = 0; for (const v of m.xs) if (v <= state.xt) inN++;
          html = `{(u, v) : X ≤ ${fNum(state.xt, 3)}}의 넓이 F(${fNum(state.xt, 3)}) = ${f4(m.cont.cdf(state.xt))}${m.n ? `, 점의 비율 ${f4(inN / m.n)}` : ''}`;
          if (state.strip) {
            const h = stripH(m), dF = m.cont.cdf(state.xt + h) - m.cont.cdf(state.xt);
            html += `<br>주황 띠의 넓이 F(x + h) − F(x) = ${f4(dF)}, ÷ h(${fNum(h, 3)}) = ${f4(dF / h)} ≈ f(x) = ${f4(m.cont.pdf(state.xt))}`;
          }
        } else html = hoverPt ? hoverLabel(m, hoverPt) : '정사각형 위에 마우스를 올려 점마다 붙은 X 값을 확인하세요.';
        if (m.cont.invalidFrac > 0) html += ` <span class="warn">정사각형의 ${(m.cont.invalidFrac * 100).toFixed(1)}%에서 X가 정의되지 않습니다.</span>`;
      }
    } else if (m.xr) {
      html = `${m.xr.name}: 칸 하나의 확률은 0.1로 같습니다. 띠가 넓게 퍼진 곳일수록 밀도가 낮습니다.`;
    }
    el.innerHTML = html;
  }

  function renderReadouts(m) {
    const rows = [];
    rows.push(['표본공간', m.kind === 'finite' ? `결과 ${m.sp.outcomes.length}가지` : m.sp.kind === 'square' ? '[0, 1]²' : '[0, 1]']);
    if (m.kind === 'finite') {
      rows.push(['반복 실험', `${fInt(m.n)}번`]);
      if (m.n && m.lastOutcome) rows.push(['마지막 결과', `${m.lastOutcome.label}${m.xr ? ` → X = ${RVL.fmtV(m.values.get(m.lastOutcome.id))}` : ''}`]);
      if (m.xr) rows.push(['X의 값', `${m.dist.list.length}가지`]);
      if (m.xr && m.n && state.ev === 'eq' && state.val != null) rows.push([`X = ${RVL.fmtV(state.val)}의 상대도수`, f4(m.freq.get(state.val) || 0)]);
      if (m.eventP != null) rows.push(['사건의 확률', f4(m.eventP)]);
    } else {
      rows.push(['점의 수', fInt(m.n)]);
      if (m.xr) {
        let mean = 0; for (const v of m.xs) mean += v; mean = m.xs.length ? mean / m.xs.length : NaN;
        rows.push(['X의 표본평균', fNum(mean, 4)]);
        rows.push(['x', fNum(state.xt, 4)]);
        rows.push(['F(x) 이론', f4(m.cont.cdf(state.xt))]);
        rows.push(['f(x) 이론', f4(m.cont.pdf(state.xt))]);
      }
    }
    $('#readouts').innerHTML = rows.map(([k, v]) => `<div class="ro"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }

  /* ───────────── 화살표 ───────────── */
  function histAnchor(v) {
    if (!hist || !hist.x) return null;
    const r = hist.svg.node().getBoundingClientRect();
    return { x: r.left + hist.mg.left + hist.x(v), y: r.top + hist.mg.top + hist.ih };
  }
  function drawArrows() {
    const m = lastModel;
    if (!m || !arrows) return;
    const list = [];
    if (m.kind === 'finite' && m.xr && !$('#right').hidden && state.showValues) {
      const one = (id, cls) => { const v = m.values.get(id); if (isFinite(v)) list.push({ from: grid.center(id), to: vchart.anchor(v), cls }); };
      if (trialArrow) one(trialArrow, 'trial');
      else if (hoverCell) one(hoverCell, '');
      else {
        const v = hoverValue != null ? hoverValue : state.ev === 'eq' ? state.val : null;
        if (v != null) {
          const e = m.dist.list.find((d) => Math.abs(d.x - v) < 1e-9);
          if (e && e.cells.length <= 12) e.cells.forEach((id) => list.push({ from: grid.center(id), to: vchart.anchor(e.x), cls: 'many' }));
        }
      }
    } else if (m.sp.kind === 'square' && m.xr && !$('#right').hidden) {
      const p = trialArrow || hoverPt;
      if (p) { const v = m.xr.f(p); if (isFinite(v)) list.push({ from: square.anchor(p.u, p.v), to: histAnchor(v), cls: trialArrow ? 'trial' : '' }); }
    }
    arrows.draw(list);
  }

  /* ───────────── 동작 ───────────── */
  function replayValues() {
    if (S.reduceMotion() || !isFinite_()) return;
    d3.selectAll('#omega .cell-val').style('opacity', 0).transition().delay((d, i) => 120 + i * 32).duration(260).style('opacity', 1);
  }
  function trialOnce() {
    stopAll();
    const sp = space();
    if (sp.kind === 'finite') {
      const s = ensureFinite(state.trials + 1);
      const o = sp.outcomes[s.idx[state.trials]];
      grid.flash(o.id);
      trialArrow = o.id;
      drawArrows();
      trialTimer = setTimeout(() => {
        applyChanges({ trials: state.trials + 1 });
        render();
        trialTimer = setTimeout(() => { trialArrow = null; drawArrows(); }, 700);
      }, S.reduceMotion() ? 0 : 420);
    } else {
      const s = ensurePoints(state.trials + 1);
      const p = { u: s.U[state.trials], v: s.V[state.trials] };
      applyChanges({ trials: state.trials + 1 });
      trialArrow = sp.kind === 'square' && lastModel && lastModel.xr ? p : null;
      render();
      trialTimer = setTimeout(() => { trialArrow = null; drawArrows(); }, 1100);
    }
  }
  function addTrials(k) { set({ trials: state.trials + k }); }
  function sweep() {
    stopAll();
    const m = lastModel;
    let lo, hi;
    if (isFinite_()) { const l = m.dist.list; lo = l[0].x - 0.5; hi = l[l.length - 1].x; }
    else [lo, hi] = m.cont.range;
    const t0 = performance.now(), T = 3200;
    if (isFinite_()) applyChanges({ ev: 'le' });
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / T);
      const v = lo + (hi - lo) * t;
      state.xt = isFinite_() ? Math.floor(v * 1000) / 1000 : +v.toFixed(3);
      render();
      if (t < 1) sweepRaf = requestAnimationFrame(frame); else sweepRaf = null;
    };
    sweepRaf = requestAnimationFrame(frame);
  }
  function cycleX(dir) {
    const ps = presets();
    const i = ps.findIndex((p) => p.id === state.xid);
    set({ xid: ps[(i + dir + ps.length) % ps.length].id }, { replay: true });
  }
  function eventExample() {
    const ex = EVENT_EX[state.space] || [];
    if (!ex.length) return;
    exIdx = (exIdx + 1) % ex.length;
    const [label, f] = ex[exIdx];
    set({ ev: 'cells', sel: space().outcomes.filter((o) => f(o.v)).map((o) => o.id), selLabel: label });
  }
  function toggleSpace() {
    const list = SPACES_FOR[PAGE];
    set({ space: list[(list.indexOf(state.space) + 1) % list.length] }, { replay: true });
  }
  function valueOr(v) {
    const l = O.distribution(space(), currentX().f).list.map((d) => d.x);
    return l.some((x) => Math.abs(x - v) < 1e-9) ? v : 'mid';
  }

  const api = {
    state, set: (ch, o) => set(ch, o), setX: (id) => set({ xid: id }, { replay: true }), cycleX, eventExample, toggleSpace, replayValues,
    trialOnce, addTrials, sweep, valueOr,
    goModule2: () => { location.href = ROOT + 'module2/discrete.html?step=2'; },
    goModule2Inverse: () => { location.href = ROOT + 'module2/continuous.html?step=6'; },
  };

  /* ───────────── URL ───────────── */
  let urlTimer = null;
  function scheduleURL() { clearTimeout(urlTimer); urlTimer = setTimeout(writeURL, 250); }
  function writeURL() {
    const q = new URLSearchParams();
    if (STEPS) q.set('step', state.step + 1);
    q.set('sp', state.space);
    if (state.xid) q.set('x', state.xid);
    if (state.xid === 'custom') q.set('e', state.expr);
    if (loaded()) q.set('w', state.w.map((v) => +v.toFixed(3)).join(','));
    if (state.ev !== 'none') q.set('ev', state.ev);
    if (state.ev === 'eq' && state.val != null) q.set('v', state.val);
    if (state.xt != null && isFinite(state.xt)) q.set('t', +(+state.xt).toFixed(4));
    if (state.trials) q.set('n', state.trials);
    q.set('seed', state.seed);
    const o = (state.band ? 'b' : '') + (state.showCdf ? 'c' : '') + (state.strip ? 's' : '');
    if (o) q.set('o', o);
    if (PAGE === 'lab') q.set('m', state.sqmode);
    try { history.replaceState(null, '', '?' + q.toString()); } catch (e) { /* file:// */ }
  }
  function readURL() {
    const q = new URLSearchParams(location.search);
    const st = parseInt(q.get('step'), 10);
    if (STEPS && st >= 1 && st <= STEPS.length) state.step = st - 1;
    if (!q.has('sp')) return false;
    const sp = q.get('sp');
    if (!SPACES_FOR[PAGE].includes(sp)) return false;
    state.space = sp;
    if (q.has('x')) state.xid = q.get('x');
    if (q.has('e')) state.expr = q.get('e');
    if (q.has('w')) { const w = q.get('w').split(',').map(Number); if (w.length === 6 && w.every((v) => v >= 0)) state.w = w; }
    if (q.has('ev')) state.ev = q.get('ev');
    if (q.has('v')) state.val = +q.get('v');
    if (q.has('t')) state.xt = +q.get('t');
    state.trials = +q.get('n') || 0;
    state.seed = +q.get('seed') || 2026;
    const o = q.get('o') || '';
    state.band = o.includes('b'); state.showCdf = o.includes('c'); state.strip = o.includes('s');
    if (q.has('m')) state.sqmode = q.get('m');
    if (STEPS) {
      const init = STEPS[state.step].init;
      state.right = init.right !== false;
      state.showValues = init.showValues !== false;
      if (init.xid === null) state.xid = null;
    }
    return true;
  }

  /* ───────────── 레이아웃 ───────────── */
  const META = {
    discrete: { crumb: '모듈 3 셀 수 있는 표본공간', h1: '확률변수는 결과에 수를 붙이는 규칙' },
    continuous: { crumb: '모듈 3 연속 표본공간', h1: '정사각형 위의 점과 확률변수' },
    lab: { crumb: '모듈 3 자유 실험실', h1: '확률변수 자유 실험실' },
  };
  function buildLayout() {
    const meta = META[PAGE];
    const spOpts = SPACES_FOR[PAGE];
    document.getElementById('app').innerHTML = `
    <header class="site-header" id="hdr"></header>
    <main class="lab">
      ${S.stage({ crumb: meta.crumb, h1: meta.h1, steps: STEPS })}
      <div class="lab-grid">
        <section class="main" aria-label="표본공간과 분포">
          <figure class="chart-card m3-card">
            <ul class="legend" id="legend"></ul>
            <div class="m3-stage" id="m3stage">
              <div class="m3-left"><h3 class="panel-title" id="left-title"></h3><div id="omega"></div></div>
              <div class="m3-right" id="right"><h3 class="panel-title" id="right-title"></h3><div id="vchart"></div><div id="cdfmini" class="cdf-mini" hidden></div></div>
            </div>
            <p class="event-line" id="event-line" aria-live="polite"></p>
            <dl class="readouts" id="readouts"></dl>
          </figure>
        </section>
        <div class="side">
          <article class="step-card" id="step-card" aria-live="polite"></article>
          <div class="controls" id="controls">
            <section class="ctl" data-ctl="space">
              <h3>표본공간</h3>
              ${PAGE === 'lab'
                ? `<select id="sel-space" aria-label="표본공간">${spOpts.map((id) => `<option value="${id}">${O.SPACES[id].name}</option>`).join('')}</select>`
                : `<div class="seg" id="seg-space" role="group" aria-label="표본공간">${spOpts.map((id) => `<button type="button" data-space="${id}">${O.SPACES[id].name}</button>`).join('')}</div>`}
            </section>
            <section class="ctl" data-ctl="xsel">
              <h3><label for="sel-x">확률변수 X</label></h3>
              <select id="sel-x"></select>
            </section>
            <section class="ctl" data-ctl="expr">
              <h3><label for="in-expr">직접 정의하기</label></h3>
              <div class="row"><input type="text" id="in-expr" maxlength="200" spellcheck="false" autocomplete="off" placeholder="예: max(a, b) - min(a, b)"><button type="button" id="btn-expr">적용</button></div>
              <p class="hint" id="expr-hint"></p>
              <p class="hint warn" id="expr-err" hidden></p>
            </section>
            <section class="ctl" data-ctl="weights">
              <h3>찌그러진 주사위 (눈별 확률)</h3>
              <div id="weights" class="weights"></div>
              <div class="btn-row"><button type="button" id="btn-fair">공정한 주사위로</button><button type="button" id="btn-six">6이 잘 나오게</button></div>
            </section>
            <section class="ctl" data-ctl="event-cells">
              <h3>사건</h3>
              <p class="hint" style="margin-top:0">칸을 누르면 사건에 넣거나 뺍니다. 키보드: 방향키로 이동, Enter로 선택.</p>
            </section>
            <section class="ctl" data-ctl="event">
              <h3>사건 모드</h3>
              <div class="seg seg-wrap" id="seg-ev" role="group" aria-label="사건 모드">
                <button type="button" data-ev="none">없음</button><button type="button" data-ev="cells">칸 고르기</button><button type="button" data-ev="eq">X = x</button><button type="button" data-ev="le">X ≤ x</button>
              </div>
              <div class="row" id="row-le" style="margin-top:8px"><input type="range" id="rng-le" aria-label="x 값"><output id="out-le"></output></div>
              <p class="hint">X = x 모드에서는 오른쪽 분포의 값을 누르세요.</p>
            </section>
            <section class="ctl" data-ctl="threshold">
              <h3><label for="rng-t">x (영역 {X ≤ x})</label></h3>
              <div class="row"><input type="range" id="rng-t" step="any"><output id="out-t"></output></div>
            </section>
            <section class="ctl" data-ctl="sqmode">
              <h3>정사각형 보기</h3>
              <div class="seg" id="seg-sq" role="group" aria-label="정사각형 보기"><button type="button" data-sq="plain">점만</button><button type="button" data-sq="bands">값 띠</button><button type="button" data-sq="region">X ≤ x 영역</button></div>
              <label class="check"><input type="checkbox" id="chk-strip"> 미분 띠 (x를 조금 늘린 만큼)</label>
            </section>
            <section class="ctl" data-ctl="trials">
              <h3>반복 실험</h3>
              <p class="hint" style="margin-top:0" id="trials-now"></p>
              <div class="btn-row"><button type="button" id="btn-one" class="primary">한 번</button><button type="button" data-add="100">+100</button><button type="button" data-add="1000">+1,000</button><button type="button" data-add="10000">+10,000</button><button type="button" id="btn-reset">처음부터</button></div>
            </section>
            <section class="ctl" data-ctl="overlays">
              <h3>겹쳐 그리기</h3>
              <label class="check" data-ctl="band"><input type="checkbox" id="chk-band"> 예상 변동 범위 (± 2 표준오차)</label>
              <label class="check" data-ctl="cdf"><input type="checkbox" id="chk-cdf"> 누적분포함수 F(x)</label>
            </section>
            <section class="ctl" data-ctl="seed">
              <h3><label for="num-seed">난수 시드</label></h3>
              <div class="row"><input type="number" id="num-seed" min="1" max="999999"><button type="button" id="btn-reseed">새 난수로 다시</button></div>
              <p class="hint">같은 시드는 언제나 같은 실험 결과를 만듭니다.</p>
            </section>
          </div>
        </div>
      </div>
    </main>
    <footer class="site-footer"><p>확률변수 실험실 모듈 3. 유한 표본공간의 분포는 모든 결과를 열거해 정확히 계산합니다.</p></footer>`;
    S.mountHeader($('#hdr'), { root: ROOT, current: body.dataset.current, tools: true });
  }

  function buildSpaceViews() {
    const host = $('#omega');
    host.innerHTML = '';
    const right = $('#vchart');
    right.innerHTML = '';
    grid = vchart = square = segment = hist = null;
    const sp = space();
    if (sp.kind === 'finite') {
      grid = new RVL.GridView(host, {
        onHover: (id) => { hoverCell = id; drawArrows(); },
        onClick: (id) => {
          if (!controls().includes('event-cells') && !controls().includes('event')) return;
          const s = new Set(state.sel);
          if (s.has(id)) s.delete(id); else s.add(id);
          set({ ev: 'cells', sel: [...s], selLabel: '' });
        },
      });
      vchart = new RVL.ValueChart(right, {
        onPick: (v) => { if (controls().includes('event') || (STEPS && ['M2', 'M4'].includes(STEPS[state.step].id))) set({ ev: 'eq', val: v }); },
        onHoverValue: (v) => { hoverValue = v; drawArrows(); },
      });
    } else if (sp.kind === 'square') {
      square = new RVL.SquareView(host, {
        onHover: (p) => {
          hoverPt = p;
          if (lastModel && lastModel.xr) {
            square.setHover(p ? { ...p, label: hoverLabel(lastModel, p) } : null);
            const mode = STEPS ? STEPS[state.step].init.sqmode || state.sqmode : state.sqmode;
            if (mode !== 'region') renderEventLine(lastModel);
          }
          drawArrows();
        },
        onRect: (r) => { if (!lastModel || !lastModel.xr) set({ rect: r }); },
      });
      if (state.xid) square.setField(currentX().f);
      hist = new RVL.HistChart(right, { height: 300, onHandle: (which, v) => { if (which === 'b') { stopAll(); state.xt = v; render(); } } });
    } else {
      segment = new RVL.SegmentView(host);
      hist = new RVL.HistChart(right, { height: 300 });
    }
    applyVisibility();
  }

  function buildXOptions() {
    const sel = $('#sel-x');
    const ps = presets();
    sel.innerHTML = ps.map((p) => `<option value="${p.id}">${p.name}</option>`).join('') + (PAGE === 'lab' ? '<option value="custom">직접 정의한 식</option>' : '');
    sel.value = state.xid || ps[0].id;
    const vars = space().vars;
    $('#expr-hint').innerHTML = `쓸 수 있는 변수: <b>${vars.join(', ')}</b>${space().id === 'coin3' ? ' (앞면 1, 뒷면 0)' : ''}. 함수: abs, max, min, sqrt, ln, exp, floor. 비교식(예: a + b >= 10)은 참이면 1, 거짓이면 0.`;
    const ex = { dice2: 'max(a, b) - min(a, b)', coin3: 'c1 + 2*c2 + 4*c3', dice1: '(a - 3.5)^2', square: 'abs(u - v) + u*v', segment: 'u^3' }[space().id];
    $('#in-expr').placeholder = `예: ${ex}`;
  }

  function buildWeights() {
    $('#weights').innerHTML = d3.range(6).map((i) => `<label class="param"><span class="param-name">${i + 1}의 눈</span><input type="range" min="0.02" max="1" step="0.01" data-w="${i}"><output data-wo="${i}"></output></label>`).join('');
    $$('#weights input').forEach((el) => el.addEventListener('input', () => {
      const w = state.w.slice(); w[+el.dataset.w] = +el.value;
      set({ w, trials: 0 });
    }));
  }

  function applyVisibility() {
    const cs = controls();
    const sp = space();
    $$('#controls [data-ctl]').forEach((el) => {
      const c = el.dataset.ctl;
      let show = c === 'overlays' ? ['band', 'cdf'].some((x) => cs.includes(x)) : cs.includes(c);
      if (c === 'weights') show = show && sp.loaded;
      if (c === 'event' || c === 'event-cells' || c === 'band') show = show && sp.kind === 'finite';
      if (c === 'threshold' || c === 'sqmode') show = show && sp.kind === 'square';
      if (c === 'cdf' && PAGE === 'lab') show = true;
      el.hidden = !show;
    });
  }

  function syncControls(m) {
    $$('#seg-space button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.space === state.space));
    if ($('#sel-space')) $('#sel-space').value = state.space;
    if (state.xid) $('#sel-x').value = state.xid;
    $$('#seg-ev button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.ev === state.ev));
    const le = $('#rng-le');
    $('#row-le').hidden = state.ev !== 'le';
    if (m.kind === 'finite' && m.dist && m.dist.list.length) {
      const l = m.dist.list;
      le.min = l[0].x - 0.5; le.max = l[l.length - 1].x + 0.5; le.step = 'any';
      if (document.activeElement !== le && state.xt != null) le.value = state.xt;
      $('#out-le').textContent = state.xt != null ? `x = ${fNum(state.xt, 3)}` : '';
    }
    if (m.cont) {
      const t = $('#rng-t');
      t.min = m.cont.range[0]; t.max = m.cont.range[1];
      if (document.activeElement !== t) t.value = state.xt;
      $('#out-t').textContent = `x = ${fNum(state.xt, 3)}`;
    }
    $$('#seg-sq button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.sq === state.sqmode));
    $('#chk-strip').checked = state.strip;
    $('#chk-band').checked = state.band;
    $('#chk-cdf').checked = state.showCdf;
    if (document.activeElement !== $('#num-seed')) $('#num-seed').value = state.seed;
    $('#trials-now').textContent = m.kind === 'finite' ? `지금까지 ${fInt(m.n)}번 실험했습니다.` : `지금까지 점 ${fInt(m.n)}개를 찍었습니다 (최대 100,000개).`;
    $('#btn-one').textContent = m.kind === 'finite' ? '실험 한 번' : '점 하나';
    $$('[data-add]').forEach((b) => (b.hidden = m.kind !== 'finite' && +b.dataset.add === 100));
    $$('#weights input').forEach((el) => { const i = +el.dataset.w; if (document.activeElement !== el) el.value = state.w[i]; });
    const wa = weightsArr();
    $$('#weights output').forEach((el) => (el.textContent = wa[+el.dataset.wo].toFixed(3)));
    $('#expr-err').hidden = !exprError;
    $('#expr-err').textContent = exprError;
    if (document.activeElement !== $('#in-expr') && state.xid === 'custom') $('#in-expr').value = state.expr;
  }

  function buildStepCard() {
    const card = $('#step-card');
    if (!STEPS) {
      card.innerHTML = `
        <p class="step-num">자유 실험실</p>
        <h2>확률변수를 직접 만들어 보세요</h2>
        <p class="do">표본공간을 고르고, 프리셋이나 직접 쓴 식으로 확률변수를 정의하세요. 같은 실험 결과에 다른 규칙을 붙이거나, 주사위를 찌그러뜨려 표본공간의 확률을 바꿔 볼 수 있습니다.</p>
        <div class="see"><h4>해 볼 만한 실험</h4><ul>
          <li>주사위 두 개에서 <code>a + b</code>와 <code>max(a, b)</code>를 번갈아 보며, 같은 반복 실험 결과로 두 분포가 함께 얻어지는 것을 확인하세요.</li>
          <li>6의 눈이 잘 나오는 주사위로 바꾸면, 규칙은 같아도 합의 분포가 오른쪽으로 기웁니다.</li>
          <li>정사각형에서 <code>abs(u - v)</code>와 <code>min(u, v)</code>는 규칙이 다른데 분포가 같습니다. 영역 모양을 비교해 보세요.</li>
          <li><code>ln(a - 1)</code>처럼 어떤 결과에서 값이 정의되지 않는 식을 넣어 보세요.</li>
        </ul></div>
        <p class="toast" id="toast" hidden></p>`;
      S.renderMath(card);
      return;
    }
    S.buildStepCard(card, STEPS, state.step, api, goStep);
  }

  function goStep(i) {
    if (!STEPS || i < 0 || i >= STEPS.length) return;
    stopAll();
    state.step = i;
    const init = JSON.parse(JSON.stringify(STEPS[i].init));
    const ch = { ...init };
    if (!('space' in ch)) ch.space = state.space;
    if (ch.space !== state.space) { state.space = ch.space; buildSpaceViews(); }
    delete ch.space;
    if (ch.xid === 'auto' && state.xid && presets().some((p) => p.id === state.xid) && i > 1) delete ch.xid;
    if (!('right' in ch)) ch.right = true;
    ghost = null;
    hoverCell = hoverValue = hoverPt = trialArrow = null;
    applyChanges(ch);
    if (square && state.xid) square.setField(currentX().f);
    buildXOptions();
    buildStepCard();
    applyVisibility();
    render();
    if (STEPS[i].id === 'M2') replayValues();
  }

  /* ───────────── 이벤트 ───────────── */
  function wire() {
    $$('#seg-space button').forEach((b) => b.addEventListener('click', () => set({ space: b.dataset.space }, { replay: true })));
    if ($('#sel-space')) $('#sel-space').addEventListener('change', (e) => set({ space: e.target.value }, { replay: true }));
    $('#sel-x').addEventListener('change', (e) => {
      if (e.target.value === 'custom') { $('#in-expr').focus(); if (state.expr) set({ xid: 'custom' }); return; }
      set({ xid: e.target.value }, { replay: true });
    });
    const applyExpr = () => {
      const src = $('#in-expr').value.trim();
      const c = X.compile(src, space().vars);
      if (c.error) { exprError = c.error; $('#expr-err').hidden = false; $('#expr-err').textContent = c.error; return; }
      set({ xid: 'custom', expr: src }, { replay: true });
    };
    $('#btn-expr').addEventListener('click', applyExpr);
    $('#in-expr').addEventListener('keydown', (e) => { if (e.key === 'Enter') applyExpr(); });
    $('#btn-fair').addEventListener('click', () => set({ w: [1, 1, 1, 1, 1, 1], trials: 0 }));
    $('#btn-six').addEventListener('click', () => set({ w: [0.1, 0.1, 0.1, 0.1, 0.1, 0.5], trials: 0 }));
    $$('#seg-ev button').forEach((b) => b.addEventListener('click', () => {
      const ev = b.dataset.ev;
      set({ ev, val: ev === 'eq' && state.val == null ? 'mid' : state.val, xt: ev === 'le' && state.xt == null ? 'mid' : state.xt });
    }));
    $('#rng-le').addEventListener('input', (e) => { stopAll(); state.xt = +e.target.value; render(); });
    $('#rng-t').addEventListener('input', (e) => { stopAll(); state.xt = +e.target.value; render(); });
    $$('#seg-sq button').forEach((b) => b.addEventListener('click', () => set({ sqmode: b.dataset.sq })));
    $('#chk-strip').addEventListener('change', (e) => set({ strip: e.target.checked, sqmode: e.target.checked ? 'region' : state.sqmode }));
    $('#btn-one').addEventListener('click', trialOnce);
    $$('[data-add]').forEach((b) => b.addEventListener('click', () => addTrials(+b.dataset.add)));
    $('#btn-reset').addEventListener('click', () => set({ trials: 0 }));
    $('#chk-band').addEventListener('change', (e) => set({ band: e.target.checked }));
    $('#chk-cdf').addEventListener('change', (e) => set({ showCdf: e.target.checked }));
    $('#num-seed').addEventListener('change', (e) => set({ seed: clamp(Math.round(+e.target.value) || 1, 1, 999999) }));
    $('#btn-reseed').addEventListener('click', () => set({ seed: 1 + Math.floor(Math.random() * 999999) }));
    S.wireTools({ onPresent: () => render(), beforeShare: writeURL });
    if (STEPS) { S.wireStepRail(goStep); S.wireStepKeys(goStep, () => state.step); }
    window.addEventListener('resize', () => requestAnimationFrame(drawArrows));
    window.addEventListener('scroll', () => { if (hoverCell || hoverPt || trialArrow || state.ev === 'eq') requestAnimationFrame(drawArrows); }, { passive: true });
  }

  /* ───────────── 시작 ───────────── */
  function init() {
    buildLayout();
    buildWeights();
    cdfmini = new RVL.CdfView(null, $('#cdfmini'), {
      heightBot: 190, margin: { top: 10, right: 14, bottom: 38, left: 50 },
      onPointer: (k, v) => { if (k !== 'x') return; stopAll(); if (isFinite_()) { state.ev = 'le'; } state.xt = v; render(); },
    });
    const restored = readURL();
    arrows = new RVL.ArrowLayer($('#m3stage'));
    buildSpaceViews();
    wire();
    if (STEPS && !restored) {
      goStep(state.step);
    } else {
      applyChanges({});
      buildXOptions();
      if (square && state.xid) square.setField(currentX().f);
      buildStepCard();
      applyVisibility();
      render();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
