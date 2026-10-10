/* 단계 정의 (PRD 5.2, 5.3)
 * 코드를 고치지 않고 문구·초기 상태·활성 조작을 바꿀 수 있도록 데이터로 분리했다.
 *
 * 각 단계:
 *   id, title          단계 번호·제목
 *   init               단계에 들어올 때 덮어쓸 상태 (분포·모수·시드는 유지)
 *   controls           보여 줄 조작 패널 목록
 *     dist  분포·모수      n  표본 크기      more  +10/+100/+1000     draw  하나씩 뽑기
 *     seed  시드          mode 세로축       bins  구간 폭           nested 쪼개기 모드
 *     rule  구간 폭 규칙   poly 도수다각형   theory 이론 분포       ghost 직전 상태
 *     play  자동 재생      interval 확률 계산 map (n, Δx) 지도      conv  수렴 그래프
 *   modes              고를 수 있는 세로축 모드
 *   card               do(해 볼 것) / see(관찰 포인트) / ask(생각해 볼 질문) / math(수식으로 보기)
 *   actions            단계 카드의 버튼. run(app)
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});

  const continuous = [
    {
      id: 'C1', title: '뽑아서 세어 보기',
      init: { mode: 'count', k: 10, rule: 'manual', nested: false, n: 100, showPoly: false, showTheory: false, showGhost: false, interval: { on: false } },
      controls: ['dist', 'n', 'more', 'draw', 'band', 'seed'],
      modes: ['count'],
      card: {
        do: '‘하나씩 뽑기’를 눌러 난수 100개를 뽑아 보세요. 뽑힌 값이 어느 구간에 들어가는지 세어 막대로 쌓습니다.',
        see: '막대의 높이는 그 구간에 들어간 <b>개수(도수)</b>입니다. n을 100에서 1,000으로 늘리면 모양은 비슷한데 세로축 눈금이 열 배로 커집니다. 막대 높이가 고르지 않은 것은 우연에 따른 변동입니다. ‘예상 변동 범위’를 켜면 각 막대가 보통 어디까지 흔들리는지 보입니다.',
        ask: 'n = 100인 히스토그램과 n = 10,000인 히스토그램을 같은 눈금 위에 놓고 비교할 수 있을까요?',
        math: '구간 $j$의 도수 $c_j$는 구간 $[a_j, b_j)$에 들어간 표본의 개수이고, $\\sum_j c_j = n$입니다.',
      },
      actions: [
        { label: '하나씩 뽑기 (100개)', run: (a) => a.drawAnimated(100), primary: true },
        { label: 'n = 1,000', run: (a) => a.set({ n: 1000 }) },
        { label: 'n = 10,000', run: (a) => a.set({ n: 10000 }) },
        { label: '다른 모양의 분포로', run: (a) => a.cycleShape() },
        { label: '예상 변동 범위 켜고 끄기', run: (a) => a.toggleBand() },
      ],
    },
    {
      id: 'C2', title: '비율로 바꾸기',
      init: { mode: 'rel', k: 10, rule: 'manual', nested: true, n: 1000, showPoly: false, showTheory: false, showGhost: true, interval: { on: false } },
      controls: ['dist', 'n', 'more', 'mode', 'bins', 'ghost', 'band', 'seed'],
      modes: ['count', 'rel'],
      card: {
        do: '세로축을 <b>상대도수</b>(개수 ÷ n)로 바꿨습니다. 먼저 n을 바꿔 보고, 그다음 ‘Δx 반으로’를 눌러 보세요.',
        see: '상대도수로 바꾸면 n이 달라도 막대 높이가 비슷하게 유지됩니다. 그런데 Δx를 반으로 줄이면 막대가 둘로 쪼개지면서 높이도 대략 절반으로 떨어집니다. 회색 점선은 바로 직전의 히스토그램입니다.',
        ask: '구간을 계속 잘게 쪼개면 막대 높이는 어디로 갈까요? 그래도 분포의 ‘모양’을 비교할 수 있을까요?',
        math: '상대도수 $= c_j/n$이고 $\\sum_j c_j/n = 1$입니다. 폭이 반이 되면 한 구간에 들어가는 비율도 대략 반이 됩니다.',
      },
      actions: [
        { label: 'Δx 반으로', run: (a) => a.halveDx(), primary: true },
        { label: 'Δx 두 배로', run: (a) => a.doubleDx() },
        { label: 'n = 100', run: (a) => a.set({ n: 100 }) },
        { label: 'n = 10,000', run: (a) => a.set({ n: 10000 }) },
      ],
    },
    {
      id: 'C3', title: '면적이 확률이 되도록',
      init: { mode: 'density', k: 10, rule: 'manual', nested: true, n: 1000, showPoly: false, showTheory: false, showGhost: true, interval: { on: false } },
      controls: ['dist', 'n', 'more', 'mode', 'bins', 'ghost', 'seed'],
      modes: ['count', 'rel', 'density'],
      card: {
        do: '세로축을 <b>밀도</b>(상대도수 ÷ Δx)로 바꿨습니다. 다시 ‘Δx 반으로’를 눌러 보세요. 막대 위에 마우스를 올리면 높이를 계산하는 과정이 보입니다.',
        see: '이제는 Δx를 줄여도 높이가 거의 그대로입니다. 쪼개진 두 막대 높이의 평균은 원래 막대 높이와 정확히 같습니다. 차트 아래 ‘면적 합계’는 언제나 1입니다.',
        ask: '밀도 히스토그램에서 막대 하나의 <b>면적</b>은 무엇을 뜻할까요?',
        math: '$$\\text{높이}_j=\\frac{c_j/n}{\\Delta x}$$ $$\\text{면적}_j=\\Delta x\\times\\text{높이}_j=\\frac{c_j}{n}$$ $$\\sum_j \\text{면적}_j = 1$$',
      },
      actions: [
        { label: 'Δx 반으로', run: (a) => a.halveDx(), primary: true },
        { label: 'Δx 두 배로', run: (a) => a.doubleDx() },
        { label: '세로축 차례로 바꿔 보기', run: (a) => a.cycleMode() },
      ],
    },
    {
      id: 'C4', title: 'n을 키우고 Δx를 줄이기',
      init: { mode: 'density', k: 10, rule: 'manual', nested: true, n: 100, showPoly: true, showTheory: false, showGhost: false, interval: { on: false } },
      controls: ['dist', 'n', 'more', 'bins', 'nested', 'rule', 'poly', 'theory', 'play', 'map', 'conv', 'seed'],
      modes: ['density'],
      card: {
        do: '‘극한으로 가기’를 누르면 n이 100에서 1,000,000까지 늘어나면서 Δx가 함께 줄어듭니다. 아래 지도의 점을 끌어 n과 Δx를 직접 골라 볼 수도 있습니다.',
        see: '주황 점선(도수다각형)은 막대 꼭대기 가운데를 이은 선입니다. n이 작은데 Δx만 줄이면 선이 들쭉날쭉해지고, n과 Δx를 함께 움직이면 선이 점점 매끄러운 곡선에 가까워집니다.',
        ask: 'n = 100에서 Δx를 아주 작게 하면 어떤 일이 생기나요? 매끄러운 곡선을 얻으려면 무엇이 함께 필요할까요?',
        math: '$n\\to\\infty$이면 상대도수가 구간의 확률로 다가가고(대수의 법칙), $\\Delta x\\to 0$이면 리만 합이 적분으로 다가갑니다. $$\\sum_j f(x_j^*)\\,\\Delta x\\;\\longrightarrow\\;\\int_{-\\infty}^{\\infty} f(x)\\,dx = 1$$ 단, 한 구간에 들어가는 표본 수 $n\\Delta x$도 함께 커져야 합니다.',
      },
      actions: [
        { label: '극한으로 가기', run: (a) => a.play(), primary: true, id: 'play' },
        { label: 'n = 100에서 Δx만 아주 작게', run: (a) => a.set({ n: 100, k: 160, rule: 'manual' }) },
        { label: '이상적인 곡선 보기', run: (a) => a.reveal(), id: 'reveal' },
      ],
    },
    {
      id: 'C5', title: '곡선이 말해 주는 것',
      init: { mode: 'density', n: 10000, rule: 'scott', nested: false, showPoly: false, showTheory: true, showGhost: false, interval: { on: true, auto: true } },
      controls: ['dist', 'n', 'more', 'bins', 'rule', 'poly', 'theory', 'interval', 'seed'],
      modes: ['density'],
      card: {
        do: '차트 위의 두 손잡이 a, b를 끌어 구간을 고르세요. 아래 ‘확률 계산’에 세 가지 값이 나란히 나옵니다.',
        see: '표본 비율, 히스토그램 면적, 곡선 아래 면적이 거의 같습니다. ‘한 점으로 좁히기’를 누르면 구간 폭이 0으로 줄면서 확률도 0이 됩니다. 균등분포(0, 0.5)에서는 곡선 높이가 2인데도 아무 문제가 없습니다.',
        ask: 'f(x) = 2라는 것은 ‘X = x일 확률이 2’라는 뜻일까요? 아니라면 무엇을 뜻할까요?',
        math: '$$P(a\\le X\\le b)=\\int_a^b f(x)\\,dx$$ $$P(X=a)=\\int_a^a f(x)\\,dx=0$$ 그래서 연속형에서는 $P(a\\le X\\le b)=P(a&lt;X&lt;b)$입니다. $f(x)$는 확률이 아니라 단위 길이당 확률(밀도)이므로 1보다 클 수 있습니다.',
      },
      actions: [
        { label: '한 점으로 좁히기', run: (a) => a.narrow(), primary: true },
        { label: '표준정규 [−1.96, 1.96]', run: (a) => a.set({ dist: 'normal', params: { mu: 0, sigma: 1 }, interval: { on: true, a: -1.96, b: 1.96 } }) },
        { label: 'f(x) > 1 예: 균등(0, 0.5)', run: (a) => a.set({ dist: 'uniform', params: { a: 0, b: 0.5 }, interval: { on: true, a: 0.1, b: 0.3 } }) },
        { label: 'f(x) > 1 예: 정규 σ = 0.2', run: (a) => a.set({ dist: 'normal', params: { mu: 0, sigma: 0.2 }, interval: { on: true, a: -0.1, b: 0.1 } }) },
      ],
    },
  ];

  const discrete = [
    {
      id: 'D1', title: '뽑아서 세어 보기',
      init: { mode: 'count', m: 1, n: 50, showPoly: false, showTheory: false, showGhost: false, interval: { on: false } },
      controls: ['dist', 'n', 'more', 'draw', 'band', 'seed'],
      modes: ['count'],
      card: {
        do: '이항분포 B(10, 0.3)은 ‘성공 확률이 0.3인 시행을 10번 했을 때의 성공 횟수’입니다. ‘하나씩 뽑기’로 이 실험을 50번 해 보세요.',
        see: '값이 0, 1, 2, …처럼 띄엄띄엄 나오므로 막대는 정수 위에 하나씩 섭니다. 구간 폭은 1이고, 막대의 가운데가 정수입니다. 주사위처럼 모든 눈의 확률이 같아도 n = 50이면 막대 높이가 꽤 다릅니다. ‘예상 변동 범위’로 이 정도 차이가 정상인지 확인해 보세요.',
        ask: '어떤 값이 가장 자주 나오나요? 10번 모두 성공한 경우는 몇 번이나 나왔나요?',
        math: '도수 $c_x$는 값 $x$가 나온 횟수이고, $\\sum_x c_x = n$입니다.',
      },
      actions: [
        { label: '하나씩 뽑기 (50개)', run: (a) => a.drawAnimated(50), primary: true },
        { label: 'n = 1,000', run: (a) => a.set({ n: 1000 }) },
        { label: '주사위로 바꾸기', run: (a) => a.set({ dist: 'dice', params: { a: 1, b: 6 } }) },
        { label: '포아송(3)으로 바꾸기', run: (a) => a.set({ dist: 'poisson', params: { lambda: 3 } }) },
        { label: '예상 변동 범위 켜고 끄기', run: (a) => a.toggleBand() },
      ],
    },
    {
      id: 'D2', title: '비율은 어디로 가는가',
      init: { mode: 'rel', m: 1, n: 50, showPoly: false, showTheory: false, showGhost: false, interval: { on: false } },
      controls: ['dist', 'n', 'more', 'mode', 'theory', 'band', 'play', 'conv', 'seed'],
      modes: ['count', 'rel'],
      card: {
        do: '세로축을 상대도수로 바꿨습니다. ‘n을 키워 가며 보기’를 눌러 실험을 계속 반복해 보세요. 마지막에 ‘이상적인 값 보기’를 누릅니다.',
        see: 'n이 작을 때는 막대가 크게 흔들리지만, n이 커질수록 한 값에 머뭅니다. 그 값이 확률 P(X = x)이고, 초록 점과 수직선으로 그린 것이 <b>확률질량함수</b>입니다.',
        ask: '상대도수가 확률에 다가간다는 것은 아래 수렴 그래프의 오차가 어떻게 변한다는 뜻일까요?',
        math: '$$\\frac{c_x}{n}\\;\\xrightarrow[n\\to\\infty]{}\\;p(x)=P(X=x),\\qquad \\sum_x p(x)=1$$ 이항분포에서는 $p(x)=\\binom{N}{x}p^x(1-p)^{N-x}$입니다.',
      },
      actions: [
        { label: 'n을 키워 가며 보기', run: (a) => a.play(), primary: true, id: 'play' },
        { label: '이상적인 값 보기', run: (a) => a.reveal(), id: 'reveal' },
        { label: 'n = 50으로 되돌리기', run: (a) => a.set({ n: 50 }) },
      ],
    },
    {
      id: 'D3', title: '막대 폭을 줄이면?',
      init: { mode: 'density', m: 1, n: 10000, showPoly: false, showTheory: false, showGhost: false, interval: { on: false } },
      controls: ['dist', 'n', 'mode', 'bins', 'theory', 'seed'],
      modes: ['count', 'rel', 'density'],
      card: {
        do: '세로축은 밀도입니다. 연속형에서 했던 것처럼 ‘Δx 반으로’를 여러 번 눌러 막대 폭을 줄여 보세요.',
        see: '연속형과 달리 정수 위의 막대는 점점 가늘어지면서 <b>끝없이 높아지고</b>, 정수 사이 구간은 비어 있습니다. 면적 합계는 여전히 1이지만 확률이 점 하나에 몰려 있어서 밀도는 한없이 커집니다.',
        ask: 'Δx → 0일 때 막대 높이가 발산한다면, 이산형에서는 무엇을 ‘이상적인 값’으로 삼아야 할까요?',
        math: '정수 $x$를 가운데에 둔 구간의 밀도는 $\\dfrac{c_x/n}{\\Delta x}\\approx\\dfrac{p(x)}{\\Delta x}\\to\\infty$입니다. 그래서 이산형은 높이 자체가 확률인 확률질량함수 $p(x)$로 나타냅니다.',
      },
      actions: [
        { label: 'Δx 반으로', run: (a) => a.halveDx(), primary: true },
        { label: 'Δx = 1로 되돌리기', run: (a) => a.set({ m: 1 }) },
        { label: '세로축을 상대도수로', run: (a) => a.set({ mode: 'rel' }) },
        { label: '연속형 3단계와 비교', run: (a) => a.goPage('continuous.html', 2) },
      ],
    },
    {
      id: 'D4', title: '확률 계산하기',
      init: { mode: 'rel', m: 1, n: 10000, showPoly: false, showTheory: true, showGhost: false, interval: { on: true, auto: true } },
      controls: ['dist', 'n', 'theory', 'interval', 'seed'],
      modes: ['rel'],
      card: {
        do: '손잡이로 구간을 고르고, 아래 ‘확률 계산’에서 끝점 포함 여부를 바꿔 보세요.',
        see: '이산형에서 확률은 고른 막대 높이의 <b>합</b>입니다. P(X ≤ 3)과 P(X &lt; 3)은 막대 하나, 곧 P(X = 3)만큼 차이가 납니다. 연속형에서는 한 점의 확률이 0이라 둘이 같습니다.',
        ask: 'P(2 ≤ X ≤ 4)를 누적확률 P(X ≤ x)만으로 나타내 보세요.',
        math: '$$P(a\\le X\\le b)=\\sum_{x=a}^{b}p(x)$$ $$P(X<3)=P(X\\le 3)-P(X=3)$$',
      },
      actions: [
        { label: 'P(X ≤ 3)', run: (a) => a.set({ interval: { on: true, a: a.supportLo(), b: 3, inclA: true, inclB: true } }), primary: true },
        { label: 'P(X < 3)', run: (a) => a.set({ interval: { on: true, a: a.supportLo(), b: 3, inclA: true, inclB: false } }) },
        { label: 'P(2 ≤ X ≤ 4)', run: (a) => a.set({ interval: { on: true, a: 2, b: 4, inclA: true, inclB: true } }) },
        { label: '연속형과 비교', run: (a) => a.goPage('continuous.html', 4) },
      ],
    },
  ];

  RVL.steps = { continuous, discrete };
})(typeof window !== 'undefined' ? window : globalThis);
