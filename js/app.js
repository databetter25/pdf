/* 모듈 1 화면 컨트롤러
 * <body data-page="continuous|discrete|lab" data-root="../">에서 동작한다.
 * 상태(state) → 모델(computeModel) → 차트·수치·패널 렌더링의 단방향 흐름.
 */
(function () {
  'use strict';
  const RVL = window.RVL;
  const D = RVL.dist, H = RVL.hist, RNG = RVL.rng;
  const body = document.body;
  const PAGE = body.dataset.page;
  const ROOT = body.dataset.root || '';
  const STEPS = PAGE === 'lab' ? null : RVL.steps[PAGE];
  const ALL_CONTROLS = ['dist', 'n', 'more', 'draw', 'seed', 'mode', 'bins', 'nested', 'rule', 'poly', 'theory', 'ghost', 'band', 'play', 'interval', 'map', 'conv'];
  const N_LIST = [10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000];
  const PLAY_SEQ = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
  const CONV_GRID = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6];
  const N_MIN = 10, N_MAX = 1e6;
  const MODE_LABEL = { count: '도수', rel: '상대도수', density: '밀도' };
  const Y_LABEL = { count: '도수 (개수)', rel: '상대도수 (개수 ÷ n)', density: '밀도 (상대도수 ÷ Δx)' };
  const SHAPES = { continuous: ['normal', 'gamma', 'uniform'], discrete: ['binomial', 'dice', 'poisson'] };
  const fInt = d3.format(',');
  const f4 = d3.format('.4f');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function fNum(v, digits = 4) {
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e5)) return v.toPrecision(3);
    return (+v.toPrecision(digits)).toString();
  }

  /* ───────────── 상태 ───────────── */
  function defaultState() {
    const kind = PAGE === 'discrete' ? 'discrete' : 'continuous';
    const dist = kind === 'discrete' ? 'binomial' : 'normal';
    return {
      step: 0, kind, dist, params: D.get(dist).defaults(), n: PAGE === 'lab' ? 1000 : 100, seed: 2026,
      k: 20, m: 1, mode: PAGE === 'lab' ? 'density' : 'count', rule: PAGE === 'lab' ? 'scott' : 'manual', nested: false,
      showPoly: false, showTheory: PAGE === 'lab', showGhost: false, showBand: false,
      interval: { on: false, a: 0, b: 1, inclA: true, inclB: true },
    };
  }
  const state = defaultState();
  let ghost = null;
  let lastModel = null;
  let chart, conv, map;
  let playing = false, playIdx = 0, playTimer = null;
  let animating = false, animTimers = [];
  let narrowRaf = null;

  function controls() {
    return STEPS ? STEPS[state.step].controls : ALL_CONTROLS;
  }
  function modes() {
    return STEPS ? STEPS[state.step].modes : ['count', 'rel', 'density'];
  }
  function dist() { return D.get(state.dist); }

  /* ───────────── 표본 버퍼 캐시 ───────────── */
  const streams = new Map();
  function getStream() {
    const key = state.dist + '|' + JSON.stringify(state.params) + '|' + state.seed;
    let s = streams.get(key);
    if (!s) {
      const d = dist(), P = { ...state.params };
      s = new RNG.SampleStream((rng) => d.sampler(rng, P), state.seed);
      streams.set(key, s);
      if (streams.size > 3) streams.delete(streams.keys().next().value);
    }
    return s;
  }

  function displayRange() {
    const d = dist();
    return d.type === 'continuous' ? H.continuousRange(d, state.params) : H.discreteRange(d, state.params);
  }

  function normalizeInterval() {
    const d = dist(), P = state.params, iv = state.interval;
    const [lo, hi] = displayRange();
    const disc = d.type === 'discrete';
    if (iv.auto || !isFinite(iv.a) || !isFinite(iv.b) || iv.b < lo || iv.a > hi) {
      const m = d.mean(P), s = Math.sqrt(d.variance(P));
      iv.a = disc ? Math.round(m - s) : +(m - s).toFixed(2);
      iv.b = disc ? Math.round(m + s) : +(m + s).toFixed(2);
    }
    delete iv.auto;
    iv.a = clamp(iv.a, lo, hi); iv.b = clamp(iv.b, lo, hi);
    if (iv.a > iv.b) [iv.a, iv.b] = [iv.b, iv.a];
    if (disc) { iv.a = Math.round(iv.a); iv.b = Math.round(iv.b); }
  }

  /* ───────────── 모델 계산 ───────────── */
  function computeModel(nShown) {
    const d = dist(), P = state.params;
    const samples = getStream().get(state.n);
    const n = nShown == null ? state.n : nShown;
    const nn = Math.max(1, n);
    let bins;
    if (d.type === 'continuous') {
      const [L, U] = H.continuousRange(d, P);
      let k = state.k;
      if (state.rule !== 'manual') k = H.ruleK(state.rule, samples, Math.max(2, n), L, U);
      if (state.nested) k = H.snapNested(k);
      bins = H.continuousBins(L, U, H.clampK(k));
    } else {
      const [a, b] = H.discreteRange(d, P);
      bins = H.discreteBins(a, b, state.m);
    }
    const { counts, out } = H.binCounts(samples, n, bins);
    const heights = H.heights(counts, nn, bins.width, state.mode);
    const dens = H.heights(counts, nn, bins.width, 'density');
    const w = bins.width;

    let theory, theoryMax = 0;
    if (d.type === 'continuous') {
      const scale = state.mode === 'count' ? nn * w : state.mode === 'rel' ? w : 1;
      const N = 600, pts = new Array(N), ys = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const xv = bins.lo + (bins.hi - bins.lo) * i / (N - 1);
        let yv = d.pdf(xv, P) * scale;
        if (!isFinite(yv)) yv = 0;
        pts[i] = [xv, yv]; ys[i] = yv;
      }
      ys.sort();
      const p98 = ys[Math.floor(0.98 * (N - 1))];
      theoryMax = p98 > 0 ? Math.min(ys[N - 1], 2.5 * p98) : ys[N - 1];
      theory = { type: 'curve', points: pts };
    } else {
      const scale = state.mode === 'count' ? nn : state.mode === 'rel' ? 1 : 1 / w;
      const pts = [];
      for (let x = bins.xmin; x <= bins.xmax; x++) {
        const yv = d.pmf(x, P) * scale;
        pts.push([x, yv]);
        theoryMax = Math.max(theoryMax, yv);
      }
      theory = { type: 'stems', points: pts };
    }

    const poly = [];
    for (let j = 0; j < bins.k; j++) {
      if (d.type === 'discrete') {
        const xi = H.binInteger(bins, j);
        if (xi !== null) poly.push([xi, heights[j]]);
      } else {
        poly.push([bins.origin + (j + 0.5) * w, heights[j]]);
      }
    }

    const iv = state.interval;
    let interval = null, barClass = null;
    if (iv.on && controls().includes('interval')) {
      if (d.type === 'continuous') {
        interval = { on: true, a: iv.a, b: iv.b, bandLo: iv.a, bandHi: iv.b };
        barClass = Array.from({ length: bins.k }, (_, j) => {
          const c = bins.origin + (j + 0.5) * w;
          return c >= iv.a && c <= iv.b ? 'in' : 'out';
        });
      } else {
        const lo = iv.inclA ? iv.a : iv.a + 1, hi = iv.inclB ? iv.b : iv.b - 1;
        interval = { on: true, a: iv.a, b: iv.b, bandLo: lo - 0.5, bandHi: Math.max(lo - 0.5, hi + 0.5), lo, hi };
        barClass = Array.from({ length: bins.k }, (_, j) => {
          const xi = H.binInteger(bins, j);
          return xi !== null && xi >= lo && xi <= hi ? 'in' : 'out';
        });
      }
    }

    let maxH = 0;
    for (let j = 0; j < bins.k; j++) if (heights[j] > maxH) maxH = heights[j];
    let ghostShow = null, ghostMax = 0;
    if (ghost && state.showGhost && controls().includes('ghost') && ghost.mode === state.mode && ghost.key === state.dist + JSON.stringify(state.params)) {
      ghostShow = ghost;
      for (const v of ghost.heights) ghostMax = Math.max(ghostMax, v);
    }
    /* 예상 변동 범위: 구간 도수 c_j ~ 이항(n, p_j) → 기댓값 n·p_j ± 2·√(n·p_j(1−p_j)) */
    let band = null, bandMax = 0;
    if (state.showBand && controls().includes('band')) {
      const unit = state.mode === 'count' ? 1 : state.mode === 'rel' ? 1 / nn : 1 / (nn * w);
      band = [];
      for (let j = 0; j < bins.k; j++) {
        let pj;
        if (d.type === 'discrete') {
          const xi = H.binInteger(bins, j);
          if (xi === null) continue;
          pj = d.pmf(xi, P);
        } else {
          const [e0, e1] = H.binEdges(bins, j);
          pj = d.cdf(e1, P) - d.cdf(e0, P);
        }
        if (!(pj > 0)) continue;
        const mu = nn * pj, se = Math.sqrt(nn * pj * (1 - pj));
        const b = { j, mid: bins.origin + (j + 0.5) * w, exp: mu * unit, lo: Math.max(0, mu - 2 * se) * unit, hi: (mu + 2 * se) * unit, inside: counts[j] >= mu - 2 * se - 1e-9 && counts[j] <= mu + 2 * se + 1e-9 };
        band.push(b);
        bandMax = Math.max(bandMax, b.hi);
      }
    }
    const yMax = Math.max(maxH, theoryMax, ghostMax, bandMax, 1e-9) * 1.08;

    let sum = 0, sumsq = 0;
    for (let i = 0; i < n; i++) { sum += samples[i]; sumsq += samples[i] * samples[i]; }
    const mean = n ? sum / n : NaN;
    const sd = n > 1 ? Math.sqrt(Math.max(0, (sumsq - n * mean * mean) / (n - 1))) : NaN;

    return {
      kind: d.type, dist: d, P, n, samples, bins, counts, out, heights, dens, mode: state.mode,
      xDomain: [bins.lo, bins.hi], yMax, yLabel: Y_LABEL[state.mode], xLabel: d.type === 'discrete' ? 'x (확률변수의 값)' : 'x',
      theory, showTheory: state.showTheory && controls().includes('theory'),
      poly: state.showPoly && controls().includes('poly') ? poly : null,
      ghost: ghostShow, band, interval, barClass, mean, sd,
      ariaLabel: `${d.name} 난수 ${fInt(n)}개의 ${MODE_LABEL[state.mode]} 히스토그램, 구간 폭 ${fNum(w)}`,
    };
  }

  /* ───────────── 상태 변경 ───────────── */
  const GHOST_KEYS = ['n', 'k', 'm', 'rule', 'nested'];
  function applyChanges(ch, opts = {}) {
    if (state.showGhost && lastModel && opts.ghost !== false && Object.keys(ch).some((k) => GHOST_KEYS.includes(k))) {
      ghost = {
        origin: lastModel.bins.origin, width: lastModel.bins.width, heights: Float64Array.from(lastModel.heights),
        mode: state.mode, key: state.dist + JSON.stringify(state.params),
      };
    }
    if ('dist' in ch && ch.dist !== state.dist) {
      const d = D.get(ch.dist);
      state.dist = ch.dist;
      state.kind = d.type;
      state.params = d.fix({ ...d.defaults(), ...(ch.params || {}) });
      ghost = null;
      if (!ch.interval) state.interval = { ...state.interval, auto: true };
      if (d.type === 'discrete' && state.rule !== 'manual') state.rule = 'manual';
    } else if (ch.params) {
      state.params = dist().fix({ ...state.params, ...ch.params });
    }
    if (ch.interval) state.interval = { ...state.interval, ...ch.interval };
    for (const k of ['n', 'k', 'm', 'mode', 'rule', 'nested', 'showPoly', 'showTheory', 'showGhost', 'showBand', 'seed']) {
      if (k in ch) state[k] = ch[k];
    }
    state.n = clamp(Math.round(state.n) || N_MIN, N_MIN, N_MAX);
    state.k = H.clampK(state.k || 10);
    if (!H.DISCRETE_M.includes(state.m)) state.m = 1;
    if (!modes().includes(state.mode)) state.mode = modes()[0];
    normalizeInterval();
  }
  function stopAll() {
    stopPlay();
    animating = false;
    animTimers.forEach(clearTimeout); animTimers = [];
    if (narrowRaf) { cancelAnimationFrame(narrowRaf); narrowRaf = null; }
  }
  function set(ch, opts = {}) {
    stopAll();
    const prevDist = state.dist;
    applyChanges(ch, opts);
    if (state.dist !== prevDist) buildDistUI();
    render(opts);
  }

  /* ───────────── 렌더링 ───────────── */
  function render(opts = {}) {
    const model = computeModel(opts.nShown);
    lastModel = model;
    chart.render(model, { duration: opts.duration ?? 280, reveal: opts.reveal });
    renderLegend(model);
    renderReadouts(model);
    syncControls(model);
    renderProb(model);
    if (opts.nShown == null) {
      scheduleAux();
      scheduleURL();
      refreshTable();
    }
    return model;
  }

  function renderLegend(m) {
    const items = [`<li><span class="sw sw-bar"></span>히스토그램 (${MODE_LABEL[m.mode]})</li>`];
    if (m.poly) items.push(`<li><span class="sw sw-poly"></span>${m.kind === 'discrete' ? '꼭대기 잇기 (보조선)' : '도수다각형'}</li>`);
    if (m.showTheory) items.push(`<li><span class="sw ${m.kind === 'discrete' ? 'sw-stem' : 'sw-theory'}"></span>${m.kind === 'discrete' ? '이론 확률질량함수 p(x)' : '이론 확률밀도함수 f(x)'}${m.mode === 'density' ? '' : m.kind === 'discrete' ? (m.mode === 'count' ? ' × n' : '') : m.mode === 'count' ? ' × n × Δx' : ' × Δx'}</li>`);
    if (m.ghost) items.push('<li><span class="sw sw-ghost"></span>직전 상태</li>');
    if (m.band) {
      const outN = m.band.filter((b) => !b.inside).length;
      items.push(`<li><span class="sw sw-band-whisker"></span>예상 변동 범위 (기댓값 ± 2 표준오차): 벗어난 막대 ${outN}개 / ${m.band.length}개</li>`);
    }
    if (m.interval) items.push('<li><span class="sw sw-band"></span>선택 구간</li>');
    $('#legend').innerHTML = items.join('');
  }

  function renderReadouts(m) {
    const w = m.bins.width;
    let area = 0;
    for (let j = 0; j < m.bins.k; j++) area += m.heights[j] * w;
    const dxText = m.kind === 'discrete'
      ? (m.bins.m === 1 ? '1' : `1/${m.bins.m} = ${fNum(w)}`)
      : fNum(w, 3);
    const areaNote = { count: '= n × Δx × (범위 안 비율)', rel: '= Δx × (범위 안 비율)', density: '= 범위 안 표본 비율' }[m.mode];
    const binsText = m.kind === 'discrete' && m.bins.m > 1 ? `${m.bins.k}개 (정수 위 ${m.bins.xmax - m.bins.xmin + 1}개)` : `${m.bins.k}개`;
    const d = m.dist;
    $('#readouts').innerHTML = `
      <div class="ro"><dt>n</dt><dd>${fInt(m.n)}</dd></div>
      <div class="ro"><dt>Δx</dt><dd>${dxText}</dd></div>
      <div class="ro"><dt>구간 수</dt><dd>${binsText}</dd></div>
      <div class="ro ro-area ${m.mode === 'density' ? 'is-one' : ''}"><dt>면적 합계 Σ(높이 × Δx)</dt><dd>${fNum(area, 6)}<small>${areaNote}</small></dd></div>
      <div class="ro"><dt>범위 밖 표본</dt><dd>${fInt(m.out)}개</dd></div>
      <div class="ro"><dt>표본평균 (이론값)</dt><dd>${fNum(m.mean, 3)} <small>(${fNum(d.mean(m.P), 3)})</small></dd></div>`;
  }

  function tooltipHtml(j) {
    const m = lastModel;
    if (!m) return '';
    const [e0, e1] = H.binEdges(m.bins, j);
    const c = m.counts[j], n = Math.max(1, m.n), w = m.bins.width;
    const cur = (mode) => (m.mode === mode ? ' class="cur"' : '');
    let head;
    if (m.kind === 'discrete') {
      const xi = H.binInteger(m.bins, j);
      if (xi === null) {
        return `<b>구간 [${fNum(e0)}, ${fNum(e1)})</b><br>이 구간에는 정수가 없어서 표본이 들어올 수 없습니다. 높이는 항상 0입니다.`;
      }
      head = `<b>x = ${xi}</b> <span class="muted">(구간 [${fNum(e0)}, ${fNum(e1)}))</span>`;
    } else {
      head = `<b>구간 [${fNum(e0)}, ${fNum(e1)})</b>`;
    }
    return `${head}
      <table>
        <tr${cur('count')}><th>도수</th><td>c = ${fInt(c)}</td></tr>
        <tr${cur('rel')}><th>상대도수</th><td>c ÷ n = ${fInt(c)} ÷ ${fInt(n)} = ${f4(c / n)}</td></tr>
        <tr${cur('density')}><th>밀도</th><td>${f4(c / n)} ÷ ${fNum(w)} = ${f4(c / (n * w))}</td></tr>
      </table>${bandTip(j)}`;
  }

  function bandTip(j) {
    const m = lastModel;
    const b = m.band && m.band.find((x) => x.j === j);
    if (!b) return '';
    const n = Math.max(1, m.n);
    const toCount = m.mode === 'count' ? 1 : m.mode === 'rel' ? n : n * m.bins.width;
    const p = b.exp * toCount / n;
    return `<p class="tip-band">이론 확률 p = ${f4(p)}, 기댓값 np = ${fNum(n * p, 3)}<br>
      ±2 표준오차 범위: ${fNum(b.lo * toCount, 3)} ~ ${fNum(b.hi * toCount, 3)}개
      ${b.inside ? '<span class="ok">범위 안</span>' : '<span class="warn">범위 밖</span>'}</p>`;
  }

  /* ───────────── 확률 계산 패널 ───────────── */
  function renderProb(m) {
    const panel = $('#prob');
    const show = controls().includes('interval');
    panel.hidden = !show;
    if (!show) return;
    const iv = state.interval;
    $('#chk-iv').checked = iv.on;
    $('#prob-body').hidden = !iv.on;
    if (!iv.on) return;
    const d = m.dist, P = m.P, disc = m.kind === 'discrete';
    $$('.disc-only', panel).forEach((el) => (el.hidden = !disc));
    $$('.cont-only', panel).forEach((el) => (el.hidden = disc));
    let r, expr;
    if (disc) {
      r = H.probDiscrete(m.samples, m.n, iv.a, iv.b, iv.inclA, iv.inclB, d, P);
      expr = `P(${iv.a} ${iv.inclA ? '≤' : '&lt;'} X ${iv.inclB ? '≤' : '&lt;'} ${iv.b})`;
      $('#iv-ia').checked = iv.inclA;
      $('#iv-ib').checked = iv.inclB;
    } else {
      r = H.probContinuous(m.samples, m.n, iv.a, iv.b, m.bins, m.dens, d, P);
      expr = `P(${fNum(iv.a)} ≤ X ≤ ${fNum(iv.b)})`;
    }
    setInput('#iv-a', iv.a);
    setInput('#iv-b', iv.b);
    $('#iv-a').step = $('#iv-b').step = disc ? 1 : 0.01;
    $('#prob-expr').innerHTML = expr;
    const rows = [
      ['표본 비율', '구간에 들어간 표본 수 ÷ n', r.sample, 'pr-sample'],
      ['히스토그램 면적', disc ? '고른 막대의 상대도수 합' : '밀도 막대의 겹친 면적 합', r.hist, 'pr-hist'],
      ['이론 확률', disc ? 'Σ p(x)' : '곡선 아래 면적 F(b) − F(a)', r.theory, 'pr-theory'],
    ];
    $('#prob-rows').innerHTML = rows.map(([t, s, v, cls]) => `
      <div class="pr ${cls}">
        <div class="pr-label"><b>${t}</b><small>${s}</small></div>
        <div class="pr-track"><span style="width:${clamp(v, 0, 1) * 100}%"></span></div>
        <div class="pr-val">${f4(v)}</div>
      </div>`).join('');
    const diff = r.sample - r.theory;
    $('#prob-note').innerHTML = disc
      ? `표본 비율 − 이론 확률 = ${diff >= 0 ? '+' : '−'}${f4(Math.abs(diff))}. 끝점 포함 여부를 바꾸면 확률이 달라집니다: P(X = ${iv.b}) = ${f4(d.pmf(iv.b, P))}.`
      : `표본 비율 − 이론 확률 = ${diff >= 0 ? '+' : '−'}${f4(Math.abs(diff))}. 연속형에서는 끝점을 넣든 빼든 확률이 같습니다 (한 점의 확률 = 0).`;
  }
  function setInput(sel, v) {
    const el = $(sel);
    if (document.activeElement !== el) el.value = v;
  }

  /* ───────────── 보조 차트 ───────────── */
  let auxTimer = null;
  function scheduleAux() {
    clearTimeout(auxTimer);
    auxTimer = setTimeout(renderAux, playing ? 30 : 120);
  }
  function renderAux() {
    const cs = controls();
    const isCont = state.kind === 'continuous';
    const showMap = cs.includes('map') && isCont;
    const showConv = cs.includes('conv');
    $('#aux').hidden = !(showMap || showConv);
    $('#map-card').hidden = !showMap;
    $('#conv-card').hidden = !showConv;
    const m = lastModel;
    if (!m) return;
    if (showMap) {
      map.render({ R: m.bins.hi - m.bins.lo, n: state.n, dx: m.bins.width, sigma: Math.sqrt(m.dist.variance(m.P)) });
    }
    if (showConv) {
      const d = m.dist, P = m.P, samples = m.samples;
      const grid = CONV_GRID.filter((n) => n < state.n).concat([state.n]);
      const pts = [];
      for (const n of grid) {
        let err;
        if (isCont) {
          const [L, U] = [m.bins.lo, m.bins.hi];
          let k = state.rule === 'manual' ? m.bins.k : H.ruleK(state.rule, samples, n, L, U);
          if (state.nested) k = H.snapNested(k);
          const b = H.continuousBins(L, U, k);
          err = H.l1Error(H.heights(H.binCounts(samples, n, b).counts, n, b.width, 'density'), b, d, P);
        } else {
          const b = H.discreteBins(m.bins.xmin, m.bins.xmax, 1);
          const { counts, out } = H.binCounts(samples, n, b);
          err = H.tvDistance(counts, n, out, b, d, P);
        }
        pts.push({ n, err, current: n === state.n });
      }
      const manual = isCont && state.rule === 'manual';
      conv.render({
        points: pts,
        yLabel: isCont ? 'L1 오차 ∫|히스토그램 − f|' : '총변동거리 ½Σ|상대도수 − p|',
        refSlope: isCont ? (manual ? null : -1 / 3) : -1 / 2,
        refLabel: isCont ? '기울기 −1/3' : '기울기 −1/2',
      });
      $('#conv-caption').textContent = isCont
        ? (manual
          ? `구간 수를 ${m.bins.k}개로 고정했습니다. n을 늘려도 오차가 어느 수준 아래로 내려가지 않는 것은 구간 폭이 남기는 치우침 때문입니다. 구간 폭 규칙을 Scott으로 바꿔 비교해 보세요.`
          : 'n이 커지면서 구간 폭도 규칙에 따라 줄어들어 오차가 계속 작아집니다. 점선은 n^(−1/3) 속도의 참고선입니다.')
        : '상대도수와 확률의 차이는 대략 1/√n 속도로 줄어듭니다 (점선).';
    }
  }

  /* ───────────── 표 보기 ───────────── */
  function refreshTable() {
    const det = $('#table-view');
    if (!det.open || playing) return;
    const m = lastModel;
    const rows = [];
    for (let j = 0; j < m.bins.k; j++) {
      if (m.kind === 'discrete' && H.binInteger(m.bins, j) === null) continue;
      const [e0, e1] = H.binEdges(m.bins, j);
      const c = m.counts[j], n = Math.max(1, m.n);
      const label = m.kind === 'discrete' ? `x = ${H.binInteger(m.bins, j)}` : `[${fNum(e0)}, ${fNum(e1)})`;
      rows.push(`<tr><td>${label}</td><td>${fInt(c)}</td><td>${f4(c / n)}</td><td>${f4(c / (n * m.bins.width))}</td></tr>`);
    }
    $('#table-body').innerHTML = rows.join('');
  }

  /* ───────────── URL 상태 (F-60) ───────────── */
  let urlTimer = null;
  function scheduleURL() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(writeURL, 250);
  }
  function writeURL() {
    const q = new URLSearchParams();
    if (STEPS) q.set('step', state.step + 1);
    q.set('d', state.dist);
    q.set('p', Object.entries(state.params).map(([k, v]) => `${k}:${v}`).join(';'));
    q.set('n', state.n);
    q.set('seed', state.seed);
    if (state.kind === 'continuous') q.set('k', state.k); else q.set('m', state.m);
    q.set('y', state.mode);
    if (state.rule !== 'manual') q.set('r', state.rule);
    if (state.nested) q.set('nest', '1');
    const o = (state.showPoly ? 'p' : '') + (state.showTheory ? 't' : '') + (state.showGhost ? 'g' : '') + (state.showBand ? 'b' : '');
    if (o) q.set('o', o);
    const iv = state.interval;
    if (iv.on) q.set('iv', [iv.a, iv.b, iv.inclA ? 1 : 0, iv.inclB ? 1 : 0].join(','));
    try { history.replaceState(null, '', '?' + q.toString()); } catch (e) { /* file:// 등 */ }
  }
  function readURL() {
    const q = new URLSearchParams(location.search);
    const stepParam = parseInt(q.get('step'), 10);
    if (STEPS && stepParam >= 1 && stepParam <= STEPS.length) state.step = stepParam - 1;
    if (!q.has('d')) return false;
    const d = D.get(q.get('d'));
    if (!d || (PAGE !== 'lab' && d.type !== PAGE)) return false;
    state.dist = d.id; state.kind = d.type;
    const P = d.defaults();
    (q.get('p') || '').split(';').forEach((kv) => {
      const [k, v] = kv.split(':');
      if (k in P && isFinite(+v)) P[k] = +v;
    });
    state.params = d.fix(P);
    const num = (key, def) => (q.has(key) && isFinite(+q.get(key)) ? +q.get(key) : def);
    state.n = num('n', state.n);
    state.seed = num('seed', state.seed);
    state.k = num('k', state.k);
    state.m = num('m', state.m);
    if (MODE_LABEL[q.get('y')]) state.mode = q.get('y');
    state.rule = ['sturges', 'scott', 'fd'].includes(q.get('r')) ? q.get('r') : 'manual';
    state.nested = q.get('nest') === '1';
    const o = q.get('o') || '';
    state.showPoly = o.includes('p'); state.showTheory = o.includes('t'); state.showGhost = o.includes('g'); state.showBand = o.includes('b');
    if (q.has('iv')) {
      const [a, b, ia, ib] = q.get('iv').split(',').map(Number);
      state.interval = { on: true, a, b, inclA: ia !== 0, inclB: ib !== 0 };
    } else state.interval.on = false;
    applyChanges({});
    return true;
  }

  /* ───────────── 동작 (단계 카드 버튼에서 호출) ───────────── */
  function currentK() { return lastModel ? lastModel.bins.k : state.k; }
  function halveDx() {
    if (state.kind === 'discrete') {
      const i = H.DISCRETE_M.indexOf(state.m);
      return set({ m: H.DISCRETE_M[Math.min(i + 1, H.DISCRETE_M.length - 1)] }, { duration: 420 });
    }
    const k = currentK();
    const next = state.nested ? H.NESTED_K[Math.min(H.NESTED_K.indexOf(H.snapNested(k)) + 1, H.NESTED_K.length - 1)] : H.clampK(k * 2);
    set({ k: next, rule: 'manual' }, { duration: 420 });
  }
  function doubleDx() {
    if (state.kind === 'discrete') {
      const i = H.DISCRETE_M.indexOf(state.m);
      return set({ m: H.DISCRETE_M[Math.max(i - 1, 0)] }, { duration: 420 });
    }
    const k = currentK();
    const next = state.nested ? H.NESTED_K[Math.max(H.NESTED_K.indexOf(H.snapNested(k)) - 1, 0)] : H.clampK(k / 2);
    set({ k: next, rule: 'manual' }, { duration: 420 });
  }
  function cycleShape() {
    const list = SHAPES[state.kind];
    const i = list.indexOf(state.dist);
    set({ dist: list[(i + 1) % list.length] }, { duration: 350 });
  }
  function cycleMode() {
    const ms = modes();
    set({ mode: ms[(ms.indexOf(state.mode) + 1) % ms.length] }, { duration: 450 });
  }
  function reveal() {
    set({ showTheory: true }, { reveal: true, duration: 350 });
    toast('');
  }

  function drawAnimated(count) {
    stopAll();
    applyChanges({ n: count }, { ghost: false });
    const samples = getStream().get(count);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduce ? 10 : clamp(3200 / count, 18, 120);
    animating = true;
    render({ nShown: 0, duration: 0 });
    let i = 0;
    const tick = () => {
      if (!animating) return;
      i++;
      const x = samples[i - 1];
      const b = lastModel.bins;
      chart.drop(x, Math.floor((x - b.origin) / b.width));
      const shown = i;
      animTimers.push(setTimeout(() => { if (animating) render({ nShown: shown, duration: 90 }); }, reduce ? 0 : 230));
      if (i < count) animTimers.push(setTimeout(tick, delay));
      else animTimers.push(setTimeout(() => { animating = false; render({ duration: 200 }); }, reduce ? 20 : 320));
    };
    tick();
  }

  function speed() { return +$('#sel-speed').value || 1000; }
  function play() {
    if (playing) { stopPlay(); return; }
    stopAll();
    playing = true;
    playIdx = 0;
    if (state.kind === 'continuous' && state.rule === 'manual') state.rule = 'scott';
    ghost = null;
    toast('');
    updatePlayButtons();
    playTick();
  }
  function playTick() {
    if (!playing) return;
    applyChanges({ n: PLAY_SEQ[playIdx++] }, { ghost: false });
    render({ duration: Math.min(500, speed() * 0.6) });
    if (playIdx >= PLAY_SEQ.length) {
      playing = false;
      updatePlayButtons();
      if (!state.showTheory && controls().includes('theory')) {
        toast(state.kind === 'discrete'
          ? '이제 ‘이상적인 값 보기’를 눌러 상대도수와 비교해 보세요.'
          : '이제 ‘이상적인 곡선 보기’를 눌러 도수다각형과 비교해 보세요.');
      }
      return;
    }
    playTimer = setTimeout(playTick, speed());
  }
  function stepPlay() {
    stopAll();
    const next = PLAY_SEQ.find((n) => n > state.n);
    if (next) {
      const ch = { n: next };
      if (state.kind === 'continuous' && state.rule === 'manual') ch.rule = 'scott';
      set(ch, { duration: 400, ghost: false });
    }
  }
  function stopPlay() {
    if (!playing) return;
    playing = false;
    clearTimeout(playTimer);
    updatePlayButtons();
  }
  function updatePlayButtons() {
    const label = playing ? '멈춤' : state.kind === 'discrete' ? 'n을 키워 가며 보기' : '극한으로 가기';
    const btn = $('#btn-play');
    btn.textContent = (playing ? '❚❚ ' : '▶ ') + label;
    btn.setAttribute('aria-pressed', playing);
    $$('[data-action-id="play"]').forEach((b) => {
      b.textContent = playing ? '❚❚ 멈춤' : '▶ ' + b.dataset.label;
      b.setAttribute('aria-pressed', playing);
    });
  }

  function narrow() {
    stopAll();
    const iv = state.interval;
    if (!iv.on) return;
    const a0 = iv.a, b0 = iv.b, c = (a0 + b0) / 2;
    const t0 = performance.now(), T = 1600;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = (now) => {
      const t = reduce ? 1 : Math.min(1, (now - t0) / T);
      const e = 1 - Math.pow(1 - t, 3);
      applyChanges({ interval: { a: a0 + (c - a0) * e, b: b0 + (c - b0) * e } }, { ghost: false });
      render({ duration: 0 });
      if (t < 1) narrowRaf = requestAnimationFrame(frame);
      else { narrowRaf = null; toast('폭이 0인 구간의 면적은 0입니다. 그래서 연속형에서는 P(X = a) = 0입니다.'); }
    };
    narrowRaf = requestAnimationFrame(frame);
  }

  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  const api = {
    set: (ch, opts) => set(ch, { duration: 350, ...opts }),
    halveDx, doubleDx, cycleShape, toggleBand: () => set({ showBand: !state.showBand }, { duration: 300 }), cycleMode, reveal, drawAnimated, play, narrow,
    supportLo: () => displayRange()[0],
    goPage: (file, idx) => { location.href = file + '?step=' + (idx + 1); },
  };

  /* ───────────── 레이아웃 생성 ───────────── */
  const PAGE_META = {
    continuous: { crumb: '모듈 1 연속형 확률변수', h1: '히스토그램에서 확률밀도함수로' },
    discrete: { crumb: '모듈 1 이산형 확률변수', h1: '히스토그램에서 확률질량함수로' },
    lab: { crumb: '모듈 1 자유 실험실', h1: '히스토그램 자유 실험실' },
  };

  function buildLayout() {
    const meta = PAGE_META[PAGE];

    const isDisc = PAGE === 'discrete';
    document.getElementById('app').innerHTML = `
    <header class="site-header" id="hdr"></header>
    <main class="lab">
      <div class="stage">
        <p class="crumb">${meta.crumb}</p>
        <h1>${meta.h1}</h1>
        ${STEPS ? `<ol class="step-rail" id="step-rail" style="--steps:${STEPS.length}">${STEPS.map((s, i) => `<li><button type="button" data-step="${i}"><span class="num">${i + 1}</span><span class="t">${s.title}</span></button></li>`).join('')}</ol>` : ''}
      </div>
      <div class="lab-grid">
        <section class="main" aria-label="히스토그램">
          <figure class="chart-card">
            <ul class="legend" id="legend"></ul>
            <div id="chart" class="chart-wrap"></div>
            <dl class="readouts" id="readouts"></dl>
            <details id="table-view" class="table-view">
              <summary>표로 보기</summary>
              <div class="table-scroll"><table><thead><tr><th>구간</th><th>도수</th><th>상대도수</th><th>밀도</th></tr></thead><tbody id="table-body"></tbody></table></div>
            </details>
          </figure>
          <section class="prob-panel" id="prob" hidden>
            <header>
              <h3>확률 계산</h3>
              <span class="prob-expr" id="prob-expr"></span>
              <label class="switch"><input type="checkbox" id="chk-iv"> 구간 고르기</label>
            </header>
            <div id="prob-body">
              <div class="prob-inputs">
                <label>a <input type="number" id="iv-a" inputmode="decimal"></label>
                <label>b <input type="number" id="iv-b" inputmode="decimal"></label>
                <label class="disc-only"><input type="checkbox" id="iv-ia"> a 포함 (≤)</label>
                <label class="disc-only"><input type="checkbox" id="iv-ib"> b 포함 (≤)</label>
                <button type="button" class="cont-only" id="btn-narrow">한 점으로 좁히기</button>
              </div>
              <div class="prob-rows" id="prob-rows"></div>
              <p class="prob-note" id="prob-note"></p>
            </div>
          </section>
        </section>
        <div class="aux" id="aux" hidden>
          <figure class="aux-card" id="map-card">
            <figcaption><h3>(n, Δx) 지도</h3><p>점을 끌어 n과 Δx를 함께 고르세요. 점선은 Scott 규칙이 고르는 길입니다.</p></figcaption>
            <div id="map"></div>
          </figure>
          <figure class="aux-card" id="conv-card">
            <figcaption><h3>수렴 그래프</h3><p id="conv-caption"></p></figcaption>
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
              <div class="row"><input type="range" id="rng-n" min="0" max="${N_LIST.length - 1}" step="1"><input type="number" id="num-n" min="${N_MIN}" max="${N_MAX}" aria-label="n 직접 입력"></div>
              <div class="btn-row" data-ctl="more">
                <button type="button" data-more="10">+10</button><button type="button" data-more="100">+100</button><button type="button" data-more="1000">+1,000</button>
              </div>
              <div class="btn-row" data-ctl="draw"><button type="button" id="btn-draw">하나씩 뽑기</button></div>
            </section>
            <section class="ctl" data-ctl="mode">
              <h3>세로축</h3>
              <div class="seg" id="seg-mode" role="group" aria-label="세로축">
                <button type="button" data-mode="count">도수</button><button type="button" data-mode="rel">상대도수</button><button type="button" data-mode="density">밀도</button>
              </div>
            </section>
            <section class="ctl" data-ctl="bins">
              <h3>구간 폭 Δx</h3>
              <div class="cont-only">
                <div class="row"><input type="range" id="rng-k" aria-label="구간 수"><output id="out-k"></output></div>
              </div>
              <div class="disc-only">
                <div class="seg seg-wrap" id="seg-m" role="group" aria-label="구간 폭">
                  ${H.DISCRETE_M.map((m) => `<button type="button" data-m="${m}">${m === 1 ? '1' : '1/' + m}</button>`).join('')}
                </div>
              </div>
              <div class="btn-row"><button type="button" id="btn-halve">Δx 반으로</button><button type="button" id="btn-double">Δx 두 배로</button></div>
              <label class="check cont-only" data-ctl="nested"><input type="checkbox" id="chk-nested"> 쪼개기 모드 (막대를 정확히 둘로 나누기)</label>
              <label class="field cont-only" data-ctl="rule">구간 폭 규칙
                <select id="sel-rule">
                  <option value="manual">직접 고르기</option>
                  <option value="sturges">Sturges: k = ⌈log₂n⌉ + 1</option>
                  <option value="scott">Scott: Δx = 3.49 s n^(−1/3)</option>
                  <option value="fd">Freedman–Diaconis: Δx = 2 IQR n^(−1/3)</option>
                </select>
              </label>
            </section>
            <section class="ctl" data-ctl="overlays">
              <h3>겹쳐 그리기</h3>
              <label class="check" data-ctl="poly"><input type="checkbox" id="chk-poly"> <span id="poly-label">도수다각형</span></label>
              <label class="check" data-ctl="theory"><input type="checkbox" id="chk-theory"> <span id="theory-label">이론 확률밀도함수</span></label>
              <label class="check" data-ctl="ghost"><input type="checkbox" id="chk-ghost"> 직전 상태 (점선)</label>
              <label class="check" data-ctl="band"><input type="checkbox" id="chk-band"> 예상 변동 범위 (기댓값 ± 2 표준오차)</label>
            </section>
            <section class="ctl" data-ctl="play">
              <h3>극한 탐색</h3>
              <div class="btn-row">
                <button type="button" id="btn-play" class="primary"></button>
                <button type="button" id="btn-stepplay">한 단계</button>
                <select id="sel-speed" aria-label="재생 속도"><option value="1600">느리게</option><option value="1000" selected>보통</option><option value="500">빠르게</option></select>
              </div>
              <p class="hint">n을 100에서 1,000,000까지 늘립니다.${isDisc ? '' : ' 구간 폭은 Scott 규칙으로 함께 줄어듭니다.'}</p>
            </section>
            <section class="ctl" data-ctl="seed">
              <h3><label for="num-seed">난수 시드</label></h3>
              <div class="row"><input type="number" id="num-seed" min="1" max="999999"><button type="button" id="btn-reseed">새 난수로 다시 뽑기</button></div>
              <p class="hint">같은 시드는 언제나 같은 난수를 만듭니다. 링크를 공유하면 같은 화면이 열립니다.</p>
            </section>
          </div>
        </div>
      </div>
    </main>
    <footer class="site-footer"><p>확률변수 실험실 모듈 1. 난수는 브라우저 안에서 시드 고정 생성기(xoshiro128**)로 만듭니다.</p></footer>`;
    RVL.shell.mountHeader(document.getElementById('hdr'), { root: ROOT, current: { continuous: 'm1c', discrete: 'm1d', lab: 'm1l' }[PAGE], tools: true });
  }

  function buildDistOptions() {
    const sel = $('#sel-dist');
    const opt = (d) => `<option value="${d.id}">${d.name}</option>`;
    if (PAGE === 'lab') {
      sel.innerHTML = `<optgroup label="연속형">${D.list.filter((d) => d.type === 'continuous').map(opt).join('')}</optgroup>
        <optgroup label="이산형">${D.list.filter((d) => d.type === 'discrete').map(opt).join('')}</optgroup>`;
    } else {
      sel.innerHTML = D.list.filter((d) => d.type === PAGE).map(opt).join('');
    }
  }

  function buildDistUI() {
    const d = dist();
    $('#sel-dist').value = d.id;
    $('#params').innerHTML = d.params.map((p) => `
      <label class="param">
        <span class="param-name">${p.label}</span>
        <input type="range" data-param="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}">
        <output data-param-out="${p.key}"></output>
      </label>`).join('');
    $$('#params input[type=range]').forEach((el) => {
      let raf = null;
      el.addEventListener('input', () => {
        const v = +el.value;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => set({ params: { [el.dataset.param]: v } }, { duration: 0, ghost: false }));
      });
    });
    const info = $('#dist-info');
    info.innerHTML = `<p class="tex" data-tex="f"></p>
      <dl><div><dt>지지집합</dt><dd data-tex="support"></dd></div><div><dt>평균</dt><dd data-tex="mean"></dd></div><div><dt>분산</dt><dd data-tex="variance"></dd></div></dl>
      <p class="hint" id="dist-now"></p>`;
    $$('[data-tex]', info).forEach((el) => {
      try { katex.render(d.tex[el.dataset.tex], el, { throwOnError: false, displayMode: el.tagName === 'P' }); }
      catch (e) { el.textContent = d.tex[el.dataset.tex]; }
    });
    $('#poly-label').textContent = d.type === 'discrete' ? '꼭대기 잇기 (보조선: 정수 사이 값은 확률이 아님)' : '도수다각형';
    $('#theory-label').textContent = d.type === 'discrete' ? '이론 확률질량함수 p(x)' : '이론 확률밀도함수 f(x)';
    applyVisibility();
  }

  function renderMath(el) {
    if (window.renderMathInElement) {
      try {
        renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
      } catch (e) { /* 수식 실패는 무시 */ }
    }
  }

  function buildStepCard() {
    const card = $('#step-card');
    if (!STEPS) {
      card.innerHTML = `
        <p class="step-num">자유 실험실</p>
        <h2>모든 조작이 열려 있습니다</h2>
        <p class="do">분포, n, 구간 폭, 세로축, 겹쳐 그리기를 마음대로 조합해 보세요. 연속형과 이산형 분포를 모두 고를 수 있습니다.</p>
        <div class="see"><h4>해 볼 만한 실험</h4><ul>
          <li>이봉분포에서 Δx를 크게 하면 두 봉우리가 하나로 뭉개집니다.</li>
          <li>감마분포 k = 0.5처럼 밀도가 0 근처에서 치솟는 분포는 히스토그램으로 따라가기 어렵습니다.</li>
          <li>구간 폭 규칙 세 가지(Sturges, Scott, Freedman–Diaconis)가 n = 1,000,000에서 각각 몇 개의 구간을 고르는지 비교해 보세요.</li>
        </ul></div>
        <p class="toast" id="toast" hidden></p>`;
      return;
    }
    const s = STEPS[state.step];
    card.innerHTML = `
      <p class="step-num">${state.step + 1}단계 / ${STEPS.length}</p>
      <h2>${s.title}</h2>
      <p class="do">${s.card.do}</p>
      <div class="see"><h4>관찰 포인트</h4><p>${s.card.see}</p></div>
      <div class="ask"><h4>생각해 볼 질문</h4><p>${s.card.ask}</p></div>
      <details class="math"><summary>수식으로 보기</summary><div>${s.card.math}</div></details>
      <div class="actions">${s.actions.map((a, i) => `<button type="button" class="${a.primary ? 'primary' : ''}" data-action="${i}"${a.id ? ` data-action-id="${a.id}" data-label="${a.label}"` : ''}>${a.id === 'play' ? '▶ ' : ''}${a.label}</button>`).join('')}</div>
      <p class="toast" id="toast" hidden></p>
      <div class="step-nav">
        <button type="button" id="btn-prev" ${state.step === 0 ? 'disabled' : ''}>← 이전 단계</button>
        <button type="button" id="btn-next" class="primary" ${state.step === STEPS.length - 1 ? 'disabled' : ''}>다음 단계 →</button>
      </div>`;
    renderMath(card);
    $$('[data-action]', card).forEach((b) => b.addEventListener('click', () => s.actions[+b.dataset.action].run(api)));
    $('#btn-prev').addEventListener('click', () => goStep(state.step - 1));
    $('#btn-next').addEventListener('click', () => goStep(state.step + 1));
    $$('#step-rail button').forEach((b) => {
      const i = +b.dataset.step;
      b.classList.toggle('done', i < state.step);
      if (i === state.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    updatePlayButtons();
  }

  function applyVisibility() {
    const cs = controls();
    $$('#controls [data-ctl]').forEach((el) => {
      const c = el.dataset.ctl;
      el.hidden = c === 'overlays' ? !['poly', 'theory', 'ghost', 'band'].some((x) => cs.includes(x)) : !cs.includes(c);
    });
    const disc = state.kind === 'discrete';
    $$('#controls .disc-only').forEach((el) => { if (!el.dataset.ctl || cs.includes(el.dataset.ctl)) el.hidden = !disc; });
    $$('#controls .cont-only').forEach((el) => { if (!el.dataset.ctl || cs.includes(el.dataset.ctl)) el.hidden = disc; });
  }

  function goStep(i) {
    if (!STEPS || i < 0 || i >= STEPS.length) return;
    stopAll();
    state.step = i;
    const init = JSON.parse(JSON.stringify(STEPS[i].init));
    const ivInit = init.interval;
    delete init.interval;
    Object.assign(state, init);
    if (ivInit) state.interval = { ...state.interval, ...ivInit };
    ghost = null;
    chart.theoryShown = chart.theoryShown && state.showTheory;
    applyChanges({});
    buildStepCard();
    applyVisibility();
    render({ duration: 400, reveal: false });
    const card = $('#step-card');
    if (card && window.innerWidth < 1000 && document.activeElement && document.activeElement.closest('.step-card, .step-rail')) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ───────────── 조작 값 동기화 ───────────── */
  function nearestNIndex(n) {
    let best = 0, bd = Infinity;
    N_LIST.forEach((v, i) => { const d = Math.abs(Math.log(v / n)); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function syncControls(m) {
    const d = m.dist;
    $('#rng-n').value = nearestNIndex(state.n);
    setInput('#num-n', state.n);
    setInput('#num-seed', state.seed);
    $$('#seg-mode button').forEach((b) => {
      const md = b.dataset.mode;
      b.setAttribute('aria-pressed', md === state.mode);
      b.disabled = !modes().includes(md);
    });
    const rk = $('#rng-k');
    if (state.nested) {
      rk.min = 0; rk.max = H.NESTED_K.length - 1; rk.step = 1;
      rk.value = H.NESTED_K.indexOf(H.snapNested(m.bins.k));
    } else {
      rk.min = H.K_MIN; rk.max = H.K_MAX; rk.step = 1; rk.value = m.bins.k;
    }
    rk.disabled = state.rule !== 'manual';
    $('#out-k').textContent = d.type === 'continuous' ? `구간 ${m.bins.k}개, Δx = ${fNum(m.bins.width, 3)}` : '';
    $$('#seg-m button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.m === state.m));
    $('#chk-nested').checked = state.nested;
    $('#sel-rule').value = state.rule;
    $('#chk-poly').checked = state.showPoly;
    $('#chk-theory').checked = state.showTheory;
    $('#chk-ghost').checked = state.showGhost;
    $('#chk-band').checked = state.showBand;
    $$('#params input[type=range]').forEach((el) => {
      const k = el.dataset.param;
      if (document.activeElement !== el) el.value = state.params[k];
      $(`[data-param-out="${k}"]`).textContent = state.params[k];
    });
    $('#dist-now').textContent = `현재 모수에서 평균 = ${fNum(d.mean(state.params))}, 분산 = ${fNum(d.variance(state.params))}`;
    const bh = $('#btn-halve'), bd = $('#btn-double');
    if (d.type === 'discrete') {
      bh.disabled = state.m === H.DISCRETE_M[H.DISCRETE_M.length - 1];
      bd.disabled = state.m === 1;
    } else {
      bh.disabled = state.nested ? m.bins.k >= H.NESTED_K[H.NESTED_K.length - 1] : m.bins.k >= H.K_MAX;
      bd.disabled = state.nested ? m.bins.k <= H.NESTED_K[0] : m.bins.k <= H.K_MIN;
    }
  }

  /* ───────────── 이벤트 연결 ───────────── */
  function wire() {
    $('#sel-dist').addEventListener('change', (e) => { set({ dist: e.target.value }, { duration: 350 }); });
    $('#rng-n').addEventListener('input', (e) => set({ n: N_LIST[+e.target.value] }, { duration: 160 }));
    $('#num-n').addEventListener('change', (e) => set({ n: +e.target.value }, { duration: 250 }));
    $$('[data-more]').forEach((b) => b.addEventListener('click', () => set({ n: state.n + +b.dataset.more }, { duration: 250 })));
    $('#btn-draw').addEventListener('click', () => drawAnimated(Math.min(state.n, 200)));
    $$('#seg-mode button').forEach((b) => b.addEventListener('click', () => set({ mode: b.dataset.mode }, { duration: 450 })));
    $('#rng-k').addEventListener('input', (e) => {
      const v = +e.target.value;
      set({ k: state.nested ? H.NESTED_K[v] : v, rule: 'manual' }, { duration: state.nested ? 420 : 120 });
    });
    $$('#seg-m button').forEach((b) => b.addEventListener('click', () => set({ m: +b.dataset.m }, { duration: 420 })));
    $('#btn-halve').addEventListener('click', halveDx);
    $('#btn-double').addEventListener('click', doubleDx);
    $('#chk-nested').addEventListener('change', (e) => set({ nested: e.target.checked }, { duration: 300 }));
    $('#sel-rule').addEventListener('change', (e) => set({ rule: e.target.value }, { duration: 300 }));
    $('#chk-poly').addEventListener('change', (e) => set({ showPoly: e.target.checked }, { duration: 200 }));
    $('#chk-theory').addEventListener('change', (e) => set({ showTheory: e.target.checked }, { duration: 300, reveal: true }));
    $('#chk-ghost').addEventListener('change', (e) => set({ showGhost: e.target.checked }, { duration: 0 }));
    $('#chk-band').addEventListener('change', (e) => set({ showBand: e.target.checked }, { duration: 300 }));
    $('#btn-play').addEventListener('click', play);
    $('#btn-stepplay').addEventListener('click', stepPlay);
    $('#num-seed').addEventListener('change', (e) => set({ seed: clamp(Math.round(+e.target.value) || 1, 1, 999999) }, { duration: 300, ghost: false }));
    $('#btn-reseed').addEventListener('click', () => set({ seed: 1 + Math.floor(Math.random() * 999999) }, { duration: 300, ghost: false }));
    $('#chk-iv').addEventListener('change', (e) => set({ interval: { on: e.target.checked } }, { duration: 200 }));
    const ivInput = (key) => (e) => {
      const v = +e.target.value;
      if (isFinite(v)) set({ interval: { [key]: v } }, { duration: 0, ghost: false });
    };
    $('#iv-a').addEventListener('change', ivInput('a'));
    $('#iv-b').addEventListener('change', ivInput('b'));
    $('#iv-ia').addEventListener('change', (e) => set({ interval: { inclA: e.target.checked } }, { duration: 0 }));
    $('#iv-ib').addEventListener('change', (e) => set({ interval: { inclB: e.target.checked } }, { duration: 0 }));
    $('#btn-narrow').addEventListener('click', narrow);
    $('#table-view').addEventListener('toggle', refreshTable);
    $('#btn-present').addEventListener('click', (e) => {
      const on = body.classList.toggle('present');
      e.currentTarget.setAttribute('aria-pressed', on);
      setTimeout(() => render({ duration: 0, reveal: false }), 50);
    });
    $('#btn-share').addEventListener('click', async (e) => {
      writeURL();
      const btn = e.currentTarget;
      try {
        await navigator.clipboard.writeText(location.href);
        btn.textContent = '복사했습니다';
      } catch (err) {
        btn.textContent = '주소창의 링크를 복사하세요';
      }
      setTimeout(() => (btn.textContent = '링크 복사'), 2000);
    });
    document.addEventListener('keydown', (e) => {
      if (!STEPS || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t.closest && t.closest('input, select, textarea, [role=slider], .seg')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goStep(state.step + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goStep(state.step - 1); }
    });
    if (STEPS) $$('#step-rail button').forEach((b) => b.addEventListener('click', () => goStep(+b.dataset.step)));
  }

  function onHandle(which, v) {
    const disc = state.kind === 'discrete';
    const [lo, hi] = displayRange();
    const prec = hi - lo < 2 ? 1000 : 100;
    v = disc ? Math.round(v) : Math.round(v * prec) / prec;
    const iv = { ...state.interval };
    if (which === 'a') iv.a = Math.min(v, iv.b); else iv.b = Math.max(v, iv.a);
    stopAll();
    applyChanges({ interval: iv }, { ghost: false });
    render({ duration: 0 });
  }

  function onMapMove(n, dx) {
    const m = lastModel;
    const R = m.bins.hi - m.bins.lo;
    const p = Math.pow(10, Math.floor(Math.log10(n)) - 1);
    const nn = clamp(Math.round(n / p) * p, N_MIN, N_MAX);
    let k = H.clampK(R / dx);
    if (state.nested) k = H.snapNested(k);
    stopAll();
    applyChanges({ n: nn, k, rule: 'manual' }, { ghost: false });
    render({ duration: 0 });
  }

  /* ───────────── 시작 ───────────── */
  function init() {
    buildLayout();
    buildDistOptions();
    chart = new RVL.HistChart($('#chart'), { onHandle, tooltip: tooltipHtml });
    conv = new RVL.ConvChart($('#conv'));
    map = new RVL.MapChart($('#map'), onMapMove);
    const restored = readURL();
    wire();
    updatePlayButtons();
    if (STEPS && !restored) {
      buildDistUI();
      goStep(state.step);
    } else {
      applyChanges({});
      buildDistUI();
      buildStepCard();
      applyVisibility();
      render({ duration: 0, reveal: false });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
