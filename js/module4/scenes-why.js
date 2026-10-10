/* 모듈 4A 왜 측도론인가 (PRD_module4 5장 A1~A5) */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});
  const scenes = ((RVL.m4scenes = RVL.m4scenes || {}).why = []);
  const U = () => RVL.m4ui;

  /* ════════════════ A1 질량을 옮기는 함수 ════════════════ */
  scenes.push({
    id: 'A1', title: '질량을 옮기는 함수',
    card: {
      do: '아래 띠 Ω = [0, 1]을 같은 확률의 블록으로 나눴습니다. 확률변수 X = Q(ω)가 블록마다 실수선의 어느 곳으로 옮기는지 보세요. 블록을 누르면 그 블록을 따라갑니다. 분포를 바꿔 가며 비교해 보세요.',
      see: '분포는 <b>Ω에 있던 확률 1을 X가 실수선으로 옮겨 쌓은 모양</b>입니다. 정규·지수에서는 블록이 넓게 펴져 <b>밀도</b>가 되고, 이항에서는 여러 블록이 한 점에 모여 <b>점 질량</b>이 됩니다. 대기 시간은 둘 다, 칸토어는 둘 다 아닙니다. 그래도 아래 CDF는 다섯 경우 모두 똑같은 방법으로 그려집니다.',
      ask: '블록 수를 200개로 늘리면 정규분포의 막대 높이는 무엇에 가까워지나요? 칸토어에서는 어떻게 되나요? (A3에서 다시 봅니다)',
      math: '$$P_X(B)=P\\big(X^{-1}(B)\\big)=P(\\{\\omega: X(\\omega)\\in B\\}),\\qquad B\\in\\mathcal B(\\mathbb R)$$ 이 $P_X$를 X의 <b>분포</b>(푸시포워드 측도)라 합니다. 여기서는 $\\Omega=[0,1]$, $P=$ 길이, $X=Q=F^{-1}$로 잡았습니다(모듈 2의 역변환). 블록 $[a,b)$는 $P_X$에서 질량 $b-a$를 갖는 집합 $Q([a,b))$로 옮겨집니다. <a href="../module3/continuous.html">모듈 3의 역상</a>과 같은 그림입니다.',
    },
    actions: [
      { label: '정규분포', run: (a) => a.setDist('normal'), primary: true },
      { label: '이항분포', run: (a) => a.setDist('binomial') },
      { label: '대기 시간(혼합)', run: (a) => a.setDist('waiting') },
      { label: '칸토어', run: (a) => a.setDist('cantor') },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4;
      const st = { dist: 'normal', B: 20, hl: 6, playing: false };
      let timer = null;
      const c = ctx.controls([
        { title: '분포와 블록', items: [
          { type: 'select', key: 'dist', label: '분포', value: 'normal', options: Object.values(u.laws).map((l) => [l.id, l.name]) },
          { type: 'select', key: 'B', label: 'Ω를 나눈 블록 수', value: '20', options: [['10', '10개 (블록마다 0.1)'], ['20', '20개 (0.05)'], ['50', '50개 (0.02)'], ['200', '200개 (0.005)']] },
          { type: 'buttons', items: [{ key: 'next', label: '다음 블록', primary: true }, { key: 'play', label: '차례로 따라가기' }] },
          { type: 'hint', text: '아래 Ω 띠의 블록을 눌러도 강조할 수 있습니다.' },
        ] },
      ], (k, v) => {
        if (k === 'dist') { st.dist = v; api.render(); }
        if (k === 'B') { st.B = +v; st.hl = Math.min(st.hl, st.B - 1); api.render(); }
        if (k === 'next') { st.hl = (st.hl + 1) % st.B; api.render(); }
        if (k === 'play') togglePlay();
      });
      function togglePlay() {
        if (timer) { clearInterval(timer); timer = null; return; }
        timer = ctx.every(ctx.S.reduceMotion() ? 1400 : 650, () => { st.hl = (st.hl + 1) % st.B; api.render(); });
      }
      ctx.legend([['m4sw-blk', 'Ω의 블록 (확률 1/B)'], ['m4sw-hl', '강조한 블록'], ['m4sw-curve', '이론 밀도'], ['m4sw-cdf', 'CDF']]);

      function pieces(law, B) {
        const br = new Set();
        for (let i = 0; i <= B; i++) br.add(i / B);
        law.atoms.forEach((a) => { br.add(a.lo); br.add(a.hi); });
        const ps = [...br].filter((v) => v >= 0 && v <= 1).sort((a, b) => a - b);
        const out = [];
        for (let i = 0; i + 1 < ps.length; i++) {
          const s = ps[i], e = ps[i + 1];
          if (e - s < 1e-12) continue;
          const mid = (s + e) / 2;
          const blk = Math.min(B - 1, Math.floor(mid * B));
          const at = law.atoms.find((a) => mid > a.lo && mid < a.hi);
          if (at) out.push({ s, e, blk, atom: at.x, x0: at.x, x1: at.x });
          else out.push({ s, e, blk, atom: null, x0: law.Q(s === 0 ? 1e-12 : s), x1: law.Q(e - 1e-12) });
        }
        return out;
      }

      const api = {
        setDist(id) { st.dist = id; c.set('dist', id); api.render(); },
        render() {
          const law = u.laws[st.dist], B = st.B;
          const el = ctx.el;
          el.innerHTML = '';
          const ps = pieces(law, B);
          const [lo, hi] = law.range;
          const clip = (v) => Math.max(lo, Math.min(hi, v));
          // 막대 높이(질량/폭)와 점 질량
          const bars = [], atomMass = new Map();
          let hmax = 0;
          for (const p of ps) {
            if (p.atom != null) { atomMass.set(p.atom, (atomMass.get(p.atom) || 0) + (p.e - p.s)); continue; }
            const a = clip(p.x0), b = clip(p.x1);
            const tail = a !== p.x0 || b !== p.x1;
            const w = Math.max(b - a, 1e-12);
            const h = (p.e - p.s) / w;
            bars.push({ p, a, b, h, tail });
            if (!tail) hmax = Math.max(hmax, h);
          }
          let dmax = 0;
          if (law.dens) for (let i = 0; i <= 200; i++) dmax = Math.max(dmax, law.dens(lo + ((hi - lo) * i) / 200));
          const hasDensAxis = law.kind !== 'd';
          const ytop = law.kind === 'sc' ? Math.min(Math.max(hmax, 2), 14) : Math.max(dmax * 1.35, Math.min(hmax, dmax * 2.2), 0.2);
          const maxAtom = Math.max(0, ...atomMass.values());
          const fig = u.panel(el, '확률 1을 실수선으로 옮기기', `아래 Ω = [0, 1]의 블록이 띠를 따라 위로 옮겨져 쌓입니다. 막대 = 블록 질량 ÷ 차지한 폭${law.atoms.length ? ', 줄기 = 한 점에 모인 질량(오른쪽 축)' : ''}`);
          const P = M4.plot(fig, {
            height: 420, x: law.range, y: [0, hasDensAxis ? ytop : Math.max(0.3, maxAtom * 1.2)], yNice: false,
            margin: { bottom: 190, right: law.atoms.length && hasDensAxis ? 50 : 16 },
            yLabel: hasDensAxis ? '밀도 (질량 ÷ 폭)' : '점 질량', aria: `${law.name}의 푸시포워드 그림`,
          });
          const { g, iw, ih, x, y } = P;
          const yM = hasDensAxis ? d3.scaleLinear().domain([0, Math.max(0.35, maxAtom * 1.25)]).range([ih, 0]) : y;
          if (law.atoms.length && hasDensAxis) {
            g.append('g').attr('class', 'axis').attr('transform', `translate(${iw},0)`).call(d3.axisRight(yM).ticks(4).tickSizeOuter(0));
            g.append('text').attr('class', 'axis-label').attr('transform', `translate(${iw + 42},${ih / 2}) rotate(90)`).attr('text-anchor', 'middle').text('점 질량');
          }
          const yT = ih + 28, yB = ih + 140, xo = d3.scaleLinear().domain([0, 1]).range([0, iw]);
          const isHL = (blk) => blk === st.hl;
          // 띠
          const bandG = g.append('g');
          for (const p of ps) {
            const a = x(clip(p.x0)), b = x(clip(p.x1));
            bandG.append('path').attr('class', 'm4-band' + (p.blk % 2 ? ' alt' : '') + (isHL(p.blk) ? ' hl' : ''))
              .attr('d', `M${a},${yT}L${b},${yT}L${xo(p.e)},${yB}L${xo(p.s)},${yB}Z`);
          }
          // 막대
          for (const r of bars) {
            const hh = Math.min(r.h, ytop * 1.02);
            P.plot.append('rect').attr('class', 'm4-blk' + (r.p.blk % 2 ? ' alt' : '') + (isHL(r.p.blk) ? ' hl' : '') + (r.tail ? ' tail' : ''))
              .attr('x', x(r.a)).attr('width', Math.max(0.6, x(r.b) - x(r.a))).attr('y', y(hh)).attr('height', ih - y(hh));
            if (r.h > ytop * 1.02 && x(r.b) - x(r.a) > 1) P.plot.append('text').attr('class', 'm4-clip').attr('x', (x(r.a) + x(r.b)) / 2).attr('y', 10).attr('text-anchor', 'middle').text('▲');
          }
          // 점 질량: 블록 조각을 쌓은 줄기
          const acc = new Map();
          for (const p of ps) {
            if (p.atom == null) continue;
            const base = acc.get(p.atom) || 0;
            const top = base + (p.e - p.s);
            acc.set(p.atom, top);
            g.append('rect').attr('class', 'm4-stack' + (p.blk % 2 ? ' alt' : '') + (isHL(p.blk) ? ' hl' : ''))
              .attr('x', x(p.atom) - 4).attr('width', 8).attr('y', yM(top)).attr('height', Math.max(0.5, yM(base) - yM(top)));
          }
          atomMass.forEach((m, xv) => { if (m > 0.004) g.append('text').attr('class', 'm4-lab').attr('x', x(xv)).attr('y', yM(m) - 5).attr('text-anchor', 'middle').text(m.toFixed(m < 0.1 ? 3 : 2)); });
          if (law.dens) u.drawDens(P, law);
          // Ω 띠
          const om = g.append('g').attr('class', 'm4-omega');
          for (let i = 0; i < B; i++) {
            om.append('rect').attr('class', 'm4-oblk' + (i % 2 ? ' alt' : '') + (isHL(i) ? ' hl' : ''))
              .attr('x', xo(i / B)).attr('width', Math.max(0.5, xo(1 / B) - xo(0))).attr('y', yB).attr('height', 18)
              .attr('tabindex', B <= 50 ? 0 : null).attr('role', B <= 50 ? 'button' : null).attr('aria-label', `블록 ${i + 1}`)
              .on('click', () => { st.hl = i; api.render(); })
              .on('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); st.hl = i; api.render(); } });
          }
          [0, 0.25, 0.5, 0.75, 1].forEach((v) => g.append('text').attr('class', 'm4-tick').attr('x', xo(v)).attr('y', yB + 32).attr('text-anchor', v === 0 ? 'start' : v === 1 ? 'end' : 'middle').text(v));
          g.append('text').attr('class', 'm4-lab strong').attr('x', iw / 2).attr('y', yB + 48).attr('text-anchor', 'middle').text('Ω = [0, 1], P = 길이');
          g.append('text').attr('class', 'm4-lab').attr('x', 0).attr('y', yT + 52).text('X = Q(ω)');

          // CDF
          const fig2 = u.panel(el, '누적분포함수 F(x) = P(X ≤ x)', 'F의 세로축이 곧 Ω입니다. 강조한 블록 [a, b)는 F의 높이 a~b 구간입니다.');
          const C = M4.plot(fig2, { height: 210, x: law.range, y: [0, 1], yNice: false, yTicks: 4, xLabel: 'x', aria: `${law.name}의 CDF` });
          const a0 = st.hl / B, b0 = (st.hl + 1) / B;
          C.plot.append('rect').attr('class', 'm4-hlband').attr('x', 0).attr('width', C.iw).attr('y', C.y(b0)).attr('height', C.y(a0) - C.y(b0));
          const qa = clip(law.Q(a0 === 0 ? 1e-12 : a0)), qb = clip(law.Q(b0 - 1e-12));
          C.plot.append('rect').attr('class', 'm4-hlband v').attr('x', C.x(qa) - (qa === qb ? 1.5 : 0)).attr('width', Math.max(3, C.x(qb) - C.x(qa))).attr('y', 0).attr('height', C.ih);
          u.drawCdf(C, law, 'm4-cdf');

          const atomsTotal = [...atomMass.values()].reduce((s, v) => s + v, 0);
          ctx.readouts([
            ['분포', law.name],
            ['구성', u.KIND[law.kind]],
            ['강조한 블록', `ω ∈ [${a0.toFixed(3)}, ${b0.toFixed(3)})`],
            ['옮겨진 곳', qa === qb ? `한 점 x = ${qa}` : `x ∈ [${qa.toFixed(3)}, ${qb.toFixed(3)}]`],
            ['점 질량의 합', atomsTotal.toFixed(3)],
            ['전체 질량', '1 (블록 질량의 합)'],
          ]);
        },
        destroy() { if (timer) clearInterval(timer); },
      };
      return api;
    },
  });

  /* ════════════════ A2 밀도는 무엇에 대한 밀도인가 ════════════════ */
  const NU = [
    ['lam', 'λ', '르베그 측도 (길이)'],
    ['cnt', '#<sub>ℤ</sub>', '정수 셈측도'],
    ['dl', 'δ<sub>0</sub> + λ', '0에 점 하나 + 길이'],
    ['self', 'P', '분포 자신'],
  ];
  const PS = ['binomial', 'normal', 'waiting', 'cantor'];
  const q0 = 0.3;
  const p10 = 1 - Math.pow(0.7, 10);
  const CASES = {
    binomial: {
      lam: { ok: false, A: { type: 'pts', xs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], tex: 'A=\\{0,1,\\dots,10\\}', nuA: 0, PA: 1 } },
      cnt: { ok: true, rn: 'pmf', tex: '\\frac{dP}{d\\#}(k)=\\binom{10}{k}0.3^k0.7^{10-k}', note: '확률질량함수가 바로 셈측도에 대한 밀도' },
      dl: { ok: false, A: { type: 'pts', xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], tex: 'A=\\{1,\\dots,10\\}', nuA: 0, PA: p10 } },
      self: { ok: true, rn: 'one', tex: '\\frac{dP}{dP}=1', note: '자기 자신에 대한 밀도는 언제나 1' },
    },
    normal: {
      lam: { ok: true, rn: 'dens', tex: '\\frac{dP}{d\\lambda}(x)=\\varphi(x)', note: '우리가 알던 확률밀도함수' },
      cnt: { ok: false, A: { type: 'offint', from: -Infinity, tex: 'A=\\mathbb R\\setminus\\mathbb Z', nuA: 0, PA: 1 } },
      dl: { ok: true, rn: 'dens0', tex: '\\frac{dP}{d(\\delta_0+\\lambda)}(x)=\\begin{cases}\\varphi(x)&x\\ne0\\\\0&x=0\\end{cases}', note: '기준 측도가 더 커도 괜찮다. 0에서의 값만 0으로 바뀐다' },
      self: { ok: true, rn: 'one', tex: '\\frac{dP}{dP}=1', note: '자기 자신에 대한 밀도는 언제나 1' },
    },
    waiting: {
      lam: { ok: false, A: { type: 'pts', xs: [0], tex: 'A=\\{0\\}', nuA: 0, PA: q0 } },
      cnt: { ok: false, A: { type: 'offint', from: 0, tex: 'A=(0,\\infty)\\setminus\\mathbb Z', nuA: 0, PA: 1 - q0 } },
      dl: { ok: true, rn: 'mixed', tex: '\\frac{dP}{d(\\delta_0+\\lambda)}(x)=\\begin{cases}q&x=0\\\\(1-q)e^{-x}&x>0\\end{cases}', note: '점 질량과 밀도를 한 함수로. C1의 가능도가 바로 이것' },
      self: { ok: true, rn: 'one', tex: '\\frac{dP}{dP}=1', note: '자기 자신에 대한 밀도는 언제나 1' },
    },
    cantor: {
      lam: { ok: false, A: { type: 'cantor', tex: 'A=C\\ (\\text{칸토어 집합})', nuA: 0, PA: 1 } },
      cnt: { ok: false, A: { type: 'cantor', ints: true, tex: 'A=C\\setminus\\{0,1\\}', nuA: 0, PA: 1 } },
      dl: { ok: false, A: { type: 'cantor', zero: true, tex: 'A=C\\setminus\\{0\\}', nuA: 0, PA: 1 } },
      self: { ok: true, rn: 'one', tex: '\\frac{dP}{dP}=1', note: '칸토어 분포는 자기 자신 말고는 이 표의 어떤 기준에도 밀도가 없다' },
    },
  };
  scenes.push({
    id: 'A2', title: '밀도는 무엇에 대한 밀도인가',
    card: {
      do: '아래 표에서 분포 P(행)와 기준 측도 ν(열)를 하나씩 골라 보세요. ✓ 칸은 P의 ν에 대한 밀도 dP/dν를, ✗ 칸은 ν로는 크기가 0인데 P로는 확률이 있는 <b>증인 집합 A</b>를 보여 줍니다.',
      see: '확률질량함수는 <b>셈측도에 대한 밀도</b>, 확률밀도함수는 <b>길이(르베그 측도)에 대한 밀도</b>입니다. 같은 개념의 두 경우일 뿐입니다. 혼합분포는 δ<sub>0</sub> + λ를 기준으로 잡으면 밀도 하나로 쓸 수 있습니다. 칸토어 분포는 어떤 기준에도 밀도가 없습니다.',
      ask: '이항분포는 왜 λ에 대한 밀도가 없을까요? 증인 집합 A = {0, 1, …, 10}의 길이와 확률을 비교해 보세요.',
      math: '<b>절대연속</b> $P\\ll\\nu$: $\\nu(A)=0\\Rightarrow P(A)=0$. <b>라돈–니코딤 정리</b>: ν가 σ-유한이고 $P\\ll\\nu$이면 $$P(A)=\\int_A f\\,d\\nu\\quad(\\text{모든 }A)$$ 를 만족하는 $f=dP/d\\nu\\ge0$이 ν-거의 어디서나 유일하게 존재한다. 이산형 $f=p$($\\nu=\\#$), 연속형 $f=$ pdf($\\nu=\\lambda$). ✗ 칸의 증인 집합 A는 $P\\not\\ll\\nu$의 증거입니다.',
    },
    actions: [
      { label: '이항 × 셈측도', run: (a) => a.pick('binomial', 'cnt'), primary: true },
      { label: '이항 × 길이', run: (a) => a.pick('binomial', 'lam') },
      { label: '대기 시간 × δ₀ + λ', run: (a) => a.pick('waiting', 'dl') },
      { label: '칸토어 × 길이', run: (a) => a.pick('cantor', 'lam') },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4;
      const st = { p: 'waiting', nu: 'dl' };
      ctx.controls([{ title: '표 사용법', items: [{ type: 'hint', text: '그림 아래 표의 칸을 누르거나 Tab으로 이동해 Enter를 누르세요. ✓ = 밀도 dP/dν가 있음, ✗ = 없음(증인 집합 표시).' }] }], () => {});
      ctx.legend([['m4sw-curve', '밀도 · 점 질량 (P)'], ['m4sw-nu', '기준 측도 ν'], ['m4sw-hl', '증인 집합 A'], ['m4sw-rn', 'dP/dν']]);

      function drawP(P, law) {
        if (law.dens) u.drawDens(P, law);
        for (const a of law.atoms) {
          P.plot.append('line').attr('class', 'm4-stem').attr('x1', P.x(a.x)).attr('x2', P.x(a.x)).attr('y1', P.y(0)).attr('y2', P.y(a.p));
          P.plot.append('circle').attr('class', 'm4-stemdot').attr('cx', P.x(a.x)).attr('cy', P.y(a.p)).attr('r', 3.5);
        }
        if (law.kind === 'sc') {
          const k = 5, h = Math.pow(1.5, k);
          M4.cantor.intervals(k).forEach(([a, b]) => P.plot.append('rect').attr('class', 'm4-blk').attr('x', P.x(a)).attr('width', Math.max(0.8, P.x(b) - P.x(a))).attr('y', P.y(h)).attr('height', P.ih - P.y(h)));
          P.plot.append('text').attr('class', 'm4-lab').attr('x', P.iw - 4).attr('y', 14).attr('text-anchor', 'end').text('폭 3⁻⁵ 막대: 높이 (3/2)⁵ ≈ 7.6, 더 좁히면 → ∞');
        }
      }
      function drawNu(Nv, law, nu) {
        const [lo, hi] = law.range, g = Nv.plot, yb = Nv.ih - 4;
        const lamBand = () => g.append('rect').attr('class', 'm4-nuband').attr('x', 0).attr('width', Nv.iw).attr('y', yb - 14).attr('height', 14);
        const ints = () => { for (let k = Math.ceil(lo); k <= hi; k++) { g.append('line').attr('class', 'm4-nustem').attr('x1', Nv.x(k)).attr('x2', Nv.x(k)).attr('y1', yb).attr('y2', yb - 26); g.append('circle').attr('class', 'm4-nudot').attr('cx', Nv.x(k)).attr('cy', yb - 26).attr('r', 3.5); } };
        if (nu === 'lam') { lamBand(); g.append('text').attr('class', 'm4-lab').attr('x', 6).attr('y', yb - 20).text('λ: 구간마다 길이'); }
        if (nu === 'cnt') { ints(); g.append('text').attr('class', 'm4-lab').attr('x', 6).attr('y', 12).text('#ℤ: 정수 하나마다 1'); }
        if (nu === 'dl') {
          lamBand();
          g.append('line').attr('class', 'm4-nustem').attr('x1', Nv.x(0)).attr('x2', Nv.x(0)).attr('y1', yb).attr('y2', yb - 34);
          g.append('circle').attr('class', 'm4-nudot').attr('cx', Nv.x(0)).attr('cy', yb - 34).attr('r', 4);
          g.append('text').attr('class', 'm4-lab').attr('x', Nv.x(0) + 8).attr('y', yb - 30).text('δ₀ + λ');
        }
        if (nu === 'self') { g.append('text').attr('class', 'm4-lab').attr('x', 6).attr('y', 14).text('ν = P: 위 그림과 같은 측도'); lamBand().attr('class', 'm4-nuband faint'); }
      }
      function drawWitness(P, A, yAt) {
        const g = P.plot;
        if (A.type === 'pts') A.xs.forEach((v) => g.append('circle').attr('class', 'm4-witness').attr('cx', P.x(v)).attr('cy', yAt).attr('r', 6));
        if (A.type === 'offint') {
          const [lo, hi] = P.x.domain();
          const a = Math.max(lo, A.from === -Infinity ? lo : A.from);
          g.append('line').attr('class', 'm4-witline').attr('x1', P.x(a)).attr('x2', P.x(hi)).attr('y1', yAt).attr('y2', yAt);
          for (let k = Math.ceil(a); k <= hi; k++) g.append('circle').attr('class', 'm4-hole').attr('cx', P.x(k)).attr('cy', yAt).attr('r', 4.5);
          if (A.from === 0) g.append('circle').attr('class', 'm4-hole').attr('cx', P.x(0)).attr('cy', yAt).attr('r', 4.5);
        }
        if (A.type === 'cantor') {
          M4.cantor.intervals(6).forEach(([a, b]) => g.append('rect').attr('class', 'm4-witrect').attr('x', P.x(a)).attr('width', Math.max(0.7, P.x(b) - P.x(a))).attr('y', yAt - 4).attr('height', 8));
          const holes = A.ints ? [0, 1] : A.zero ? [0] : [];
          holes.forEach((v) => g.append('circle').attr('class', 'm4-hole').attr('cx', P.x(v)).attr('cy', yAt).attr('r', 4.5));
        }
      }
      function drawRN(R, law, cs) {
        const g = R.plot, [lo, hi] = law.range;
        const curve = (fn, from) => u.path(g, d3.range(0, 401).map((i) => lo + ((hi - lo) * i) / 400).filter((v) => v > from).map((v) => [R.x(v), R.y(fn(v))]), 'm4-rn');
        if (cs.rn === 'dens') curve(law.dens, -Infinity);
        if (cs.rn === 'dens0') {
          curve(law.dens, -Infinity);
          g.append('circle').attr('class', 'm4-open rn').attr('cx', R.x(0)).attr('cy', R.y(law.dens(0))).attr('r', 4);
          g.append('circle').attr('class', 'm4-closed rn').attr('cx', R.x(0)).attr('cy', R.y(0)).attr('r', 4);
        }
        if (cs.rn === 'mixed') {
          curve(law.dens, 1e-9);
          g.append('circle').attr('class', 'm4-open rn').attr('cx', R.x(0)).attr('cy', R.y(1 - q0)).attr('r', 4);
          g.append('circle').attr('class', 'm4-closed rn').attr('cx', R.x(0)).attr('cy', R.y(q0)).attr('r', 4.5);
          g.append('text').attr('class', 'm4-lab').attr('x', R.x(0) + 8).attr('y', R.y(q0) + 4).text('x = 0에서 q = 0.3');
        }
        if (cs.rn === 'pmf' || (cs.rn === 'one' && law.kind === 'd')) {
          law.atoms.forEach((a) => {
            const v = cs.rn === 'pmf' ? a.p : 1;
            g.append('line').attr('class', 'm4-rnstem').attr('x1', R.x(a.x)).attr('x2', R.x(a.x)).attr('y1', R.y(0)).attr('y2', R.y(v));
            g.append('circle').attr('class', 'm4-closed rn').attr('cx', R.x(a.x)).attr('cy', R.y(v)).attr('r', 3.5);
          });
        } else if (cs.rn === 'one') {
          if (law.kind === 'sc') M4.cantor.intervals(6).forEach(([a, b]) => g.append('rect').attr('class', 'm4-rnrect').attr('x', R.x(a)).attr('width', Math.max(0.7, R.x(b) - R.x(a))).attr('y', R.y(1) - 1.5).attr('height', 3));
          else if (law.kind === 'mix') { curve(() => 1, 1e-9); g.append('circle').attr('class', 'm4-closed rn').attr('cx', R.x(0)).attr('cy', R.y(1)).attr('r', 4); }
          else curve(() => 1, -Infinity);
        }
      }

      const api = {
        pick(p, nu) { st.p = p; st.nu = nu; api.render(); },
        render() {
          const law = u.laws[st.p], cs = CASES[st.p][st.nu];
          const el = ctx.el;
          el.innerHTML = '';
          const ymax = law.kind === 'sc' ? 9 : law.kind === 'd' ? 0.32 : law.kind === 'mix' ? 0.8 : 0.45;
          const nuName = NU.find((n) => n[0] === st.nu);
          const f1 = u.panel(el, `P = ${law.name}`, law.kind === 'd' ? '줄기 = 점 질량' : law.kind === 'mix' ? '줄기 = 0의 점 질량 0.3, 곡선 = 양수 부분의 밀도' : law.kind === 'sc' ? '확률 1이 칸토어 집합(길이 0) 위에 있음' : '곡선 = 밀도');
          const P = M4.plot(f1, { height: 200, x: law.range, y: [0, ymax], yNice: false, yTicks: 4, margin: { bottom: 28 }, aria: `${law.name}의 질량 그림` });
          if (!cs.ok) drawWitness(P, cs.A, P.ih - 1);
          drawP(P, law);
          const f2 = u.panel(el, `기준 측도 ν = ${nuName[1]}`, nuName[2]);
          const Nv = M4.plot(f2, { height: 92, x: law.range, y: [0, 1], noY: true, margin: { bottom: 28, top: 6 }, aria: '기준 측도 그림' });
          drawNu(Nv, law, st.nu);
          if (!cs.ok) drawWitness(Nv, cs.A, Nv.ih - 7);
          if (cs.ok) {
            const rmax = cs.rn === 'one' ? 1.3 : cs.rn === 'pmf' ? 0.32 : cs.rn === 'mixed' ? 0.8 : 0.45;
            const f3 = u.panel(el, `밀도 dP/dν (${nuName[1]}에 대한)`, cs.note);
            const R = M4.plot(f3, { height: 170, x: law.range, y: [0, rmax], yNice: false, yTicks: 4, aria: '라돈–니코딤 도함수' });
            drawRN(R, law, cs);
            const tex = document.createElement('p');
            tex.className = 'm4-tex';
            tex.innerHTML = `$${cs.tex}$`;
            f3.appendChild(tex);
          } else {
            const box = document.createElement('div');
            box.className = 'm4-verdict bad';
            box.innerHTML = `<b>dP/dν 없음.</b> 증인 집합 $${cs.A.tex}$: $\\nu(A)=0$인데 $P(A)=${cs.A.PA === 1 ? '1' : cs.A.PA.toFixed(4)}$. 밀도 f가 있다면 $P(A)=\\int_A f\\,d\\nu=0$이어야 하므로 모순입니다.`;
            el.appendChild(box);
          }
          // 표
          ctx.extra.innerHTML = `<div class="m4-tablewrap"><table class="m4-table m4-grid"><caption>P ≪ ν 인가? (칸을 누르세요)</caption>
            <thead><tr><th scope="col">P \\ ν</th>${NU.map((n) => `<th scope="col">${n[1]}<small>${n[2]}</small></th>`).join('')}</tr></thead>
            <tbody>${PS.map((p) => `<tr><th scope="row">${u.laws[p].short}</th>${NU.map((n) => {
              const c2 = CASES[p][n[0]];
              const cur = p === st.p && n[0] === st.nu;
              return `<td><button type="button" class="m4-cell ${c2.ok ? 'ok' : 'no'}" data-p="${p}" data-nu="${n[0]}" aria-pressed="${cur}">${c2.ok ? '✓ 밀도 있음' : '✗ 없음'}</button></td>`;
            }).join('')}</tr>`).join('')}</tbody></table></div>`;
          ctx.extra.querySelectorAll('.m4-cell').forEach((b) => b.addEventListener('click', () => api.pick(b.dataset.p, b.dataset.nu)));
          ctx.math(el);
          ctx.readouts([
            ['P', law.name], ['ν', `${nuName[1].replace(/<[^>]+>/g, '')} (${nuName[2]})`],
            ['P ≪ ν ?', cs.ok ? '예 → dP/dν 존재' : '아니오'],
            ['ν(A) / P(A)', cs.ok ? '—' : `0 / ${cs.A.PA === 1 ? '1' : cs.A.PA.toFixed(4)}`],
          ]);
        },
      };
      return api;
    },
  });

  /* ════════════════ A3 칸토어 분포 ════════════════ */
  scenes.push({
    id: 'A3', title: '칸토어 분포: 밀도도 질량도 없는 분포',
    card: {
      do: '공정한 동전을 던져 삼진 전개의 자리마다 0 또는 2를 고르면 칸토어 분포의 표본이 됩니다. 표본 12만 개의 밀도 히스토그램을 구간 폭 3<sup>−k</sup>로 그렸습니다. k를 1부터 8까지 올려 보세요.',
      see: '모듈 1의 연속형에서는 구간을 좁히면 막대 꼭대기가 한 곡선으로 모였습니다. 여기서는 표본이 있는 칸이 정확히 <b>2<sup>k</sup>개</b>뿐이고, 막대 높이는 <b>(3/2)<sup>k</sup></b>로 끝없이 커집니다. 수렴할 곡선, 곧 밀도가 없습니다. 그런데도 한 점의 확률은 0이라 점 질량도 없습니다. 맨 아래 CDF(악마의 계단)는 연속이고 잘 정의됩니다.',
      ask: '표본이 들어간 칸들의 총길이 (2/3)<sup>k</sup>는 k → ∞에서 얼마가 되나요? 그 위에 확률 1이 모두 있다는 것은 무슨 뜻일까요?',
      math: '$$X=\\sum_{k\\ge1}\\frac{2B_k}{3^k},\\quad B_k\\overset{iid}{\\sim}\\text{Bernoulli}(1/2)$$ $P(X\\in C)=1$, $\\lambda(C)=\\lim(2/3)^k=0$, $P(X=x)=0$. 따라서 $P_X$는 λ에 대해 특이($P_X\\perp\\lambda$)이면서 연속입니다. $E[X]=1/2$, $\\mathrm{Var}(X)=1/8$. <a href="../module1/continuous.html">모듈 1 히스토그램</a>과 비교해 보세요.',
    },
    actions: [
      { label: 'k 하나 올리기', run: (a) => a.step(1), primary: true },
      { label: 'k = 1로', run: (a) => a.setK(1) },
      { label: 'k = 8로', run: (a) => a.setK(8) },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4;
      const n = 120000;
      const st = { k: 3 };
      const smp = (() => { const r = ctx.rng(31), s = M4.cantor.sampler(r), a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = s(); return a; })();
      const sorted = Float64Array.from(smp).sort();
      let mean = 0; for (const v of smp) mean += v; mean /= n;
      let vr = 0; for (const v of smp) vr += (v - mean) ** 2; vr /= n - 1;
      const c = ctx.controls([{ title: '구간 폭', items: [
        { type: 'range', key: 'k', label: 'k (구간 폭 3<sup>−k</sup>)', min: 1, max: 8, step: 1, value: 3, fmt: (v) => `${v}` },
        { type: 'check', key: 'uni', label: '비교: 균등분포 U(0, 1)도 같은 폭으로', value: false },
      ] }], (k, v) => { if (k === 'k') st.k = v; if (k === 'uni') st.uni = v; api.render(); });
      ctx.legend([['m4sw-blk', '칸토어 표본 히스토그램'], ['m4sw-hl', '높이 (3/2)ᵏ'], ['m4sw-cdf', 'CDF (악마의 계단)'], ['m4sw-ecdf', 'ECDF']]);
      const uni = (() => { const r = ctx.rng(32), a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = r.random(); return a; })();

      const api = {
        setK(k) { st.k = k; c.set('k', k); api.render(); },
        step(d) { api.setK(st.k >= 8 ? 1 : st.k + d); },
        render() {
          const el = ctx.el;
          el.innerHTML = '';
          const k = st.k, nb = Math.pow(3, k), w = 1 / nb;
          const cnt = new Map();
          for (const v of smp) { const i = Math.min(nb - 1, Math.floor(v * nb)); cnt.set(i, (cnt.get(i) || 0) + 1); }
          let hmax = 0;
          cnt.forEach((c2) => { hmax = Math.max(hmax, c2 / n / w); });
          const theo = Math.pow(1.5, k);
          const f1 = u.panel(el, `밀도 히스토그램 (구간 폭 3<sup>−${k}</sup> = ${w.toPrecision(3)})`, `막대 넓이의 합 = 1. 표본이 있는 칸 ${cnt.size}개`);
          const P = M4.plot(f1, { height: 230, x: [0, 1], y: [0, Math.max(theo * 1.18, 1.6)], yLabel: '밀도', xLabel: 'x', aria: '칸토어 히스토그램' });
          if (st.uni) {
            const cu = new Float64Array(nb);
            for (const v of uni) cu[Math.min(nb - 1, Math.floor(v * nb))]++;
            if (nb <= 800) for (let i = 0; i < nb; i++) P.plot.append('rect').attr('class', 'm4-ghostbar').attr('x', P.x(i * w)).attr('width', Math.max(0.5, P.x(w) - P.x(0))).attr('y', P.y(cu[i] / n / w)).attr('height', P.ih - P.y(cu[i] / n / w));
            else P.plot.append('rect').attr('class', 'm4-ghostbar').attr('x', 0).attr('width', P.iw).attr('y', P.y(1)).attr('height', P.ih - P.y(1));
          }
          cnt.forEach((c2, i) => {
            const h = c2 / n / w;
            P.plot.append('rect').attr('class', 'm4-blk').attr('x', P.x(i * w)).attr('width', Math.max(0.7, P.x(w) - P.x(0))).attr('y', P.y(h)).attr('height', P.ih - P.y(h));
          });
          P.plot.append('line').attr('class', 'm4-hline').attr('x1', 0).attr('x2', P.iw).attr('y1', P.y(theo)).attr('y2', P.y(theo));
          P.plot.append('text').attr('class', 'm4-lab hl').attr('x', P.iw - 4).attr('y', P.y(theo) - 5).attr('text-anchor', 'end').text(`(3/2)^${k} = ${theo.toFixed(2)}`);
          if (st.uni) P.plot.append('text').attr('class', 'm4-lab').attr('x', 4).attr('y', P.y(1) - 5).text('균등분포: 높이 1 근처에 모임');

          const f2 = u.panel(el, '칸토어 집합 만들기', '단계마다 남은 구간의 가운데 1/3을 지웁니다. 남는 구간 2ᵏ개, 총길이 (2/3)ᵏ');
          const rows = k + 1, rh = 13;
          const Cn = M4.plot(f2, { height: rows * (rh + 5) + 34, x: [0, 1], y: [0, 1], noY: true, margin: { top: 6, bottom: 26, left: 54 }, aria: '칸토어 집합 구성' });
          for (let j = 0; j <= k; j++) {
            const yy = 2 + j * (rh + 5);
            u.cantorDust(Cn, j, yy, rh, j === k ? 'm4-dust cur' : 'm4-dust');
            Cn.g.append('text').attr('class', 'm4-tick').attr('x', -8).attr('y', yy + rh - 2).attr('text-anchor', 'end').text(`${j}단계`);
          }

          const f3 = u.panel(el, 'CDF는 멀쩡하다', '계단처럼 평평한 구간(지운 곳)에서는 변하지 않고, 남은 곳(길이 0)에서만 0에서 1까지 오릅니다');
          const C = M4.plot(f3, { height: 200, x: [-0.02, 1.02], y: [0, 1], yNice: false, yTicks: 4, xLabel: 'x', aria: '칸토어 CDF' });
          const step = Math.max(1, Math.floor(n / 1500));
          const ep = [];
          for (let i = 0; i < n; i += step) ep.push([C.x(sorted[i]), C.y((i + 1) / n)]);
          u.path(C.plot, ep, 'm4-ecdf');
          u.drawCdf(C, u.laws.cantor, 'm4-cdf', { n: 1200 });

          ctx.readouts([
            ['칸 수 3ᵏ', ctx.S.fInt(nb)],
            ['표본이 있는 칸', `${cnt.size} (2ᵏ = ${Math.pow(2, k)})`],
            ['가장 높은 막대', `${hmax.toFixed(2)} (이론 ${theo.toFixed(2)})`],
            ['남은 길이 (2/3)ᵏ', Math.pow(2 / 3, k).toFixed(4)],
            ['표본 평균 / 분산', `${mean.toFixed(4)} / ${vr.toFixed(4)}<small>이론 0.5 / 0.125</small>`],
          ]);
        },
      };
      return api;
    },
  });

  /* ════════════════ A4 르베그 분해 탐색기 ════════════════ */
  scenes.push({
    id: 'A4', title: '르베그 분해 탐색기',
    card: {
      do: '세 성분의 가중치를 슬라이더로 정하세요(합이 1이 되도록 자동으로 나눕니다). 이산 성분은 0.25와 0.75에 반씩, 절대연속 성분은 Beta(2, 2), 특이연속 성분은 칸토어 분포입니다.',
      see: 'CDF에서 세 성분은 모양이 다릅니다. <b>이산</b>은 점프, <b>절대연속</b>은 매끈한 오름, <b>특이연속</b>은 점프도 기울기도 없이(거의 모든 곳에서 기울기 0) 오르는 악마의 계단입니다. PMF는 이산 성분만, PDF는 절대연속 성분만 설명합니다. CDF 하나는 셋을 모두 담고, 표본(ECDF)도 그것을 따라갑니다.',
      ask: '가중치가 (0.3, 0.5, 0.2)일 때 “PMF의 합”과 “PDF의 적분”은 각각 얼마인가요? 나머지 0.2는 어디에 있나요?',
      math: '<b>르베그 분해</b>: 실수선 위의 모든 확률측도는 유일하게 $$P=P_d+P_{ac}+P_{sc}$$ 로 나뉜다. $P_d=\\sum p_i\\delta_{x_i}$, $P_{ac}\\ll\\lambda$ (밀도 $f$), $P_{sc}$는 점 질량이 없고 $P_{sc}\\perp\\lambda$. CDF로는 $F=F_d+F_{ac}+F_{sc}$, $F_{ac}(x)=\\int_{-\\infty}^xf$, $F_{sc}$는 연속이고 거의 어디서나 $F_{sc}\'=0$. <b>르베그–스틸티어스 대응</b>: CDF 성질을 만족하는 F와 확률측도는 일대일입니다.',
    },
    actions: [
      { label: '셋 다 섞기', run: (a) => a.preset(0.3, 0.5, 0.2), primary: true },
      { label: '이산만', run: (a) => a.preset(1, 0, 0) },
      { label: '절대연속만', run: (a) => a.preset(0, 1, 0) },
      { label: '칸토어만', run: (a) => a.preset(0, 0, 1) },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4;
      const st = { wd: 0.3, wa: 0.5, ws: 0.2 };
      const nS = 4000;
      const base = (() => { const r = ctx.rng(41); return Array.from({ length: nS }, () => [r.random(), r.random(), r.random(), r.random(), r.random()]); })();
      const cs = M4.cantor;
      const c = ctx.controls([{ title: '성분 가중치 (합 1로 정규화)', items: [
        { type: 'range', key: 'wd', label: '이산 (0.25, 0.75에 점 질량)', min: 0, max: 1, step: 0.05, value: 0.3, fmt: (v) => v.toFixed(2) },
        { type: 'range', key: 'wa', label: '절대연속 Beta(2, 2)', min: 0, max: 1, step: 0.05, value: 0.5, fmt: (v) => v.toFixed(2) },
        { type: 'range', key: 'ws', label: '특이연속 (칸토어)', min: 0, max: 1, step: 0.05, value: 0.2, fmt: (v) => v.toFixed(2) },
      ] }], (k, v) => { st[k] = v; api.render(); });
      ctx.legend([['m4sw-stem', '이산 성분'], ['m4sw-curve', '절대연속 성분'], ['m4sw-dust', '특이연속 성분'], ['m4sw-cdf', '합친 CDF'], ['m4sw-ecdf', 'ECDF (표본 4,000개)'], ['m4sw-blk', '표본 히스토그램']]);
      const Fb = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 3 * x * x - 2 * x * x * x);
      const Fd = (x) => (x >= 0.75 ? 1 : x >= 0.25 ? 0.5 : 0);
      const api = {
        preset(a, b, s) { st.wd = a; st.wa = b; st.ws = s; c.set('wd', a); c.set('wa', b); c.set('ws', s); api.render(); },
        render() {
          const el = ctx.el;
          el.innerHTML = '';
          let tot = st.wd + st.wa + st.ws;
          if (tot <= 0) tot = 1;
          const wd = st.wd / tot, wa = st.wa / tot, ws = st.ws / tot;
          const F = (x) => wd * Fd(x) + wa * Fb(x) + ws * cs.cdf(x);
          const law = { atoms: [], F, range: [-0.05, 1.05] };
          let cum = 0;
          law.atoms = wd > 0 ? [0.25, 0.75].map((xv) => { const lo = F(xv - 1e-9); cum = F(xv); return { x: xv, p: wd / 2, lo, hi: cum }; }) : [];
          // 질량 그림
          const f1 = u.panel(el, '세 성분의 질량', '줄기 = 점 질량(높이 = 확률), 곡선 = 밀도, 아래 띠 = 칸토어 성분이 놓인 곳(길이 0)');
          const P = M4.plot(f1, { height: 210, x: law.range, y: [0, Math.max(1.6, wa * 1.5 * 1.15, wd / 2 * 1.15)], yNice: false, yTicks: 4, margin: { bottom: 58 }, aria: '르베그 분해 질량 그림' });
          if (wa > 0) u.path(P.plot, d3.range(0, 301).map((i) => i / 300).map((v) => [P.x(v), P.y(wa * 6 * v * (1 - v))]), 'm4-curve');
          if (wd > 0) [0.25, 0.75].forEach((v) => {
            P.plot.append('line').attr('class', 'm4-stem d').attr('x1', P.x(v)).attr('x2', P.x(v)).attr('y1', P.y(0)).attr('y2', P.y(wd / 2));
            P.plot.append('circle').attr('class', 'm4-stemdot d').attr('cx', P.x(v)).attr('cy', P.y(wd / 2)).attr('r', 4);
            P.plot.append('text').attr('class', 'm4-lab').attr('x', P.x(v) + 7).attr('y', P.y(wd / 2) + 4).text((wd / 2).toFixed(3));
          });
          if (ws > 0) {
            const gD = P.g.append('g').attr('opacity', 0.25 + 0.75 * ws);
            M4.cantor.intervals(6).forEach(([a, b]) => gD.append('rect').attr('class', 'm4-dust sc').attr('x', P.x(a)).attr('width', Math.max(0.7, P.x(b) - P.x(a))).attr('y', P.ih + 26).attr('height', 12));
            P.g.append('text').attr('class', 'm4-lab').attr('x', P.iw).attr('y', P.ih + 52).attr('text-anchor', 'end').text(`칸토어 성분 ${ws.toFixed(2)}: 밀도 막대로는 보이지 않음`);
          }
          // CDF
          const f2 = u.panel(el, '합친 CDF와 성분별 CDF', '굵은 선 = 합친 F, 가는 선 = 가중치를 곱한 성분별 CDF');
          const C = M4.plot(f2, { height: 240, x: law.range, y: [0, 1], yNice: false, yTicks: 4, xLabel: 'x', aria: '르베그 분해 CDF' });
          const xs = d3.range(0, 801).map((i) => -0.05 + (1.1 * i) / 800);
          if (wa > 0) u.path(C.plot, xs.map((v) => [C.x(v), C.y(wa * Fb(v))]), 'm4-comp ac');
          if (ws > 0) u.path(C.plot, xs.map((v) => [C.x(v), C.y(ws * cs.cdf(v))]), 'm4-comp sc');
          if (wd > 0) u.drawCdf(C, { atoms: [{ x: 0.25, lo: 0, hi: wd / 2 }, { x: 0.75, lo: wd / 2, hi: wd }], F: (v) => wd * Fd(v), range: law.range }, 'm4-comp d', { dots: false });
          // 표본
          const smp = base.map(([r0, r1, r2, r3, r4]) => {
            if (r0 < wd) return r1 < 0.5 ? 0.25 : 0.75;
            if (r0 < wd + wa) { const t = [r1, r2, r3].sort((p, q) => p - q); return t[1]; }
            return cs.quantile(r4);
          }).sort((p, q) => p - q);
          const ep = [[C.x(-0.05), C.y(0)]];
          smp.forEach((v, i) => { ep.push([C.x(v), C.y(i / nS)], [C.x(v), C.y((i + 1) / nS)]); });
          ep.push([C.x(1.05), C.y(1)]);
          u.path(C.plot, ep, 'm4-ecdf');
          u.drawCdf(C, law, 'm4-cdf strong');
          // 표본 히스토그램 (PRD A4)
          const f3 = u.panel(el, `표본 히스토그램 (n = ${ctx.S.fInt(nS)}, 구간 폭 0.02)`, '이산 성분은 뾰족한 막대, 절대연속 성분은 곡선을 따르는 막대, 칸토어 성분은 빈칸이 많은 들쭉날쭉한 막대로 보입니다');
          const nb = 50, bw = 1 / nb, hc = new Float64Array(nb);
          smp.forEach((v) => { hc[Math.min(nb - 1, Math.floor(v / bw))]++; });
          const hmax = Math.max(...hc) / nS / bw;
          const Hh = M4.plot(f3, { height: 200, x: law.range, y: [0, Math.min(Math.max(2, hmax * 1.1), 30)], yNice: false, yTicks: 4, xLabel: 'x', yLabel: '밀도', aria: '혼합 표본 히스토그램' });
          hc.forEach((cc, i) => { const h = cc / nS / bw; Hh.plot.append('rect').attr('class', 'm4-blk').attr('x', Hh.x(i * bw) + 0.5).attr('width', Math.max(0.5, Hh.x(bw) - Hh.x(0) - 1)).attr('y', Hh.y(h)).attr('height', Hh.ih - Hh.y(h)); });
          if (wa > 0) u.path(Hh.plot, d3.range(0, 301).map((i) => i / 300).map((v) => [Hh.x(v), Hh.y(wa * 6 * v * (1 - v))]), 'm4-curve');
          ctx.extra.innerHTML = u.table(['성분', '가중치', 'PMF로 보이나', 'PDF로 보이나', 'CDF에서의 모습'], [
            ['이산 P<sub>d</sub>', wd.toFixed(3), '예 (합 = ' + wd.toFixed(3) + ')', '아니오', '점프'],
            ['절대연속 P<sub>ac</sub>', wa.toFixed(3), '아니오', '예 (적분 = ' + wa.toFixed(3) + ')', '매끈한 오름'],
            ['특이연속 P<sub>sc</sub>', ws.toFixed(3), '아니오', '아니오', '점프 없이 기울기 0으로 오름'],
          ], { caption: '르베그 분해: 각 성분을 무엇이 설명하는가', cls: 'text' });
          let ks = 0;
          for (let i = 0; i < nS;) {
            let j = i; while (j + 1 < nS && smp[j + 1] === smp[i]) j++;   // 같은 값(점 질량) 묶음
            ks = Math.max(ks, Math.abs((j + 1) / nS - F(smp[i])), Math.abs(i / nS - F(smp[i] - 1e-9)));
            i = j + 1;
          }
          ctx.readouts([
            ['가중치 (d, ac, sc)', `${wd.toFixed(2)}, ${wa.toFixed(2)}, ${ws.toFixed(2)}`],
            ['x = 0.25의 점프', (wd / 2).toFixed(3)],
            ['PMF 합 + PDF 적분', `${(wd + wa).toFixed(3)}<small>1 − 이 값 = 칸토어 성분</small>`],
            ['F(0.5)', F(0.5).toFixed(4)],
            ['KS 거리 (ECDF, F)', `${ks.toFixed(4)}<small>기준 1.36/√n = ${(1.36 / Math.sqrt(nS)).toFixed(4)}</small>`],
          ]);
        },
      };
      return api;
    },
  });

  /* ════════════════ A5 길이가 0인 무한 집합 ════════════════ */
  scenes.push({
    id: 'A5', title: '길이가 0인 무한 집합',
    card: {
      do: '[0, 1]의 유리수를 0, 1, 1/2, 1/3, 2/3, 1/4, … 순서로 나열하고, k번째 유리수에 길이 ε/2<sup>k</sup>인 구간을 씌웁니다. K를 늘려 더 많은 유리수를 덮어 보세요. 아래에서는 같은 유리수로 만든 디리클레 함수의 리만 합을 봅니다.',
      see: '유리수는 [0, 1] 어디에나 빽빽한데도 구간 길이의 합은 ε 이하입니다. ε을 얼마든지 작게 할 수 있으니 유리수 전체의 길이는 <b>0</b>입니다. 그래서 르베그 적분으로는 ∫1<sub>ℚ</sub> dλ = 0이 바로 나오지만, 리만 위합은 항상 1, 아래합은 항상 0이라 리만 적분은 정의되지 않습니다.',
      ask: '유리수는 무한히 많은데 길이가 0입니다. [0, 1] 전체도 점들의 모임인데 길이가 1입니다. 두 경우의 차이는 무엇일까요? (힌트: 셀 수 있는가)',
      math: '셀 수 있는 집합 $\\{q_1,q_2,\\dots\\}$: $\\lambda(\\mathbb Q\\cap[0,1])\\le\\sum_k\\varepsilon/2^k=\\varepsilon$. 이것은 <b>σ-가법성</b>(셀 수 있는 합집합)이 있어야 쓸 수 있는 논증입니다. 반면 모든 부분집합에 평행이동 불변·σ-가법인 길이를 줄 수는 없습니다(<b>비탈리 집합</b>). 그래서 측정할 수 있는 집합의 모임, 곧 <b>σ-대수</b> $\\mathcal F$를 먼저 정하고 $(\\Omega,\\mathcal F,P)$ 위에서 확률을 정의합니다.',
    },
    actions: [
      { label: '하나씩 덮기 (재생)', run: (a) => a.play(), primary: true },
      { label: 'ε 줄이기', run: (a) => a.setEps(0.05) },
      { label: '리만 합: 무리수 점 고르기', run: (a) => a.setTag('irr') },
    ],
    create(ctx) {
      const u = U(), M4 = ctx.M4;
      const st = { K: 12, eps: 0.3, m: 10, tag: 'rat' };
      let timer = null;
      const c = ctx.controls([
        { title: '유리수 덮기', items: [
          { type: 'range', key: 'K', label: '덮을 유리수 개수 K', min: 1, max: 300, step: 1, value: 12, fmt: (v) => `${v}` },
          { type: 'range', key: 'eps', label: 'ε (구간 길이 합의 상한)', min: 0.01, max: 0.5, step: 0.01, value: 0.3, fmt: (v) => v.toFixed(2) },
          { type: 'buttons', items: [{ key: 'play', label: '하나씩 덮기', primary: true }] },
        ] },
        { title: '디리클레 함수의 리만 합', items: [
          { type: 'range', key: 'm', label: '분할 수 m', min: 2, max: 60, step: 1, value: 10, fmt: (v) => `${v}` },
          { type: 'seg', key: 'tag', label: '각 칸에서 고르는 점', value: 'rat', options: [['rat', '유리수 점'], ['irr', '무리수 점']] },
        ] },
      ], (k, v) => {
        if (k === 'play') { api.play(); return; }
        st[k] = v; api.render();
      });
      ctx.legend([['m4sw-hl', '유리수를 덮은 구간'], ['m4sw-qdot', '유리수'], ['m4sw-blk', '리만 합의 직사각형']]);
      const api = {
        setEps(e) { st.eps = e; c.set('eps', e); api.render(); },
        setTag(t) { st.tag = t; c.set('tag', t); api.render(); },
        play() {
          if (timer) { clearInterval(timer); timer = null; return; }
          st.K = 1; c.set('K', 1); api.render();
          timer = ctx.every(ctx.S.reduceMotion() ? 600 : 160, () => {
            if (st.K >= 60) { clearInterval(timer); timer = null; return; }
            st.K++; c.set('K', st.K); api.render();
          });
        },
        render() {
          const el = ctx.el;
          el.innerHTML = '';
          const qs = M4.farey(st.K + 1);
          const cur = qs.slice(0, st.K);
          const iv = cur.map(([p, q], i) => { const half = st.eps / Math.pow(2, i + 1) / 2; const x0 = p / q; return [x0 - half, x0 + half]; });
          const un = M4.unionLength(iv);
          const f1 = u.panel(el, `유리수 ${st.K}개를 길이 합 ${(st.eps * (1 - Math.pow(2, -st.K))).toFixed(4)} 이하의 구간으로 덮기`, '위: 구간 하나하나 (k번째 길이 ε/2ᵏ), 아래 띠: 덮인 부분 전체(합집합)');
          const P = M4.plot(f1, { height: 190, x: [-0.02, 1.02], y: [0, 1], noY: true, margin: { bottom: 40, top: 8 }, xLabel: '[0, 1]', aria: '유리수 덮개' });
          iv.forEach(([a, b], i) => {
            const hh = Math.max(0.12, 0.8 - 0.05 * Math.log2(i + 1) * 2);
            P.plot.append('rect').attr('class', 'm4-cover').attr('x', P.x(a)).attr('width', Math.max(0.6, P.x(b) - P.x(a))).attr('y', P.y(0.15 + hh)).attr('height', P.y(0.15) - P.y(0.15 + hh));
          });
          un.merged.forEach(([a, b]) => P.plot.append('rect').attr('class', 'm4-union').attr('x', P.x(a)).attr('width', Math.max(0.8, P.x(b) - P.x(a))).attr('y', P.y(0.1)).attr('height', P.y(0) - P.y(0.1)));
          cur.forEach(([p, q], i) => P.plot.append('circle').attr('class', 'm4-qdot' + (i === st.K - 1 ? ' cur' : '')).attr('cx', P.x(p / q)).attr('cy', P.y(0.15)).attr('r', i === st.K - 1 ? 4.5 : 2.6));
          const last = cur[cur.length - 1];
          P.plot.append('text').attr('class', 'm4-lab').attr('x', Math.min(P.iw - 60, Math.max(4, P.x(last[0] / last[1]) - 20))).attr('y', 12).text(`${st.K}번째: ${last[0]}/${last[1]}`);

          // 디리클레
          const f2 = u.panel(el, '디리클레 함수 1<sub>ℚ</sub>의 리만 합', '점 = 유리수에서 값 1, 선 = 무리수에서 값 0 (둘 다 어디에나 빽빽함)');
          const D = M4.plot(f2, { height: 190, x: [0, 1], y: [0, 1.15], yNice: false, yTicks: 3, xLabel: 'x', aria: '디리클레 함수 리만 합' });
          const m = st.m, val = st.tag === 'rat' ? 1 : 0;
          for (let i = 0; i < m; i++) {
            D.plot.append('rect').attr('class', 'm4-upper').attr('x', D.x(i / m)).attr('width', D.x(1 / m) - D.x(0)).attr('y', D.y(1)).attr('height', D.ih - D.y(1));
            if (val) D.plot.append('rect').attr('class', 'm4-blk riem').attr('x', D.x(i / m) + 1).attr('width', Math.max(0.5, D.x(1 / m) - D.x(0) - 2)).attr('y', D.y(1)).attr('height', D.ih - D.y(1));
            const tx = val ? (i + 0.5) / m : (i + Math.SQRT1_2) / m;
            D.plot.append('circle').attr('class', 'm4-tag').attr('cx', D.x(tx)).attr('cy', D.y(val)).attr('r', 3.5);
          }
          D.plot.append('line').attr('class', 'm4-irr').attr('x1', 0).attr('x2', D.iw).attr('y1', D.y(0) - 1).attr('y2', D.y(0) - 1);
          M4.farey(220).forEach(([p, q]) => D.plot.append('circle').attr('class', 'm4-qdot small').attr('cx', D.x(p / q)).attr('cy', D.y(1)).attr('r', 1.6));
          ctx.readouts([
            ['덮은 유리수', `${st.K}개`],
            ['구간 길이의 합', `${(st.eps * (1 - Math.pow(2, -st.K))).toFixed(5)}<small>항상 ε = ${st.eps.toFixed(2)} 미만</small>`],
            ['합집합의 길이', `${un.length.toFixed(5)}<small>[0, 1] 밖으로 나간 부분 제외</small>`],
            ['리만 위합 / 아래합', '1 / 0<small>m을 바꿔도 그대로</small>'],
            ['고른 점의 리만 합', `${val}`],
            ['르베그 적분 ∫1<sub>ℚ</sub>dλ', '1·λ(ℚ) + 0·λ(ℚᶜ) = 0'],
          ]);
        },
        destroy() { if (timer) clearInterval(timer); },
      };
      return api;
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
