/* 표본공간과 확률변수 (PRD_module3 5.5, 5.8)
 *   SPACES       표본공간 정의 (유한: 주사위 2개·동전 3번·주사위 1개 / 연속: 정사각형·선분)
 *   PRESETS      표본공간별 확률변수 프리셋
 *   distribution 유한 표본공간에서 모든 결과를 열거해 X의 분포를 정확히 계산
 *   preimage     역상 {ω : X(ω) ∈ 조건}
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});

  const dice2 = [];
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) dice2.push({ id: `${a}-${b}`, v: { a, b }, label: `(${a}, ${b})`, row: a - 1, col: b - 1 });
  const coin3 = [];
  for (let i = 0; i < 8; i++) {
    const c1 = (i & 4) ? 0 : 1, c2 = (i & 2) ? 0 : 1, c3 = (i & 1) ? 0 : 1; // HHH부터 TTT 순서
    const label = [c1, c2, c3].map((c) => (c ? 'H' : 'T')).join('');
    coin3.push({ id: label, v: { c1, c2, c3 }, label, row: i < 4 ? 0 : 1, col: i % 4 });
  }
  const dice1 = [];
  for (let a = 1; a <= 6; a++) dice1.push({ id: `${a}`, v: { a }, label: `${a}`, row: 0, col: a - 1 });

  const SPACES = {
    dice2: { id: 'dice2', name: '주사위 두 개', kind: 'finite', vars: ['a', 'b'], rows: 6, cols: 6, outcomes: dice2, loaded: true,
      desc: '첫째 주사위 눈 a, 둘째 주사위 눈 b. 결과 36가지' },
    coin3: { id: 'coin3', name: '동전 세 번', kind: 'finite', vars: ['c1', 'c2', 'c3'], rows: 2, cols: 4, outcomes: coin3, loaded: false,
      desc: 'H = 앞면(1), T = 뒷면(0). 결과 8가지' },
    dice1: { id: 'dice1', name: '주사위 한 개', kind: 'finite', vars: ['a'], rows: 1, cols: 6, outcomes: dice1, loaded: true,
      desc: '주사위 눈 a. 결과 6가지' },
    square: { id: 'square', name: '정사각형 위의 점', kind: 'square', vars: ['u', 'v'], desc: '[0, 1] × [0, 1] 위의 무작위 점 (u, v). 넓이 = 확률' },
    segment: { id: 'segment', name: '선분 위의 점', kind: 'segment', vars: ['u'], desc: '[0, 1] 위의 무작위 점 u (균등분포)' },
  };

  const firstHead = (o) => (o.c1 ? 1 : o.c2 ? 2 : o.c3 ? 3 : 0);
  const longestRun = (o) => { let best = 0, cur = 0; for (const c of [o.c1, o.c2, o.c3]) { cur = c ? cur + 1 : 0; best = Math.max(best, cur); } return best; };
  const PRESETS = {
    dice2: [
      { id: 'sum', name: '두 눈의 합', tex: 'X(a,b)=a+b', f: (o) => o.a + o.b },
      { id: 'max', name: '큰 눈 (최댓값)', tex: 'X(a,b)=\\max(a,b)', f: (o) => Math.max(o.a, o.b) },
      { id: 'min', name: '작은 눈 (최솟값)', tex: 'X(a,b)=\\min(a,b)', f: (o) => Math.min(o.a, o.b) },
      { id: 'absdiff', name: '두 눈의 차 (절댓값)', tex: 'X(a,b)=|a-b|', f: (o) => Math.abs(o.a - o.b) },
      { id: 'prod', name: '두 눈의 곱', tex: 'X(a,b)=ab', f: (o) => o.a * o.b },
      { id: 'first', name: '첫째 주사위의 눈', tex: 'X(a,b)=a', f: (o) => o.a },
      { id: 'ind7', name: '합이 7이면 1, 아니면 0', tex: 'X(a,b)=\\mathbf 1\\{a+b=7\\}', f: (o) => (o.a + o.b === 7 ? 1 : 0) },
    ],
    coin3: [
      { id: 'heads', name: '앞면의 수', tex: 'X=c_1+c_2+c_3', f: (o) => o.c1 + o.c2 + o.c3 },
      { id: 'diff', name: '앞면 수 − 뒷면 수', tex: 'X=(c_1+c_2+c_3)-(3-c_1-c_2-c_3)', f: (o) => 2 * (o.c1 + o.c2 + o.c3) - 3 },
      { id: 'first', name: '처음 앞면이 나온 시행 (없으면 0)', tex: 'X=\\min\\{i: c_i=1\\}\\ (\\text{없으면 }0)', f: firstHead },
      { id: 'run', name: '가장 긴 연속 앞면 길이', tex: 'X=\\text{가장 긴 연속 H의 길이}', f: longestRun },
    ],
    dice1: [
      { id: 'face', name: '주사위 눈', tex: 'X(a)=a', f: (o) => o.a },
      { id: 'even', name: '짝수면 1, 홀수면 0', tex: 'X(a)=\\mathbf 1\\{a\\text{ 짝수}\\}', f: (o) => (o.a % 2 === 0 ? 1 : 0) },
      { id: 'sq', name: '(눈 − 3)²', tex: 'X(a)=(a-3)^2', f: (o) => (o.a - 3) ** 2 },
    ],
  };

  function outcomeProb(space, o, weights) {
    if (space.id === 'dice2') return weights ? weights[o.v.a - 1] * weights[o.v.b - 1] : 1 / 36;
    if (space.id === 'dice1') return weights ? weights[o.v.a - 1] : 1 / 6;
    return 1 / space.outcomes.length;
  }

  /** X의 분포: [{x, p, count, cells:[id]}] (x 오름차순), invalid: 값이 정의되지 않은 결과 */
  function distribution(space, f, weights) {
    const map = new Map();
    const invalid = [];
    for (const o of space.outcomes) {
      let x;
      try { x = f(o.v); } catch (e) { x = NaN; }
      if (!isFinite(x)) { invalid.push(o.id); continue; }
      x = +x.toPrecision(12);
      const e = map.get(x) || { x, p: 0, count: 0, cells: [] };
      e.p += outcomeProb(space, o, weights);
      e.count += 1;
      e.cells.push(o.id);
      map.set(x, e);
    }
    const list = [...map.values()].sort((a, b) => a.x - b.x);
    return { list, invalid, N: space.outcomes.length, uniform: !weights || weights.every((w) => Math.abs(w - weights[0]) < 1e-12) };
  }

  /** 역상: mode 'eq' | 'le' | 'int' */
  function preimage(space, f, mode, x, a, b) {
    const ids = [];
    for (const o of space.outcomes) {
      let v;
      try { v = f(o.v); } catch (e) { v = NaN; }
      if (!isFinite(v)) continue;
      const ok = mode === 'eq' ? Math.abs(v - x) < 1e-9 : mode === 'le' ? v <= x + 1e-9 : (v > a + 1e-9 && v <= b + 1e-9);
      if (ok) ids.push(o.id);
    }
    return ids;
  }

  /** 결과 표본추출기: 결과의 인덱스를 돌려준다 */
  function outcomeSampler(space, weights) {
    return (rng) => {
      const cum = [];
      if (space.loaded) { let s = 0; for (const w of (weights || [1, 1, 1, 1, 1, 1].map((x) => x / 6))) { s += w; cum.push(s); } cum[5] = 1; }
      const die = () => { const u = rng.random(); let i = 0; while (i < 5 && u > cum[i]) i++; return i; };
      if (space.id === 'dice2') return () => die() * 6 + die();
      if (space.id === 'dice1') return () => die();
      return () => Math.floor(rng.random() * space.outcomes.length);
    };
  }

  RVL.omega = { SPACES, PRESETS, distribution, preimage, outcomeProb, outcomeSampler };
})(typeof window !== 'undefined' ? window : globalThis);
