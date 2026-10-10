/* 경험적 누적분포함수(ECDF)와 관련 계산 (PRD_module2 5.6)
 *   sorted(samples, n)      정렬된 복사본
 *   countLE(s, x)           x 이하인 표본 수 (이진 탐색)
 *   at(s, x)                F̂n(x)
 *   dn(s, dist, P)          Dn = sup|F̂n − F| 와 그 위치 (연속·이산·혼합 공통, 같은 값 묶음 처리)
 *   dkw(n, alpha)           DKW 띠 폭 ε = √(ln(2/α) / 2n)
 *   quantile(s, p)          표본 분위수 x_(⌈np⌉) (ECDF의 일반화 역함수와 같은 정의)
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});

  function sorted(samples, n) {
    const a = Float64Array.from(samples.subarray ? samples.subarray(0, n) : samples.slice(0, n));
    a.sort();
    return a;
  }
  function countLE(s, x) {
    let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] <= x) lo = m + 1; else hi = m; }
    return lo;
  }
  function countLT(s, x) {
    let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < x) lo = m + 1; else hi = m; }
    return lo;
  }
  const at = (s, x) => (s.length ? countLE(s, x) / s.length : 0);

  function dn(s, dist, P) {
    const n = s.length;
    let best = { d: 0, x: NaN, ecdf: 0, cdf: 0 };
    if (!n) return best;
    let i = 0;
    while (i < n) {
      const v = s[i];
      let j = i;
      while (j < n && s[j] === v) j++;
      const below = i / n, upTo = j / n;
      const Fv = dist.cdf(v, P), Fl = dist.cdfLeft ? dist.cdfLeft(v, P) : Fv;
      const d1 = Math.abs(upTo - Fv), d2 = Math.abs(below - Fl);
      if (d1 > best.d) best = { d: d1, x: v, ecdf: upTo, cdf: Fv };
      if (d2 > best.d) best = { d: d2, x: v, ecdf: below, cdf: Fl, left: true };
      i = j;
    }
    return best;
  }
  const dkw = (n, alpha = 0.05) => Math.sqrt(Math.log(2 / alpha) / (2 * n));
  function quantile(s, p) {
    const n = s.length;
    if (!n) return NaN;
    return s[Math.min(n - 1, Math.max(0, Math.ceil(n * p - 1e-12) - 1))];
  }

  RVL.ecdf = { sorted, countLE, countLT, at, dn, dkw, quantile };
})(typeof window !== 'undefined' ? window : globalThis);
