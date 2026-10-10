/* 모듈 4B 적분과 극한 (PRD_module4 5장 B1~B4) */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});
  const scenes = ((RVL.m4scenes = RVL.m4scenes || {}).limits = []);
  const U = () => RVL.m4ui;

  /* ════════════════ B1 가로로 자르는 적분 ════════════════ */
  const B1D = ['exponential', 'waiting', 'binomial', 'cantor'];
  const B1T = { exponential: 5, waiting: 5, binomial: 8, cantor: 1 };
  const B1I = { exponential: 60, waiting: 60, binomial: 10.5, cantor: 1 };
  scenes.push({
    id: 'B1', title: '가로로 자르는 적분',
    card: {
      do: '왼쪽은 분위수 함수 Q(ω)의 그래프입니다. 그 아래 넓이가 E[X]입니다. 넓이를 <b>세로 기둥</b>(리만)이 아니라 <b>가로 층</b>으로 채워 보세요. 높이 t의 층의 폭은 {ω : X(ω) > t}의 확률 P(X > t)입니다. 오른쪽은 같은 층을 생존함수 S(t) = P(X > t) 아래에 세워 놓은 것입니다.',
      see: '가로로 자르면 “값이 t보다 큰 ω들의 측도”만 알면 됩니다. PMF도 PDF도 필요 없습니다. 그래서 이항(PMF만), 지수(PDF만), 대기 시간(둘 다 필요), 칸토어(둘 다 없음) 모두 <b>같은 공식 ∫S(t)dt</b>로 평균을 구합니다. 아래 표에서 어떤 방법이 어디서 막히는지 보세요.',
      ask: '칸토어 분포의 평균 1/2은 Σx p(x)로도, ∫x f(x) dx로도 구할 수 없습니다. 그런데도 E[X] = 1/2이 “정의된다”고 말할 수 있는 근거는 무엇인가요?',
      math: '르베그 적분은 단순함수 $\\sum_i c_i\\mathbf 1_{A_i}$의 적분 $\\sum_i c_iP(A_i)$에서 출발해 단조 극한으로 정의합니다. 그 결과 $X\\ge0$이면 $$E[X]=\\int_\\Omega X\\,dP=\\int_0^\\infty P(X>t)\\,dt$$ (층 케이크 공식, 토넬리 정리). 칸토어: $\\int_0^1(1-F(t))\\,dt=1/2$.',
    },
    actions: [
      { label: '층 쌓기 (재생)', run: (a) => a.play(), primary: true },
      { label: '칸토어로', run: (a) => a.setDist('cantor') },
      { label: '이항으로', run: (a) => a.setDist('binomial') },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4;
      const st = { dist: 'exponential', L: 16, shown: 16 };
      let timer = null;
      const c = ctx.controls([{ title: '분포와 층', items: [
        { type: 'select', key: 'dist', label: '분포', value: 'exponential', options: B1D.map((id) => [id, u.laws[id].name]) },
        { type: 'range', key: 'L', label: '층의 수', min: 4, max: 80, step: 1, value: 16, fmt: (v) => `${v}` },
        { type: 'buttons', items: [{ key: 'play', label: '층 쌓기', primary: true }] },
      ] }], (k, v) => {
        if (k === 'play') { api.play(); return; }
        if (k === 'dist') st.dist = v;
        if (k === 'L') { st.L = v; st.shown = v; }
        api.render();
      });
      ctx.legend([['m4sw-curve', 'Q(ω) / S(t)'], ['m4sw-layer', '높이 t의 층 (폭 P(X > t))'], ['m4sw-hl', '마지막에 쌓은 층']]);
      // 표 값: 수치 적분과 몬테카를로
      const table = {};
      B1D.forEach((id, j) => {
        const law = u.laws[id], Ti = B1I[id], N = 200000;
        let s = 0;
        for (let i = 0; i < N; i++) s += 1 - law.F(((i + 0.5) * Ti) / N);
        const sm = u.sample(law, ctx.rng(50 + j), 100000);
        const stt = M4.stats(sm);
        table[id] = { intS: (s * Ti) / N, mc: stt.mean, se: stt.se };
      });
      const api = {
        setDist(id) { st.dist = id; c.set('dist', id); api.render(); },
        play() {
          if (timer) { clearInterval(timer); timer = null; }
          st.shown = 0; api.render();
          timer = ctx.every(ctx.S.reduceMotion() ? 500 : 140, () => {
            if (st.shown >= st.L) { clearInterval(timer); timer = null; return; }
            st.shown++; api.render();
          });
        },
        render() {
          const law = u.laws[st.dist], T = B1T[st.dist], L = st.L, dt = T / L;
          const el = ctx.el;
          el.innerHTML = '';
          const r = u.row(el);
          const f1 = u.panel(r, '왼쪽: Q(ω) 아래를 가로 층으로', '층의 폭 = P(X > t) = 1 − F(t)');
          const P = M4.plot(f1, { height: 270, x: [0, 1], y: [0, T], yNice: false, xLabel: 'ω (Ω = [0, 1])', yLabel: '값 t', aria: '분위수 함수와 가로 층' });
          let sum = 0;
          for (let i = 0; i < st.shown; i++) {
            const t0 = i * dt, tm = t0 + dt / 2, S = 1 - law.F(tm);
            sum += S * dt;
            const cls = 'm4-layer' + (i === st.shown - 1 && st.shown < L ? ' hl' : '') + (i % 2 ? ' alt' : '');
            P.plot.append('rect').attr('class', cls).attr('x', P.x(1 - S)).attr('width', P.x(1) - P.x(1 - S)).attr('y', P.y(t0 + dt)).attr('height', P.y(t0) - P.y(t0 + dt));
          }
          const qs = [];
          for (let i = 0; i <= 600; i++) { const w = Math.min(1 - 1e-9, Math.max(1e-9, i / 600)); qs.push([P.x(w), P.y(Math.min(T * 1.05, law.Q(w)))]); }
          u.path(P.plot, qs, 'm4-curve');
          const f2 = u.panel(r, '오른쪽: 같은 층을 S(t) 아래에 세움', 'S(t) = P(X > t), 넓이 = E[X]');
          const R = M4.plot(f2, { height: 270, x: [0, T], y: [0, 1], yNice: false, yTicks: 4, xLabel: 't', yLabel: 'P(X > t)', aria: '생존함수와 기둥' });
          for (let i = 0; i < st.shown; i++) {
            const t0 = i * dt, S = 1 - law.F(t0 + dt / 2);
            const cls = 'm4-layer' + (i === st.shown - 1 && st.shown < L ? ' hl' : '') + (i % 2 ? ' alt' : '');
            R.plot.append('rect').attr('class', cls).attr('x', R.x(t0)).attr('width', R.x(dt) - R.x(0)).attr('y', R.y(S)).attr('height', R.ih - R.y(S));
          }
          const sp = u.cdfPoints(law, 0, T, 800).map(([t, F]) => [R.x(t), R.y(1 - F)]);
          u.path(R.plot, sp, 'm4-curve');
          const tail = 1 - law.F(T);
          let tailInt = 0;
          { const Ti = B1I[st.dist], K = 20000; for (let i = 0; i < K; i++) tailInt += 1 - law.F(T + ((i + 0.5) * (Ti - T)) / K); tailInt *= (Ti - T) / K; }
          const rows = [
            ['Σ x p(x) (PMF)', '✗ 점 질량 없음', '0 <small>(0의 점 질량만, 부분)</small>', '3', '✗ 점 질량 없음'],
            ['∫ x f(x) dx (PDF)', '1', '0.7 <small>(밀도 부분만)</small>', '✗ 밀도 없음', '✗ 밀도 없음'],
            ['두 공식을 더함', '1', '0·0.3 + 0.7 = 0.7', '3', '✗ 둘 다 0'],
            ['∫ S(t) dt (수치)', ...B1D.map((id) => u.f(table[id].intS, 5))],
            ['몬테카를로 (10만 개)', ...B1D.map((id) => `${table[id].mc.toFixed(4)} <small>± ${(2 * table[id].se).toFixed(4)}</small>`)],
            ['참값 E[X]', '1', '0.7', '3', '0.5'],
          ];
          ctx.extra.innerHTML = u.table(['방법', ...B1D.map((id) => (id === st.dist ? `<b>${u.laws[id].short}</b>` : u.laws[id].short))], rows, { caption: '평균을 구하는 방법 비교 (✗ = 그 방법으로는 계산 불가)', cls: 'col-' + (B1D.indexOf(st.dist) + 2) });
          ctx.readouts([
            ['층 두께 Δt', dt.toFixed(4)],
            ['쌓은 층', `${st.shown} / ${L}`],
            ['Σ P(X > t) Δt', `${sum.toFixed(4)}${tail > 1e-4 && st.shown === L ? `<small>t > ${T}의 꼬리 ∫S = ${tailInt.toFixed(4)}는 그림 밖</small>` : ''}`],
            ['E[X]', `${law.mean}`],
          ]);
        },
        destroy() { if (timer) clearInterval(timer); },
      };
      return api;
    },
  });

  /* ════════════════ B2 극한과 기댓값의 순서 ════════════════ */
  const NS = Array.from({ length: 13 }, (_, i) => Math.pow(2, i));
  const SEQ = {
    a: { name: '(a) Xₙ = n·1{U < 1/n}', f: (w, n) => (w < 1 / n ? n : 0), E: () => 1, lim: () => 0, Elim: 0, Esup: Infinity, pne: (n) => 1 / n, sup: (w) => Math.floor(1 / w), verdict: 'lim E[Xₙ] = 1 ≠ 0 = E[lim Xₙ]. 지배함수 sup Xₙ ≈ 1/ω의 기댓값이 ∞라서 DCT를 쓸 수 없습니다.' },
    b: { name: '(b) Yₙ = 1{U < 1/n}', f: (w, n) => (w < 1 / n ? 1 : 0), E: (n) => 1 / n, lim: () => 0, Elim: 0, Esup: 1, pne: (n) => 1 / n, sup: () => 1, verdict: '|Yₙ| ≤ 1이고 E[1] < ∞이므로 DCT: lim E[Yₙ] = E[lim Yₙ] = 0.' },
    c: { name: '(c) Zₙ = min(U^(−1/2), n)', f: (w, n) => Math.min(1 / Math.sqrt(w), n), E: (n) => 2 - 1 / n, lim: (w) => 1 / Math.sqrt(w), Elim: 2, Esup: 2, pne: (n) => 1 / (n * n), sup: (w) => 1 / Math.sqrt(w), verdict: 'Zₙ이 단조 증가하므로 MCT: E[Zₙ] = 2 − 1/n ↑ 2 = E[U^(−1/2)].' },
  };
  scenes.push({
    id: 'B2', title: '극한과 기댓값의 순서',
    card: {
      do: '세 수열을 차례로 고르고 n을 키워 보세요. 위 그림은 ω ↦ Xₙ(ω)의 그래프(넓이 = 기댓값), 아래 그림은 n에 따른 E[Xₙ]와 같은 ω 2만 개로 구한 표본 평균입니다.',
      see: '(a)는 ω마다 결국 0이 되는데(거의 확실히 0으로 수렴) 기댓값은 언제나 1입니다. 극한과 기댓값의 순서를 바꿀 수 없습니다. 차이는 <b>지배함수</b>에 있습니다: (b)는 1로 눌리고, (c)는 단조 증가합니다. (a)의 큰 n에서 표본 평균이 0이나 엉뚱한 값으로 튀는 것도 보세요.',
      ask: '추정량이 확률 1로 참값에 수렴해도 기댓값(편향)은 남을 수 있을까요? (a)를 “θ̂ₙ − θ”로 읽어 보세요.',
      math: '<b>단조수렴정리(MCT)</b>: $0\\le X_n\\uparrow X$이면 $E[X_n]\\uparrow E[X]$. <b>파투 보조정리</b>: $X_n\\ge0$이면 $E[\\liminf X_n]\\le\\liminf E[X_n]$ ((a)에서 0 < 1). <b>지배수렴정리(DCT)</b>: $X_n\\to X$ a.s., $|X_n|\\le Y$, $E[Y]<\\infty$이면 $E[X_n]\\to E[X]$. 점근 통계의 “미분과 적분의 교환”, “극한과 기댓값의 교환”은 모두 이 정리들로 정당화됩니다.',
    },
    actions: [
      { label: '(a) 반례', run: (a) => a.setSeq('a'), primary: true },
      { label: '(b) DCT', run: (a) => a.setSeq('b') },
      { label: '(c) MCT', run: (a) => a.setSeq('c') },
      { label: 'n 키우기', run: (a) => a.bump() },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4;
      const st = { seq: 'a', j: 4 };
      const M = 20000;
      const om = (() => { const r = ctx.rng(61), a = new Float64Array(M); for (let i = 0; i < M; i++) a[i] = r.random(); return a; })();
      const mc = {};
      Object.keys(SEQ).forEach((k) => { mc[k] = NS.map((n) => { const v = new Float64Array(M); for (let i = 0; i < M; i++) v[i] = SEQ[k].f(om[i], n); return M4.stats(v); }); });
      const c = ctx.controls([{ title: '수열과 n', items: [
        { type: 'seg', key: 'seq', label: '수열', value: 'a', options: [['a', '(a)'], ['b', '(b)'], ['c', '(c)']] },
        { type: 'range', key: 'j', label: 'n = 2<sup>j</sup>', min: 0, max: 12, step: 1, value: 4, fmt: (v) => `n = ${Math.pow(2, v)}` },
      ] }], (k, v) => { st[k] = v; api.render(); });
      ctx.legend([['m4sw-blk', 'Xₙ(ω)'], ['m4sw-lim', '극한 lim Xₙ(ω)'], ['m4sw-ghost', '지배함수 sup Xₙ'], ['m4sw-curve', 'E[Xₙ] 이론'], ['m4sw-fit', 'P(Xₙ ≠ lim)'], ['m4sw-dot', '표본 평균 (±2SE)']]);
      const api = {
        setSeq(s) { st.seq = s; c.set('seq', s); api.render(); },
        bump() { st.j = st.j >= 12 ? 0 : st.j + 2 > 12 ? 12 : st.j + 2; c.set('j', st.j); api.render(); },
        render() {
          const s = SEQ[st.seq], n = NS[st.j];
          const el = ctx.el;
          el.innerHTML = '';
          const cap = st.seq === 'b' ? 1.25 : 12;
          const f1 = u.panel(el, `${s.name},  n = ${n}`, '가로축 ω ∈ [0, 1], 그래프 아래 넓이 = E[Xₙ]');
          const P = M4.plot(f1, { height: 240, x: [0, 1], y: [0, cap], yNice: false, xLabel: 'ω', yLabel: 'Xₙ(ω)', aria: '수열 그래프' });
          const xs = d3.range(1, 1001).map((i) => i / 1000);
          // 지배함수
          u.path(P.plot, [[P.x(0.0005), P.y(Math.min(cap * 1.1, s.sup(0.0005)))], ...xs.map((w) => [P.x(w), P.y(Math.min(cap * 1.1, s.sup(w)))])], 'm4-ghost');
          // Xn 영역
          if (st.seq === 'c') {
            const pts = [[P.x(0), P.y(0)], [P.x(0), P.y(Math.min(cap, n))]];
            const w0 = 1 / (n * n);
            pts.push([P.x(w0), P.y(Math.min(cap, n))]);
            d3.range(0, 501).map((i) => w0 + ((1 - w0) * i) / 500).forEach((w) => pts.push([P.x(w), P.y(Math.min(cap, s.f(w, n)))]));
            pts.push([P.x(1), P.y(0)]);
            P.plot.append('path').attr('class', 'm4-area').attr('d', u.line(pts) + 'Z');
          } else {
            const h = s.f(0, n);
            const wpx = Math.max(2, P.x(1 / n) - P.x(0));
            P.plot.append('rect').attr('class', 'm4-area').attr('x', 0).attr('width', wpx).attr('y', P.y(Math.min(cap, h))).attr('height', P.ih - P.y(Math.min(cap, h)));
            P.plot.append('line').attr('class', 'm4-baseline').attr('x1', wpx).attr('x2', P.iw).attr('y1', P.ih - 1).attr('y2', P.ih - 1);
            if (h > cap) P.plot.append('text').attr('class', 'm4-lab hl').attr('x', wpx + 6).attr('y', 14).text(`↑ 높이 n = ${n} (잘림), 폭 1/n → 넓이 1`);
          }
          // 극한
          if (st.seq === 'c') u.path(P.plot, xs.map((w) => [P.x(w), P.y(Math.min(cap * 1.1, s.lim(w)))]), 'm4-lim');
          else P.plot.append('line').attr('class', 'm4-lim').attr('x1', 0).attr('x2', P.iw).attr('y1', P.y(0) - 2).attr('y2', P.y(0) - 2);

          const f2 = u.panel(el, 'n에 따른 E[Xₙ]와 P(Xₙ ≠ lim Xₙ)', `회색 점선 = E[lim Xₙ] = ${s.Elim}, 주황 점선 = P(Xₙ ≠ lim Xₙ) → 0`);
          const ylo = 0, yhi = st.seq === 'c' ? 2.3 : st.seq === 'b' ? 1.1 : 2.2;
          const E = M4.plot(f2, { height: 210, x: [1, 4096], xType: 'log', y: [ylo, yhi], yNice: false, yTicks: 4, xTickValues: [1, 4, 16, 64, 256, 1024, 4096], xFormat: d3.format('d'), xLabel: 'n (로그 눈금)', aria: '기댓값의 극한' });
          E.plot.append('line').attr('class', 'm4-hline lim').attr('x1', 0).attr('x2', E.iw).attr('y1', E.y(s.Elim)).attr('y2', E.y(s.Elim));
          const ns2 = d3.range(0, 121).map((i) => Math.pow(2, (12 * i) / 120));
          u.path(E.plot, ns2.map((m) => [E.x(m), E.y(s.E(m))]), 'm4-curve');
          u.path(E.plot, ns2.map((m) => [E.x(m), E.y(s.pne(m))]), 'm4-fit');
          NS.forEach((m, i) => {
            const r2 = mc[st.seq][i];
            const yv = Math.min(yhi, r2.mean);
            E.plot.append('line').attr('class', 'm4-err').attr('x1', E.x(m)).attr('x2', E.x(m)).attr('y1', E.y(Math.max(ylo, r2.mean - 2 * r2.se))).attr('y2', E.y(Math.min(yhi, r2.mean + 2 * r2.se)));
            E.plot.append('circle').attr('class', 'm4-mc' + (i === st.j ? ' cur' : '')).attr('cx', E.x(m)).attr('cy', E.y(yv)).attr('r', i === st.j ? 5 : 3.5);
          });
          const cur = mc[st.seq][st.j];
          let zeros = 0; for (let i = 0; i < M; i++) if (s.f(om[i], n) === s.lim(om[i])) zeros++;
          ctx.extra.innerHTML = `<p class="m4-verdict ${st.seq === 'a' ? 'bad' : 'good'}">${s.verdict}</p>`;
          ctx.readouts([
            ['n', ctx.S.fInt(n)],
            ['E[Xₙ] (이론)', s.E(n).toFixed(4)],
            ['표본 평균 (ω 2만 개)', `${cur.mean.toFixed(4)}<small>± ${(2 * cur.se).toFixed(4)}</small>`],
            ['E[lim Xₙ]', `${s.Elim}`],
            ['P(Xₙ ≠ lim Xₙ)', `${u.f(s.pne(n), 5)}<small>표본에서 ${(1 - zeros / M).toFixed(5)}</small>`],
            ['E[sup Xₙ]', s.Esup === Infinity ? '∞ (지배 불가)' : `${s.Esup}`],
          ]);
        },
      };
      return api;
    },
  });

  /* ════════════════ B3 수렴의 종류: 타자기 수열 ════════════════ */
  scenes.push({
    id: 'B3', title: '수렴의 종류',
    card: {
      do: '타자기 수열 Xₙ = 1{U ∈ [j/2<sup>k</sup>, (j+1)/2<sup>k</sup>)}, n = 2<sup>k</sup> + j는 [0, 1]을 점점 좁은 구간으로 훑습니다. n을 움직여 보고, ω 하나를 고정해 그 경로 X₁(ω), X₂(ω), …를 아래에서 보세요.',
      see: 'P(Xₙ = 1) = 2<sup>−k</sup> → 0이므로 <b>확률수렴</b>합니다. 그러나 어떤 ω를 고르든 k 단계마다 정확히 한 번 1이 나오므로, 경로는 0으로 수렴하지 않습니다. 곧 <b>거의 확실한 수렴은 아닙니다</b>. 부분수열 n = 2<sup>k</sup>(고리 표시)만 보면 ω > 0인 모든 경로가 결국 0이 됩니다.',
      ask: '추정량의 “약한 일치성”(확률수렴)과 “강한 일치성”(거의 확실한 수렴)은 표본을 계속 늘려 가는 한 사람의 경험에서 어떻게 다를까요?',
      math: '$X_n\\xrightarrow{P}X$: 모든 $\\varepsilon>0$에 대해 $P(|X_n-X|>\\varepsilon)\\to0$. $X_n\\xrightarrow{a.s.}X$: $P(\\{\\omega:X_n(\\omega)\\to X(\\omega)\\})=1$. a.s. ⇒ P이지만 역은 거짓(이 예). 대신 <b>리스 정리</b>: 확률수렴하면 거의 확실히 수렴하는 부분수열이 있다. <b>보렐–칸텔리</b>: $\\sum P(A_n)<\\infty$이면 $P(A_n\\text{ 무한히 자주})=0$. 여기서 $\\sum2^{-k}\\cdot2^k=\\infty$이고, 부분수열에서는 $\\sum2^{-k}<\\infty$.',
    },
    actions: [
      { label: 'n 끝까지 재생', run: (a) => a.play(), primary: true },
      { label: '다른 ω 고르기', run: (a) => a.randomOmega() },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4;
      const NMAX = 255;
      const st = { n: 11, w: 0.3 };
      let timer = null;
      const r0 = ctx.rng(71);
      const c = ctx.controls([{ title: '수열과 ω', items: [
        { type: 'range', key: 'n', label: 'n', min: 1, max: NMAX, step: 1, value: 11, fmt: (v) => `${v}` },
        { type: 'range', key: 'w', label: '고정한 ω', min: 0.001, max: 0.999, step: 0.001, value: 0.3, fmt: (v) => v.toFixed(3) },
        { type: 'buttons', items: [{ key: 'play', label: '재생', primary: true }, { key: 'rand', label: '무작위 ω' }] },
      ] }], (k, v) => {
        if (k === 'play') return api.play();
        if (k === 'rand') return api.randomOmega();
        st[k] = v; api.render();
      });
      ctx.legend([['m4sw-blk', 'Xₙ = 1인 구간'], ['m4sw-hl', '고정한 ω'], ['m4sw-dot', 'Xₘ(ω)'], ['m4sw-ring', '부분수열 m = 2ᵏ'], ['m4sw-curve', 'P(Xₘ = 1) = 2⁻ᵏ']]);
      const kj = (n) => { const k = Math.floor(Math.log2(n)); return [k, n - Math.pow(2, k)]; };
      const X = (m, w) => { const [k, j] = kj(m), s = Math.pow(2, k); return w >= j / s && w < (j + 1) / s ? 1 : 0; };
      const api = {
        randomOmega() { st.w = Math.round((0.001 + 0.998 * r0.random()) * 1000) / 1000; c.set('w', st.w); api.render(); },
        play() {
          if (timer) { clearInterval(timer); timer = null; return; }
          st.n = 1; c.set('n', 1); api.render();
          timer = ctx.every(ctx.S.reduceMotion() ? 300 : 70, () => {
            if (st.n >= NMAX) { clearInterval(timer); timer = null; return; }
            st.n++; c.set('n', st.n); api.render();
          });
        },
        render() {
          const el = ctx.el;
          el.innerHTML = '';
          const [k, j] = kj(st.n), s = Math.pow(2, k);
          const f1 = u.panel(el, `X<sub>${st.n}</sub>: n = 2<sup>${k}</sup> + ${j}`, `[${j}/${s}, ${j + 1}/${s}) 위에서만 1`);
          const P = M4.plot(f1, { height: 150, x: [0, 1], y: [0, 1.2], yNice: false, yTicks: 2, xLabel: 'ω', aria: '타자기 수열의 현재 항' });
          P.plot.append('rect').attr('class', 'm4-area').attr('x', P.x(j / s)).attr('width', Math.max(1.5, P.x(1 / s) - P.x(0))).attr('y', P.y(1)).attr('height', P.ih - P.y(1));
          P.plot.append('line').attr('class', 'm4-omline').attr('x1', P.x(st.w)).attr('x2', P.x(st.w)).attr('y1', 0).attr('y2', P.ih);
          P.plot.append('text').attr('class', 'm4-lab hl').attr('x', P.x(st.w) + (st.w > 0.8 ? -6 : 6)).attr('y', 12).attr('text-anchor', st.w > 0.8 ? 'end' : 'start').text(`ω = ${st.w.toFixed(3)}`);
          const f2 = u.panel(el, `ω = ${st.w.toFixed(3)}의 경로 Xₘ(ω), m = 1 … ${NMAX}`, '세로 점선 = 새 단계 k의 시작 (m = 2ᵏ). 각 단계에서 정확히 한 번 1');
          const Q = M4.plot(f2, { height: 210, x: [1, 256], xType: 'log', y: [-0.08, 1.12], yNice: false, yTicks: 2, xTickValues: [1, 2, 4, 8, 16, 32, 64, 128, 256], xFormat: d3.format('d'), xLabel: 'm (로그 눈금)', aria: '고정한 ω의 경로' });
          for (let kk = 0; kk <= 8; kk++) Q.plot.append('line').attr('class', 'm4-sep').attr('x1', Q.x(Math.pow(2, kk))).attr('x2', Q.x(Math.pow(2, kk))).attr('y1', 0).attr('y2', Q.ih);
          const pk = [];
          for (let kk = 0; kk < 8; kk++) pk.push([Q.x(Math.pow(2, kk)), Q.y(Math.pow(2, -kk))], [Q.x(Math.pow(2, kk + 1)), Q.y(Math.pow(2, -kk))]);
          u.path(Q.plot, pk, 'm4-curve');
          let ones = 0, lastOne = 0;
          for (let m = 1; m <= NMAX; m++) {
            const v = X(m, st.w), on = m <= st.n;
            if (v && on) { ones++; lastOne = m; }
            Q.plot.append('circle').attr('class', 'm4-pdot' + (v ? ' one' : '') + (on ? '' : ' off')).attr('cx', Q.x(m + 0.5)).attr('cy', Q.y(v)).attr('r', v ? 4 : 2);
          }
          for (let kk = 0; kk <= 7; kk++) { const m = Math.pow(2, kk); Q.plot.append('circle').attr('class', 'm4-ring' + (m <= st.n ? '' : ' off')).attr('cx', Q.x(m + 0.5)).attr('cy', Q.y(X(m, st.w))).attr('r', 7); }
          Q.plot.append('line').attr('class', 'm4-omline').attr('x1', Q.x(st.n + 0.5)).attr('x2', Q.x(st.n + 0.5)).attr('y1', 0).attr('y2', Q.ih);
          const kSub = Math.ceil(Math.log2(1 / st.w) + 1e-12);
          ctx.readouts([
            ['n = 2ᵏ + j', `k = ${k}, j = ${j}`],
            ['P(Xₙ = 1)', `2<sup>−${k}</sup> = ${Math.pow(2, -k).toFixed(4)}`],
            ['Xₙ(ω)', `${X(st.n, st.w)}`],
            ['지금까지 1이 나온 횟수', `${ones}<small>마지막: m = ${lastOne}. 단계마다 1번 → 무한히 반복</small>`],
            ['부분수열 X<sub>2ᵏ</sub>(ω)', `k ≥ ${kSub}부터 0<small>1{ω &lt; 2⁻ᵏ} → 0</small>`],
          ]);
        },
        destroy() { if (timer) clearInterval(timer); },
      };
      return api;
    },
  });

  /* ════════════════ B4 무한 동전 던지기 ════════════════ */
  scenes.push({
    id: 'B4', title: '무한 동전 던지기',
    card: {
      do: 'ω ∈ [0, 1]의 이진 전개 0.b₁b₂b₃…를 공정한 동전을 무한히 던진 기록으로 봅니다. 무작위 ω 20개의 앞면 비율 경로를 n = 10,000까지 그렸습니다. 예외 ω(1/4, 1/3)를 켜고, 직접 유리수를 넣어 보세요.',
      see: '무작위 경로는 모두 1/2로 모이고 띠(±2 표준편차) 안에 머뭅니다. 하지만 1/4 = 0.01000…은 비율이 0으로, 1/3 = 0.0101…은 1/2로 가지만 “11”이 한 번도 나오지 않습니다. 이런 예외 ω는 무한히(셀 수 없이) 많지만, 그 모임의 측도는 0입니다.',
      ask: '“앞면 비율이 1/2로 수렴한다”는 사건을 유한 번의 던지기로 확인할 수 있나요? 이 사건을 만들려면 몇 번의 합집합·교집합이 필요한가요?',
      math: '$$A=\\Big\\{\\omega:\\tfrac{S_n(\\omega)}{n}\\to\\tfrac12\\Big\\}=\\bigcap_{m\\ge1}\\bigcup_{N\\ge1}\\bigcap_{n\\ge N}\\Big\\{\\big|\\tfrac{S_n}{n}-\\tfrac12\\big|<\\tfrac1m\\Big\\}$$ 셀 수 있는 연산으로 만든 사건이라 σ-대수 안에 있고, <b>강한 대수의 법칙</b>: $P(A)=1$. 무한 곱 측도는 <b>콜모고로프 확장 정리</b>로 존재합니다(여기서는 [0, 1]의 길이와 같음). 보렐의 정규수 정리: 거의 모든 ω에서 모든 길이 k의 비트열이 빈도 $2^{-k}$로 나타납니다.',
    },
    actions: [
      { label: '예외 ω 1/4, 1/3 켜기', run: (a) => a.exc(true), primary: true },
      { label: '새 ω 20개', run: (a) => a.reseed() },
      { label: '2/7 넣어 보기', run: (a) => a.custom('2/7') },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4;
      const N = 10000, NP = 20;
      const st = { off: 0, q4: false, q3: false, txt: '' };
      const c = ctx.controls([
        { title: '경로', items: [
          { type: 'buttons', items: [{ key: 'reseed', label: '새 ω 20개', primary: true }] },
          { type: 'check', key: 'q4', label: '예외 ω = 1/4 = 0.01000…₂', value: false },
          { type: 'check', key: 'q3', label: '예외 ω = 1/3 = 0.010101…₂', value: false },
          { type: 'text', key: 'txt', label: '직접 넣기 (예: 5/7, 0.3)', value: '', placeholder: 'p/q 또는 소수' },
        ] },
      ], (k, v) => {
        if (k === 'reseed') return api.reseed();
        st[k] = v; api.render();
      });
      ctx.legend([['m4sw-path', '무작위 ω 20개'], ['m4sw-band', '1/2 ± 1/√n (±2 표준편차)'], ['m4sw-hl', '예외 ω']]);
      const idx = [...new Set(d3.range(0, 241).map((i) => Math.round(Math.pow(10, (4 * i) / 240))))].filter((v) => v >= 1 && v <= N);
      function pathOf(bits) {
        let s = 0, pairs = 0;
        const fr = new Float64Array(N + 1);
        for (let i = 1; i <= N; i++) { s += bits[i - 1]; fr[i] = s / i; if (i >= 2 && bits[i - 1] && bits[i - 2]) pairs++; }
        return { fr, head: bits.slice(0, 24).join(''), pairs: pairs / (N - 1) };
      }
      function ratBits(p, q) {
        const b = new Uint8Array(N);
        if (p >= q) { b.fill(1); return b; }
        let r = p;
        for (let i = 0; i < N; i++) { r *= 2; if (r >= q) { b[i] = 1; r -= q; } }
        return b;
      }
      function parse(t) {
        t = (t || '').trim();
        if (!t) return null;
        let m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (m) { const p = +m[1], q = +m[2]; if (q > 0 && p <= q && q <= 1e9) { const g = M4.gcd(p, q) || 1; return [p / g, q / g]; } return 'err'; }
        m = t.match(/^0?\.(\d{1,9})$/);
        if (m) { const q = Math.pow(10, m[1].length), p = +m[1], g = M4.gcd(p, q) || 1; return [p / g, q / g]; }
        if (t === '0' || t === '1') return [+t, 1];
        return 'err';
      }
      let rand = [];
      function build() {
        rand = Array.from({ length: NP }, (_, p) => { const r = ctx.rng(200 + st.off * 31 + p), b = new Uint8Array(N); for (let i = 0; i < N; i++) b[i] = r.random() < 0.5 ? 1 : 0; return pathOf(b); });
      }
      build();
      const api = {
        reseed() { st.off++; build(); api.render(); },
        exc(on) { st.q4 = on; st.q3 = on; c.set('q4', on); c.set('q3', on); api.render(); },
        custom(t) { st.txt = t; c.set('txt', t); api.render(); },
        render() {
          const el = ctx.el;
          el.innerHTML = '';
          const f1 = u.panel(el, '앞면 비율 Sₙ/n', `무작위 ω ${NP}개와 예외 ω (가로축 로그 눈금)`);
          const P = M4.plot(f1, { height: 300, x: [1, N], xType: 'log', y: [0, 1], yNice: false, yTicks: 4, xTickValues: [1, 10, 100, 1000, 10000], xFormat: d3.format(','), xLabel: '던진 횟수 n', yLabel: '앞면 비율', aria: '앞면 비율 경로' });
          const band = [], band2 = [];
          idx.forEach((n) => { const h = Math.min(0.5, 1 / Math.sqrt(n)); band.push([P.x(n), P.y(0.5 + h)]); band2.unshift([P.x(n), P.y(0.5 - h)]); });
          P.plot.append('path').attr('class', 'm4-sband').attr('d', u.line(band.concat(band2)) + 'Z');
          P.plot.append('line').attr('class', 'm4-hline lim').attr('x1', 0).attr('x2', P.iw).attr('y1', P.y(0.5)).attr('y2', P.y(0.5));
          rand.forEach((pp) => u.path(P.plot, idx.map((n) => [P.x(n), P.y(pp.fr[n])]), 'm4-cpath'));
          const ex = [];
          if (st.q4) ex.push(['1/4', pathOf(ratBits(1, 4))]);
          if (st.q3) ex.push(['1/3', pathOf(ratBits(1, 3))]);
          const pr = parse(st.txt);
          if (Array.isArray(pr)) ex.push([`${pr[0]}/${pr[1]}`, pathOf(ratBits(pr[0], pr[1]))]);
          ex.forEach(([lab, pp], i) => {
            u.path(P.plot, idx.map((n) => [P.x(n), P.y(pp.fr[n])]), 'm4-cpath ex' + (i ? ' ex' + i : ''));
            P.plot.append('text').attr('class', 'm4-lab hl').attr('x', P.iw - 4).attr('y', P.y(pp.fr[N]) + (pp.fr[N] > 0.9 ? 14 : -5) + i * 0).attr('text-anchor', 'end').text(`ω = ${lab}`);
          });
          let inside = 0;
          rand.forEach((pp) => { if (Math.abs(pp.fr[N] - 0.5) < 1 / Math.sqrt(N)) inside++; });
          const rows = rand.slice(0, 3).map((pp, i) => [`무작위 ${i + 1}`, `<code>0.${pp.head}…</code>`, pp.fr[N].toFixed(4), pp.pairs.toFixed(4)])
            .concat(ex.map(([lab, pp]) => ({ cls: 'ex', cells: [`ω = ${lab}`, `<code>0.${pp.head}…</code>`, pp.fr[N].toFixed(4), pp.pairs.toFixed(4)] })));
          ctx.extra.innerHTML = u.table(['ω', '이진 전개 (앞 24자리)', `n = 10⁴의 앞면 비율`, '연속한 “11”의 빈도'], rows, { caption: '정규수라면 앞면 비율 → 1/2, “11” 빈도 → 1/4' })
            + (pr === 'err' ? '<p class="hint warn">입력은 0 이상 1 이하의 분수(p/q) 또는 0.xxx 꼴 소수로 넣어 주세요.</p>' : '');
          ctx.readouts([
            ['던진 횟수', ctx.S.fInt(N)],
            ['띠 안의 무작위 경로', `${inside} / ${NP}<small>기대 약 95%</small>`],
            ['예외 ω', ex.length ? ex.map(([lab, pp]) => `${lab} → ${pp.fr[N].toFixed(3)}`).join(', ') : '끔'],
            ['예외 집합의 측도', '0<small>셀 수 없이 많아도</small>'],
          ]);
        },
      };
      return api;
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
