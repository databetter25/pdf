/* 히스토그램 계산: 표시 범위, 구간, 집계, 세로축 변환, 구간 폭 규칙, 오차 지표, 확률 계산
 * PRD 5.5 「계산 규칙」의 구현.
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});

  const NESTED_K = [5, 10, 20, 40, 80, 160, 320];
  const DISCRETE_M = [1, 2, 4, 5, 10, 20];
  const K_MIN = 5, K_MAX = 400;

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  /** 연속형 표시 범위 [L, U]: 유한한 지지집합 끝은 그대로, 무한하면 0.05%·99.95% 분위수를 보기 좋게 반올림 */
  function continuousRange(dist, P) {
    const [sLo, sHi] = dist.support(P);
    const qLo = isFinite(sLo) ? sLo : dist.quantile(0.0005, P);
    const qHi = isFinite(sHi) ? sHi : dist.quantile(0.9995, P);
    const step = niceStep((qHi - qLo) / 20);
    const L = isFinite(sLo) ? sLo : Math.floor(qLo / step) * step;
    const U = isFinite(sHi) ? sHi : Math.ceil(qHi / step) * step;
    return [+L.toPrecision(12), +U.toPrecision(12)];
  }

  /** 이산형 표시 범위 [xmin, xmax] (정수) */
  function discreteRange(dist, P) {
    const [sLo, sHi] = dist.support(P);
    const lo = isFinite(sLo) ? sLo : dist.quantile(0.00005, P);
    let hi = isFinite(sHi) ? sHi : dist.quantile(0.9999, P);
    if (hi <= lo) hi = lo + 1;
    return [lo, hi];
  }

  function continuousBins(L, U, k) {
    return { kind: 'continuous', origin: L, width: (U - L) / k, k, lo: L, hi: U };
  }
  /** 이산형 구간: 폭 1/m, 모든 정수가 구간의 정확한 중심이 되도록 정렬 */
  function discreteBins(xmin, xmax, m) {
    const w = 1 / m;
    const k = (xmax - xmin) * m + 1;
    return { kind: 'discrete', origin: xmin - w / 2, width: w, k, m, lo: xmin - w / 2, hi: xmax + w / 2, xmin, xmax };
  }
  function binEdges(bins, j) {
    return [bins.origin + j * bins.width, bins.origin + (j + 1) * bins.width];
  }
  /** 이산형에서 구간 j가 정수를 중심으로 갖는지 (갖는다면 그 정수) */
  function binInteger(bins, j) {
    if (bins.kind !== 'discrete') return null;
    return j % bins.m === 0 ? bins.xmin + j / bins.m : null;
  }

  function binCounts(samples, n, bins) {
    const counts = new Float64Array(bins.k);
    const o = bins.origin, inv = 1 / bins.width, k = bins.k;
    let out = 0;
    for (let i = 0; i < n; i++) {
      const x = samples[i];
      const j = Math.floor((x - o) * inv);
      if (j >= 0 && j < k) counts[j]++;
      else if (j === k && x <= bins.hi) counts[k - 1]++;
      else out++;
    }
    return { counts, out };
  }

  /** 세로축 모드: 'count' 도수, 'rel' 상대도수, 'density' 밀도 */
  function heights(counts, n, width, mode) {
    const h = new Float64Array(counts.length);
    const s = mode === 'count' ? 1 : mode === 'rel' ? 1 / n : 1 / (n * width);
    for (let j = 0; j < counts.length; j++) h[j] = counts[j] * s;
    return h;
  }

  /* 구간 폭 규칙 */
  function sampleSd(samples, n) {
    let mean = 0, m2 = 0;
    for (let i = 0; i < n; i++) {
      const d = samples[i] - mean;
      mean += d / (i + 1);
      m2 += d * (samples[i] - mean);
    }
    return n > 1 ? Math.sqrt(m2 / (n - 1)) : 0;
  }
  function sortedSubsample(samples, n, maxSize) {
    const step = Math.max(1, Math.floor(n / maxSize));
    const m = Math.ceil(n / step);
    const arr = new Float64Array(m);
    for (let i = 0, j = 0; i < n && j < m; i += step, j++) arr[j] = samples[i];
    arr.sort();
    return arr;
  }
  function quantileSorted(arr, p) {
    const h = (arr.length - 1) * p;
    const i = Math.floor(h);
    return i + 1 < arr.length ? arr[i] + (h - i) * (arr[i + 1] - arr[i]) : arr[i];
  }
  /** IQR (n이 크면 최대 20만 개 등간격 부분표본으로 근사) */
  function iqr(samples, n) {
    const a = sortedSubsample(samples, n, 200000);
    return quantileSorted(a, 0.75) - quantileSorted(a, 0.25);
  }
  function clampK(k) { return Math.max(K_MIN, Math.min(K_MAX, Math.round(k))); }

  /** 규칙에 따른 구간 수 k */
  function ruleK(rule, samples, n, L, U) {
    const R = U - L;
    if (n < 2) return 10;
    if (rule === 'sturges') return clampK(Math.ceil(Math.log2(n)) + 1);
    if (rule === 'scott') {
      const h = 3.49 * sampleSd(samples, n) * Math.pow(n, -1 / 3);
      return h > 0 ? clampK(R / h) : 10;
    }
    if (rule === 'fd') {
      const h = 2 * iqr(samples, n) * Math.pow(n, -1 / 3);
      return h > 0 ? clampK(R / h) : 10;
    }
    return 10;
  }
  function ruleWidth(rule, samples, n) {
    if (rule === 'scott') return 3.49 * sampleSd(samples, n) * Math.pow(n, -1 / 3);
    if (rule === 'fd') return 2 * iqr(samples, n) * Math.pow(n, -1 / 3);
    return NaN;
  }
  /** 쪼개기 모드: k를 5·2^j 중 로그 거리로 가장 가까운 값으로 */
  function snapNested(k) {
    let best = NESTED_K[0], bd = Infinity;
    for (const c of NESTED_K) {
      const d = Math.abs(Math.log(c / k));
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  /* 오차 지표 */
  /** 연속형 L1 오차 ∫|f̂ − f|dx. 각 구간을 20개 소구간으로 나눈 중점 규칙 + 범위 밖 이론 질량 */
  function l1Error(densityHeights, bins, dist, P) {
    const sub = 20, w = bins.width, dw = w / sub;
    let s = 0;
    for (let j = 0; j < bins.k; j++) {
      const h = densityHeights[j];
      const x0 = bins.origin + j * w;
      for (let t = 0; t < sub; t++) {
        s += Math.abs(h - dist.pdf(x0 + (t + 0.5) * dw, P)) * dw;
      }
    }
    const outside = 1 - (dist.cdf(bins.hi, P) - dist.cdf(bins.lo, P));
    return s + Math.max(0, outside);
  }
  /** 이산형 총변동거리 TV = ½ Σ|p̂(x) − p(x)| (범위 밖은 상한으로 더함) */
  function tvDistance(counts, n, outCount, bins, dist, P) {
    let s = 0, inside = 0;
    for (let x = bins.xmin; x <= bins.xmax; x++) {
      const j = (x - bins.xmin) * bins.m;
      const p = dist.pmf(x, P);
      inside += p;
      s += Math.abs(counts[j] / n - p);
    }
    return 0.5 * (s + Math.abs(outCount / n - Math.max(0, 1 - inside)));
  }

  /* 확률 계산 (PRD 5.6) */
  function probContinuous(samples, n, a, b, bins, densityHeights, dist, P) {
    if (b < a) [a, b] = [b, a];
    let c = 0;
    for (let i = 0; i < n; i++) { const x = samples[i]; if (x >= a && x <= b) c++; }
    let area = 0;
    for (let j = 0; j < bins.k; j++) {
      const [e0, e1] = binEdges(bins, j);
      const ov = Math.min(b, e1) - Math.max(a, e0);
      if (ov > 0) area += densityHeights[j] * ov;
    }
    return { sample: c / n, hist: area, theory: dist.cdf(b, P) - dist.cdf(a, P) };
  }
  /** 이산형: 정수 a..b, 끝점 포함 여부 */
  function probDiscrete(samples, n, a, b, inclA, inclB, dist, P) {
    if (b < a) [a, b] = [b, a];
    const lo = inclA ? a : a + 1;
    const hi = inclB ? b : b - 1;
    if (hi < lo) return { sample: 0, hist: 0, theory: 0, lo, hi };
    let c = 0;
    for (let i = 0; i < n; i++) { const x = samples[i]; if (x >= lo && x <= hi) c++; }
    let th = 0;
    for (let x = lo; x <= hi; x++) th += dist.pmf(x, P);
    return { sample: c / n, hist: c / n, theory: th, lo, hi };
  }

  RVL.hist = {
    NESTED_K, DISCRETE_M, K_MIN, K_MAX,
    niceStep, continuousRange, discreteRange, continuousBins, discreteBins,
    binEdges, binInteger, binCounts, heights,
    sampleSd, iqr, ruleK, ruleWidth, snapNested, clampK,
    l1Error, tvDistance, probContinuous, probDiscrete,
  };
})(typeof window !== 'undefined' ? window : globalThis);
