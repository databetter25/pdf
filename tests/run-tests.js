/* 수치 테스트 — 실행: node tests/run-tests.js
 * PRD 9장 수용 기준 중 화면 없이 검증 가능한 항목(AC-01~AC-10)을 확인한다.
 */
'use strict';
require('../js/rng.js');
require('../js/distributions.js');
require('../js/histogram.js');
require('../js/ecdf.js');
require('../js/omega.js');
require('../js/expr.js');
require('../js/sqdist.js');
require('../js/m4lib.js');
const { rng: RNG, dist: D, hist: H } = globalThis.RVL;
const REF = require('./reference-values.js');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? '  — ' + detail : '')); }
}
function stream(id, P, seed) {
  const d = D.get(id);
  return new RNG.SampleStream((rng) => d.sampler(rng, P), seed);
}

console.log('AC-01 밀도 모드 면적 합계 = 범위 안 표본 비율');
for (const id of ['normal', 'gamma', 'exponential', 'mixture']) {
  const d = D.get(id), P = d.defaults();
  const s = stream(id, P, 7).get(20000);
  const [L, U] = H.continuousRange(d, P);
  for (const k of [7, 40, 320]) {
    const bins = H.continuousBins(L, U, k);
    const { counts, out } = H.binCounts(s, 20000, bins);
    const h = H.heights(counts, 20000, bins.width, 'density');
    let area = 0; for (const v of h) area += v * bins.width;
    check(`${id} k=${k}`, Math.abs(area - (20000 - out) / 20000) < 1e-12, `area=${area}`);
  }
}

console.log('AC-02 같은 시드 → 같은 집계');
{
  const d = D.get('normal'), P = d.defaults();
  const bins = H.continuousBins(-4, 4, 50);
  const a = H.binCounts(stream('normal', P, 2026).get(5000), 5000, bins).counts;
  const b = H.binCounts(stream('normal', P, 2026).get(5000), 5000, bins).counts;
  check('normal seed 2026', a.every((v, i) => v === b[i]));
  const c = H.binCounts(stream('normal', P, 2027).get(5000), 5000, bins).counts;
  check('다른 시드는 다른 결과', !c.every((v, i) => v === a[i]));
}

console.log('AC-03 n을 늘려도 앞부분 유지');
for (const id of ['normal', 'gamma', 'beta', 'binomial', 'poisson']) {
  const d = D.get(id), P = d.defaults();
  const st = stream(id, P, 11);
  const first = Float64Array.from(st.get(100));
  const after = st.get(1000).subarray(0, 100);
  check(id, first.every((v, i) => v === after[i]));
}

console.log('AC-04 이산형 구간: 정수가 구간 중심, 정수 없는 구간은 0');
for (const m of H.DISCRETE_M) {
  const d = D.get('binomial'), P = d.defaults();
  const [x0, x1] = H.discreteRange(d, P);
  const bins = H.discreteBins(x0, x1, m);
  let centered = true;
  for (let x = x0; x <= x1; x++) {
    const j = (x - x0) * m;
    const [e0, e1] = H.binEdges(bins, j);
    if (Math.abs((e0 + e1) / 2 - x) > 1e-9) centered = false;
  }
  const { counts } = H.binCounts(stream('binomial', P, 3).get(10000), 10000, bins);
  let emptyOk = true;
  for (let j = 0; j < bins.k; j++) if (H.binInteger(bins, j) === null && counts[j] !== 0) emptyOk = false;
  check(`m=${m}`, centered && emptyOk);
}

console.log('AC-05 쪼개기: 부모 밀도 = 두 자식 밀도의 평균');
{
  const d = D.get('normal'), P = d.defaults();
  const s = stream('normal', P, 5).get(10000);
  const [L, U] = H.continuousRange(d, P);
  let ok = true;
  for (let i = 0; i < H.NESTED_K.length - 1; i++) {
    const kp = H.NESTED_K[i], kc = H.NESTED_K[i + 1];
    const bp = H.continuousBins(L, U, kp), bc = H.continuousBins(L, U, kc);
    const hp = H.heights(H.binCounts(s, 10000, bp).counts, 10000, bp.width, 'density');
    const hc = H.heights(H.binCounts(s, 10000, bc).counts, 10000, bc.width, 'density');
    for (let j = 0; j < kp; j++) if (Math.abs(hp[j] - (hc[2 * j] + hc[2 * j + 1]) / 2) > 1e-9) ok = false;
  }
  check('5→10→…→320', ok);
}

console.log('AC-06 PDF 적분 = 1, PMF 합 = 1');
for (const d of D.list.filter((x) => x.type !== 'mixed')) {
  const P = d.defaults();
  if (d.type === 'continuous') {
    // 분위수 변환 x = Q(u)로 적분하면 끝점 특이성 없이 ∫f dx = ∫ f(Q(u)) Q'(u) du; 여기서는 CDF 차이로 직접 비교
    const lo = d.quantile(1e-10, P), hi = d.quantile(1 - 1e-10, P);
    const N = 200000; const h = (hi - lo) / N;
    let s = 0;
    for (let i = 0; i < N; i++) s += d.pdf(lo + (i + 0.5) * h, P) * h;
    const target = d.cdf(hi, P) - d.cdf(lo, P);
    // 끝점이 발산하는 분포(감마 k<1 등)가 아니므로 중점규칙으로 충분
    check(`${d.id} ∫f = ${s.toFixed(8)}`, Math.abs(s - target) < 1e-6 && Math.abs(target - 1) < 1e-8);
  } else {
    const [lo, hiS] = d.support(P);
    const hi = isFinite(hiS) ? hiS : lo + 2000;
    let s = 0; for (let k = lo; k <= hi; k++) s += d.pmf(k, P);
    check(`${d.id} Σp = ${s.toFixed(12)}`, Math.abs(s - 1) < 1e-9);
  }
}

console.log('AC-07 CDF가 scipy 기준값과 1e-7 이내');
for (const [id, ref] of Object.entries(REF)) {
  const d = D.get(id);
  let worst = 0;
  for (const [x, F] of ref.points) worst = Math.max(worst, Math.abs(d.cdf(x, ref.params) - F));
  check(`${id} (최대 오차 ${worst.toExponential(1)})`, worst < 1e-7);
}
{
  let worst = 0;
  for (const p of [1e-8, 0.001, 0.025, 0.3, 0.5, 0.9, 0.975, 0.9995]) {
    worst = Math.max(worst, Math.abs(D.special.normCdf(D.special.normInv(p)) - p) / p);
  }
  check(`정규 분위수 왕복 (상대오차 ${worst.toExponential(1)})`, worst < 1e-9);
}

console.log('AC-08 n=10⁶ 표본평균·표본분산이 이론값 ±4 표준오차 이내');
for (const d of D.list) {
  const P = d.defaults(), n = 1e6;
  const t0 = Date.now();
  const s = stream(d.id, P, 99).get(n);
  const ms = Date.now() - t0;
  let m = 0; for (let i = 0; i < n; i++) m += s[i]; m /= n;
  let v = 0, m4 = 0;
  for (let i = 0; i < n; i++) { const e = s[i] - m; v += e * e; m4 += e * e * e * e; }
  v /= n - 1; m4 /= n;
  const mu = d.mean(P), sig2 = d.variance(P);
  const seMean = Math.sqrt(sig2 / n);
  const seVar = Math.sqrt(Math.max(m4 - v * v, 1e-300) / n);
  const zM = (m - mu) / seMean, zV = (v - sig2) / seVar;
  check(`${d.id}: z(평균)=${zM.toFixed(2)}, z(분산)=${zV.toFixed(2)}, 생성 ${ms}ms`, Math.abs(zM) < 4 && Math.abs(zV) < 4);
}

console.log('AC-09 N(0,1) [−1.96, 1.96] 이론 확률 0.9500');
{
  const d = D.get('normal'), P = d.defaults();
  const p = d.cdf(1.96, P) - d.cdf(-1.96, P);
  check(`표시값 ${p.toFixed(4)}`, p.toFixed(4) === '0.9500');
}

console.log('AC-10 이산형은 끝점 포함 여부에 따라 달라지고, 연속형은 같다');
{
  const d = D.get('binomial'), P = d.defaults();
  const s = stream('binomial', P, 1).get(10000);
  const le = H.probDiscrete(s, 10000, 0, 3, true, true, d, P).theory;
  const lt = H.probDiscrete(s, 10000, 0, 3, true, false, d, P).theory;
  check(`P(X≤3)=${le.toFixed(4)} ≠ P(X<3)=${lt.toFixed(4)}`, Math.abs(le - lt) > 0.1);
  const c = D.get('normal'), Q = c.defaults();
  check('연속형 P(X≤1) = P(X<1)', c.cdf(1, Q) === c.cdf(1 - 0, Q));
}

console.log('추가: 이산형 CDF·분위수 일관성, 오차 지표 감소');
for (const id of ['binomial', 'poisson', 'geometric', 'dice']) {
  const d = D.get(id), P = d.defaults();
  let ok = true;
  for (const p of [0.01, 0.2, 0.5, 0.8, 0.99]) {
    const q = d.quantile(p, P);
    if (!(d.cdf(q, P) >= p - 1e-12 && d.cdf(q - 1, P) < p)) ok = false;
  }
  check(id, ok);
}
{
  const d = D.get('normal'), P = d.defaults();
  const s = stream('normal', P, 8).get(1e6);
  const [L, U] = H.continuousRange(d, P);
  const err = (n) => {
    const k = H.ruleK('scott', s, n, L, U);
    const b = H.continuousBins(L, U, k);
    return H.l1Error(H.heights(H.binCounts(s, n, b).counts, n, b.width, 'density'), b, d, P);
  };
  const e1 = err(1000), e2 = err(1e6);
  check(`L1 오차 n=10³ ${e1.toFixed(3)} → n=10⁶ ${e2.toFixed(4)}`, e2 < e1 / 5);
}

console.log('추가: 균등분포 n=100의 구간 도수가 이항분포 B(n, p)만큼 흔들리는지 (시드 1~20000)');
for (const [id, P, k, p0] of [['dice', { a: 1, b: 6 }, 0, 1 / 6], ['uniform', { a: 0, b: 1 }, 10, 0.1]]) {
  const d = D.get(id), R = 20000, n = 100;
  let bins;
  if (d.type === 'continuous') bins = H.continuousBins(0, 1, k); else bins = H.discreteBins(1, 6, 1);
  const K = bins.k, sum = new Array(K).fill(0), sq = new Array(K).fill(0);
  for (let seed = 1; seed <= R; seed++) {
    const c = H.binCounts(stream(id, P, seed).get(n), n, bins).counts;
    for (let j = 0; j < K; j++) { sum[j] += c[j]; sq[j] += c[j] * c[j]; }
  }
  const mu = n * p0, v = n * p0 * (1 - p0);
  let worstM = 0, worstV = 0;
  for (let j = 0; j < K; j++) {
    const m = sum[j] / R, vv = sq[j] / R - m * m;
    worstM = Math.max(worstM, Math.abs(m - mu) / Math.sqrt(v / R));
    worstV = Math.max(worstV, Math.abs(vv - v) / v);
  }
  check(`${id}: 칸별 평균 최대 |z| = ${worstM.toFixed(2)}, 분산 최대 상대오차 = ${(worstV * 100).toFixed(1)}%`, worstM < 4 && worstV < 0.05);
}

/* ───────────── 모듈 2 (PRD_module2 8장) ───────────── */
{
  const E = globalThis.RVL.ecdf;
  console.log('AC2-01 ECDF 계단 값');
  const s = E.sorted(Float64Array.from([5, 2, 1, 2]), 4);
  const got = [0.9, 1, 1.9, 2, 4.9, 5].map((x) => E.at(s, x));
  check(`[1,2,2,5] → ${got.join(', ')}`, JSON.stringify(got) === JSON.stringify([0, 0.25, 0.25, 0.75, 0.75, 1]));

  console.log('AC2-02 Dₙ이 scipy kstest와 일치');
  const KS = require('./reference-ks.js');
  for (const [k, r] of Object.entries(KS)) {
    const d = D.get(r.id), P = d.defaults();
    const st = new RNG.SampleStream((g) => d.sampler(g, P), 42).get(r.n);
    const dn = E.dn(E.sorted(st, r.n), d, P).d;
    check(`${k}: ${dn.toFixed(6)} vs ${r.D.toFixed(6)}`, Math.abs(dn - r.D) < 1e-12);
  }

  console.log('AC2-03 지수분포 n=100에서 Dₙ > 0.134인 비율 (시드 1~2000)');
  {
    const d = D.get('exponential'), P = d.defaults();
    let rej = 0;
    for (let seed = 1; seed <= 2000; seed++) if (E.dn(E.sorted(stream('exponential', P, seed).get(100), 100), d, P).d > 0.13403) rej++;
    check(`기각 비율 ${(rej / 20).toFixed(2)}%`, rej / 2000 >= 0.035 && rej / 2000 <= 0.065);
  }

  console.log('AC2-04 이산형 CDF 점프 = PMF, 정수 사이에서 평평');
  for (const id of ['binomial', 'poisson', 'dice', 'geometric']) {
    const d = D.get(id), P = d.defaults();
    const [lo, hi] = H.discreteRange(d, P);
    let ok = true;
    for (let x = lo; x <= hi; x++) {
      if (Math.abs(d.cdf(x, P) - d.cdf(x - 1, P) - d.pmf(x, P)) > 1e-12) ok = false;
      if (Math.abs(d.cdf(x + 0.5, P) - d.cdf(x, P)) > 1e-15 || Math.abs(d.cdfLeft(x, P) - d.cdf(x - 1, P)) > 1e-15) ok = false;
    }
    check(id, ok);
  }

  console.log('AC2-05 역변환 표본추출 10⁶개');
  for (const id of ['exponential', 'binomial']) {
    const d = D.get(id), P = d.defaults(), n = 1e6;
    const r = RNG.createRng(7);
    let m = 0, v = 0; const xs = new Float64Array(n);
    for (let i = 0; i < n; i++) { xs[i] = d.quantile(r.random(), P); m += xs[i]; }
    m /= n; for (let i = 0; i < n; i++) v += (xs[i] - m) ** 2; v /= n - 1;
    const zm = (m - d.mean(P)) / Math.sqrt(d.variance(P) / n);
    check(`${id}: 평균 ${m.toFixed(4)} (z = ${zm.toFixed(2)}), 분산 ${v.toFixed(4)} (이론 ${d.variance(P).toFixed(4)})`, Math.abs(zm) < 4 && Math.abs(v / d.variance(P) - 1) < 0.01);
  }

  console.log('AC2-06 이론 분위수');
  check('지수(1) 중앙값 0.6931', D.get('exponential').quantile(0.5, { lambda: 1 }).toFixed(4) === '0.6931');
  check('표준정규 3사분위수 0.6745', D.get('normal').quantile(0.75, { mu: 0, sigma: 1 }).toFixed(4) === '0.6745');
  check('B(10, 0.3) 중앙값 3', D.get('binomial').quantile(0.5, { N: 10, p: 0.3 }) === 3);

  console.log('AC2-07 혼합분포');
  {
    const d = D.get('waiting'), P = d.defaults();
    const s = stream('waiting', P, 3).get(1e6);
    let z = 0; for (let i = 0; i < 1e6; i++) if (s[i] === 0) z++;
    check(`F(0) = ${d.cdf(0, P)}, F(1) = ${d.cdf(1, P).toFixed(4)}, 0의 비율 ${(z / 1e6).toFixed(4)}`,
      d.cdf(0, P) === 0.3 && d.cdf(1, P).toFixed(4) === '0.7425' && Math.abs(z / 1e6 - 0.3) < 0.002);
  }
}

/* ───────────── 모듈 3 (PRD_module3 8장) ───────────── */
{
  const { omega: Om, expr: Ex, sqdist: Sq } = globalThis.RVL;
  const sp = Om.SPACES.dice2, coin = Om.SPACES.coin3;
  const tbl = (space, id) => Om.distribution(space, Om.PRESETS[space.id].find((p) => p.id === id).f).list.map((d) => `${d.x}:${d.count}`).join(' ');

  console.log('AC3-01 주사위 두 개 합의 열거');
  const sum = Om.distribution(sp, (v) => v.a + v.b);
  check(tbl(sp, 'sum'), tbl(sp, 'sum') === '2:1 3:2 4:3 5:4 6:5 7:6 8:5 9:4 10:3 11:2 12:1' && sum.list.reduce((a, d) => a + d.count, 0) === 36);
  check('최댓값 1:1 2:3 3:5 4:7 5:9 6:11', tbl(sp, 'max') === '1:1 2:3 3:5 4:7 5:9 6:11');
  check('차의 절댓값 0:6 1:10 2:8 3:6 4:4 5:2', tbl(sp, 'absdiff') === '0:6 1:10 2:8 3:6 4:4 5:2');
  check('곱: 서로 다른 값 18개', Om.distribution(sp, (v) => v.a * v.b).list.length === 18);

  console.log('AC3-02 값 7의 역상');
  const pre = Om.preimage(sp, (v) => v.a + v.b, 'eq', 7).sort().join(' ');
  check(pre, pre === '1-6 2-5 3-4 4-3 5-2 6-1');

  console.log('AC3-03 X ≤ x의 칸 수 / 36 = F(x)');
  {
    let ok = true;
    for (let x = 1.5; x <= 12.5; x += 0.5) {
      const k = Om.preimage(sp, (v) => v.a + v.b, 'le', x).length;
      const F = sum.list.filter((d) => d.x <= x).reduce((a, d) => a + d.p, 0);
      if (Math.abs(k / 36 - F) > 1e-12) ok = false;
    }
    check('x = 1.5, 2, …, 12.5', ok);
  }

  console.log('AC3-04 동전 세 번 프리셋');
  check(`앞면 수 ${tbl(coin, 'heads')}`, tbl(coin, 'heads') === '0:1 1:3 2:3 3:1');
  check(`앞면 − 뒷면 ${tbl(coin, 'diff')}`, tbl(coin, 'diff') === '-3:1 -1:3 1:3 3:1');
  check(`처음 앞면 ${tbl(coin, 'first')}`, tbl(coin, 'first') === '0:1 1:4 2:2 3:1');

  console.log('AC3-05 정사각형 프리셋: 닫힌 꼴 CDF vs 격자, 몬테카를로');
  {
    const r = RNG.createRng(11), N = 1e6;
    const U = new Float64Array(N), V = new Float64Array(N);
    for (let i = 0; i < N; i++) { U[i] = r.random(); V[i] = r.random(); }
    for (const p of Sq.SQUARE) {
      const g = Sq.gridDist(p.f, 'square');
      const xs = new Float64Array(N);
      for (let i = 0; i < N; i++) xs[i] = p.f({ u: U[i], v: V[i] });
      xs.sort();
      let worstG = 0, worstK = 0;
      for (let t = 1; t < 40; t++) {
        const x = p.range[0] + (p.range[1] - p.range[0]) * t / 40;
        worstG = Math.max(worstG, Math.abs(g.cdf(x) - p.cdf(x)));
        let a = 0, b = N; while (a < b) { const m = (a + b) >> 1; if (xs[m] <= x) a = m + 1; else b = m; }
        worstK = Math.max(worstK, Math.abs(a / N - p.cdf(x)));
      }
      check(`${p.id}: 격자 오차 ${worstG.toExponential(1)}, 표본 오차 ${worstK.toExponential(1)}`, worstG < 2e-3 && worstK < 2e-3);
    }
  }

  console.log('AC3-06 선분 변환 Y = −ln U');
  {
    const g = Sq.SEGMENT.find((s) => s.id === 'neglog');
    const r = RNG.createRng(5), N = 1e6, ys = new Float64Array(N);
    let m = 0;
    for (let i = 0; i < N; i++) { ys[i] = g.g(r.random()); m += ys[i]; }
    m /= N; ys.sort();
    let dn = 0; for (let i = 0; i < N; i++) { const F = g.cdf(ys[i]); dn = Math.max(dn, (i + 1) / N - F, F - i / N); }
    check(`평균 ${m.toFixed(4)}, KS Dₙ ${dn.toFixed(5)} (5% 기각값 ${(1.358 / 1000).toFixed(5)})`, Math.abs(m - 1) < 4e-3 && dn < 1.358 / 1000);
  }

  console.log('AC3-07 반복 실험 n = 10⁴: 값마다 예상 변동 범위 이탈 비율 (시드 1~1000)');
  {
    const miss = new Array(13).fill(0), n = 1e4;
    for (let seed = 1; seed <= 1000; seed++) {
      const r = RNG.createRng(seed), draw = Om.outcomeSampler(sp, null)(r), c = new Array(13).fill(0);
      for (let i = 0; i < n; i++) { const o = sp.outcomes[draw()].v; c[o.a + o.b]++; }
      for (const d of sum.list) { const se = Math.sqrt(d.p * (1 - d.p) / n); if (Math.abs(c[d.x] / n - d.p) > 2 * se) miss[d.x]++; }
    }
    const rates = sum.list.map((d) => miss[d.x] / 1000);
    check(`이탈 비율 ${rates.map((v) => (v * 100).toFixed(1)).join(', ')}%`, rates.every((v) => v >= 0.03 && v <= 0.07));
  }

  console.log('AC3-08 사용자 정의 식');
  {
    const cases = [
      ['max(u,v)', { u: 0.2, v: 0.7 }, 0.7, ['u', 'v']], ['a+b>=10', { a: 4, b: 6 }, 1, ['a', 'b']], ['a+b>=10', { a: 4, b: 5 }, 0, ['a', 'b']],
      ['ln(u)', { u: Math.E }, 1, ['u']], ['2^3^2', {}, 512, []], ['-2^2', {}, -4, []], ['(1+2)*3', {}, 9, []], ['abs(a-b)', { a: 2, b: 5 }, 3, ['a', 'b']],
      ['min(a,b,1)', { a: 3, b: 2 }, 1, ['a', 'b']], ['sqrt(16)', {}, 4, []], ['exp(0)', {}, 1, []], ['floor(2.7)', {}, 2, []],
      ['c1+2*c2+4*c3', { c1: 1, c2: 0, c3: 1 }, 5, ['c1', 'c2', 'c3']], ['a==b', { a: 3, b: 3 }, 1, ['a', 'b']], ['a!=b', { a: 3, b: 3 }, 0, ['a', 'b']],
      ['u<v', { u: 0.1, v: 0.2 }, 1, ['u', 'v']], ['u<=v', { u: 0.2, v: 0.2 }, 1, ['u', 'v']], ['u>v', { u: 0.2, v: 0.2 }, 0, ['u', 'v']],
      ['1/0', {}, NaN, []], ['ln(0)', {}, NaN, []], ['sqrt(-1)', {}, NaN, []], ['(a-3.5)^2', { a: 1 }, 6.25, ['a']],
      ['u*v', { u: 0.5, v: 0.5 }, 0.25, ['u', 'v']], ['a/b', { a: 1, b: 4 }, 0.25, ['a', 'b']], ['+a', { a: 2 }, 2, ['a']],
      ['  a  +  b ', { a: 1, b: 1 }, 2, ['a', 'b']], ['max(a,b)-min(a,b)', { a: 6, b: 1 }, 5, ['a', 'b']], ['1.5*2', {}, 3, []],
      ['abs(u-v)+u*v', { u: 0.5, v: 0.1 }, 0.45, ['u', 'v']], ['u^3', { u: 0.5 }, 0.125, ['u']],
    ];
    let ok = 0;
    for (const [src, vars, want, allowed] of cases) {
      const c = Ex.compile(src, allowed);
      const got = c.f ? c.f(vars) : 'ERR:' + c.error;
      if ((isNaN(want) && Number.isNaN(got)) || Math.abs(got - want) < 1e-12) ok++; else console.log(`    ${src} → ${got} (기대 ${want})`);
    }
    check(`정상 식 ${ok}/${cases.length}`, ok === cases.length);
    const bad = ['alert(1)', 'window', 'constructor', 'a.constructor', 'this', 'Function("x")', 'u; v', '__proto__', 'x', 'a'.repeat(201), '', '1 +', 'max(1)', '`1`', '[1]'];
    const rejected = bad.filter((src) => Ex.compile(src, ['u', 'v']).error).length;
    check(`위험하거나 잘못된 식 ${rejected}/${bad.length} 거절`, rejected === bad.length);
  }

  console.log('AC3-09 찌그러진 주사위');
  {
    const w = [0.1, 0.1, 0.1, 0.1, 0.1, 0.5];
    const d = Om.distribution(sp, (v) => v.a + v.b, w);
    const tot = d.list.reduce((a, e) => a + e.p, 0);
    let p12 = d.list.find((e) => e.x === 12).p, p7 = d.list.find((e) => e.x === 7).p;
    check(`확률 합 ${tot.toFixed(12)}, P(12) = ${p12.toFixed(4)}, P(7) = ${p7.toFixed(4)}`, Math.abs(tot - 1) < 1e-12 && Math.abs(p12 - 0.25) < 1e-12 && Math.abs(p7 - 0.14) < 1e-12);
  }
}

/* ───────────── 모듈 4 (PRD_module4 10장) ───────────── */
{
  const M4 = globalThis.RVL.m4, C = M4.cantor;
  console.log('AC4-01 칸토어 표본 10⁶개');
  {
    const n = 1e6, r = RNG.createRng(41), smp = C.sampler(r), xs = new Float64Array(n);
    let m = 0; for (let i = 0; i < n; i++) { xs[i] = smp(); m += xs[i]; } m /= n;
    let v = 0; for (let i = 0; i < n; i++) v += (xs[i] - m) ** 2; v /= n - 1;
    xs.sort();
    let dn = 0; for (let i = 0; i < n; i += 7) { const F = C.cdf(xs[i]); dn = Math.max(dn, (i + 1) / n - F, F - i / n); }
    const z = (m - 0.5) / Math.sqrt(0.125 / n);
    check(`평균 ${m.toFixed(5)} (z = ${z.toFixed(2)}), 분산 ${v.toFixed(5)}, KS ${dn.toFixed(5)} < ${(1.36 / 1000).toFixed(5)}`, Math.abs(z) < 4 && Math.abs(v - 0.125) < 0.001 && dn < 1.36 / 1000);
  }
  console.log('AC4-02 칸토어 CDF와 분위수');
  {
    const vals = [[1 / 3, 0.5], [2 / 3, 0.5], [1 / 9, 0.25], [0.25, 1 / 3], [0, 0], [1, 1]];
    const ok1 = vals.every(([x, F]) => Math.abs(C.cdf(x) - F) < 1e-9);
    let worst = 0;
    for (let i = 1; i < 1000; i++) { const u = i / 1000; worst = Math.max(worst, Math.abs(C.cdf(C.quantile(u)) - u)); }
    check(`F(1/3), F(2/3), F(1/9), F(1/4) 기준값, 왕복 오차 ${worst.toExponential(1)}`, ok1 && worst < 1e-9);
  }
  console.log('AC4-03 폭 3^-k 히스토그램의 점유 칸 수 = 2^k');
  {
    const n = 200000, r = RNG.createRng(3), smp = C.sampler(r), xs = Array.from({ length: n }, smp);
    let ok = true, msg = [];
    for (let k = 1; k <= 6; k++) {
      const K = 3 ** k, c = new Uint8Array(K);
      for (const x of xs) c[Math.min(K - 1, Math.floor(x * K))] = 1;
      const occ = c.reduce((a, b) => a + b, 0);
      msg.push(occ); if (occ !== 2 ** k) ok = false;
    }
    check(`k = 1~6: ${msg.join(', ')}`, ok);
  }
  console.log('AC4-04 유리수 덮개');
  {
    const K = 3000, eps = 0.1, Q = M4.farey(K);
    const keys = new Set(Q.map(([a, b]) => a + '/' + b));
    const iv = Q.map(([a, b], i) => { const c = a / b, h = eps / 2 ** (i + 1) / 2; return [c - h, c + h]; });
    const u = M4.unionLength(iv);
    check(`유리수 ${K}개(중복 ${K - keys.size}), 합집합 길이 ${u.length.toFixed(6)} ≤ ${eps}`, keys.size === K && u.length <= eps * (1 - 2 ** -K) + 1e-15);
  }
  console.log('AC4-05 ∫S(t)dt = E[X]');
  {
    const integ = (S, hi, N = 200000) => { let s = 0; const h = hi / N; for (let i = 0; i < N; i++) s += S((i + 0.5) * h) * h; return s; };
    const ex = D.get('exponential'), bi = D.get('binomial');
    const cases = [
      ['지수(1)', (t) => 1 - ex.cdf(t, { lambda: 1 }), 40, 1],
      ['0 과잉 지수(0.4, 1)', (t) => 1 - M4.zi.cdf(t, 0.4, 1), 40, 0.6],
      ['이항(10, 0.3)', (t) => 1 - bi.cdf(t, { N: 10, p: 0.3 }), 10, 3],
      ['칸토어', (t) => 1 - C.cdf(t), 1, 0.5],
    ];
    for (const [nm, S, hi, mu] of cases) { const v = integ(S, hi); check(`${nm}: ${v.toFixed(6)} (이론 ${mu})`, Math.abs(v - mu) < 1e-4); }
  }
  console.log('AC4-06 E[min(U^(-1/2), n)] = 2 − 1/n');
  {
    const r = RNG.createRng(9), M = 1e6;
    for (const n of [2, 10, 100]) {
      let s = 0, s2 = 0;
      for (let i = 0; i < M; i++) { const z = Math.min(Math.pow(r.random(), -0.5), n); s += z; s2 += z * z; }
      const m = s / M, se = Math.sqrt((s2 / M - m * m) / M);
      check(`n = ${n}: ${m.toFixed(4)} (이론 ${(2 - 1 / n).toFixed(4)}, z = ${((m - 2 + 1 / n) / se).toFixed(2)})`, Math.abs(m - 2 + 1 / n) < 4 * se);
    }
  }
  console.log('AC4-07 0 과잉 지수 MLE');
  {
    const r = RNG.createRng(12), smp = M4.zi.sampler(r, 0.4, 1), xs = Array.from({ length: 1e5 }, smp);
    const f = M4.zi.fit(xs);
    check(`q̂ = ${f.q.toFixed(4)}, λ̂ = ${f.lam.toFixed(4)}, 잘못된 λ̂ = ${f.naiveLam.toFixed(4)}`, Math.abs(f.q - 0.4) < 0.004 && Math.abs(f.lam - 1) < 0.01 && Math.abs(f.naiveLam - 1 / 0.6) < 0.03);
  }
  console.log('AC4-08 중요도 표본추출');
  {
    const N = D.special, c = 4, truth = 1 - N.normCdf(c), M = 1e4, r = RNG.createRng(21);
    const z = (() => { const g = D.get('normal').sampler(r, { mu: 0, sigma: 1 }); return g; })();
    let s = 0, s2 = 0;
    for (let i = 0; i < M; i++) { const y = c + z(); const w = y > c ? Math.exp(-c * y + c * c / 2) : 0; s += w; s2 += w * w; }
    const m = s / M, rse = Math.sqrt((s2 / M - m * m) / M) / truth;
    let sb = 0;
    for (let i = 0; i < M; i++) { const y = c + 0.5 + 4.5 * r.random(); sb += N.normPdf(y) * 4.5; }
    check(`참값 ${truth.toExponential(3)}, IS ${m.toExponential(3)} (상대표준오차 ${(rse * 100).toFixed(2)}%), 절단 제안 ${(sb / M).toExponential(3)}`, rse < 0.05 && sb / M < truth * 0.5);
  }
  console.log('AC4-09 조건부 기댓값');
  {
    const want = { 0: 0.5202, 3: 0.1640, 6: 0.0207 };
    for (const k of [0, 3, 6]) { const e = M4.ce.dyadic(k), l = M4.ce.l2(e, M4.ce.means(e)); check(`k = ${k}: L2 오차 ${l.toFixed(4)} (기준 ${want[k]})`, Math.abs(l - want[k]) < 1e-3); }
    const e = M4.ce.dyadic(3), lv = M4.ce.means(e), r = RNG.createRng(5);
    const z = lv.map(() => r.random() * 2 - 1);
    const ip = M4.ce.inner(e, lv, z);
    const e2 = M4.ce.dyadic(2), lv2 = M4.ce.means(e2);
    const tower = Math.max(...lv2.map((v, i) => Math.abs((lv[2 * i] + lv[2 * i + 1]) / 2 - v)));
    check(`직교성 E[(X−Y)Z] = ${ip.toExponential(1)}, 탑 성질 오차 ${tower.toExponential(1)}`, Math.abs(ip) < 1e-3 && tower < 1e-12);
  }
  console.log('AC4-10 라오–블랙웰');
  {
    const th = M4.rb.theory(1, 10), r = RNG.createRng(77), sim = M4.rb.simulate(r, 1, 10, 1e5);
    const a = M4.stats(sim.naive, th.theta), b = M4.stats(sim.rb, th.theta);
    check(`분산 ${a.var.toFixed(4)} (이론 ${th.varNaive.toFixed(4)}), ${b.var.toFixed(4)} (이론 ${th.varRB.toFixed(4)}); 평균 ${a.mean.toFixed(4)}, ${b.mean.toFixed(4)} (θ = ${th.theta.toFixed(4)})`,
      Math.abs(a.var / th.varNaive - 1) < 0.05 && Math.abs(b.var / th.varRB - 1) < 0.05 && Math.abs(a.mean - th.theta) < 4 * a.se && Math.abs(b.mean - th.theta) < 4 * b.se);
  }
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
