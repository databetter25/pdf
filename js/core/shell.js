/* 공통 셸: 머리글·내비게이션, 단계 레일·단계 카드, 발표 모드, 링크 복사, 키보드 단계 이동, 서식 도우미
 * 모든 페이지에서 쓴다. <header data-shell-header data-current="..." data-root="../">가 있으면 자동으로 채운다.
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});

  const NAV = [
    { label: '모듈 1 히스토그램', short: '모듈 1', items: [
      ['m1c', 'module1/continuous.html', '연속형: 확률밀도함수'],
      ['m1d', 'module1/discrete.html', '이산형: 확률질량함수'],
      ['m1l', 'module1/lab.html', '자유 실험실'],
    ] },
    { label: '모듈 2 누적분포함수', short: '모듈 2', items: [
      ['m2c', 'module2/continuous.html', '연속형: 줄 세워 세기에서 CDF로'],
      ['m2d', 'module2/discrete.html', '이산형: 계단과 점프'],
      ['m2l', 'module2/lab.html', '자유 실험실'],
    ] },
    { label: '모듈 3 확률변수', short: '모듈 3', items: [
      ['m3d', 'module3/discrete.html', '주사위와 동전'],
      ['m3c', 'module3/continuous.html', '정사각형 위의 점'],
      ['m3l', 'module3/lab.html', '자유 실험실'],
    ] },
    { label: '모듈 4 측도론', short: '모듈 4', items: [
      ['m4w', 'module4/why.html', '왜 측도론인가'],
      ['m4l', 'module4/limits.html', '적분과 극한'],
      ['m4s', 'module4/stats.html', '측도론 위의 수리통계학'],
    ] },
    { label: '학습 노트', short: '학습 노트', items: [
      ['notes', 'notes/index.html', '요약'],
      ['lecture', 'notes/lecture.html', '강의노트 1: 히스토그램에서 분포로'],
      ['lecture2', 'notes/lecture2.html', '강의노트 2: 누적분포함수'],
      ['lecture3', 'notes/lecture3.html', '강의노트 3: 확률변수'],
      ['lecture4', 'notes/lecture4.html', '강의노트 4: 측도론과 확률분포'],
    ] },
    { label: '교수자 안내', short: '교수자 안내', href: ['teacher', 'teacher/index.html'] },
  ];

  const BRAND_SVG = '<svg viewBox="0 0 28 20" aria-hidden="true"><rect x="1" y="12" width="4" height="7"/><rect x="6" y="6" width="4" height="13"/><rect x="11" y="2" width="4" height="17"/><rect x="16" y="7" width="4" height="12"/><rect x="21" y="13" width="4" height="6"/><path d="M1 18 C7 16 9 1 13 1 S19 16 27 18"/></svg>';

  function header(rootPath, current, tools) {
    const groups = NAV.map((g, gi) => {
      if (g.href) {
        const [id, href] = g.href;
        return `<div class="nav-group"><a class="nav-top" href="${rootPath}${href}"${id === current ? ' aria-current="page"' : ''}>${g.short}</a></div>`;
      }
      const isCur = g.items.some(([id]) => id === current);
      return `<div class="nav-group${isCur ? ' current' : ''}">
        <button type="button" class="nav-top" aria-expanded="false" aria-controls="navm-${gi}">${g.short}<span aria-hidden="true" class="caret">▾</span></button>
        <ul class="nav-menu" id="navm-${gi}" role="list"><li class="nav-menu-title">${g.label}</li>${g.items.map(([id, href, t]) =>
          `<li><a href="${rootPath}${href}"${id === current ? ' aria-current="page"' : ''}>${t}</a></li>`).join('')}</ul>
      </div>`;
    }).join('');
    return `
      <a class="brand" href="${rootPath}index.html">${BRAND_SVG}확률변수 실험실</a>
      <button type="button" class="nav-toggle ghost-btn" aria-expanded="false" aria-controls="site-nav">메뉴</button>
      <nav class="site-nav" id="site-nav" aria-label="사이트">${groups}</nav>
      ${tools ? `<div class="header-tools">
        <button type="button" id="btn-present" class="ghost-btn" aria-pressed="false">발표 모드</button>
        <button type="button" id="btn-share" class="ghost-btn">링크 복사</button>
      </div>` : ''}`;
  }

  function wireNav(el) {
    const groups = Array.from(el.querySelectorAll('.nav-group'));
    const closeAll = (except) => groups.forEach((g) => {
      if (g === except) return;
      g.classList.remove('open');
      const b = g.querySelector('button.nav-top');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
    groups.forEach((g) => {
      const b = g.querySelector('button.nav-top');
      if (!b) return;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !g.classList.contains('open');
        closeAll(g);
        g.classList.toggle('open', open);
        b.setAttribute('aria-expanded', String(open));
      });
    });
    document.addEventListener('click', (e) => { if (!el.contains(e.target)) closeAll(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
    const tg = el.querySelector('.nav-toggle');
    if (tg) tg.addEventListener('click', () => {
      const open = !el.classList.contains('nav-open');
      el.classList.toggle('nav-open', open);
      tg.setAttribute('aria-expanded', String(open));
    });
  }

  /** <header data-shell-header>를 자동으로 채운다 */
  function mountHeader(el, opts = {}) {
    el = el || document.querySelector('[data-shell-header]');
    if (!el) return null;
    el.classList.add('site-header');
    el.dataset.mounted = '1';
    el.innerHTML = header(opts.root ?? el.dataset.root ?? '', opts.current ?? el.dataset.current ?? '', opts.tools);
    wireNav(el);
    return el;
  }

  /** 발표 모드·링크 복사 */
  function wireTools({ onPresent, beforeShare } = {}) {
    const bp = document.getElementById('btn-present');
    if (bp) bp.addEventListener('click', () => {
      const on = document.body.classList.toggle('present');
      bp.setAttribute('aria-pressed', on);
      if (onPresent) setTimeout(() => onPresent(on), 50);
    });
    const bs = document.getElementById('btn-share');
    if (bs) bs.addEventListener('click', async () => {
      if (beforeShare) beforeShare();
      try { await navigator.clipboard.writeText(location.href); bs.textContent = '복사했습니다'; }
      catch (err) { bs.textContent = '주소창의 링크를 복사하세요'; }
      setTimeout(() => (bs.textContent = '링크 복사'), 2000);
    });
  }

  function stage({ crumb, h1, steps }) {
    return `<div class="stage">
      <p class="crumb">${crumb}</p>
      <h1>${h1}</h1>
      ${steps ? `<ol class="step-rail" id="step-rail" style="--steps:${steps.length}">${steps.map((s, i) =>
        `<li><button type="button" data-step="${i}"><span class="num">${i + 1}</span><span class="t">${s.title}</span></button></li>`).join('')}</ol>` : ''}
    </div>`;
  }

  function renderMath(el) {
    if (root.renderMathInElement) {
      try {
        root.renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
      } catch (e) { /* 무시 */ }
    }
  }

  /** 단계 카드 HTML과 연결. api는 단계 actions의 run(api)에 넘겨진다 */
  function buildStepCard(card, steps, idx, api, go) {
    const s = steps[idx];
    card.innerHTML = `
      <p class="step-num">${idx + 1}단계 / ${steps.length}</p>
      <h2>${s.title}</h2>
      <p class="do">${s.card.do}</p>
      <div class="see"><h4>관찰 포인트</h4><p>${s.card.see}</p></div>
      <div class="ask"><h4>생각해 볼 질문</h4><p>${s.card.ask}</p></div>
      <details class="math"><summary>수식으로 보기</summary><div>${s.card.math}</div></details>
      <div class="actions">${(s.actions || []).map((a, i) => `<button type="button" class="${a.primary ? 'primary' : ''}" data-action="${i}"${a.id ? ` data-action-id="${a.id}" data-label="${a.label}"` : ''}>${a.label}</button>`).join('')}</div>
      <p class="toast" id="toast" hidden></p>
      <div class="step-nav">
        <button type="button" id="btn-prev" ${idx === 0 ? 'disabled' : ''}>← 이전 단계</button>
        <button type="button" id="btn-next" class="primary" ${idx === steps.length - 1 ? 'disabled' : ''}>다음 단계 →</button>
      </div>`;
    renderMath(card);
    card.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => s.actions[+b.dataset.action].run(api)));
    card.querySelector('#btn-prev').addEventListener('click', () => go(idx - 1));
    card.querySelector('#btn-next').addEventListener('click', () => go(idx + 1));
    document.querySelectorAll('#step-rail button').forEach((b) => {
      const i = +b.dataset.step;
      b.classList.toggle('done', i < idx);
      if (i === idx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  }

  function wireStepRail(go) {
    document.querySelectorAll('#step-rail button').forEach((b) => b.addEventListener('click', () => go(+b.dataset.step)));
  }
  function wireStepKeys(go, getIdx) {
    document.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t.closest && t.closest('input, select, textarea, [role=slider], .seg, [data-keys]')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(getIdx() + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(getIdx() - 1); }
    });
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  /* 서식 */
  const fInt = (v) => (isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—');
  const f4 = (v) => (isFinite(v) ? v.toFixed(4) : '—');
  function fNum(v, digits = 4) {
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e5)) return v.toPrecision(3);
    return (+v.toPrecision(digits)).toString();
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }
  function frac(num, den) {
    const g = gcd(num, den);
    return { n: num / g, d: den / g, text: num === 0 ? '0' : num === den ? '1' : `${num / g}/${den / g}` };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const N_LIST = [10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000];
  function nearestNIndex(n) {
    let best = 0, bd = Infinity;
    N_LIST.forEach((v, i) => { const d = Math.abs(Math.log(v / n)); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  const reduceMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  RVL.shell = {
    NAV, header, mountHeader, wireNav, wireTools, stage, renderMath, buildStepCard, wireStepRail, wireStepKeys, toast,
    fInt, f4, fNum, gcd, frac, clamp, N_LIST, nearestNIndex, reduceMotion,
    $: (s, el = document) => el.querySelector(s),
    $$: (s, el = document) => Array.from(el.querySelectorAll(s)),
  };

  if (typeof document !== 'undefined') {
    const auto = () => { const el = document.querySelector('[data-shell-header]'); if (el && !el.dataset.mounted) { el.dataset.mounted = '1'; mountHeader(el); } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
  }
})(typeof window !== 'undefined' ? window : globalThis);
