/* 모듈 4 장면 공통 도구
 *   laws    장면에서 쓰는 분포 5종 (정규·지수·이항·대기 시간·칸토어): 분위수 Q, CDF F, 점 질량, 밀도
 *   panel   그림 칸(제목 + 그림 자리) 만들기
 *   drawCdf CDF 그리기(점프 위치에 닫힌 점·열린 점)
 *   table   수치 비교 표 HTML
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});
  const SP = RVL.dist.special;
  const M4 = RVL.m4;

  /* ───────────── 분포 ───────────── */
  function withAtoms(atoms) {
    let c = 0;
    return atoms.map((a) => { const lo = c; c += a.p; return Object.assign({}, a, { lo, hi: c }); });
  }
  const binom = RVL.dist.get('binomial');
  const BP = { N: 10, p: 0.3 };
  const binAtoms = withAtoms(Array.from({ length: 11 }, (_, k) => ({ x: k, p: binom.pmf(k, BP) })));
  const WQ = 0.3;

  const laws = {
    normal: {
      id: 'normal', name: '정규 N(0, 1)', short: '정규', kind: 'ac', range: [-3.6, 3.6], mean: 0,
      Q: (u) => SP.normInv(Math.min(1 - 1e-15, Math.max(1e-15, u))), F: (x) => SP.normCdf(x), dens: (x) => SP.normPdf(x), atoms: [],
    },
    exponential: {
      id: 'exponential', name: '지수 Exp(1)', short: '지수', kind: 'ac', range: [-0.3, 5.2], mean: 1,
      Q: (u) => -Math.log1p(-Math.min(u, 1 - 1e-15)), F: (x) => (x < 0 ? 0 : -Math.expm1(-x)), dens: (x) => (x < 0 ? 0 : Math.exp(-x)), atoms: [],
    },
    binomial: {
      id: 'binomial', name: '이항 B(10, 0.3)', short: '이항', kind: 'd', range: [-0.8, 10.8], mean: 3,
      Q: (u) => { for (const a of binAtoms) if (u <= a.hi + 1e-15) return a.x; return 10; },
      F: (x) => (x < 0 ? 0 : binom.cdf(Math.floor(x + 1e-12), BP)), dens: null, atoms: binAtoms,
    },
    waiting: {
      id: 'waiting', name: '대기 시간 (q = 0.3, λ = 1)', short: '대기 시간', kind: 'mix', range: [-0.4, 5.2], mean: 1 - WQ,
      Q: (u) => (u <= WQ ? 0 : -Math.log1p(-Math.min((u - WQ) / (1 - WQ), 1 - 1e-15))),
      F: (x) => (x < 0 ? 0 : WQ + (1 - WQ) * -Math.expm1(-x)), dens: (x) => (x <= 0 ? 0 : (1 - WQ) * Math.exp(-x)), atoms: withAtoms([{ x: 0, p: WQ }]),
    },
    cantor: {
      id: 'cantor', name: '칸토어', short: '칸토어', kind: 'sc', range: [-0.08, 1.08], mean: 0.5,
      Q: (u) => M4.cantor.quantile(u), F: (x) => M4.cantor.cdf(x), dens: null, atoms: [],
    },
  };
  const KIND = { ac: '밀도만 (절대연속)', d: '점 질량만 (이산)', mix: '점 질량 + 밀도 (혼합)', sc: '둘 다 없음 (특이연속)' };

  /* ───────────── 그림 도우미 ───────────── */
  /** 장면 안에 그림 칸 하나: 제목과 그림 자리 */
  function panel(parent, title, sub, cls) {
    const box = document.createElement('div');
    box.className = 'm4-panel' + (cls ? ' ' + cls : '');
    box.innerHTML = `${title ? `<p class="panel-title">${title}${sub ? `<small>${sub}</small>` : ''}</p>` : ''}<div class="m4-fig"></div>`;
    parent.appendChild(box);
    return box.querySelector('.m4-fig');
  }
  function row(parent) {
    const d = document.createElement('div');
    d.className = 'm4-row';
    parent.appendChild(d);
    return d;
  }
  const line = d3.line().x((d) => d[0]).y((d) => d[1]);
  function path(g, pts, cls) { return g.append('path').attr('class', cls).attr('d', line(pts)); }

  /** CDF 점들: 격자 + 점프 직전·직후 */
  function cdfPoints(law, lo, hi, n = 700) {
    const xs = [];
    for (let i = 0; i <= n; i++) xs.push(lo + ((hi - lo) * i) / n);
    for (const a of law.atoms) if (a.x > lo && a.x < hi) xs.push(a.x - 1e-7, a.x);
    xs.sort((p, q) => p - q);
    return xs.map((x) => [x, law.F(x)]);
  }
  /** CDF 그리기: 점프는 점선, 닫힌 점(F(x))과 열린 점(F(x−)) */
  function drawCdf(P, law, cls = 'm4-cdf', opts = {}) {
    const [lo, hi] = P.x.domain();
    const pts = cdfPoints(law, lo, hi, opts.n || 700);
    const g = P.plot.append('g').attr('class', 'm4-cdfg');
    let seg = [];
    const segs = [];
    for (let i = 0; i < pts.length; i++) {
      if (i > 0 && pts[i][1] - pts[i - 1][1] > 1e-4 && pts[i][0] - pts[i - 1][0] < 1e-6) { segs.push(seg); seg = []; }
      seg.push([P.x(pts[i][0]), P.y(pts[i][1])]);
    }
    segs.push(seg);
    segs.forEach((s) => path(g, s, cls));
    if (opts.dots !== false) {
      for (const a of law.atoms) {
        if (a.x < lo || a.x > hi) continue;
        g.append('line').attr('class', 'm4-jump').attr('x1', P.x(a.x)).attr('x2', P.x(a.x)).attr('y1', P.y(a.lo)).attr('y2', P.y(a.hi));
        g.append('circle').attr('class', 'm4-open').attr('cx', P.x(a.x)).attr('cy', P.y(a.lo)).attr('r', 3.5);
        g.append('circle').attr('class', 'm4-closed').attr('cx', P.x(a.x)).attr('cy', P.y(a.hi)).attr('r', 3.5);
      }
    }
    return g;
  }
  /** 칸토어 집합 단계 k의 구간들을 띠로 */
  function cantorDust(P, k, y, h, cls = 'm4-dust') {
    const g = P.plot.append('g');
    M4.cantor.intervals(k).forEach(([a, b]) => g.append('rect').attr('class', cls).attr('x', P.x(a)).attr('width', Math.max(0.8, P.x(b) - P.x(a))).attr('y', y).attr('height', h));
    return g;
  }

  /** 밀도 곡선: 점 질량 위치에서 끊어 그림 (혼합분포에서 세로선이 생기지 않도록) */
  function drawDens(P, law, cls = 'm4-curve', n = 400) {
    const [lo, hi] = P.x.domain();
    const cuts = law.atoms.map((a) => a.x).filter((v) => v > lo && v < hi).sort((a, b) => a - b);
    const edges = [lo, ...cuts, hi];
    for (let i = 0; i + 1 < edges.length; i++) {
      const a = edges[i] + (i > 0 ? 1e-9 : 0), b = edges[i + 1] - (i + 2 < edges.length ? 1e-9 : 0);
      const m = Math.max(2, Math.round((n * (b - a)) / (hi - lo)));
      path(P.plot, d3.range(0, m + 1).map((j) => a + ((b - a) * j) / m).map((v) => [P.x(v), P.y(law.dens(v))]), cls);
    }
  }

  /* ───────────── 표와 숫자 ───────────── */
  function f(v, d = 4) {
    if (v == null || Number.isNaN(v)) return '—';
    if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
    if (v !== 0 && Math.abs(v) < 1e-3) return v.toExponential(2).replace('e', '×10^').replace(/\^([-+]?)(\d+)/, (m, s, e) => '<sup>' + (s === '-' ? '−' : '') + e + '</sup>');
    return v.toFixed(d).replace('-', '−');
  }
  function table(head, rows, opts = {}) {
    return `<div class="m4-tablewrap"><table class="m4-table${opts.cls ? ' ' + opts.cls : ''}">${opts.caption ? `<caption>${opts.caption}</caption>` : ''}
      <thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${(r.cells || r).map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  /** 표본 n개 (분위수 변환) */
  function sample(law, rng, n) {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = law.Q(rng.random());
    return out;
  }

  RVL.m4ui = { laws, KIND, panel, row, line, path, cdfPoints, drawCdf, drawDens, cantorDust, f, table, sample };
})(typeof window !== 'undefined' ? window : globalThis);
