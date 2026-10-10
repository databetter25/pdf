/* 확률분포 라이브러리
 * 각 분포는 다음을 제공한다.
 *   id, name, type('continuous'|'discrete'), params[], fix(P)
 *   pdf(x,P) 또는 pmf(k,P), cdf(x,P), quantile(p,P), sampler(rng,P)
 *   mean(P), variance(P), support(P) → [lo, hi]
 *   tex: { f, mean, variance, support } (KaTeX 문자열)
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});

  /* ───────────── 특수함수 ───────────── */
  const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  const LN_SQRT_2PI = 0.9189385332046728;

  function lnGamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
    x -= 1;
    let a = LANCZOS[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
    return LN_SQRT_2PI + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  const FPMIN = 1e-300;
  function gammaSeries(a, x) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 100000; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  function gammaContFrac(a, x) {
    let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
    for (let i = 1; i < 100000; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-16) break;
    }
    return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
  }
  /** 정칙화 하부 불완전감마 P(a,x) */
  function gammaP(a, x) {
    if (x <= 0) return 0;
    if (!isFinite(x)) return 1;
    return x < a + 1 ? gammaSeries(a, x) : 1 - gammaContFrac(a, x);
  }
  /** 정칙화 상부 불완전감마 Q(a,x) = 1 − P(a,x) */
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    if (!isFinite(x)) return 0;
    return x < a + 1 ? 1 - gammaSeries(a, x) : gammaContFrac(a, x);
  }

  function betaContFrac(x, a, b) {
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m < 100000; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-16) break;
    }
    return h;
  }
  /** 정칙화 불완전베타 I_x(a,b) */
  function betaI(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const lbt = lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
    const bt = Math.exp(lbt);
    if (x < (a + 1) / (a + b + 2)) return bt * betaContFrac(x, a, b) / a;
    return 1 - bt * betaContFrac(1 - x, b, a) / b;
  }

  function normPdf(z) { return Math.exp(-0.5 * z * z - LN_SQRT_2PI); }
  function normCdf(z) {
    if (isNaN(z)) return NaN;
    const q = 0.5 * gammaQ(0.5, 0.5 * z * z);
    return z < 0 ? q : 1 - q;
  }
  function normInv(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425;
    let q, r, x;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= 1 - pl) {
      q = p - 0.5; r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    for (let i = 0; i < 2; i++) { // Halley 보정
      const e = normCdf(x) - p;
      const u = e * Math.sqrt(2 * Math.PI) * Math.exp(0.5 * x * x);
      x = x - u / (1 + 0.5 * x * u);
    }
    return x;
  }

  /* ───────────── 표본추출 도우미 ───────────── */
  function normalSampler(rng) {
    let spare = null;
    return function () {
      if (spare !== null) { const s = spare; spare = null; return s; }
      let u, v, s;
      do {
        u = 2 * rng.random() - 1;
        v = 2 * rng.random() - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      const m = Math.sqrt(-2 * Math.log(s) / s);
      spare = v * m;
      return u * m;
    };
  }
  /** 모양 k, 척도 1인 감마 (Marsaglia–Tsang) */
  function gammaSampler(rng, k) {
    if (k < 1) {
      const g = gammaSampler(rng, k + 1);
      const inv = 1 / k;
      return () => g() * Math.pow(rng.random(), inv);
    }
    const norm = normalSampler(rng);
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    return function () {
      for (;;) {
        let x, v;
        do { x = norm(); v = 1 + c * x; } while (v <= 0);
        v = v * v * v;
        const u = rng.random();
        const x2 = x * x;
        if (u < 1 - 0.0331 * x2 * x2) return d * v;
        if (Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))) return d * v;
      }
    };
  }
  /** 누적확률표를 이용한 이산 역변환 (이진 탐색) */
  function tableSampler(rng, lo, cdfArr) {
    const last = cdfArr.length - 1;
    return function () {
      const u = rng.random();
      let a = 0, b = last;
      while (a < b) {
        const m = (a + b) >> 1;
        if (cdfArr[m] < u) a = m + 1; else b = m;
      }
      return lo + a;
    };
  }
  function buildCdfTable(dist, P) {
    const [lo, hiSup] = dist.support(P);
    const arr = [];
    let acc = 0;
    for (let k = lo; k <= hiSup && arr.length < 100000; k++) {
      acc += dist.pmf(k, P);
      arr.push(acc);
      if (acc >= 1 - 1e-15) break;
    }
    arr[arr.length - 1] = 1;
    return { lo, arr: Float64Array.from(arr) };
  }

  /* ───────────── 분위수 (일반) ───────────── */
  function bisect(f, p, lo, hi) {
    for (let i = 0; i < 300; i++) {
      const mid = 0.5 * (lo + hi);
      if (f(mid) < p) lo = mid; else hi = mid;
      if (hi - lo <= 1e-13 * (1 + Math.abs(mid))) break;
    }
    return 0.5 * (lo + hi);
  }
  function contQuantile(dist, p, P) {
    let [lo, hi] = dist.support(P);
    const m = dist.mean(P);
    const s = Math.sqrt(dist.variance(P)) || 1;
    const f = (x) => dist.cdf(x, P);
    if (!isFinite(lo)) { lo = m - 10 * s; while (f(lo) > p) lo -= 10 * s; }
    if (!isFinite(hi)) { hi = m + 10 * s; while (f(hi) < p) hi += 10 * s; }
    return bisect(f, p, lo, hi);
  }
  function discQuantile(dist, p, P) {
    const [lo, hi] = dist.support(P);
    let acc = 0;
    for (let k = lo; k <= hi && k < lo + 1e6; k++) {
      acc += dist.pmf(k, P);
      if (acc >= p - 1e-14) return k;
    }
    return isFinite(hi) ? hi : lo;
  }

  /* ───────────── 분포 정의 ───────────── */
  const list = [];
  function def(d) {
    d.fix = d.fix || ((P) => P);
    if (!d.quantile) {
      d.quantile = d.type === 'continuous'
        ? (p, P) => contQuantile(d, p, P)
        : (p, P) => discQuantile(d, p, P);
    }
    if (d.type === 'discrete') {
      d.cdf = d.cdf || function (x, P) {
        const [lo] = d.support(P);
        const k = Math.floor(x + 1e-9);
        if (k < lo) return 0;
        let s = 0;
        for (let i = lo; i <= k; i++) s += d.pmf(i, P);
        return Math.min(1, s);
      };
      d.pdf = d.pmf;
      if (!d.sampler) {
        d.sampler = (rng, P) => {
          const t = buildCdfTable(d, P);
          return tableSampler(rng, t.lo, t.arr);
        };
      }
    }
    if (!d.cdfLeft) {
      // F(x⁻) = P(X < x). 연속형은 F(x)와 같고, 정수 지지 이산형은 F(⌈x⌉ − 1)
      d.cdfLeft = d.type === 'discrete' ? (x, P) => d.cdf(Math.ceil(x - 1e-9) - 1, P) : d.cdf;
    }
    d.defaults = () => Object.fromEntries(d.params.map((q) => [q.key, q.def]));
    list.push(d);
    return d;
  }

  /* 연속형 */
  def({
    id: 'normal', name: '정규분포', type: 'continuous',
    params: [
      { key: 'mu', label: 'μ (평균)', min: -3, max: 3, step: 0.1, def: 0 },
      { key: 'sigma', label: 'σ (표준편차)', min: 0.1, max: 3, step: 0.05, def: 1 },
    ],
    pdf: (x, P) => normPdf((x - P.mu) / P.sigma) / P.sigma,
    cdf: (x, P) => normCdf((x - P.mu) / P.sigma),
    quantile: (p, P) => P.mu + P.sigma * normInv(p),
    sampler: (rng, P) => { const z = normalSampler(rng); return () => P.mu + P.sigma * z(); },
    mean: (P) => P.mu, variance: (P) => P.sigma * P.sigma,
    support: () => [-Infinity, Infinity],
    tex: { f: 'f(x)=\\dfrac{1}{\\sigma\\sqrt{2\\pi}}\\,e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}', mean: '\\mu', variance: '\\sigma^2', support: '-\\infty<x<\\infty' },
  });

  def({
    id: 'uniform', name: '균등분포', type: 'continuous',
    params: [
      { key: 'a', label: 'a (왼쪽 끝)', min: -3, max: 3, step: 0.1, def: 0 },
      { key: 'b', label: 'b (오른쪽 끝)', min: -2.9, max: 5, step: 0.1, def: 1 },
    ],
    fix: (P) => (P.b <= P.a + 0.05 ? { ...P, b: +(P.a + 0.1).toFixed(2) } : P),
    pdf: (x, P) => (x >= P.a && x <= P.b ? 1 / (P.b - P.a) : 0),
    cdf: (x, P) => (x <= P.a ? 0 : x >= P.b ? 1 : (x - P.a) / (P.b - P.a)),
    quantile: (p, P) => P.a + p * (P.b - P.a),
    sampler: (rng, P) => () => P.a + (P.b - P.a) * rng.random(),
    mean: (P) => (P.a + P.b) / 2, variance: (P) => (P.b - P.a) ** 2 / 12,
    support: (P) => [P.a, P.b],
    tex: { f: 'f(x)=\\dfrac{1}{b-a}', mean: '\\dfrac{a+b}{2}', variance: '\\dfrac{(b-a)^2}{12}', support: 'a\\le x\\le b' },
  });

  def({
    id: 'exponential', name: '지수분포', type: 'continuous',
    params: [{ key: 'lambda', label: 'λ (비율)', min: 0.2, max: 5, step: 0.1, def: 1 }],
    pdf: (x, P) => (x < 0 ? 0 : P.lambda * Math.exp(-P.lambda * x)),
    cdf: (x, P) => (x <= 0 ? 0 : -Math.expm1(-P.lambda * x)),
    quantile: (p, P) => -Math.log1p(-p) / P.lambda,
    sampler: (rng, P) => () => -Math.log(rng.random()) / P.lambda,
    mean: (P) => 1 / P.lambda, variance: (P) => 1 / (P.lambda * P.lambda),
    support: () => [0, Infinity],
    tex: { f: 'f(x)=\\lambda e^{-\\lambda x}', mean: '1/\\lambda', variance: '1/\\lambda^2', support: 'x\\ge 0' },
  });

  def({
    id: 'gamma', name: '감마분포', type: 'continuous',
    params: [
      { key: 'k', label: 'k (모양)', min: 0.5, max: 10, step: 0.1, def: 2 },
      { key: 'theta', label: 'θ (척도)', min: 0.25, max: 4, step: 0.05, def: 1 },
    ],
    pdf: (x, P) => (x <= 0 ? 0 : Math.exp((P.k - 1) * Math.log(x) - x / P.theta - lnGamma(P.k) - P.k * Math.log(P.theta))),
    cdf: (x, P) => gammaP(P.k, x / P.theta),
    sampler: (rng, P) => { const g = gammaSampler(rng, P.k); return () => P.theta * g(); },
    mean: (P) => P.k * P.theta, variance: (P) => P.k * P.theta * P.theta,
    support: () => [0, Infinity],
    tex: { f: 'f(x)=\\dfrac{x^{k-1}e^{-x/\\theta}}{\\Gamma(k)\\,\\theta^k}', mean: 'k\\theta', variance: 'k\\theta^2', support: 'x>0' },
  });

  def({
    id: 'beta', name: '베타분포', type: 'continuous',
    params: [
      { key: 'alpha', label: 'α', min: 0.5, max: 10, step: 0.1, def: 2 },
      { key: 'beta', label: 'β', min: 0.5, max: 10, step: 0.1, def: 5 },
    ],
    pdf: (x, P) => (x <= 0 || x >= 1 ? 0 : Math.exp((P.alpha - 1) * Math.log(x) + (P.beta - 1) * Math.log(1 - x) + lnGamma(P.alpha + P.beta) - lnGamma(P.alpha) - lnGamma(P.beta))),
    cdf: (x, P) => betaI(x, P.alpha, P.beta),
    sampler: (rng, P) => {
      const ga = gammaSampler(rng, P.alpha), gb = gammaSampler(rng, P.beta);
      return () => { const x = ga(), y = gb(); return x / (x + y); };
    },
    mean: (P) => P.alpha / (P.alpha + P.beta),
    variance: (P) => { const s = P.alpha + P.beta; return P.alpha * P.beta / (s * s * (s + 1)); },
    support: () => [0, 1],
    tex: { f: 'f(x)=\\dfrac{x^{\\alpha-1}(1-x)^{\\beta-1}}{B(\\alpha,\\beta)}', mean: '\\dfrac{\\alpha}{\\alpha+\\beta}', variance: '\\dfrac{\\alpha\\beta}{(\\alpha+\\beta)^2(\\alpha+\\beta+1)}', support: '0<x<1' },
  });

  const S2 = 0.7;
  def({
    id: 'mixture', name: '이봉분포 (두 정규의 혼합)', type: 'continuous',
    params: [
      { key: 'w', label: 'w (왼쪽 봉우리 비중)', min: 0.1, max: 0.9, step: 0.05, def: 0.5 },
      { key: 'delta', label: 'δ (두 봉우리 사이 거리)', min: 0, max: 6, step: 0.1, def: 4 },
    ],
    pdf: (x, P) => P.w * normPdf(x + P.delta / 2) + (1 - P.w) * normPdf((x - P.delta / 2) / S2) / S2,
    cdf: (x, P) => P.w * normCdf(x + P.delta / 2) + (1 - P.w) * normCdf((x - P.delta / 2) / S2),
    sampler: (rng, P) => {
      const z = normalSampler(rng);
      return () => (rng.random() < P.w ? -P.delta / 2 + z() : P.delta / 2 + S2 * z());
    },
    mean: (P) => P.w * (-P.delta / 2) + (1 - P.w) * (P.delta / 2),
    variance: (P) => {
      const m = P.w * (-P.delta / 2) + (1 - P.w) * (P.delta / 2);
      return P.w * (1 + P.delta * P.delta / 4) + (1 - P.w) * (S2 * S2 + P.delta * P.delta / 4) - m * m;
    },
    support: () => [-Infinity, Infinity],
    tex: { f: 'f(x)=w\\,\\phi\\!\\left(x+\\tfrac{\\delta}{2}\\right)+(1-w)\\,\\tfrac{1}{0.7}\\phi\\!\\left(\\tfrac{x-\\delta/2}{0.7}\\right)', mean: 'w\\!\\left(-\\tfrac{\\delta}{2}\\right)+(1-w)\\tfrac{\\delta}{2}', variance: '\\text{(혼합분산)}', support: '-\\infty<x<\\infty' },
  });

  def({
    id: 'chisq', name: '카이제곱분포', type: 'continuous',
    params: [{ key: 'nu', label: 'ν (자유도)', min: 1, max: 30, step: 1, def: 4 }],
    pdf: (x, P) => (x <= 0 ? 0 : Math.exp((P.nu / 2 - 1) * Math.log(x) - x / 2 - lnGamma(P.nu / 2) - (P.nu / 2) * Math.LN2)),
    cdf: (x, P) => gammaP(P.nu / 2, x / 2),
    sampler: (rng, P) => { const g = gammaSampler(rng, P.nu / 2); return () => 2 * g(); },
    mean: (P) => P.nu, variance: (P) => 2 * P.nu,
    support: () => [0, Infinity],
    tex: { f: 'f(x)=\\dfrac{x^{\\nu/2-1}e^{-x/2}}{2^{\\nu/2}\\Gamma(\\nu/2)}', mean: '\\nu', variance: '2\\nu', support: 'x>0' },
  });

  def({
    id: 't', name: 't 분포', type: 'continuous',
    params: [{ key: 'nu', label: 'ν (자유도)', min: 3, max: 30, step: 1, def: 5 }],
    pdf: (x, P) => { const v = P.nu; return Math.exp(lnGamma((v + 1) / 2) - lnGamma(v / 2) - 0.5 * Math.log(v * Math.PI) - ((v + 1) / 2) * Math.log1p(x * x / v)); },
    cdf: (x, P) => { const v = P.nu; const ib = betaI(v / (v + x * x), v / 2, 0.5); return x >= 0 ? 1 - 0.5 * ib : 0.5 * ib; },
    sampler: (rng, P) => {
      const z = normalSampler(rng), g = gammaSampler(rng, P.nu / 2);
      return () => z() / Math.sqrt((2 * g()) / P.nu);
    },
    mean: () => 0, variance: (P) => P.nu / (P.nu - 2),
    support: () => [-Infinity, Infinity],
    tex: { f: 'f(x)=\\dfrac{\\Gamma(\\frac{\\nu+1}{2})}{\\sqrt{\\nu\\pi}\\,\\Gamma(\\frac{\\nu}{2})}\\left(1+\\dfrac{x^2}{\\nu}\\right)^{-\\frac{\\nu+1}{2}}', mean: '0', variance: '\\dfrac{\\nu}{\\nu-2}', support: '-\\infty<x<\\infty' },
  });

  def({
    id: 'lognormal', name: '로그정규분포', type: 'continuous',
    params: [
      { key: 'mu', label: 'μ (log X의 평균)', min: -1, max: 1, step: 0.05, def: 0 },
      { key: 'sigma', label: 'σ (log X의 표준편차)', min: 0.2, max: 1.2, step: 0.05, def: 0.5 },
    ],
    pdf: (x, P) => (x <= 0 ? 0 : normPdf((Math.log(x) - P.mu) / P.sigma) / (x * P.sigma)),
    cdf: (x, P) => (x <= 0 ? 0 : normCdf((Math.log(x) - P.mu) / P.sigma)),
    quantile: (p, P) => Math.exp(P.mu + P.sigma * normInv(p)),
    sampler: (rng, P) => { const z = normalSampler(rng); return () => Math.exp(P.mu + P.sigma * z()); },
    mean: (P) => Math.exp(P.mu + P.sigma * P.sigma / 2),
    variance: (P) => (Math.exp(P.sigma * P.sigma) - 1) * Math.exp(2 * P.mu + P.sigma * P.sigma),
    support: () => [0, Infinity],
    tex: { f: 'f(x)=\\dfrac{1}{x\\sigma\\sqrt{2\\pi}}e^{-\\frac{(\\ln x-\\mu)^2}{2\\sigma^2}}', mean: 'e^{\\mu+\\sigma^2/2}', variance: '(e^{\\sigma^2}-1)e^{2\\mu+\\sigma^2}', support: 'x>0' },
  });

  def({
    id: 'weibull', name: '와이블분포', type: 'continuous',
    params: [
      { key: 'k', label: 'k (모양)', min: 0.6, max: 5, step: 0.1, def: 1.5 },
      { key: 'lambda', label: 'λ (척도)', min: 0.5, max: 3, step: 0.1, def: 1 },
    ],
    pdf: (x, P) => (x < 0 ? 0 : (P.k / P.lambda) * Math.pow(x / P.lambda, P.k - 1) * Math.exp(-Math.pow(x / P.lambda, P.k))),
    cdf: (x, P) => (x <= 0 ? 0 : -Math.expm1(-Math.pow(x / P.lambda, P.k))),
    quantile: (p, P) => P.lambda * Math.pow(-Math.log1p(-p), 1 / P.k),
    sampler: (rng, P) => () => P.lambda * Math.pow(-Math.log(rng.random()), 1 / P.k),
    mean: (P) => P.lambda * Math.exp(lnGamma(1 + 1 / P.k)),
    variance: (P) => P.lambda * P.lambda * (Math.exp(lnGamma(1 + 2 / P.k)) - Math.exp(2 * lnGamma(1 + 1 / P.k))),
    support: () => [0, Infinity],
    tex: { f: 'f(x)=\\dfrac{k}{\\lambda}\\left(\\dfrac{x}{\\lambda}\\right)^{k-1}e^{-(x/\\lambda)^k}', mean: '\\lambda\\,\\Gamma(1+1/k)', variance: '\\lambda^2[\\Gamma(1+2/k)-\\Gamma(1+1/k)^2]', support: 'x\\ge 0' },
  });

  /* 이산형 */
  function lnChoose(n, k) { return lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1); }

  def({
    id: 'binomial', name: '이항분포', type: 'discrete',
    params: [
      { key: 'N', label: 'N (시행 횟수)', min: 1, max: 100, step: 1, def: 10 },
      { key: 'p', label: 'p (성공 확률)', min: 0.01, max: 0.99, step: 0.01, def: 0.3 },
    ],
    pmf: (k, P) => {
      if (k < 0 || k > P.N || k !== Math.floor(k)) return 0;
      return Math.exp(lnChoose(P.N, k) + k * Math.log(P.p) + (P.N - k) * Math.log1p(-P.p));
    },
    mean: (P) => P.N * P.p, variance: (P) => P.N * P.p * (1 - P.p),
    support: (P) => [0, P.N],
    tex: { f: 'p(x)=\\binom{N}{x}p^{x}(1-p)^{N-x}', mean: 'Np', variance: 'Np(1-p)', support: 'x=0,1,\\dots,N' },
  });

  def({
    id: 'dice', name: '이산균등분포 (주사위)', type: 'discrete',
    params: [
      { key: 'a', label: 'a (가장 작은 값)', min: 0, max: 10, step: 1, def: 1 },
      { key: 'b', label: 'b (가장 큰 값)', min: 1, max: 20, step: 1, def: 6 },
    ],
    fix: (P) => (P.b <= P.a ? { ...P, b: P.a + 1 } : P),
    pmf: (k, P) => (k >= P.a && k <= P.b && k === Math.floor(k) ? 1 / (P.b - P.a + 1) : 0),
    sampler: (rng, P) => () => P.a + Math.floor(rng.random() * (P.b - P.a + 1)),
    mean: (P) => (P.a + P.b) / 2, variance: (P) => ((P.b - P.a + 1) ** 2 - 1) / 12,
    support: (P) => [P.a, P.b],
    tex: { f: 'p(x)=\\dfrac{1}{b-a+1}', mean: '\\dfrac{a+b}{2}', variance: '\\dfrac{(b-a+1)^2-1}{12}', support: 'x=a,a+1,\\dots,b' },
  });

  def({
    id: 'poisson', name: '포아송분포', type: 'discrete',
    params: [{ key: 'lambda', label: 'λ (평균 발생 수)', min: 0.2, max: 30, step: 0.1, def: 3 }],
    pmf: (k, P) => (k < 0 || k !== Math.floor(k) ? 0 : Math.exp(k * Math.log(P.lambda) - P.lambda - lnGamma(k + 1))),
    cdf: (x, P) => { const k = Math.floor(x + 1e-9); return k < 0 ? 0 : gammaQ(k + 1, P.lambda); },
    mean: (P) => P.lambda, variance: (P) => P.lambda,
    support: () => [0, Infinity],
    tex: { f: 'p(x)=\\dfrac{\\lambda^{x}e^{-\\lambda}}{x!}', mean: '\\lambda', variance: '\\lambda', support: 'x=0,1,2,\\dots' },
  });

  def({
    id: 'bernoulli', name: '베르누이분포', type: 'discrete',
    params: [{ key: 'p', label: 'p (성공 확률)', min: 0.01, max: 0.99, step: 0.01, def: 0.3 }],
    pmf: (k, P) => (k === 1 ? P.p : k === 0 ? 1 - P.p : 0),
    sampler: (rng, P) => () => (rng.random() < P.p ? 1 : 0),
    mean: (P) => P.p, variance: (P) => P.p * (1 - P.p),
    support: () => [0, 1],
    tex: { f: 'p(x)=p^{x}(1-p)^{1-x}', mean: 'p', variance: 'p(1-p)', support: 'x=0,1' },
  });

  def({
    id: 'geometric', name: '기하분포', type: 'discrete',
    params: [{ key: 'p', label: 'p (성공 확률)', min: 0.05, max: 0.95, step: 0.01, def: 0.3 }],
    pmf: (k, P) => (k < 1 || k !== Math.floor(k) ? 0 : P.p * Math.pow(1 - P.p, k - 1)),
    cdf: (x, P) => { const k = Math.floor(x + 1e-9); return k < 1 ? 0 : -Math.expm1(k * Math.log1p(-P.p)); },
    sampler: (rng, P) => {
      const l = Math.log1p(-P.p);
      return () => Math.max(1, Math.ceil(Math.log(rng.random()) / l));
    },
    mean: (P) => 1 / P.p, variance: (P) => (1 - P.p) / (P.p * P.p),
    support: () => [1, Infinity],
    tex: { f: 'p(x)=p(1-p)^{x-1}', mean: '1/p', variance: '\\dfrac{1-p}{p^2}', support: 'x=1,2,3,\\dots\\ (\\text{첫 성공까지의 시행 횟수})' },
  });

  /* 혼합형: 0에서 질량 q + 지수분포 (모듈 2 자유 실험실 전용, PRD_module2 5.8) */
  def({
    id: 'waiting', name: '상담 대기 시간 (혼합분포)', type: 'mixed',
    params: [
      { key: 'q', label: 'q (바로 연결될 확률)', min: 0.05, max: 0.9, step: 0.05, def: 0.3 },
      { key: 'lambda', label: 'λ (대기 시간의 비율)', min: 0.2, max: 3, step: 0.1, def: 1 },
    ],
    atoms: (P) => [{ x: 0, p: P.q }],
    pdfCont: (x, P) => (x < 0 ? 0 : (1 - P.q) * P.lambda * Math.exp(-P.lambda * x)),
    pdf: (x, P) => (x < 0 ? 0 : (1 - P.q) * P.lambda * Math.exp(-P.lambda * x)),
    cdf: (x, P) => (x < 0 ? 0 : P.q + (1 - P.q) * -Math.expm1(-P.lambda * x)),
    cdfLeft: (x, P) => (x <= 0 ? 0 : P.q + (1 - P.q) * -Math.expm1(-P.lambda * x)),
    quantile: (p, P) => (p <= P.q ? 0 : -Math.log1p(-(p - P.q) / (1 - P.q)) / P.lambda),
    sampler: (rng, P) => () => (rng.random() < P.q ? 0 : -Math.log(rng.random()) / P.lambda),
    mean: (P) => (1 - P.q) / P.lambda,
    variance: (P) => 2 * (1 - P.q) / (P.lambda * P.lambda) - ((1 - P.q) / P.lambda) ** 2,
    support: () => [0, Infinity],
    tex: { f: 'F(x)=q+(1-q)(1-e^{-\\lambda x}),\\ x\\ge 0', mean: '(1-q)/\\lambda', variance: '\\tfrac{2(1-q)}{\\lambda^2}-\\tfrac{(1-q)^2}{\\lambda^2}', support: 'x\\ge 0\\ (x=0\\text{에 질량 }q)' },
  });

  const byId = Object.fromEntries(list.map((d) => [d.id, d]));

  RVL.dist = {
    list, byId,
    get: (id) => byId[id],
    special: { lnGamma, gammaP, gammaQ, betaI, normPdf, normCdf, normInv },
  };
})(typeof window !== 'undefined' ? window : globalThis);
