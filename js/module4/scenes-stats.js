/* 모듈 4C 측도론 위의 수리통계학 (PRD_module4 5장 C1~C4) */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});
  const scenes = ((RVL.m4scenes = RVL.m4scenes || {}).stats = []);
  const U = () => RVL.m4ui;

  /* ════════════════ C1 라돈–니코딤 도함수와 가능도 ════════════════ */
  scenes.push({
    id: 'C1', title: '라돈–니코딤 도함수와 가능도',
    card: {
      do: '하루 강수량처럼 “0이 자주 나오고, 0이 아니면 연속값”인 자료를 만들었습니다. P(X = 0) = q, X > 0이면 (1 − q)λe<sup>−λx</sup>입니다. q, λ, n을 바꿔 보며 두 가지 최대가능도 추정을 비교하세요.',
      see: '기준 측도를 ν = δ<sub>0</sub> + λ(0의 점 하나 + 길이)로 잡으면 이 분포의 밀도 dP/dν는 0에서 q, 양수에서 (1 − q)λe<sup>−λx</sup>인 <b>함수 하나</b>이고, 가능도는 그 곱입니다. 결과 q̂ = n₀/n, λ̂ = n₊/Σx는 참값 근처입니다. 모든 자료를 지수분포로 본 추정은 λ̂ ≈ λ/(1 − q)로 크게 빗나갑니다(q = 0.4면 약 1.67배).',
      ask: '지수분포 가능도 ∏λe<sup>−λxᵢ</sup>에 x = 0을 넣으면 λ가 나옵니다. 이 값은 “확률”인가요, “밀도”인가요? 0에 있는 확률 q와 비교해 무엇이 잘못됐나요?',
      math: '모형 $\\{P_\\theta\\}$가 공통 σ-유한 측도 ν에 대해 $P_\\theta\\ll\\nu$이면 <b>가능도</b>는 $$L(\\theta;x_1,\\dots,x_n)=\\prod_i\\frac{dP_\\theta}{d\\nu}(x_i)$$ 여기서 $\\frac{dP}{d\\nu}(0)=q$, $\\frac{dP}{d\\nu}(x)=(1-q)\\lambda e^{-\\lambda x}$ ($x>0$). 그러면 $\\log L=n_0\\log q+n_+\\log(1-q)+n_+\\log\\lambda-\\lambda\\sum x_i$. 또 $E[g(X)]=\\int g\\,\\frac{dP}{d\\nu}\\,d\\nu=q\\,g(0)+(1-q)\\int_0^\\infty g(x)\\lambda e^{-\\lambda x}dx$.',
    },
    actions: [
      { label: '새 표본', run: (a) => a.reseed(), primary: true },
      { label: 'q = 0 (순수 지수)', run: (a) => a.setQ(0) },
      { label: 'q = 0.6', run: (a) => a.setQ(0.6) },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4, zi = M4.zi;
      const st = { q: 0.4, lam: 1, n: 2000, off: 0 };
      const c = ctx.controls([{ title: '모형과 표본', items: [
        { type: 'range', key: 'q', label: 'q = P(X = 0)', min: 0, max: 0.8, step: 0.05, value: 0.4, fmt: (v) => v.toFixed(2) },
        { type: 'range', key: 'lam', label: 'λ (양수 부분의 비율)', min: 0.2, max: 3, step: 0.1, value: 1, fmt: (v) => v.toFixed(1) },
        { type: 'select', key: 'n', label: '표본 크기 n', value: '2000', options: [['200', '200'], ['2000', '2,000'], ['20000', '20,000'], ['100000', '100,000']] },
        { type: 'buttons', items: [{ key: 'reseed', label: '새 표본', primary: true }] },
      ] }], (k, v) => {
        if (k === 'reseed') return api.reseed();
        st[k] = k === 'n' ? +v : v; api.render();
      });
      ctx.legend([['m4sw-blk', '표본 (0의 비율, 양수 부분 밀도)'], ['m4sw-curve', '참 분포'], ['m4sw-fit', 'ν = δ₀ + λ 기준 MLE'], ['m4sw-naive', '지수분포로 본 MLE'], ['m4sw-ecdf', 'ECDF']]);
      const api = {
        reseed() { st.off++; api.render(); },
        setQ(q) { st.q = q; c.set('q', q); api.render(); },
        render() {
          const { q, lam, n } = st;
          const r = ctx.rng(300 + st.off), s = zi.sampler(r, q, lam);
          const xs = new Float64Array(n);
          for (let i = 0; i < n; i++) xs[i] = s();
          const fit = zi.fit(xs);
          const el = ctx.el;
          el.innerHTML = '';
          const xmax = -Math.log(0.004) / lam;
          const nb = 32, bw = xmax / nb;
          const cnt = new Float64Array(nb);
          for (const v of xs) if (v > 0 && v < xmax) cnt[Math.floor(v / bw)]++;
          const dmax = (1 - q) * lam;
          let hmax = 0; cnt.forEach((cc) => { hmax = Math.max(hmax, cc / n / bw); });
          const ytop = Math.max(q, fit.q, dmax, hmax) * 1.18 + 0.02;
          const f1 = u.panel(ctx.el, '자료: 0의 비율(줄기)과 양수 부분의 밀도(막대)', '줄기 높이 = 확률(질량), 막대 높이 = 밀도. 둘 다 ν = δ₀ + λ에 대한 밀도 dP/dν의 값입니다');
          const P = M4.plot(f1, { height: 230, x: [-xmax * 0.06, xmax], y: [0, ytop], yNice: false, yTicks: 4, xLabel: 'x', aria: '0 과잉 자료 그림' });
          cnt.forEach((cc, i) => { const h = cc / n / bw; P.plot.append('rect').attr('class', 'm4-blk').attr('x', P.x(i * bw)).attr('width', Math.max(0.5, P.x(bw) - P.x(0) - 1)).attr('y', P.y(h)).attr('height', P.ih - P.y(h)); });
          P.plot.append('rect').attr('class', 'm4-blk atom').attr('x', P.x(0) - 4).attr('width', 8).attr('y', P.y(fit.q)).attr('height', P.ih - P.y(fit.q));
          u.path(P.plot, d3.range(1, 301).map((i) => (xmax * i) / 300).map((v) => [P.x(v), P.y(zi.rn(v, q, lam))]), 'm4-curve');
          P.plot.append('circle').attr('class', 'm4-closed').attr('cx', P.x(0)).attr('cy', P.y(q)).attr('r', 5);
          P.plot.append('text').attr('class', 'm4-lab').attr('x', P.x(0) + 9).attr('y', P.y(Math.max(q, fit.q)) - 4).text(`0의 비율 ${fit.q.toFixed(3)} (참 q = ${q.toFixed(2)})`);
          // CDF
          const f2 = u.panel(ctx.el, 'CDF 비교', '지수분포로 본 적합은 0에서의 점프를 표현할 수 없습니다');
          const C = M4.plot(f2, { height: 220, x: [-xmax * 0.06, xmax], y: [0, 1], yNice: false, yTicks: 4, xLabel: 'x', aria: '적합 CDF 비교' });
          const srt = Float64Array.from(xs).sort();
          const step = Math.max(1, Math.floor(n / 1200));
          const ep = [[C.x(-xmax * 0.06), C.y(0)], [C.x(0), C.y(0)]];
          for (let i = 0; i < n; i += step) ep.push([C.x(srt[i]), C.y((i + 1) / n)]);
          ep.push([C.x(xmax), C.y(1)]);
          u.path(C.plot, ep, 'm4-ecdf');
          const law = (qq, ll) => ({ atoms: qq > 0 ? [{ x: 0, p: qq, lo: 0, hi: qq }] : [], F: (v) => zi.cdf(v, qq, ll), range: [-xmax * 0.06, xmax] });
          u.drawCdf(C, law(q, lam), 'm4-cdf');
          u.drawCdf(C, law(fit.q, fit.lam), 'm4-fit', { dots: false });
          u.drawCdf(C, law(0, fit.naiveLam), 'm4-naive', { dots: false });
          // 표
          const mo = zi.moments(q, lam);
          const gs = [
            ['g(x) = x', (v) => v, mo.mean],
            ['g(x) = x²', (v) => v * v, mo.m2],
            ['g(x) = e<sup>−x</sup>', (v) => Math.exp(-v), mo.lapl],
            ['g(x) = 1{x ≤ 1}', (v) => (v <= 1 ? 1 : 0), mo.le1],
          ];
          const rowsG = gs.map(([lab, g, th]) => {
            const v = new Float64Array(n);
            for (let i = 0; i < n; i++) v[i] = g(xs[i]);
            const ss = M4.stats(v);
            const ok = Math.abs(ss.mean - th) <= 3 * ss.se + 1e-12;
            return [lab, th.toFixed(4), `${ss.mean.toFixed(4)} <small>± ${(2 * ss.se).toFixed(4)}</small>`, ok ? '<span class="ok">일치</span>' : '<span class="warn">벗어남</span>'];
          });
          ctx.extra.innerHTML = u.table(['모수', '참값', 'ν = δ₀ + λ 기준 MLE', '지수분포로 본 MLE'], [
            ['q', q.toFixed(3), fit.q.toFixed(4), '0 (모형에 없음)'],
            ['λ', lam.toFixed(3), fit.lam.toFixed(4), `${fit.naiveLam.toFixed(4)} <small>(${(fit.naiveLam / lam).toFixed(3)}배)</small>`],
          ], { caption: '최대가능도 추정' }) + u.table(['g', 'q·g(0) + (1−q)∫g λe<sup>−λx</sup>dx', `몬테카를로 (n = ${ctx.S.fInt(n)})`, '±3SE'], rowsG, { caption: 'E[g(X)] = ∫ g · dP/dν dν' });
          ctx.readouts([
            ['n₀ (0인 관측) / n₊', `${ctx.S.fInt(fit.n0)} / ${ctx.S.fInt(fit.np)}`],
            ['q̂ = n₀/n', fit.q.toFixed(4)],
            ['λ̂ = n₊ / Σx', fit.lam.toFixed(4)],
            ['잘못된 λ̂ = n / Σx', `${fit.naiveLam.toFixed(4)}<small>이론 λ/(1−q) = ${(lam / (1 - q)).toFixed(4)}</small>`],
          ]);
        },
      };
      return api;
    },
  });

  /* ════════════════ C2 측도 바꾸기: 중요도 표본추출 ════════════════ */
  scenes.push({
    id: 'C2', title: '측도 바꾸기: 중요도 표본추출',
    card: {
      do: '표준정규 Z에서 꼬리 확률 p = P(Z > c)를 추정합니다. 단순 몬테카를로는 Z를 그대로 뽑고, 중요도 표본추출은 다른 분포 Q에서 뽑아 가중치 w = dP/dQ를 곱합니다. c와 μ를 바꾸고, 절단 제안분포도 골라 보세요. 표본 1만 개짜리 실험을 200번 반복했습니다.',
      see: 'c = 5에서 단순 몬테카를로는 1만 개 중 Z > 5가 거의 나오지 않아 추정값이 대부분 0입니다. μ = c인 제안분포는 상대오차 몇 %로 맞힙니다. 반대로 <b>절단 제안분포 U(c + 0.5, c + 5)</b>는 (c, c + 0.5)에 표본을 하나도 두지 않아서(P ≪ Q 위반) 아무리 많이 뽑아도 참값보다 작게 나옵니다.',
      ask: 'μ를 c보다 훨씬 크게 하면 어떻게 될까요? 가중치 w가 어떤 값들을 가지게 되는지 생각해 보세요.',
      math: '$P\\ll Q$이면 $$E_P[g(X)]=\\int g\\,dP=\\int g\\,\\frac{dP}{dQ}\\,dQ=E_Q\\Big[g(Y)\\,\\frac{dP}{dQ}(Y)\\Big].$$ $Q=N(\\mu,1)$이면 $\\frac{dP}{dQ}(y)=e^{-\\mu y+\\mu^2/2}$. 분산은 $\\mathrm{Var}_Q(gw)=e^{\\mu^2}\\,\\bar\\Phi(c+\\mu)-p^2$. 조건 $P\\ll Q$가 깨지면(Q가 0인 곳에 P의 질량) 항등식 자체가 성립하지 않습니다. <a href="../module2/continuous.html">모듈 2</a>의 역변환과 함께, 측도를 바꾸는 계산의 대표 예입니다.',
    },
    actions: [
      { label: 'c = 5, μ = 5', run: (a) => a.set({ c: 5, mu: 5, m: 'shift' }), primary: true },
      { label: '절단 제안분포', run: (a) => a.set({ m: 'trunc' }) },
      { label: 'μ 너무 크게 (μ = 7, c = 3)', run: (a) => a.set({ c: 3, mu: 7, m: 'shift' }) },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4, SP = ctx.D.special;
      const R = 200;
      const st = { c: 4, mu: 4, m: 'shift', M: 10000 };
      let tm = null;
      const cache = {};
      const c = ctx.controls([{ title: '목표와 제안분포', items: [
        { type: 'range', key: 'c', label: '문턱 c (p = P(Z > c))', min: 2, max: 6, step: 0.5, value: 4, fmt: (v) => v.toFixed(1) },
        { type: 'seg', key: 'm', label: '제안분포 Q', value: 'shift', options: [['shift', 'N(μ, 1)'], ['trunc', 'U(c+0.5, c+5)']] },
        { type: 'range', key: 'mu', label: 'μ (N(μ, 1)의 중심)', min: 0, max: 7, step: 0.25, value: 4, fmt: (v) => v.toFixed(2) },
        { type: 'select', key: 'M', label: '반복마다 표본 수', value: '10000', options: [['1000', '1,000'], ['10000', '10,000']] },
      ] }], (k, v) => {
        st[k] = k === 'M' ? +v : v;
        clearTimeout(tm); tm = setTimeout(() => api.render(), 50);
      });
      ctx.legend([['m4sw-curve', '목표 P = N(0, 1)'], ['m4sw-prop', '제안 Q'], ['m4sw-rn', '가중치 w = dP/dQ'], ['m4sw-hl', '영역 z > c'], ['m4sw-dot', '반복 200회의 추정값 ÷ 참값']]);
      const nrm = (r) => ctx.D.get('normal').sampler(r, { mu: 0, sigma: 1 });
      function runPlain(cc, M) {
        const key = `p${cc}_${M}`;
        if (cache[key]) return cache[key];
        const z = nrm(ctx.rng(400)), out = new Float64Array(R);
        for (let t = 0; t < R; t++) { let k = 0; for (let i = 0; i < M; i++) if (z() > cc) k++; out[t] = k / M; }
        return (cache[key] = out);
      }
      function runShift(cc, mu, M) {
        const z = nrm(ctx.rng(401)), out = new Float64Array(R), h = (mu * mu) / 2;
        for (let t = 0; t < R; t++) { let s = 0; for (let i = 0; i < M; i++) { const y = mu + z(); if (y > cc) s += Math.exp(-mu * y + h); } out[t] = s / M; }
        return out;
      }
      function runTrunc(cc, M) {
        const key = `t${cc}_${M}`;
        if (cache[key]) return cache[key];
        const r = ctx.rng(402), out = new Float64Array(R), a = cc + 0.5, w = 4.5;
        for (let t = 0; t < R; t++) { let s = 0; for (let i = 0; i < M; i++) { const y = a + w * r.random(); s += SP.normPdf(y) * w; } out[t] = s / M; }
        return (cache[key] = out);
      }
      const api = {
        set(o) { Object.assign(st, o); Object.keys(o).forEach((k) => c.set(k, o[k])); api.render(); },
        render() {
          const { c: cc, mu, M } = st;
          const p = SP.normCdf(-cc);
          const plain = runPlain(cc, M);
          const est = st.m === 'shift' ? runShift(cc, mu, M) : runTrunc(cc, M);
          const sP = M4.stats(plain), sE = M4.stats(est);
          const el = ctx.el;
          el.innerHTML = '';
          // 밀도 (로그 눈금)
          const x0 = -4, x1 = Math.max(cc + 5.5, mu + 4);
          const f1 = u.panel(el, '목표 밀도와 제안 밀도 (세로 로그 눈금)', `참값 p = P(Z > ${cc}) = ${p >= 1e-3 ? String(+p.toPrecision(4)) : u.f(p)}`);
          const P = M4.plot(f1, { height: 230, x: [x0, x1], y: [1e-14, 1], yType: 'log', yTicks: 5, yFormat: (v) => { const e = Math.round(Math.log10(v)); return e === 0 ? '1' : `1e${e}`; }, xLabel: 'z', aria: '목표·제안 밀도' });
          P.plot.append('rect').attr('class', 'm4-region').attr('x', P.x(cc)).attr('width', P.iw - P.x(cc)).attr('y', 0).attr('height', P.ih);
          const xs = d3.range(0, 501).map((i) => x0 + ((x1 - x0) * i) / 500);
          const lg = (v) => P.y(Math.max(1e-14, Math.min(1, v)));
          u.path(P.plot, xs.map((v) => [P.x(v), lg(SP.normPdf(v))]), 'm4-curve');
          if (st.m === 'shift') u.path(P.plot, xs.map((v) => [P.x(v), lg(SP.normPdf(v - mu))]), 'm4-prop');
          else {
            const a = cc + 0.5, b = cc + 5;
            u.path(P.plot, [[P.x(x0), lg(1e-14)], [P.x(a), lg(1e-14)], [P.x(a), lg(1 / 4.5)], [P.x(Math.min(b, x1)), lg(1 / 4.5)], [P.x(Math.min(b, x1)), lg(1e-14)], [P.x(x1), lg(1e-14)]], 'm4-prop');
            P.plot.append('rect').attr('class', 'm4-gap').attr('x', P.x(cc)).attr('width', P.x(a) - P.x(cc)).attr('y', 0).attr('height', P.ih);
            P.plot.append('text').attr('class', 'm4-lab hl').attr('x', P.x(cc) + 3).attr('y', 14).text('Q = 0인데 P > 0');
          }
          // 가중치 w = dP/dQ (PRD C2)
          const fw = u.panel(el, '가중치 w(y) = dP/dQ(y) (세로 로그 눈금)', st.m === 'shift' ? `w(y) = exp(−${mu}y + ${mu}²/2). z > c에서 w가 작을수록(1보다 훨씬 작을수록) 드문 사건을 자주 뽑고 작게 셈` : '제안 밀도가 0인 곳에서는 w가 정의되지 않음(P ≪ Q 위반)');
          const W = M4.plot(fw, { height: 170, x: [x0, x1], y: [1e-16, 1e16], yType: 'log', yTicks: 5, yFormat: (v) => { const e = Math.round(Math.log10(v)); return e === 0 ? '1' : `1e${e}`; }, xLabel: 'y', aria: '중요도 가중치' });
          W.plot.append('rect').attr('class', 'm4-region').attr('x', W.x(cc)).attr('width', W.iw - W.x(cc)).attr('y', 0).attr('height', W.ih);
          W.plot.append('line').attr('class', 'm4-hline lim').attr('x1', 0).attr('x2', W.iw).attr('y1', W.y(1)).attr('y2', W.y(1));
          const lw = (v) => W.y(Math.max(1e-16, Math.min(1e16, v)));
          if (st.m === 'shift') u.path(W.plot, xs.map((v) => [W.x(v), lw(Math.exp(-mu * v + (mu * mu) / 2))]), 'm4-rn');
          else {
            const a = cc + 0.5, b = cc + 5;
            u.path(W.plot, d3.range(0, 201).map((i) => a + ((Math.min(b, x1) - a) * i) / 200).map((v) => [W.x(v), lw(4.5 * SP.normPdf(v))]), 'm4-rn');
            W.plot.append('rect').attr('class', 'm4-gap').attr('x', W.x(cc)).attr('width', W.x(a) - W.x(cc)).attr('y', 0).attr('height', W.ih);
            W.plot.append('text').attr('class', 'm4-lab hl').attr('x', W.x(cc) + 3).attr('y', 14).text('w 정의 안 됨');
          }
          // 추정값 띠
          const f2 = u.panel(el, '반복 200회의 추정값 ÷ 참값', '1에 모일수록 좋은 방법. 3보다 크면 오른쪽 끝에 ▶로 표시');
          const S = M4.plot(f2, { height: 150, x: [0, 3], y: [0, 2], yNice: false, yTicks: 2, yFormat: () => '', margin: { left: 112 }, xLabel: '추정값 ÷ 참값', aria: '추정값 분포' });
          S.plot.append('line').attr('class', 'm4-hline lim').attr('x1', S.x(1)).attr('x2', S.x(1)).attr('y1', 0).attr('y2', S.ih);
          const jr = ctx.rng(403);
          const rowsD = [['단순 MC', plain, 1.5], [st.m === 'shift' ? `N(${mu}, 1)` : '절단 U', est, 0.5]];
          rowsD.forEach(([lab, arr, yc]) => {
            S.g.append('text').attr('class', 'm4-tick').attr('x', -8).attr('y', S.y(yc) + 4).attr('text-anchor', 'end').text(lab);
            let over = 0;
            for (const v of arr) {
              const rr = v / p;
              if (rr > 3) { over++; continue; }
              S.plot.append('circle').attr('class', 'm4-sdot').attr('cx', S.x(rr)).attr('cy', S.y(yc + (jr.random() - 0.5) * 0.6)).attr('r', 2.4);
            }
            if (over) S.plot.append('text').attr('class', 'm4-lab hl').attr('x', S.iw - 2).attr('y', S.y(yc) + 4).attr('text-anchor', 'end').text(`▶ ${over}`);
          });
          const zeroP = plain.filter((v) => v === 0).length;
          const relTh = Math.sqrt((1 - p) / (M * p));
          const relShift = Math.sqrt(Math.max(0, Math.exp(mu * mu) * SP.normCdf(-(cc + mu)) - p * p) / M) / p;
          const truncTarget = SP.normCdf(-(cc + 0.5)) - SP.normCdf(-(cc + 5));
          const fp = (v) => (v >= 1e-3 ? String(+v.toPrecision(4)) : u.f(v));
          const pct = (v) => (v >= 10 ? `${ctx.S.fInt(Math.round(v * 100))}%` : `${(v * 100).toFixed(1)}%`);
          ctx.extra.innerHTML = u.table(['방법', '평균 추정값', '참값과의 비', '상대표준오차 (반복으로)', '상대표준오차 (이론)'], [
            ['단순 MC', fp(sP.mean), (sP.mean / p).toFixed(3), sP.sd > 0 ? pct(sP.sd / p) : '— (모두 0)', pct(relTh)],
            ...(st.m === 'shift'
              ? [[`N(${mu}, 1) + 가중치`, fp(sE.mean), (sE.mean / p).toFixed(3), pct(sE.sd / p), pct(relShift)]]
              : [['절단 U(c+0.5, c+5)', fp(sE.mean), (sE.mean / p).toFixed(3), pct(sE.sd / p), `편향: 기댓값 ${fp(truncTarget)}`]]),
          ], { caption: `표본 ${ctx.S.fInt(M)}개 × ${R}회 반복. 참값 p = ${fp(p)}` });
          ctx.readouts([
            ['p = P(Z > c)', fp(p)],
            ['단순 MC에서 추정값 0인 반복', `${zeroP} / ${R}`],
            ['w = dP/dQ at y = c', st.m === 'shift' ? u.f(Math.exp(-mu * cc + (mu * mu) / 2), 3) : '(c, c+0.5)에서 정의 안 됨'],
            [st.m === 'shift' ? '상대오차 비 (단순 ÷ 중요도)' : '빠진 질량', st.m === 'shift' ? (() => { const g = relTh / Math.max(relShift, 1e-12); return g >= 1 ? `${ctx.S.fInt(Math.round(g))}배 좋아짐` : `${g.toFixed(2)}배<small>오히려 나빠짐: 가중치가 들쭉날쭉</small>`; })() : `${fp(p - truncTarget)} (${pct((p - truncTarget) / p)})`],
          ]);
        },
        destroy() { clearTimeout(tm); },
      };
      return api;
    },
  });

  /* ════════════════ C3 조건부 기댓값은 사영이다 ════════════════ */
  const EX2 = 0.5 - 1 / Math.PI + 0.2;
  scenes.push({
    id: 'C3', title: '조건부 기댓값은 사영이다',
    card: {
      do: 'Ω = [0, 1)에서 X(ω) = sin 2πω + ω²입니다. 정보 σ-대수 𝒢는 [0, 1)을 칸으로 나눈 분할이 만드는 것입니다(“ω가 어느 칸에 있는지만 안다”). k를 키워 정보를 늘려 보세요. 그리고 <b>계단 하나를 위아래로 끌어</b> 보세요.',
      see: '파란 계단 E[X | 𝒢]는 칸마다 X의 평균입니다. 계단을 어느 쪽으로 끌든 L² 오차가 커집니다. 곧 E[X | 𝒢]는 𝒢-가측 함수(칸마다 상수인 함수) 가운데 X에 <b>가장 가까운 것</b>, L² 공간에서의 <b>직교 사영</b>입니다. 오차 X − E[X | 𝒢]는 모든 𝒢-가측 Z와 직교하고, 피타고라스 E[X²] = E[Y²] + E[(X − Y)²]가 성립합니다.',
      ask: '무작위 분할로 바꿔도 사영의 성질은 그대로인가요? 칸이 같은 수일 때 등분할과 무작위 분할 중 어느 쪽 오차가 작은가요?',
      math: '$X\\in L^2$일 때 $Y=E[X\\mid\\mathcal G]$는 $$E\\big[(X-Y)Z\\big]=0\\quad\\text{(모든 }\\mathcal G\\text{-가측 }Z\\in L^2)$$ 를 만족하는 유일한 𝒢-가측 Y이고, $\\|X-Y\\|_2=\\min_{Z}\\|X-Z\\|_2$. 일반적으로는 라돈–니코딤 정리로 정의: $\\nu(G)=E[X\\mathbf 1_G]$는 $P|_{\\mathcal G}$에 절대연속이므로 $Y=d\\nu/dP|_{\\mathcal G}$. 탑 성질 $E[E[X\\mid\\mathcal G_k]\\mid\\mathcal G_j]=E[X\\mid\\mathcal G_j]$ ($\\mathcal G_j\\subset\\mathcal G_k$). 확률 0인 사건에 조건을 거는 문제도 이 정의로 해결됩니다.',
    },
    actions: [
      { label: '정보 늘리기 (k + 1)', run: (a) => a.bump(), primary: true },
      { label: '계단 원래대로', run: (a) => a.resetLevels() },
      { label: '무작위 분할', run: (a) => a.setPart('rand') },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4, ce = M4.ce;
      const st = { k: 3, part: 'dy', zoff: 0 };
      let edges, levels, opt, refs = null;
      const c = ctx.controls([{ title: '정보 σ-대수 𝒢', items: [
        { type: 'range', key: 'k', label: '칸 수 2<sup>k</sup>', min: 0, max: 8, step: 1, value: 3, fmt: (v) => `${Math.pow(2, v)}칸` },
        { type: 'seg', key: 'part', label: '분할', value: 'dy', options: [['dy', '등분할'], ['rand', '무작위']] },
        { type: 'buttons', items: [{ key: 'reset', label: '계단 원래대로', primary: true }, { key: 'z', label: '새 무작위 Z' }] },
        { type: 'hint', text: '그림에서 계단을 끌거나, 계단을 Tab으로 고른 뒤 ↑ ↓ 키로 움직입니다.' },
      ] }], (k, v) => {
        if (k === 'reset') return api.resetLevels();
        if (k === 'z') { st.zoff++; return update(); }
        st[k] = v; build();
      });
      ctx.legend([['m4sw-curve', 'X(ω)'], ['m4sw-step', 'E[X | 𝒢] (또는 끈 계단)'], ['m4sw-res', '오차 X − Y'], ['m4sw-hl', '옮긴 계단']]);
      const dyErr = d3.range(0, 9).map((k) => { const e = ce.dyadic(k); return ce.l2(e, ce.means(e)); });
      function makeEdges() {
        const K = Math.pow(2, st.k);
        if (st.part === 'dy') return ce.dyadic(st.k);
        const r = ctx.rng(500 + st.k), cuts = [];
        for (let i = 0; i < K - 1; i++) cuts.push(r.random());
        return [0, ...cuts.sort((a, b) => a - b), 1];
      }
      function build() {
        edges = makeEdges();
        opt = ce.means(edges);
        levels = opt.slice();
        draw();
      }
      function draw() {
        const el = ctx.el;
        el.innerHTML = '';
        const f1 = u.panel(el, `X와 E[X | 𝒢] (${edges.length - 1}칸, ${st.part === 'dy' ? '등분할' : '무작위 분할'})`, '계단을 끌어 보세요. 어느 쪽으로 옮겨도 오차가 커집니다');
        const P = M4.plot(f1, { height: 300, x: [0, 1], y: [-1.05, 1.45], yNice: false, xLabel: 'ω', yLabel: '값', aria: '조건부 기댓값 계단' });
        const xs = d3.range(0, 801).map((i) => i / 800);
        const resG = P.plot.append('g');
        edges.slice(1, -1).forEach((e) => P.plot.append('line').attr('class', 'm4-sep').attr('x1', P.x(e)).attr('x2', P.x(e)).attr('y1', 0).attr('y2', P.ih));
        u.path(P.plot, xs.map((w) => [P.x(w), P.y(ce.X(w))]), 'm4-curve');
        const stepG = P.plot.append('g');
        const segs = levels.map((_, i) => {
          const g = stepG.append('g').attr('class', 'm4-stepg').attr('data-i', i);
          if (edges.length <= 33) g.attr('tabindex', 0).attr('role', 'slider').attr('aria-label', `칸 ${i + 1}의 높이`);
          const hit = g.append('rect').attr('class', 'm4-hit');
          const ln = g.append('line').attr('class', 'm4-step');
          return { g, hit, ln };
        });
        refs = { P, segs, resG };
        // 끌기
        let drag = null;
        const ov = P.svg.node();
        const toData = (ev) => {
          const pt = ov.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
          const m = P.plot.node().getScreenCTM().inverse();
          const q = pt.matrixTransform(m);
          return [P.x.invert(q.x), P.y.invert(q.y)];
        };
        segs.forEach((s, i) => {
          s.g.on('pointerdown', (ev) => { ev.preventDefault(); drag = i; s.g.node().setPointerCapture && s.g.node().setPointerCapture(ev.pointerId); });
          s.g.on('pointermove', (ev) => { if (drag !== i) return; levels[i] = Math.max(-1, Math.min(1.4, toData(ev)[1])); update(); });
          s.g.on('pointerup pointercancel', () => { drag = null; });
          s.g.on('keydown', (ev) => {
            if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); levels[i] = Math.max(-1, Math.min(1.4, levels[i] + (ev.key === 'ArrowUp' ? 0.05 : -0.05))); update(); }
          });
        });
        update();
      }
      function update() {
        if (!refs) return;
        const { P, segs, resG } = refs;
        segs.forEach((s, i) => {
          const a = P.x(edges[i]), b = P.x(edges[i + 1]), yy = P.y(levels[i]);
          const moved = Math.abs(levels[i] - opt[i]) > 1e-9;
          s.ln.attr('x1', a).attr('x2', b).attr('y1', yy).attr('y2', yy).classed('hl', moved);
          s.hit.attr('x', a).attr('width', Math.max(4, b - a)).attr('y', yy - 9).attr('height', 18);
          s.g.attr('aria-valuenow', levels[i].toFixed(3));
        });
        resG.selectAll('*').remove();
        const pts = [], N = 600;
        for (let i = 0; i <= N; i++) { const w = Math.min(1 - 1e-9, i / N); pts.push([w, ce.X(w), levels[ce.cellOf(edges, w)]]); }
        resG.append('path').attr('class', 'm4-resid').attr('d', d3.area().x((d) => P.x(d[0])).y0((d) => P.y(d[2])).y1((d) => P.y(d[1]))(pts));
        const err = ce.l2(edges, levels), errOpt = ce.l2(edges, opt);
        const zr = ctx.rng(600 + st.zoff), z = levels.map(() => zr.random() * 2 - 1);
        const inn = ce.inner(edges, levels, z), innOpt = ce.inner(edges, opt, z);
        let EY = 0, EY2 = 0;
        for (let i = 0; i < levels.length; i++) { const L = edges[i + 1] - edges[i]; EY += L * opt[i]; EY2 += L * opt[i] * opt[i]; }
        // 탑 성질 (등분할만): 𝒢_j, j = floor(k/2)
        let tower = '—';
        if (st.part === 'dy' && st.k > 0) {
          const j = Math.floor(st.k / 2), coarse = ce.means(ce.dyadic(j)), r2 = Math.pow(2, st.k - j);
          let mx = 0;
          for (let a = 0; a < coarse.length; a++) { let s = 0; for (let b = 0; b < r2; b++) s += opt[a * r2 + b]; mx = Math.max(mx, Math.abs(s / r2 - coarse[a])); }
          tower = `j = ${j}: 최대 오차 ${mx < 1e-12 ? '&lt; 10<sup>−12</sup>' : mx.toExponential(1)}<small>E[E[X|𝒢ₖ]|𝒢ⱼ] = E[X|𝒢ⱼ]</small>`;
        }
        const moved = levels.some((v, i) => Math.abs(v - opt[i]) > 1e-9);
        ctx.extra.innerHTML = u.table(['k', ...d3.range(0, 9).map(String)], [
          ['칸 수', ...d3.range(0, 9).map((k) => String(Math.pow(2, k)))],
          { cls: 'num', cells: ['L² 오차 (등분할)', ...dyErr.map((v, k) => (k === st.k && st.part === 'dy' ? `<b>${v.toFixed(3)}</b>` : v.toFixed(3)))] },
        ], { caption: '정보가 늘면 E[X | 𝒢ₖ] → X (L²)', cls: 'compact' });
        ctx.readouts([
          ['L² 오차 ‖X − Y‖', `${err.toFixed(4)}${moved ? `<small>최소(사영) ${errOpt.toFixed(4)}</small>` : '<small>사영: 최솟값</small>'}`],
          ['직교성 E[(X − Y)Z]', `${inn.toExponential(2)}${moved ? `<small>사영이면 ${innOpt.toExponential(1)}</small>` : ''}`],
          ['피타고라스', `${EX2.toFixed(4)} = ${EY2.toFixed(4)} + ${(errOpt * errOpt).toFixed(4)}<small>E[X²] = E[Y²] + E[(X−Y)²]</small>`],
          ['E[E[X|𝒢]] = E[X]', `${EY.toFixed(6)} = 1/3`],
          ['탑 성질', tower],
        ]);
      }
      const api = {
        bump() { st.k = st.k >= 8 ? 0 : st.k + 1; c.set('k', st.k); build(); },
        resetLevels() { levels = opt.slice(); update(); },
        setPart(p) { st.part = p; c.set('part', p); build(); },
        render() { build(); },
      };
      return api;
    },
  });

  /* ════════════════ C4 라오–블랙웰 ════════════════ */
  scenes.push({
    id: 'C4', title: '라오–블랙웰: 조건부화로 분산 줄이기',
    card: {
      do: '포아송(λ) 표본 n개로 θ = P(X = 0) = e<sup>−λ</sup>를 추정합니다. 세 추정량을 5,000번 반복해 비교하세요: 첫 관측만 보는 δ = 1{X₁ = 0}, 그것을 충분통계량 T = ΣXᵢ로 조건부화한 E[δ | T] = (1 − 1/n)<sup>T</sup>, 그리고 MLE e<sup>−X̄</sup>.',
      see: 'δ는 0 또는 1뿐이라 분산이 θ(1 − θ)로 큽니다. 아래 산점도에서 T가 같은 반복끼리 δ를 평균하면 초록 곡선 (1 − 1/n)<sup>T</sup>에 놓입니다. <b>그것이 라오–블랙웰 추정량</b>이고, C3의 사영과 같은 그림입니다. 불편성은 그대로, 분산은 λ = 1, n = 10에서 0.2325 → 0.0142로 줄어듭니다.',
      ask: 'MLE e<sup>−X̄</sup>는 분산이 조금 더 작은데도 왜 “최선의 불편추정량”이 아닐까요? 표의 편향 열을 보세요.',
      math: '<b>라오–블랙웰</b>: T가 충분통계량, δ가 θ의 불편추정량이면 $\\tilde\\delta=E[\\delta\\mid T]$는 θ에 의존하지 않는 추정량이고 $E[\\tilde\\delta]=\\theta$, $\\mathrm{Var}(\\tilde\\delta)\\le\\mathrm{Var}(\\delta)$ (조건부 분산 공식 $\\mathrm{Var}\\,\\delta=\\mathrm{Var}\\,E[\\delta|T]+E\\,\\mathrm{Var}(\\delta|T)$). 여기서 $X_1\\mid T\\sim\\mathrm{Bin}(T,1/n)$이라 $E[\\delta\\mid T]=(1-1/n)^T$. <b>레만–셰페</b>: T가 완비이면 이것이 유일한 UMVUE. $\\mathrm{Var}=e^{-2\\lambda}(e^{\\lambda/n}-1)$, 크라메르–라오 하한 $\\lambda e^{-2\\lambda}/n$.',
    },
    actions: [
      { label: '다시 뽑기', run: (a) => a.reseed(), primary: true },
      { label: 'n = 3', run: (a) => a.setN(3) },
      { label: 'n = 40', run: (a) => a.setN(40) },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4, rb = M4.rb;
      const st = { lam: 1, n: 10, off: 0 };
      const MREP = 5000;
      const c = ctx.controls([{ title: '모형', items: [
        { type: 'range', key: 'lam', label: 'λ', min: 0.2, max: 3, step: 0.1, value: 1, fmt: (v) => v.toFixed(1) },
        { type: 'range', key: 'n', label: '표본 크기 n', min: 2, max: 50, step: 1, value: 10, fmt: (v) => `${v}` },
        { type: 'buttons', items: [{ key: 'reseed', label: '다시 뽑기', primary: true }] },
      ] }], (k, v) => { if (k === 'reseed') return api.reseed(); st[k] = v; api.render(); });
      ctx.legend([['m4sw-blk', '추정값 분포'], ['m4sw-curve', '참값 θ, 곡선 (1 − 1/n)ᵀ'], ['m4sw-mean', '평균'], ['m4sw-dot', 'T별 δ의 평균']]);
      const api = {
        reseed() { st.off++; api.render(); },
        setN(n) { st.n = n; c.set('n', n); api.render(); },
        render() {
          const { lam, n } = st;
          const th = rb.theory(lam, n);
          const sim = rb.simulate(ctx.rng(700 + st.off), lam, n, MREP);
          const sN = M4.stats(sim.naive, th.theta), sR = M4.stats(sim.rb, th.theta), sM = M4.stats(sim.mle, th.theta);
          const e1 = Math.exp(n * lam * (Math.exp(-1 / n) - 1)), e2 = Math.exp(n * lam * (Math.exp(-2 / n) - 1));
          const mleVar = e2 - e1 * e1, mleBias = e1 - th.theta;
          const el = ctx.el;
          el.innerHTML = '';
          const f1 = u.panel(el, `세 추정량의 분포 (반복 ${ctx.S.fInt(MREP)}회)`, `세로선 = 참값 θ = ${th.theta.toFixed(4)}, ▼ = 추정값의 평균`);
          const rows = [['δ = 1{X₁ = 0}', sim.naive, sN], ['E[δ | T] = (1−1/n)ᵀ', sim.rb, sR], ['MLE e^(−X̄)', sim.mle, sM]];
          const nb = 40;
          rows.forEach(([lab, arr, ss], ri) => {
            const cnt = new Float64Array(nb);
            for (const v of arr) cnt[Math.min(nb - 1, Math.floor(v * nb))]++;
            const mx = Math.max(...cnt) / arr.length;
            const P = M4.plot(f1.appendChild(document.createElement('div')), { height: ri === 2 ? 118 : 92, x: [0, 1], y: [0, mx * 1.1], yNice: false, yTicks: 2, yFormat: d3.format('.0%'), margin: { top: 18, bottom: ri === 2 ? 40 : 20, left: 54 }, xLabel: ri === 2 ? '추정값' : null, aria: lab });
            cnt.forEach((cc, i) => { const h = cc / arr.length; P.plot.append('rect').attr('class', 'm4-blk').attr('x', P.x(i / nb) + 0.5).attr('width', Math.max(0.5, P.x(1 / nb) - P.x(0) - 1)).attr('y', P.y(h)).attr('height', P.ih - P.y(h)); });
            P.plot.append('line').attr('class', 'm4-vline th').attr('x1', P.x(th.theta)).attr('x2', P.x(th.theta)).attr('y1', 0).attr('y2', P.ih);
            P.plot.append('path').attr('class', 'm4-meanmark').attr('d', d3.symbol(d3.symbolTriangle, 70)()).attr('transform', `translate(${P.x(ss.mean)},${-4}) rotate(180)`);
            P.g.append('text').attr('class', 'm4-lab strong').attr('x', 0).attr('y', -4).text(`${lab}   분산 ${ss.var.toFixed(4)}`);
          });
          // 산점도
          const f2 = u.panel(el, 'T = ΣXᵢ와 δ = 1{X₁ = 0}', '점 = 반복 하나(세로로 흩뜨림), 주황 = T가 같은 반복들의 δ 평균, 초록 = (1 − 1/n)ᵀ');
          let tmax = 0; for (const t of sim.T) tmax = Math.max(tmax, t);
          const S = M4.plot(f2, { height: 230, x: [-0.5, tmax + 0.5], y: [-0.15, 1.15], yNice: false, yTicks: 3, xLabel: 'T', yLabel: 'δ', aria: 'T와 δ의 산점도' });
          const jr = ctx.rng(701);
          const show = Math.min(MREP, 1500);
          for (let i = 0; i < show; i++) S.plot.append('circle').attr('class', 'm4-sdot faint').attr('cx', S.x(sim.T[i] + (jr.random() - 0.5) * 0.5)).attr('cy', S.y(sim.naive[i] + (jr.random() - 0.5) * 0.14)).attr('r', 1.8);
          u.path(S.plot, d3.range(0, 201).map((i) => (tmax * i) / 200).map((t) => [S.x(t), S.y(Math.pow(1 - 1 / n, t))]), 'm4-curve');
          const grp = new Map();
          for (let i = 0; i < MREP; i++) { const g = grp.get(sim.T[i]) || [0, 0]; g[0] += sim.naive[i]; g[1]++; grp.set(sim.T[i], g); }
          grp.forEach(([s, m], t) => { if (m >= 15) S.plot.append('circle').attr('class', 'm4-gmean').attr('cx', S.x(t)).attr('cy', S.y(s / m)).attr('r', 4.5); });
          ctx.extra.innerHTML = u.table(['추정량', '평균', '편향 (이론)', '분산 (시뮬)', '분산 (이론)', 'MSE (시뮬)'], [
            ['δ = 1{X₁ = 0}', sN.mean.toFixed(4), '0', sN.var.toFixed(5), th.varNaive.toFixed(5), sN.mse.toFixed(5)],
            ['(1 − 1/n)ᵀ (라오–블랙웰)', sR.mean.toFixed(4), '0', sR.var.toFixed(5), th.varRB.toFixed(5), sR.mse.toFixed(5)],
            ['e^(−X̄) (MLE)', sM.mean.toFixed(4), mleBias.toFixed(5), sM.var.toFixed(5), mleVar.toFixed(5), sM.mse.toFixed(5)],
          ], { caption: `θ = e^(−${lam}) = ${th.theta.toFixed(4)}, n = ${n}` });
          ctx.readouts([
            ['θ = e^(−λ)', th.theta.toFixed(4)],
            ['분산 비 RB / δ', `${(th.varRB / th.varNaive).toFixed(4)}<small>시뮬 ${(sR.var / sN.var).toFixed(4)}</small>`],
            ['크라메르–라오 하한', `${(lam * Math.exp(-2 * lam) / n).toFixed(5)}<small>RB 분산은 이보다 큼(효율적이지는 않음)</small>`],
            ['평균의 차 (RB − θ)', `${(sR.mean - th.theta).toFixed(4)}<small>±2SE ${(2 * sR.se).toFixed(4)}</small>`],
          ]);
        },
      };
      return api;
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
