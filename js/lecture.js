/* 강의노트 그림: 사이트의 난수·분포·차트 라이브러리를 그대로 써서 본문 안에 실제 시뮬레이션 그림을 그린다.
 * <div class="lfig" data-fig="..."></div> 요소마다 아래 FIGS의 같은 이름 함수가 호출된다.
 */
(function () {
  'use strict';
  const { dist: D, hist: H, rng: RNG } = window.RVL;
  const YL = { count: '도수', rel: '상대도수', density: '밀도' };

  function bandFor(d, P, bins, counts, n, mode) {
    const unit = mode === 'count' ? 1 : mode === 'rel' ? 1 / n : 1 / (n * bins.width);
    const out = [];
    for (let j = 0; j < bins.k; j++) {
      let p;
      if (d.type === 'discrete') {
        const xi = H.binInteger(bins, j);
        if (xi === null) continue;
        p = d.pmf(xi, P);
      } else {
        const [a, b] = H.binEdges(bins, j);
        p = d.cdf(b, P) - d.cdf(a, P);
      }
      if (!(p > 0)) continue;
      const mu = n * p, se = Math.sqrt(n * p * (1 - p));
      out.push({ j, mid: bins.origin + (j + 0.5) * bins.width, exp: mu * unit, lo: Math.max(0, mu - 2 * se) * unit, hi: (mu + 2 * se) * unit, inside: counts[j] >= mu - 2 * se - 1e-9 && counts[j] <= mu + 2 * se + 1e-9 });
    }
    return out;
  }

  /** 분포에서 난수를 뽑아 히스토그램을 그린다 */
  function sim(el, o) {
    const d = D.get(o.dist), P = o.P || d.defaults();
    const s = new RNG.SampleStream((r) => d.sampler(r, P), o.seed || 2026).get(o.n);
    let bins;
    if (d.type === 'continuous') {
      const [L, U] = H.continuousRange(d, P);
      const k = o.rule ? H.ruleK(o.rule, s, o.n, L, U) : o.k;
      bins = H.continuousBins(L, U, k);
    } else {
      const [a, b] = H.discreteRange(d, P);
      bins = H.discreteBins(a, b, o.m || 1);
    }
    const mode = o.mode || 'count';
    const { counts } = H.binCounts(s, o.n, bins);
    const heights = H.heights(counts, o.n, bins.width, mode);
    let theory = null, tmax = 0;
    if (o.theory) {
      if (d.type === 'continuous') {
        const sc = mode === 'count' ? o.n * bins.width : mode === 'rel' ? bins.width : 1;
        const pts = d3.range(500).map((i) => { const x = bins.lo + (bins.hi - bins.lo) * i / 499; return [x, d.pdf(x, P) * sc]; });
        tmax = d3.max(pts, (p) => p[1]);
        theory = { type: 'curve', points: pts };
      } else {
        const sc = mode === 'count' ? o.n : mode === 'rel' ? 1 : 1 / bins.width;
        const pts = d3.range(bins.xmin, bins.xmax + 1).map((x) => [x, d.pmf(x, P) * sc]);
        tmax = d3.max(pts, (p) => p[1]);
        theory = { type: 'stems', points: pts };
      }
    }
    const band = o.band ? bandFor(d, P, bins, counts, o.n, mode) : null;
    const yMax = Math.max(d3.max(heights), tmax, band ? d3.max(band, (b) => b.hi) : 0) * 1.08;
    const chart = new RVL.HistChart(el, { height: o.height || 230, margin: { top: 10, right: 10, bottom: 40, left: 48 } });
    chart.render({
      kind: d.type, bins, heights, mode, xDomain: [bins.lo, bins.hi], yMax,
      yLabel: YL[mode], xLabel: o.xLabel || 'x', theory, showTheory: !!o.theory, band,
      poly: null, ariaLabel: o.aria || `${d.name} 난수 ${o.n}개의 ${YL[mode]} 히스토그램`,
    }, { duration: 0, reveal: false });
    return { counts: Array.from(counts).filter((_, j) => d.type === 'continuous' || H.binInteger(bins, j) !== null), band, bins };
  }

  /** 주어진 자료로 히스토그램을 그린다 */
  function data(el, values, L, U, k, mode, ghost) {
    const bins = H.continuousBins(L, U, k);
    const n = values.length;
    const { counts } = H.binCounts(Float64Array.from(values), n, bins);
    const heights = H.heights(counts, n, bins.width, mode);
    let g = null, gmax = 0;
    if (ghost) {
      const gb = H.continuousBins(L, U, ghost);
      const gh = H.heights(H.binCounts(Float64Array.from(values), n, gb).counts, n, gb.width, mode);
      g = { origin: L, width: gb.width, heights: gh };
      gmax = d3.max(gh);
    }
    const chart = new RVL.HistChart(el, { height: 210, margin: { top: 10, right: 10, bottom: 40, left: 48 } });
    chart.render({
      kind: 'continuous', bins, heights, mode, xDomain: [L, U], yMax: Math.max(d3.max(heights), gmax) * 1.12,
      yLabel: YL[mode], xLabel: '통학 시간 (분)', ghost: g, showTheory: false, ariaLabel: `통학 시간 20명 자료의 ${YL[mode]} 히스토그램`,
    }, { duration: 0 });
  }

  /** 누적분포함수 그림 (모듈 2): 이론 CDF와 표본 ECDF */
  function cdfFig(el, o) {
    const d = D.get(o.dist), P = o.P || d.defaults();
    let dom, polys = [], jumps = [];
    if (d.type === 'discrete') {
      const [a, b] = H.discreteRange(d, P);
      dom = [a - 1, b + 1];
      let prev = 0;
      polys.push([[dom[0], 0], [a, 0]]);
      for (let k = a; k <= b; k++) { const F = d.cdf(k, P); jumps.push({ x: k, lo: prev, hi: F }); polys.push([[k, F], [k + 1 <= b ? k + 1 : dom[1], F]]); prev = F; }
    } else {
      const [L, U] = H.continuousRange(d, P);
      const pad = (U - L) * 0.04;
      dom = [L - pad, U];
      const atoms = d.atoms ? d.atoms(P) : [];
      for (const at of atoms) jumps.push({ x: at.x, lo: d.cdfLeft(at.x, P), hi: d.cdf(at.x, P) });
      const curve = [[dom[0], 0]];
      if (atoms.length) curve.push([atoms[0].x, 0]);
      const pts = [];
      for (let i = 0; i <= 400; i++) { const x = (atoms.length ? atoms[0].x : dom[0]) + (U - (atoms.length ? atoms[0].x : dom[0])) * i / 400; pts.push([x, d.cdf(x, P)]); }
      polys = atoms.length ? [curve, pts] : [[[dom[0], 0], ...pts.filter((q) => q[0] > dom[0])]];
    }
    let ecdf = null;
    if (o.n) {
      const smp = Float64Array.from(new RNG.SampleStream((r) => d.sampler(r, P), o.seed || 2026).get(o.n)).sort();
      const pts = [[dom[0], 0]];
      for (let i = 0; i < smp.length; i++) pts.push([smp[i], (i + 1) / smp.length]);
      pts.push([dom[1], 1]);
      ecdf = { points: pts };
    }
    const v = new RVL.CdfView(null, el, { heightBot: o.height || 220, margin: { top: 10, right: 14, bottom: 40, left: 50 } });
    v.render({ kind: d.type === 'discrete' ? 'discrete' : 'continuous', xDomain: dom, xLabel: o.xLabel || 'x', aria: o.aria || `${d.name}의 누적분포함수`,
      cdf: { show: o.theory !== false, polys, jumps }, ecdf, cursor: o.cursor || {} }, { duration: 0 });
  }

  /** 유한 표본공간 그림 (모듈 3): 칸과 X의 분포 */
  function gridFig(el, spaceId, xid, hlValue) {
    const O = RVL.omega, sp = O.SPACES[spaceId];
    const pr = O.PRESETS[spaceId].find((q) => q.id === xid);
    const dist = O.distribution(sp, pr.f);
    const values = new Map(sp.outcomes.map((o) => [o.id, pr.f(o.v)]));
    el.classList.add('lf-pair');
    const a = document.createElement('div'), b = document.createElement('div');
    el.append(a, b);
    const hl = hlValue != null ? new Set(dist.list.find((q) => q.x === hlValue).cells) : null;
    new RVL.GridView(a).render({ space: sp, values, hl });
    const fr = new Map(dist.list.map((q) => [q.x, RVL.shell ? RVL.shell.frac(q.count, sp.outcomes.length).text : String(q.p)]));
    new RVL.ValueChart(b).render({ list: dist.list, fracText: fr, hlValues: hl ? new Set([hlValue]) : null, xLabel: pr.name, height: 240 });
  }

  /** 정사각형 그림 (모듈 3) */
  function squareFig(el, xid, mode, t) {
    const pr = RVL.sqdist.SQUARE.find((q) => q.id === xid);
    const v = new RVL.SquareView(el);
    v.setField(pr.f);
    v.render({ mode, threshold: t, points: null });
  }

  const COMMUTE = [12, 15, 17, 18, 21, 22, 22, 24, 25, 26, 27, 28, 29, 31, 33, 34, 36, 38, 42, 47];
  const FIGS = {
    'commute-count': (el) => data(el, COMMUTE, 10, 50, 4, 'count'),
    'commute-rel10': (el) => data(el, COMMUTE, 10, 50, 4, 'rel'),
    'commute-rel5': (el) => data(el, COMMUTE, 10, 50, 8, 'rel', 4),
    'commute-den10': (el) => data(el, COMMUTE, 10, 50, 4, 'density'),
    'commute-den5': (el) => data(el, COMMUTE, 10, 50, 8, 'density', 4),
    'unif-seeds': (el) => {
      el.classList.add('lfig-grid');
      [2026, 11, 12, 13].forEach((seed) => {
        const box = document.createElement('div');
        box.className = 'lfig-cell';
        const cap = document.createElement('p');
        box.appendChild(cap);
        const holder = document.createElement('div');
        box.appendChild(holder);
        el.appendChild(box);
        const r = sim(holder, { dist: 'uniform', P: { a: 0, b: 1 }, n: 100, k: 10, seed, band: true, height: 200 });
        const outN = r.band.filter((b) => !b.inside).length;
        cap.textContent = `시드 ${seed}: ${r.counts.join(', ')} (범위 밖 ${outN}개)`;
      });
    },
    'dice-100': (el) => sim(el, { dist: 'dice', P: { a: 1, b: 6 }, n: 100, seed: 2026, band: true, xLabel: '주사위 눈' }),
    'unif-10000': (el) => sim(el, { dist: 'uniform', P: { a: 0, b: 1 }, n: 10000, k: 10, seed: 2026, mode: 'rel', band: true }),
    'normal-noisy': (el) => sim(el, { dist: 'normal', n: 100, k: 160, mode: 'density', theory: true }),
    'normal-coarse': (el) => sim(el, { dist: 'normal', n: 1000000, k: 5, mode: 'density', theory: true }),
    'normal-good': (el) => sim(el, { dist: 'normal', n: 1000000, rule: 'scott', mode: 'density', theory: true }),
    'binom-rel': (el) => sim(el, { dist: 'binomial', n: 10000, mode: 'rel', theory: true }),
    'binom-den20': (el) => sim(el, { dist: 'binomial', n: 10000, m: 20, mode: 'density' }),
    'ecdf-10': (el) => cdfFig(el, { dist: 'exponential', n: 10 }),
    'ecdf-1000': (el) => cdfFig(el, { dist: 'exponential', n: 1000 }),
    'cdf-exp': (el) => cdfFig(el, { dist: 'exponential', cursor: { mode: 'x', x: 1, cdf: 1 - Math.exp(-1) } }),
    'cdf-binom': (el) => cdfFig(el, { dist: 'binomial', xLabel: 'x (성공 횟수)', cursor: { mode: 'x', x: 3, cdf: 0.6496107184 } }),
    'cdf-mixed': (el) => cdfFig(el, { dist: 'waiting', xLabel: '대기 시간 (분)' }),
    'grid-sum': (el) => gridFig(el, 'dice2', 'sum', 7),
    'grid-max': (el) => gridFig(el, 'dice2', 'max', 6),
    'sq-sum-bands': (el) => squareFig(el, 'sum', 'bands'),
    'sq-max-region': (el) => squareFig(el, 'max', 'region', 0.6),
    'sq-dist-region': (el) => squareFig(el, 'dist', 'region', 0.5),
    'seg-sq': (el) => new RVL.SegmentView(el).render({ g: (u) => u * u, range: [0, 1], label: 'Y = U²' }),
    'seg-neglog': (el) => new RVL.SegmentView(el).render({ g: (u) => -Math.log(u), range: [0, 6], label: 'Y = −ln U' }),
  };

  document.querySelectorAll('.lfig[data-fig]').forEach((el) => {
    const f = FIGS[el.dataset.fig];
    if (f) { try { f(el); } catch (e) { el.textContent = '그림을 그리지 못했습니다: ' + e.message; } }
  });

  /* 목차 생성 */
  const toc = document.getElementById('toc-list');
  if (toc) {
    document.querySelectorAll('.lecture h2[id]').forEach((h) => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="#${h.id}">${h.textContent}</a>`;
      toc.appendChild(li);
    });
    const links = Array.from(toc.querySelectorAll('a'));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((ents) => {
        ents.forEach((e) => {
          if (e.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
        });
      }, { rootMargin: '0px 0px -75% 0px' });
      document.querySelectorAll('.lecture h2[id]').forEach((h) => io.observe(h));
    }
  }
})();
