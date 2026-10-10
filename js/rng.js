/* 시드 고정 난수 생성기와 표본 버퍼
 * - xoshiro128** (32비트 연산) 두 번을 묶어 53비트 정밀도의 (0,1) 균등난수를 만든다.
 * - SampleStream은 한 분포·모수·시드 조합의 표본을 앞에서부터 차례로 쌓는다.
 *   n을 늘려도 앞부분은 그대로 유지된다 (PRD F-03).
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});

  function splitmix32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x9e3779b9) | 0;
      let t = a ^ (a >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t = t ^ (t >>> 15);
      t = Math.imul(t, 0x735a2d97);
      return (t ^ (t >>> 15)) >>> 0;
    };
  }

  function createRng(seed) {
    const sm = splitmix32(seed);
    let a = sm(), b = sm(), c = sm(), d = sm();
    if ((a | b | c | d) === 0) a = 1;
    function nextU32() {
      const t = b << 9;
      let r = Math.imul(b, 5);
      r = (r << 7) | (r >>> 25);
      r = Math.imul(r, 9);
      c ^= a; d ^= b; b ^= c; a ^= d; c ^= t;
      d = (d << 11) | (d >>> 21);
      return r >>> 0;
    }
    return {
      nextU32,
      /** (0,1) 열린 구간의 균등난수, 53비트 정밀도 */
      random() {
        const hi = nextU32() >>> 5;   // 27 bits
        const lo = nextU32() >>> 6;   // 26 bits
        return (hi * 67108864 + lo + 0.5) / 9007199254740992;
      },
    };
  }

  class SampleStream {
    /**
     * @param {(rng)=>()=>number} makeSampler 난수 생성기를 받아 표본 하나를 돌려주는 함수를 만든다
     * @param {number} seed
     */
    constructor(makeSampler, seed) {
      this.rng = createRng(seed);
      this.draw = makeSampler(this.rng);
      this.buf = new Float64Array(1024);
      this.len = 0;
    }
    ensure(n) {
      if (n <= this.len) return;
      if (n > this.buf.length) {
        let cap = this.buf.length;
        while (cap < n) cap *= 2;
        const nb = new Float64Array(cap);
        nb.set(this.buf.subarray(0, this.len));
        this.buf = nb;
      }
      const buf = this.buf, draw = this.draw;
      for (let i = this.len; i < n; i++) buf[i] = draw();
      this.len = n;
    }
    /** 앞에서부터 n개 (복사하지 않은 view) */
    get(n) {
      this.ensure(n);
      return this.buf.subarray(0, n);
    }
  }

  RVL.rng = { createRng, SampleStream };
})(typeof window !== 'undefined' ? window : globalThis);
