/* 모듈 3 단계 정의 (PRD_module3 5.2, 5.3)
 * controls: space 표본공간 · xsel 확률변수 · expr 사용자 정의 식 · weights 찌그러진 주사위
 *           event 사건 모드(유한) · threshold x 슬라이더(연속) · sqmode 정사각형 보기 · trials 반복 실험
 *           band 예상 변동 범위 · cdf 누적분포함수 미니 그래프 · seed 시드
 * init 키: space, xid, showValues, ev('none'|'cells'|'eq'|'le'), val, xt, trials, band, showCdf, sqmode, strip, rect, right(오른쪽 판 표시)
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});

  const discrete = [
    {
      id: 'M1', title: '실험과 표본공간',
      init: { xid: null, showValues: false, ev: 'cells', sel: [], trials: 0, band: false, showCdf: false, right: false },
      controls: ['space', 'event-cells'],
      card: {
        do: '주사위 두 개를 던지는 실험입니다. 칸 하나가 일어날 수 있는 결과 하나입니다. 칸을 눌러 사건을 만들어 보세요.',
        see: '모든 결과의 모임이 <b>표본공간</b> Ω이고, 고른 칸들의 모임이 <b>사건</b>입니다. 결과 36가지가 모두 같은 확률이므로, 사건의 확률은 고른 칸 수 ÷ 36입니다.',
        ask: '“두 눈의 합이 7”이라는 사건은 몇 칸으로 이루어져 있나요? “합이 2”는요?',
        math: '$$P(A)=\\frac{|A|}{|\\Omega|}\\qquad(\\text{모든 결과의 확률이 같을 때})$$',
      },
      actions: [
        { label: '사건 예시 보기', run: (a) => a.eventExample(), primary: true },
        { label: '선택 지우기', run: (a) => a.set({ sel: [] }) },
        { label: '다른 실험으로', run: (a) => a.toggleSpace() },
      ],
    },
    {
      id: 'M2', title: '결과에 수 붙이기',
      init: { xid: 'auto', showValues: true, ev: 'none', sel: [], trials: 0, band: false, showCdf: false, right: true },
      controls: ['space'],
      card: {
        do: '각 결과에 “두 눈의 합”이라는 수를 붙였습니다. 칸에 마우스를 올리면 그 결과가 실수축의 어느 값으로 가는지 화살표가 보입니다.',
        see: '확률변수 X는 <b>결과마다 수를 하나씩 붙이는 규칙</b>입니다. 서로 다른 칸이 같은 값으로 갈 수 있습니다. 값 7로 가는 칸은 6개이므로 P(X = 7) = 6/36입니다.',
        ask: 'X가 가질 수 있는 값은 몇 가지인가요? 칸은 36개인데 왜 값은 그보다 적을까요?',
        math: '$$X:\\Omega\\to\\mathbb{R},\\qquad X\\big((a,b)\\big)=a+b$$ 확률변수는 이름과 달리 <b>함수</b>입니다.',
      },
      actions: [
        { label: '숫자 붙이는 모습 다시 보기', run: (a) => a.replayValues(), primary: true },
        { label: '값 7로 가는 칸 보기', run: (a) => a.set({ ev: 'eq', val: a.valueOr(7) }) },
        { label: '다른 실험으로', run: (a) => a.toggleSpace() },
      ],
    },
    {
      id: 'M3', title: '같은 실험, 다른 확률변수',
      init: { xid: 'auto', showValues: true, ev: 'none', sel: [], trials: 0, band: false, showCdf: false, right: true },
      controls: ['space', 'xsel'],
      card: {
        do: '같은 주사위 실험에 다른 규칙을 붙여 보세요. ‘다음 확률변수’를 누르면 합 → 최댓값 → 최솟값 → 차 → 곱 → 첫째 눈 → 지시변수 순으로 바뀝니다.',
        see: '표본공간과 확률은 그대로인데, 규칙이 바뀌면 칸의 숫자와 분포 모양이 모두 달라집니다. 흐린 점선은 바로 전 확률변수의 분포입니다. “합이 7이면 1, 아니면 0”은 값이 두 개뿐인 <b>베르누이</b> 확률변수입니다.',
        ask: '최댓값의 분포는 왜 큰 값 쪽으로 기울어 있을까요? 6이 최댓값이 되는 칸을 세어 보세요.',
        math: '$$P_X(B)=P\\big(\\{\\omega: X(\\omega)\\in B\\}\\big)$$ 확률분포 $P_X$는 표본공간의 확률 $P$와 규칙 $X$가 함께 정합니다.',
      },
      actions: [
        { label: '다음 확률변수', run: (a) => a.cycleX(1), primary: true },
        { label: '이전 확률변수', run: (a) => a.cycleX(-1) },
        { label: '지시변수 (합이 7이면 1)', run: (a) => a.setX('ind7') },
      ],
    },
    {
      id: 'M4', title: '역상: 값에서 결과로',
      init: { xid: 'auto', showValues: true, ev: 'eq', val: 'mid', sel: [], trials: 0, band: false, showCdf: true, right: true },
      controls: ['space', 'xsel', 'event', 'cdf'],
      card: {
        do: '오른쪽 분포에서 값을 누르면 그 값으로 가는 칸들이 강조됩니다. ‘X ≤ x’로 바꾸고 x를 움직여 보세요.',
        see: '사건 {X = x}, {X ≤ x}는 표본공간의 칸 모임(역상)입니다. 강조된 칸 수 ÷ 36이 확률이고, x를 움직일 때 {X ≤ x}의 확률을 이은 것이 아래 계단, 곧 <b>누적분포함수</b> F(x)입니다.',
        ask: 'x를 정수에서 조금 오른쪽으로 옮기면 강조된 칸이 늘어나나요? 계단이 평평한 구간에서는 무슨 일이 일어나나요?',
        math: '$$X^{-1}(B)=\\{\\omega\\in\\Omega: X(\\omega)\\in B\\},\\qquad F(x)=P\\big(X^{-1}((-\\infty,x])\\big)$$ 모든 구간 $B$의 역상이 사건이어야 확률을 붙일 수 있습니다(가측성).',
      },
      actions: [
        { label: 'X = 7의 역상', run: (a) => a.set({ ev: 'eq', val: a.valueOr(7) }), primary: true },
        { label: 'X ≤ 4의 역상', run: (a) => a.set({ ev: 'le', xt: 4 }) },
        { label: 'x를 왼쪽부터 키우기', run: (a) => a.sweep() },
        { label: '모듈 2에서 자세히', run: (a) => a.goModule2() },
      ],
    },
    {
      id: 'M5', title: '실험을 반복하면',
      init: { xid: 'auto', showValues: true, ev: 'none', sel: [], trials: 0, band: true, showCdf: false, right: true },
      controls: ['space', 'xsel', 'trials', 'band', 'seed'],
      card: {
        do: '‘실험 한 번’을 여러 번 누른 뒤 ‘10,000번 더’를 눌러 보세요. 확률변수를 바꿔도 지금까지의 실험 결과는 그대로 쓰입니다.',
        see: '실험 결과(칸)가 반짝이고, 그 칸의 X 값이 실수축에 쌓입니다. 반복할수록 값별 상대도수(파란 막대)가 이론 확률(점)로 다가갑니다. 모듈 1의 히스토그램이 바로 이 과정이었습니다.',
        ask: '같은 10,000번의 실험으로 “합”과 “최댓값”의 분포를 모두 구할 수 있는 이유는 무엇일까요?',
        math: '$$\\frac{\\#\\{i: X(\\omega_i)=x\\}}{n}\\;\\xrightarrow[n\\to\\infty]{}\\;P(X=x)$$',
      },
      actions: [
        { label: '실험 한 번', run: (a) => a.trialOnce(), primary: true },
        { label: '100번 더', run: (a) => a.addTrials(100) },
        { label: '10,000번 더', run: (a) => a.addTrials(10000) },
        { label: '처음부터', run: (a) => a.set({ trials: 0 }) },
      ],
    },
  ];

  const continuous = [
    {
      id: 'N1', title: '무작위 점과 넓이',
      init: { space: 'square', xid: null, sqmode: 'plain', trials: 0, rect: { u0: 0, u1: 0.5, v0: 0, v1: 0.5 }, showCdf: false, right: false, strip: false },
      controls: ['trials', 'seed'],
      card: {
        do: '정사각형 [0, 1] × [0, 1] 위에 무작위로 점을 찍는 실험입니다. 점을 1,000개 찍고, 정사각형 위를 끌어 직사각형 영역을 그려 보세요.',
        see: '영역 안에 들어간 점의 비율이 영역의 <b>넓이</b>에 가까워집니다. 연속 표본공간에서는 넓이가 곧 확률입니다. 점 하나(넓이 0)의 확률은 0입니다.',
        ask: '대각선 위의 점들, 곧 u = v인 결과들의 확률은 얼마일까요?',
        math: '$$\\Omega=[0,1]^2,\\qquad P(A)=\\text{넓이}(A)$$',
      },
      actions: [
        { label: '점 1,000개 찍기', run: (a) => a.addTrials(1000), primary: true },
        { label: '점 하나 찍기', run: (a) => a.trialOnce() },
        { label: '영역: 왼쪽 아래 1/4', run: (a) => a.set({ rect: { u0: 0, u1: 0.5, v0: 0, v1: 0.5 } }) },
        { label: '영역: 가는 띠', run: (a) => a.set({ rect: { u0: 0.45, u1: 0.55, v0: 0, v1: 1 } }) },
      ],
    },
    {
      id: 'N2', title: '점에 수 붙이기',
      init: { space: 'square', xid: 'sum', sqmode: 'bands', trials: 2000, showCdf: false, right: true, strip: false, rect: null },
      controls: ['xsel', 'trials', 'seed'],
      card: {
        do: '각 점 (u, v)에 수를 붙이는 규칙을 골라 보세요. 정사각형 위에 마우스를 올리면 그 점의 X 값으로 화살표가 이어집니다.',
        see: '정사각형의 색 띠는 X 값이 비슷한 점들의 모임입니다(진할수록 큰 값). 같은 정사각형이라도 규칙에 따라 분포가 균등, 삼각형, 2x처럼 달라집니다. 띠가 넓게 퍼진 값일수록 밀도가 높습니다.',
        ask: 'u + v가 1 근처에 몰리는 이유를 정사각형의 대각선 띠로 설명해 보세요.',
        math: '$$X(u,v)=u+v,\\qquad f_X(x)=\\begin{cases}x & 0\\le x\\le1\\\\ 2-x & 1\\lt x\\le2\\end{cases}$$',
      },
      actions: [
        { label: 'X = u', run: (a) => a.setX('u') },
        { label: 'X = u + v', run: (a) => a.setX('sum'), primary: true },
        { label: 'X = max(u, v)', run: (a) => a.setX('max') },
        { label: 'X = 원점까지 거리', run: (a) => a.setX('dist') },
      ],
    },
    {
      id: 'N3', title: '영역 넓이 = 누적확률',
      init: { space: 'square', xid: 'max', sqmode: 'region', trials: 1000, showCdf: true, right: true, strip: false, xt: 'mid', rect: null },
      controls: ['xsel', 'threshold', 'cdf', 'trials', 'seed'],
      card: {
        do: 'x 슬라이더(또는 오른쪽 그래프의 손잡이 b)를 움직여 보세요. 정사각형에 {X ≤ x}인 점들의 영역이 칠해집니다.',
        see: '칠해진 영역의 넓이가 F(x) = P(X ≤ x)입니다. max(u, v) ≤ x는 한 변이 x인 정사각형이라 F(x) = x²입니다. ‘미분해 보기’를 누르면 x를 조금 늘릴 때 새로 칠해지는 주황 띠가 보이고, 그 넓이 ÷ 늘린 폭이 밀도 f(x)입니다.',
        ask: '원점까지 거리 X에서 {X ≤ 0.5}는 어떤 모양이고 넓이는 얼마인가요?',
        math: '$$F(x)=\\text{넓이}\\{(u,v): X(u,v)\\le x\\},\\qquad f(x)=\\lim_{h\\to0}\\frac{F(x+h)-F(x)}{h}$$',
      },
      actions: [
        { label: '미분해 보기', run: (a) => a.set({ strip: !a.state.strip }), primary: true },
        { label: 'x를 왼쪽부터 키우기', run: (a) => a.sweep() },
        { label: 'X = 원점까지 거리', run: (a) => a.setX('dist') },
        { label: 'X = u·v', run: (a) => a.setX('prod') },
      ],
    },
    {
      id: 'N4', title: '확률변수의 함수',
      init: { space: 'segment', xid: 'sq', trials: 2000, showCdf: false, right: true, strip: false, rect: null },
      controls: ['xsel', 'trials', 'seed'],
      card: {
        do: '선분 [0, 1] 위의 균등난수 U에 함수 g를 씌워 새 확률변수 Y = g(U)를 만듭니다. 함수를 바꿔 보세요.',
        see: 'U의 같은 폭 칸 10개는 확률이 0.1씩 같습니다. g를 거치면 칸의 폭이 늘거나 줄어드는데, 확률 0.1은 그대로이므로 <b>넓게 늘어난 곳은 밀도가 묽고, 좁게 눌린 곳은 진합니다</b>. Y = −ln U는 지수분포가 됩니다. 모듈 2의 역변환 표본추출과 같은 원리입니다.',
        ask: 'Y = U²에서 0 근처의 밀도가 아주 큰 이유를 칸의 폭으로 설명해 보세요.',
        math: '$$f_Y(y)=f_U\\big(g^{-1}(y)\\big)\\left|\\frac{d}{dy}g^{-1}(y)\\right|\\qquad(g\\text{가 단조일 때})$$ 예: $Y=U^2$이면 $g^{-1}(y)=\\sqrt y$, $f_Y(y)=\\dfrac{1}{2\\sqrt y}$.',
      },
      actions: [
        { label: 'Y = 2U', run: (a) => a.setX('twoU') },
        { label: 'Y = U²', run: (a) => a.setX('sq'), primary: true },
        { label: 'Y = √U', run: (a) => a.setX('sqrt') },
        { label: 'Y = −ln U', run: (a) => a.setX('neglog') },
        { label: '모듈 2 역변환과 비교', run: (a) => a.goModule2Inverse() },
      ],
    },
  ];

  RVL.steps3 = { discrete, continuous };
})(typeof window !== 'undefined' ? window : globalThis);
