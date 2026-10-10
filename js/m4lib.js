/* 모듈 4 수학 라이브러리 (PRD_module4 7장)
 *   cantor       칸토어 분포: 표본, CDF(악마의 계단), 분위수
 *   farey        [0,1]의 유리수를 분모 순서로 나열
 *   unionLength  구간 합집합의 길이 (병합)
 *   zi           0 과잉 지수분포 (P(X=0)=q, 나머지 Exp(λ))
 *   ce           조건부 기댓값 E[X|G] (X(ω)=sin2πω+ω², 분할 σ-대수)
 *   rb           포아송 P(X=0) 추정: 단순 불편, 라오–블랙웰, MLE
 *   plot         장면 그림용 SVG 틀(축·격자·라벨)
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});
  const DIG = 40;

  /* ───────────── 칸토어 분포 ───────────── */
  const P3 = Array.from({ length: DIG + 1 }, (_, k) => Math.pow(3, -k));
  const cantor = {
    mean: 0.5, variance: 1 / 8,
    sampler(rng) {
      return () => {
        let x = 0;
        for (let k = 1; k <= DIG; k++) if (rng.random() < 0.5) x += 2 * P3[k];
        return x;
      };
    },
    cdf(x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let r = 0, s = 0.5;
      for (let i = 0; i < DIG; i++) {
        x *= 3;
        const d = Math.floor(x);
        x -= d;
        if (d === 1) return r + s;
        if (d === 2) r += s;
        s /= 2;
      }
      return r;
    },
    quantile(u) {
      let x = 0;
      for (let k = 1; k <= DIG; k++) {
        u *= 2;
        if (u >= 1) { x += 2 * P3[k]; u -= 1; }
      }
      return x;
    },
    /** 단계 k의 남는 구간 2^k개 */
    intervals(k) {
      let iv = [[0, 1]];
      for (let i = 0; i < k; i++) {
        const nx = [];
        for (const [a, b] of iv) { const t = (b - a) / 3; nx.push([a, a + t], [b - t, b]); }
        iv = nx;
      }
      return iv;
    },
  };

  /* ───────────── 유리수 ───────────── */
  function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
  /** [0,1]의 유리수 K개: 0/1, 1/1, 1/2, 1/3, 2/3, 1/4, 3/4, … (기약분수, 중복 없음) */
  function farey(K) {
    const out = [[0, 1], [1, 1]];
    for (let d = 2; out.length < K; d++) {
      for (let n = 1; n < d && out.length < K; n++) if (gcd(n, d) === 1) out.push([n, d]);
    }
    return out.slice(0, K);
  }
  /** 구간들을 [lo, hi]로 자른 뒤 합집합 길이 */
  function unionLength(intervals, lo = 0, hi = 1) {
    const iv = intervals.map(([a, b]) => [Math.max(lo, a), Math.min(hi, b)]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
    let len = 0, cs = -Infinity, ce = -Infinity;
    const merged = [];
    for (const [a, b] of iv) {
      if (a > ce) { if (ce > cs) { len += ce - cs; merged.push([cs, ce]); } cs = a; ce = b; }
      else ce = Math.max(ce, b);
    }
    if (ce > cs) { len += ce - cs; merged.push([cs, ce]); }
    return { length: len, merged };
  }

  /* ───────────── 0 과잉 지수 ───────────── */
  const zi = {
    sampler: (rng, q, lam) => () => (rng.random() < q ? 0 : -Math.log(rng.random()) / lam),
    cdf: (x, q, lam) => (x < 0 ? 0 : q + (1 - q) * -Math.expm1(-lam * x)),
    /** 기준 측도 ν = δ0 + λ에 대한 라돈–니코딤 도함수 */
    rn: (x, q, lam) => (x === 0 ? q : x > 0 ? (1 - q) * lam * Math.exp(-lam * x) : 0),
    moments: (q, lam) => ({ mean: (1 - q) / lam, m2: 2 * (1 - q) / (lam * lam), lapl: q + (1 - q) * lam / (lam + 1), le1: q + (1 - q) * -Math.expm1(-lam) }),
    /** 올바른 MLE (ν = δ0 + λ 기준)와 지수분포로 잘못 본 MLE */
    fit(xs) {
      let n0 = 0, sp = 0, np = 0, s = 0;
      for (const v of xs) { s += v; if (v === 0) n0++; else { np++; sp += v; } }
      const n = xs.length;
      return { q: n0 / n, lam: np / sp, naiveLam: n / s, n0, np, n };
    },
  };

  /* ───────────── 조건부 기댓값 ───────────── */
  const ce = {
    X: (w) => Math.sin(2 * Math.PI * w) + w * w,
    I: (w) => -Math.cos(2 * Math.PI * w) / (2 * Math.PI) + (w * w * w) / 3,
    /** 분할점 edges(0=e0<…<eK=1)에서 칸별 평균 */
    means(edges) {
      const m = [];
      for (let i = 0; i + 1 < edges.length; i++) m.push((ce.I(edges[i + 1]) - ce.I(edges[i])) / (edges[i + 1] - edges[i]));
      return m;
    },
    cellOf(edges, w) {
      let a = 0, b = edges.length - 2;
      while (a < b) { const m = (a + b + 1) >> 1; if (edges[m] <= w) a = m; else b = m - 1; }
      return a;
    },
    /** ||X − Y||₂, Y는 칸별 상수 levels */
    l2(edges, levels, N = 200000) {
      let s = 0, j = 0;
      for (let i = 0; i < N; i++) {
        const w = (i + 0.5) / N;
        while (j + 2 < edges.length && w >= edges[j + 1]) j++;
        const d = ce.X(w) - levels[j];
        s += d * d;
      }
      return Math.sqrt(s / N);
    },
    /** E[(X − Y) Z], Z는 칸별 상수 */
    inner(edges, levels, z, N = 200000) {
      let s = 0, j = 0;
      for (let i = 0; i < N; i++) {
        const w = (i + 0.5) / N;
        while (j + 2 < edges.length && w >= edges[j + 1]) j++;
        s += (ce.X(w) - levels[j]) * z[j];
      }
      return s / N;
    },
    dyadic: (k) => Array.from({ length: (1 << k) + 1 }, (_, i) => i / (1 << k)),
  };

  /* ───────────── 라오–블랙웰 (포아송) ───────────── */
  const rb = {
    theory(lam, n) {
      const th = Math.exp(-lam);
      return { theta: th, varNaive: th * (1 - th), varRB: Math.exp(-2 * lam) * Math.expm1(lam / n) };
    },
    /** M번 반복: 각 반복의 (X1, T)와 세 추정량 */
    simulate(rng, lam, n, M) {
      const pois = RVL.dist.get('poisson').sampler(rng, { lambda: lam });
      const X1 = new Int32Array(M), T = new Int32Array(M);
      const naive = new Float64Array(M), rbv = new Float64Array(M), mle = new Float64Array(M);
      const a = 1 - 1 / n;
      for (let m = 0; m < M; m++) {
        let t = 0, x1 = 0;
        for (let i = 0; i < n; i++) { const x = pois(); if (i === 0) x1 = x; t += x; }
        X1[m] = x1; T[m] = t;
        naive[m] = x1 === 0 ? 1 : 0;
        rbv[m] = Math.pow(a, t);
        mle[m] = Math.exp(-t / n);
      }
      return { X1, T, naive, rb: rbv, mle };
    },
  };

  function stats(arr, truth) {
    const n = arr.length;
    let m = 0; for (let i = 0; i < n; i++) m += arr[i]; m /= n;
    let v = 0, mse = 0;
    for (let i = 0; i < n; i++) { v += (arr[i] - m) ** 2; if (truth != null) mse += (arr[i] - truth) ** 2; }
    return { mean: m, var: v / (n - 1), sd: Math.sqrt(v / (n - 1)), mse: truth != null ? mse / n : NaN, se: Math.sqrt(v / (n - 1) / n) };
  }

  /* ───────────── 그림 틀 ───────────── */
  function plot(el, o = {}) {
    el.innerHTML = '';
    const W = Math.max(260, o.width || el.clientWidth || 600);
    const H = o.height || 240;
    const mg = Object.assign({ top: 14, right: 16, bottom: 42, left: 54 }, o.margin || {});
    const iw = W - mg.left - mg.right, ih = H - mg.top - mg.bottom;
    const svg = d3.select(el).append('svg').attr('class', 'm4-svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H).attr('role', 'img');
    if (o.aria) svg.append('title').text(o.aria);
    const id = 'm4c' + Math.random().toString(36).slice(2, 8);
    svg.append('defs').append('clipPath').attr('id', id).append('rect').attr('x', -2).attr('y', -4).attr('width', iw + 4).attr('height', ih + 8);
    const g = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);
    const mk = (type, dom, rng) => (type === 'log' ? d3.scaleLog() : d3.scaleLinear()).domain(dom).range(rng);
    const x = mk(o.xType, o.x || [0, 1], [0, iw]);
    const y = mk(o.yType, o.y || [0, 1], [ih, 0]);
    if (o.yNice !== false && o.yType !== 'log') y.nice(5);
    const grid = g.append('g').attr('class', 'grid');
    if (!o.noAxes) {
      const yt = o.yTicks || 5;
      if (!o.noY) grid.call(d3.axisLeft(y).ticks(yt).tickSize(-iw).tickFormat('')).select('.domain').remove();
      const xa = d3.axisBottom(x).tickSizeOuter(0).tickPadding(6);
      if (o.xTickValues) xa.tickValues(o.xTickValues);
      else xa.ticks(o.xTicks || Math.max(4, Math.floor(iw / 72)));
      if (o.xFormat) xa.tickFormat(o.xFormat);
      g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`).call(xa);
      const ya = d3.axisLeft(y).ticks(yt).tickSizeOuter(0).tickPadding(6);
      if (o.yFormat) ya.tickFormat(o.yFormat);
      if (!o.noY) g.append('g').attr('class', 'axis').call(ya);
      if (o.xLabel) g.append('text').attr('class', 'axis-label').attr('x', iw / 2).attr('y', ih + 36).attr('text-anchor', 'middle').text(o.xLabel);
      if (o.yLabel) g.append('text').attr('class', 'axis-label').attr('transform', `translate(${-mg.left + 13},${ih / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(o.yLabel);
    }
    const plotG = g.append('g').attr('clip-path', o.clip === false ? null : `url(#${id})`);
    return { svg, g, plot: plotG, x, y, iw, ih, W, H, mg };
  }

  RVL.m4 = { cantor, farey, unionLength, zi, ce, rb, stats, plot, gcd };
})(typeof window !== 'undefined' ? window : globalThis);
