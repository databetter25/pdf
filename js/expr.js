/* 사용자 정의 확률변수 식 파서 (PRD_module3 5.6)
 * eval·Function을 쓰지 않는다. 재귀 하강 파서로 식을 트리로 바꾸고, 허용된 변수·함수만 평가한다.
 *   연산: + - * / ^ ( )   비교: < <= > >= == != (참 1, 거짓 0)
 *   함수: abs max min sqrt ln exp floor
 *   compile(src, allowedVars) → { f(vars), error }
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});
  const FUNCS = {
    abs: { n: [1, 1], f: Math.abs }, sqrt: { n: [1, 1], f: Math.sqrt }, ln: { n: [1, 1], f: Math.log },
    exp: { n: [1, 1], f: Math.exp }, floor: { n: [1, 1], f: Math.floor },
    max: { n: [2, 8], f: Math.max }, min: { n: [2, 8], f: Math.min },
  };
  const MAXLEN = 200;

  function tokenize(src) {
    const toks = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
        const v = Number(src.slice(i, j));
        if (!isFinite(v)) throw new Error(`숫자 ‘${src.slice(i, j)}’를 읽을 수 없습니다.`);
        toks.push({ t: 'num', v }); i = j; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i; while (j < src.length && /[A-Za-z_0-9]/.test(src[j])) j++;
        toks.push({ t: 'id', v: src.slice(i, j) }); i = j; continue;
      }
      const two = src.slice(i, i + 2);
      if (['<=', '>=', '==', '!='].includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
      if ('+-*/^(),<>'.includes(c)) { toks.push({ t: c === '(' || c === ')' || c === ',' ? c : 'op', v: c }); i++; continue; }
      throw new Error(`‘${c}’ 기호는 쓸 수 없습니다.`);
    }
    return toks;
  }

  function compile(src, allowedVars) {
    try {
      if (typeof src !== 'string' || !src.trim()) throw new Error('식을 입력하세요.');
      if (src.length > MAXLEN) throw new Error(`식은 ${MAXLEN}자 이내로 쓰세요.`);
      const toks = tokenize(src);
      let p = 0;
      const peek = () => toks[p];
      const take = (t, v) => {
        const k = toks[p];
        if (!k || k.t !== t || (v !== undefined && k.v !== v)) throw new Error(v ? `‘${v}’가 필요합니다.` : '식이 완전하지 않습니다.');
        p++; return k;
      };
      const allowedMsg = () => `${allowedVars.join(', ')}와 ${Object.keys(FUNCS).join(', ')}만 쓸 수 있습니다.`;

      function primary() {
        const k = peek();
        if (!k) throw new Error('식이 완전하지 않습니다.');
        if (k.t === 'num') { p++; const v = k.v; return () => v; }
        if (k.t === '(') { p++; const e = expr(); take(')'); return e; }
        if (k.t === 'id') {
          p++;
          if (peek() && peek().t === '(') {
            const fn = Object.prototype.hasOwnProperty.call(FUNCS, k.v) ? FUNCS[k.v] : null;
            if (!fn) throw new Error(`‘${k.v}’ 함수는 없습니다. ${allowedMsg()}`);
            p++;
            const args = [];
            if (peek() && peek().t !== ')') { args.push(expr()); while (peek() && peek().t === ',') { p++; args.push(expr()); } }
            take(')');
            if (args.length < fn.n[0] || args.length > fn.n[1]) throw new Error(`${k.v}()의 인수 개수가 맞지 않습니다.`);
            const f = fn.f;
            return (vars) => f(...args.map((a) => a(vars)));
          }
          if (!allowedVars.includes(k.v)) throw new Error(`‘${k.v}’는 쓸 수 없는 이름입니다. ${allowedMsg()}`);
          const name = k.v;
          return (vars) => vars[name];
        }
        throw new Error(`‘${k.v}’ 위치가 잘못되었습니다.`);
      }
      function unary() {
        const k = peek();
        if (k && k.t === 'op' && (k.v === '-' || k.v === '+')) { p++; const e = unary(); return k.v === '-' ? (v) => -e(v) : e; }
        return power();
      }
      function power() {
        const b = primary();
        const k = peek();
        if (k && k.t === 'op' && k.v === '^') { p++; const e = unary(); return (v) => Math.pow(b(v), e(v)); }
        return b;
      }
      function mul() {
        let l = unary();
        for (;;) {
          const k = peek();
          if (k && k.t === 'op' && (k.v === '*' || k.v === '/')) {
            p++; const r = unary(), a = l;
            l = k.v === '*' ? (v) => a(v) * r(v) : (v) => { const d = r(v); return d === 0 ? NaN : a(v) / d; };
          } else return l;
        }
      }
      function add() {
        let l = mul();
        for (;;) {
          const k = peek();
          if (k && k.t === 'op' && (k.v === '+' || k.v === '-')) { p++; const r = mul(), a = l; l = k.v === '+' ? (v) => a(v) + r(v) : (v) => a(v) - r(v); }
          else return l;
        }
      }
      function expr() {
        const l = add();
        const k = peek();
        if (k && k.t === 'op' && ['<', '<=', '>', '>=', '==', '!='].includes(k.v)) {
          p++; const r = add();
          const op = k.v;
          return (v) => {
            const A = l(v), B = r(v), eq = Math.abs(A - B) < 1e-9;
            return (op === '<' ? A < B && !eq : op === '<=' ? A <= B || eq : op === '>' ? A > B && !eq : op === '>=' ? A >= B || eq : op === '==' ? eq : !eq) ? 1 : 0;
          };
        }
        return l;
      }
      const e = expr();
      if (p < toks.length) throw new Error(`‘${toks[p].v}’ 부근을 읽을 수 없습니다.`);
      return { f: (vars) => { const r = e(vars); return typeof r === 'number' && isFinite(r) ? r : NaN; }, error: null };
    } catch (err) {
      return { f: null, error: err.message };
    }
  }

  RVL.expr = { compile, FUNCS };
})(typeof window !== 'undefined' ? window : globalThis);
