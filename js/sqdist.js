/* 정사각형·선분 표본공간 위 확률변수의 분포 (PRD_module3 5.7)
 * 프리셋은 닫힌 꼴 CDF·PDF를, 사용자 정의 식은 격자 수치 CDF를 쓴다.
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});
  const R2 = Math.SQRT2;

  const SQUARE = [
    { id: 'u', name: '가로 좌표 u', tex: 'X(u,v)=u', f: (o) => o.u, range: [0, 1],
      cdf: (x) => Math.max(0, Math.min(1, x)), pdf: (x) => (x >= 0 && x <= 1 ? 1 : 0) },
    { id: 'sum', name: '두 좌표의 합 u + v', tex: 'X(u,v)=u+v', f: (o) => o.u + o.v, range: [0, 2],
      cdf: (x) => (x <= 0 ? 0 : x <= 1 ? x * x / 2 : x <= 2 ? 1 - (2 - x) ** 2 / 2 : 1), pdf: (x) => (x < 0 || x > 2 ? 0 : x <= 1 ? x : 2 - x) },
    { id: 'max', name: '큰 좌표 max(u, v)', tex: 'X(u,v)=\\max(u,v)', f: (o) => Math.max(o.u, o.v), range: [0, 1],
      cdf: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x), pdf: (x) => (x < 0 || x > 1 ? 0 : 2 * x) },
    { id: 'min', name: '작은 좌표 min(u, v)', tex: 'X(u,v)=\\min(u,v)', f: (o) => Math.min(o.u, o.v), range: [0, 1],
      cdf: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - (1 - x) ** 2), pdf: (x) => (x < 0 || x > 1 ? 0 : 2 * (1 - x)) },
    { id: 'prod', name: '두 좌표의 곱 uv', tex: 'X(u,v)=uv', f: (o) => o.u * o.v, range: [0, 1],
      cdf: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x - x * Math.log(x)), pdf: (x) => (x <= 0 || x > 1 ? 0 : -Math.log(x)) },
    { id: 'absdiff', name: '두 좌표의 차 |u − v|', tex: 'X(u,v)=|u-v|', f: (o) => Math.abs(o.u - o.v), range: [0, 1],
      cdf: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - (1 - x) ** 2), pdf: (x) => (x < 0 || x > 1 ? 0 : 2 * (1 - x)) },
    { id: 'dist', name: '원점까지의 거리 √(u² + v²)', tex: 'X(u,v)=\\sqrt{u^2+v^2}', f: (o) => Math.hypot(o.u, o.v), range: [0, R2],
      cdf: (x) => (x <= 0 ? 0 : x <= 1 ? Math.PI * x * x / 4 : x < R2 ? Math.sqrt(x * x - 1) + x * x * (Math.PI / 4 - Math.acos(1 / x)) : 1),
      pdf: (x) => (x <= 0 ? 0 : x <= 1 ? Math.PI * x / 2 : x < R2 ? x * (Math.PI / 2 - 2 * Math.acos(1 / x)) : 0) },
  ];

  const N = () => RVL.dist.special;
  const SEGMENT = [
    { id: 'twoU', name: 'Y = 2U (늘이기)', tex: 'Y=2U', g: (u) => 2 * u, range: [0, 2], inc: true,
      cdf: (y) => Math.max(0, Math.min(1, y / 2)), pdf: (y) => (y >= 0 && y <= 2 ? 0.5 : 0) },
    { id: 'sq', name: 'Y = U² (제곱)', tex: 'Y=U^2', g: (u) => u * u, range: [0, 1], inc: true,
      cdf: (y) => (y <= 0 ? 0 : y >= 1 ? 1 : Math.sqrt(y)), pdf: (y) => (y <= 0 || y > 1 ? 0 : 1 / (2 * Math.sqrt(y))) },
    { id: 'sqrt', name: 'Y = √U (제곱근)', tex: 'Y=\\sqrt U', g: (u) => Math.sqrt(u), range: [0, 1], inc: true,
      cdf: (y) => (y <= 0 ? 0 : y >= 1 ? 1 : y * y), pdf: (y) => (y < 0 || y > 1 ? 0 : 2 * y) },
    { id: 'neglog', name: 'Y = −ln U (지수분포)', tex: 'Y=-\\ln U', g: (u) => -Math.log(u), range: [0, 6], inc: false,
      cdf: (y) => (y <= 0 ? 0 : -Math.expm1(-y)), pdf: (y) => (y < 0 ? 0 : Math.exp(-y)) },
    { id: 'normq', name: 'Y = Φ⁻¹(U) (표준정규 분위수)', tex: 'Y=\\Phi^{-1}(U)', g: (u) => N().normInv(u), range: [-3.5, 3.5], inc: true,
      cdf: (y) => N().normCdf(y), pdf: (y) => N().normPdf(y) },
  ];

  /** 사용자 정의 식의 격자 분포: G×G 중점에서 값을 구해 정렬 (넓이 근사) */
  function gridDist(f, kind, G = 400) {
    const vals = [];
    let invalid = 0;
    if (kind === 'square') {
      for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
        const v = f({ u: (i + 0.5) / G, v: (j + 0.5) / G });
        if (isFinite(v)) vals.push(v); else invalid++;
      }
    } else {
      const M = G * G;
      for (let i = 0; i < M; i++) { const v = f({ u: (i + 0.5) / M }); if (isFinite(v)) vals.push(v); else invalid++; }
    }
    const s = Float64Array.from(vals).sort();
    const total = s.length + invalid;
    const lo = s.length ? s[0] : 0, hi = s.length ? s[s.length - 1] : 1;
    const countLE = (x) => { let a = 0, b = s.length; while (a < b) { const m = (a + b) >> 1; if (s[m] <= x) a = m + 1; else b = m; } return a; };
    return {
      sorted: s, invalid, invalidFrac: invalid / total, range: [lo, hi === lo ? lo + 1 : hi],
      cdf: (x) => countLE(x) / total,
      pdf: (x, h) => { h = h || (hi - lo) / 80 || 0.01; return (countLE(x + h / 2) - countLE(x - h / 2)) / total / h; },
      distinct: (() => { let c = 0; for (let i = 0; i < s.length && c <= 60; i++) if (i === 0 || s[i] !== s[i - 1]) c++; return c; })(),
    };
  }

  RVL.sqdist = { SQUARE, SEGMENT, gridDist };
})(typeof window !== 'undefined' ? window : globalThis);
