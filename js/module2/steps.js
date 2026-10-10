/* 모듈 2 단계 정의 (PRD_module2 5.2, 5.3)
 * controls: dist n more draw top overlays cursor play inverse conv seed
 *   overlays 안의 개별 항목: ov-ecdf ov-cdf ov-dn ov-band ov-tangent ov-toptheory
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});
  const BASE = { showEcdf: true, showCdf: false, showTopTheory: false, showDn: false, showBand: false, showTangent: false, invMode: false, cursor: 'x' };

  const continuous = [
    {
      id: 'E1', title: '줄 세워 세기',
      init: { ...BASE, n: 10, top: 'rug', cx: 'median' },
      controls: ['dist', 'n', 'more', 'draw', 'cursor', 'seed'],
      cursors: ['x'],
      card: {
        do: '‘하나씩 뽑기’로 지수분포에서 난수 10개를 뽑아 보세요. 위에는 뽑힌 값이 수직선 위의 눈금으로, 아래에는 “이 값 이하인 표본의 비율”이 계단으로 쌓입니다. 그래프 위를 끌어 x를 움직여 보세요.',
        see: '표본이 하나 떨어질 때마다 그 위치부터 오른쪽 전체가 <b>1/n</b>만큼 올라갑니다. 커서 왼쪽의 진한 눈금 수를 n으로 나눈 값이 아래 계단의 높이입니다. 이 계단 함수를 <b>경험적 누적분포함수(ECDF)</b>라고 합니다.',
        ask: '계단은 몇 번 올라가나요? 마지막 계단의 높이는 얼마인가요? 같은 값이 두 번 나오면 계단은 어떻게 될까요?',
        math: '$$\\hat F_n(x)=\\frac{1}{n}\\,\\#\\{i: x_i\\le x\\}$$ 정렬한 표본 $x_{(1)}\\le\\cdots\\le x_{(n)}$의 각 점에서 $1/n$씩 뛰는 계단함수입니다.',
      },
      actions: [
        { label: '하나씩 뽑기 (10개)', run: (a) => a.drawAnimated(10), primary: true },
        { label: 'n = 30', run: (a) => a.set({ n: 30 }) },
        { label: '다른 분포로', run: (a) => a.cycleShape() },
      ],
    },
    {
      id: 'E2', title: 'n을 늘리면',
      init: { ...BASE, n: 30, top: 'rug' },
      controls: ['dist', 'n', 'more', 'top', 'overlays', 'ov-ecdf', 'ov-cdf', 'ov-dn', 'play', 'conv', 'seed'],
      cursors: ['x'],
      card: {
        do: '‘n을 키워 가며 보기’를 누르세요. 끝나면 ‘이론 CDF 보기’와 ‘최대 거리 보기’를 차례로 눌러 봅니다.',
        see: '계단이 촘촘해지며 하나의 매끄러운 곡선에 다가갑니다. 모듈 1의 히스토그램과 달리 <b>구간 폭을 고를 필요가 없습니다</b>. 주황 세로선은 계단과 이론 곡선이 가장 멀리 떨어진 곳(Dₙ)이고, n이 100배가 되면 대략 1/10로 줄어듭니다.',
        ask: '‘히스토그램과 비교’를 눌러 위 그래프의 구간 수를 바꿔 보세요. 히스토그램 모양은 바뀌는데 아래 계단은 왜 바뀌지 않을까요?',
        math: '$$D_n=\\sup_x\\,\\big|\\hat F_n(x)-F(x)\\big|\\;\\xrightarrow[n\\to\\infty]{}\\;0$$ (Glivenko–Cantelli 정리). $D_n$은 대략 $1/\\sqrt n$ 속도로 줄고, $n=100$에서 5% 기준값은 약 0.134입니다.',
      },
      actions: [
        { label: 'n을 키워 가며 보기', run: (a) => a.play(), primary: true, id: 'play' },
        { label: '이론 CDF 보기', run: (a) => a.set({ showCdf: true }) },
        { label: '최대 거리 보기', run: (a) => a.set({ showCdf: true, showDn: true }) },
        { label: '히스토그램과 비교', run: (a) => a.set({ top: 'hist', showTopTheory: false }) },
      ],
    },
    {
      id: 'E3', title: '넓이가 쌓이면',
      init: { ...BASE, n: 1000, top: 'pdf', showEcdf: false, showCdf: true, cx: 'q0.25' },
      controls: ['dist', 'cursor', 'overlays', 'ov-ecdf', 'seed'],
      cursors: ['x'],
      card: {
        do: '위 그래프는 이론 확률밀도함수입니다. 그래프 위를 왼쪽에서 오른쪽으로 끌어 보세요. ‘쓸어 보기’를 누르면 자동으로 움직입니다.',
        see: '위 그래프의 초록 음영은 x 왼쪽의 넓이, 곧 $P(X\\le x)$입니다. 아래 그래프의 점 높이가 언제나 그 넓이와 같습니다. 넓이가 쌓여 높이가 됩니다.',
        ask: '밀도가 높은 곳을 지날 때 아래 곡선은 어떻게 움직이나요? 밀도가 거의 0인 곳에서는요?',
        math: '$$F(x)=P(X\\le x)=\\int_{-\\infty}^{x}f(t)\\,dt$$',
      },
      actions: [
        { label: '왼쪽에서 오른쪽으로 쓸어 보기', run: (a) => a.sweep(), primary: true },
        { label: 'x를 중앙값에', run: (a) => a.set({ cursor: 'x', cx: a.quantile(0.5) }) },
        { label: '다른 분포로', run: (a) => a.cycleShape() },
      ],
    },
    {
      id: 'E4', title: '기울기가 밀도',
      init: { ...BASE, n: 1000, top: 'pdf', showEcdf: false, showCdf: true, showTangent: true, cx: 'q0.3' },
      controls: ['dist', 'cursor', 'overlays', 'ov-tangent', 'seed'],
      cursors: ['x'],
      card: {
        do: 'x를 움직이며 아래 곡선의 접선(주황)과 위 그래프의 주황 막대를 비교하세요.',
        see: '접선의 기울기와 그 점의 밀도 f(x)가 언제나 같습니다. CDF가 가파르게 오르는 곳에 확률이 몰려 있고, 평평한 곳에는 확률이 거의 없습니다.',
        ask: '정규분포에서 CDF가 가장 가파른 곳은 어디인가요? 균등분포의 CDF는 왜 직선일까요?',
        math: '$$f(x)=F\'(x)=\\lim_{h\\to0}\\frac{F(x+h)-F(x)}{h}=\\lim_{h\\to0}\\frac{P(x\\lt X\\le x+h)}{h}$$',
      },
      actions: [
        { label: '가장 가파른 곳으로', run: (a) => a.set({ cx: a.modeX() }), primary: true },
        { label: '꼬리 쪽으로', run: (a) => a.set({ cx: a.quantile(0.97) }) },
        { label: '다른 분포로', run: (a) => a.cycleShape() },
      ],
    },
    {
      id: 'E5', title: '구간 확률과 분위수',
      init: { ...BASE, n: 1000, top: 'pdf', showEcdf: false, showCdf: true, cursor: 'interval', ca: 'q0.25', cb: 'q0.75' },
      controls: ['dist', 'cursor', 'overlays', 'ov-ecdf', 'seed'],
      cursors: ['x', 'p', 'interval'],
      card: {
        do: '‘구간’ 커서에서 a, b를 끌어 보세요. 이어서 커서를 ‘p로 읽기’로 바꾸고 아래 그래프에서 가로선을 위아래로 끌어 봅니다.',
        see: '구간 확률은 아래 그래프의 두 높이 차 F(b) − F(a)이고, 위 그래프의 넓이와 같습니다. ‘p로 읽기’는 거꾸로 높이 p에서 x를 찾습니다. 이것이 <b>분위수</b>이고, p = 0.5이면 중앙값입니다.',
        ask: '지수분포(λ = 1)의 중앙값이 평균(1)보다 작은 이유를 CDF 모양으로 설명해 보세요.',
        math: '$$P(a\\lt X\\le b)=F(b)-F(a),\\qquad Q(p)=\\inf\\{x: F(x)\\ge p\\}$$ 지수분포(λ = 1)의 중앙값은 $\\ln 2\\approx0.693$, 표준정규의 3사분위수는 약 0.674입니다.',
      },
      actions: [
        { label: '중앙값', run: (a) => a.set({ cursor: 'p', cp: 0.5 }), primary: true },
        { label: '1사분위수', run: (a) => a.set({ cursor: 'p', cp: 0.25 }) },
        { label: '3사분위수', run: (a) => a.set({ cursor: 'p', cp: 0.75 }) },
        { label: '사분위 구간 [Q1, Q3]', run: (a) => a.set({ cursor: 'interval', ca: a.quantile(0.25), cb: a.quantile(0.75) }) },
      ],
    },
    {
      id: 'E6', title: '거꾸로 읽어 난수 만들기',
      init: { ...BASE, n: 1000, top: 'hist', showEcdf: true, showCdf: true, showTopTheory: true, cursor: 'none', invMode: true },
      controls: ['dist', 'inverse', 'overlays', 'ov-ecdf', 'ov-toptheory', 'seed'],
      cursors: [],
      card: {
        do: '‘균등난수 하나 보내기’를 여러 번 누르세요. 0과 1 사이의 수 u가 왼쪽 축에서 출발해 CDF를 만나고, 그 x로 떨어집니다. 이어서 100개, 1,000개를 보내 봅니다.',
        see: 'u는 0~1에서 고르게 뽑지만, CDF가 가파른 곳(밀도가 높은 곳)에서는 넓은 범위의 u가 좁은 x 범위로 모이고 평평한 곳에서는 드물게 떨어집니다. 그래서 위 히스토그램이 이론 밀도 모양이 됩니다.',
        ask: 'CDF가 평평한 구간으로는 왜 난수가 거의 떨어지지 않을까요? 이산형 분포에서는 가로선이 계단의 어디에 닿을까요?',
        math: '$U\\sim U(0,1)$이면 $X=Q(U)$의 분포는 $F$입니다: $$P(Q(U)\\le x)=P(U\\le F(x))=F(x)$$ 지수분포는 $Q(u)=-\\ln(1-u)/\\lambda$이고, 이 사이트의 지수·와이블·기하분포 난수가 실제로 이 방법으로 만들어집니다.',
      },
      actions: [
        { label: '균등난수 하나 보내기', run: (a) => a.inverse(1), primary: true },
        { label: '100개 보내기', run: (a) => a.inverse(100) },
        { label: '1,000개 보내기', run: (a) => a.inverse(1000) },
        { label: '처음부터', run: (a) => a.inverseReset() },
      ],
    },
  ];

  const discrete = [
    {
      id: 'G1', title: '계단 만들기',
      init: { ...BASE, n: 20, top: 'rug', cx: 'median' },
      controls: ['dist', 'n', 'more', 'draw', 'cursor', 'seed'],
      cursors: ['x'],
      card: {
        do: '이항분포 B(10, 0.3)에서 ‘하나씩 뽑기’로 20개를 뽑아 보세요. 위에는 같은 값이 점으로 쌓이고, 아래에는 계단이 생깁니다.',
        see: 'ECDF는 연속형과 똑같이 만듭니다. 다만 같은 값이 여러 번 나오므로, 한 값에서 나온 횟수만큼 계단이 한꺼번에 크게 올라갑니다. 정수 사이에서는 계단이 평평합니다.',
        ask: '값 3이 다섯 번 나왔다면 x = 3에서 계단은 얼마나 올라갈까요?',
        math: '$$\\hat F_n(x)=\\frac{1}{n}\\#\\{i: x_i\\le x\\},\\qquad \\hat F_n(k)-\\hat F_n(k-1)=\\frac{\\#\\{i:x_i=k\\}}{n}$$',
      },
      actions: [
        { label: '하나씩 뽑기 (20개)', run: (a) => a.drawAnimated(20), primary: true },
        { label: 'n = 200', run: (a) => a.set({ n: 200 }) },
        { label: '주사위로 바꾸기', run: (a) => a.set({ dist: 'dice', params: { a: 1, b: 6 } }) },
      ],
    },
    {
      id: 'G2', title: '점프는 질량',
      init: { ...BASE, n: 1000, top: 'pdf', showCdf: true, showEcdf: true, cx: 3 },
      controls: ['dist', 'n', 'more', 'cursor', 'overlays', 'ov-ecdf', 'ov-cdf', 'seed'],
      cursors: ['x'],
      card: {
        do: '위 그래프는 확률질량함수, 아래는 이론 CDF(초록)와 ECDF(파랑)입니다. 정수 위로 x를 옮기며 위 막대 높이와 아래 점프 크기를 비교하세요.',
        see: 'x에서 계단이 뛰는 크기가 정확히 그 값의 확률 p(x)입니다. 위 그래프에서 x 이하의 막대(진한 색)를 모두 더하면 아래 그래프의 높이가 됩니다.',
        ask: 'x = 2.5에서 F의 값은 F(2)와 F(3) 중 어느 쪽과 같을까요?',
        math: '$$F(x)=\\sum_{k\\le x}p(k),\\qquad F(k)-F(k^-)=p(k)$$ 예: $B(10,0.3)$에서 $F(3)-F(2)=0.6496-0.3828=0.2668=p(3)$',
      },
      actions: [
        { label: 'x = 3', run: (a) => a.set({ cx: 3 }), primary: true },
        { label: 'x = 2.5', run: (a) => a.set({ cx: 2.5 }) },
        { label: '포아송(3)으로', run: (a) => a.set({ dist: 'poisson', params: { lambda: 3 } }) },
      ],
    },
    {
      id: 'G3', title: '닫힌 점과 열린 점',
      init: { ...BASE, n: 1000, top: 'pdf', showCdf: true, showEcdf: false, cx: 3 },
      controls: ['dist', 'cursor', 'seed'],
      cursors: ['x'],
      card: {
        do: '‘3 바로 왼쪽’, ‘정확히 3’, ‘3 바로 오른쪽’ 버튼을 차례로 누르고 F 값을 읽어 보세요.',
        see: '점프 위치에는 아래에 <b>열린 점(○)</b>, 위에 <b>닫힌 점(●)</b>이 있습니다. F(3) = P(X ≤ 3)은 3을 포함하므로 위쪽 값입니다. 오른쪽에서 다가가면 그 값에 닿고, 왼쪽에서 다가가면 아래 값에 머뭅니다. 이것을 <b>오른쪽 연속</b>이라고 합니다.',
        ask: 'P(X < 3)은 그래프의 어느 점 높이인가요?',
        math: '$$F(3)=\\lim_{t\\downarrow 3}F(t)=0.6496,\\qquad F(3^-)=\\lim_{t\\uparrow 3}F(t)=P(X\\lt 3)=0.3828$$',
      },
      actions: [
        { label: '3 바로 왼쪽 (2.999)', run: (a) => a.set({ cx: 2.999 }) },
        { label: '정확히 3', run: (a) => a.set({ cx: 3 }), primary: true },
        { label: '3 바로 오른쪽 (3.001)', run: (a) => a.set({ cx: 3.001 }) },
      ],
    },
    {
      id: 'G4', title: '끝점이 바꾸는 확률',
      init: { ...BASE, n: 1000, top: 'pdf', showCdf: true, showEcdf: false, cursor: 'interval', ca: 2, cb: 4, inclA: true, inclB: true },
      controls: ['dist', 'cursor', 'seed'],
      cursors: ['interval'],
      card: {
        do: '구간 a, b를 고르고 ‘a 포함’, ‘b 포함’을 바꿔 보세요. 아래 표에 네 가지 확률이 동시에 나옵니다.',
        see: '기본형은 $P(a\\lt X\\le b)=F(b)-F(a)$입니다. a를 포함하면 a의 점프 하나를 더하고(F(a⁻)부터), b를 빼면 b의 점프 하나를 뺍니다(F(b⁻)까지). 차트에서 포함된 점프는 진하게, 빠진 점프는 흐리게 표시됩니다.',
        ask: '연속형에서는 네 확률이 왜 모두 같을까요?',
        math: '$$P(a\\le X\\le b)=F(b)-F(a^-),\\quad P(a\\lt X\\lt b)=F(b^-)-F(a)$$ 예: $B(10,0.3)$에서 $P(2\\le X\\le4)=0.7004$, $P(2\\lt X\\le4)=0.4669$',
      },
      actions: [
        { label: 'P(2 ≤ X ≤ 4)', run: (a) => a.set({ ca: 2, cb: 4, inclA: true, inclB: true }), primary: true },
        { label: 'P(2 < X ≤ 4)', run: (a) => a.set({ ca: 2, cb: 4, inclA: false, inclB: true }) },
        { label: 'P(2 < X < 4)', run: (a) => a.set({ ca: 2, cb: 4, inclA: false, inclB: false }) },
        { label: '연속형과 비교', run: (a) => a.goPage('continuous.html', 4) },
      ],
    },
  ];

  RVL.steps2 = { continuous, discrete };
})(typeof window !== 'undefined' ? window : globalThis);
