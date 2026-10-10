/* 모듈 4 장면 프레임워크 (PRD_module4 F4-01)
 * 장면 정의: { id, title, card:{do,see,ask,math}, actions:[{label, run(inst), primary}], create(ctx) → { render(), destroy?(), ...동작 } }
 * ctx: el(그림), extra(표), ctrl(조작), rng(off), legend(items), readouts(rows), controls(sections, onChange), every(ms, fn), raf(fn), link(path)
 */
(function () {
  'use strict';
  const RVL = window.RVL, S = RVL.shell;
  const { $ } = S;
  const body = document.body;
  const PAGE = body.dataset.page;
  const ROOT = body.dataset.root || '';
  const SCENES = RVL.m4scenes[PAGE];
  const META = {
    why: { crumb: '모듈 4 측도론과 확률분포', h1: '왜 측도론인가' },
    limits: { crumb: '모듈 4 측도론과 확률분포', h1: '적분과 극한' },
    stats: { crumb: '모듈 4 측도론과 확률분포', h1: '측도론 위의 수리통계학' },
  };
  const state = { step: 0, seed: 2026 };
  let inst = null, cleanups = [];

  function readURL() {
    const q = new URLSearchParams(location.search);
    const s = parseInt(q.get('step'), 10);
    if (s >= 1 && s <= SCENES.length) state.step = s - 1;
    const sd = parseInt(q.get('seed'), 10);
    if (sd >= 1) state.seed = sd;
  }
  function writeURL() {
    try { history.replaceState(null, '', `?step=${state.step + 1}&seed=${state.seed}`); } catch (e) { /* file:// */ }
  }

  function buildLayout() {
    const meta = META[PAGE];
    document.getElementById('app').innerHTML = `
    <header class="site-header" id="hdr"></header>
    <main class="lab">
      ${S.stage({ crumb: meta.crumb, h1: meta.h1, steps: SCENES })}
      <div class="lab-grid">
        <section class="main" aria-label="시뮬레이션">
          <figure class="chart-card m4-card">
            <ul class="legend" id="legend"></ul>
            <div id="scene" class="m4-scene"></div>
            <div id="scene-extra" class="m4-extra"></div>
            <dl class="readouts" id="readouts"></dl>
          </figure>
        </section>
        <div class="side">
          <article class="step-card" id="step-card" aria-live="polite"></article>
          <div class="controls" id="ctrl"></div>
        </div>
      </div>
    </main>
    <footer class="site-footer"><p>확률변수 실험실 모듈 4. 이론값과 시뮬레이션 값을 나란히 보여 줍니다.</p></footer>`;
    S.mountHeader($('#hdr'), { root: ROOT, current: body.dataset.current, tools: true });
  }

  /* 조작 패널 생성기 */
  function controls(sections, onChange) {
    const ctrl = $('#ctrl');
    const values = {};
    const outs = {};
    const fmts = {};
    const html = sections.map((sec) => `
      <section class="ctl">
        ${sec.title ? `<h3>${sec.title}</h3>` : ''}
        ${sec.items.map((it) => {
          const id = 'c-' + it.key;
          if (it.type !== 'buttons' && it.type !== 'hint') values[it.key] = it.value;
          if (it.type === 'range') {
            fmts[it.key] = it.fmt || ((v) => String(v));
            return `<label class="param"><span class="param-name">${it.label}</span><input type="range" id="${id}" data-k="${it.key}" min="${it.min}" max="${it.max}" step="${it.step}" value="${it.value}"><output data-o="${it.key}"></output></label>`;
          }
          if (it.type === 'select') return `<label class="field">${it.label}<select id="${id}" data-k="${it.key}">${it.options.map(([v, l]) => `<option value="${v}"${v === it.value ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
          if (it.type === 'seg') return `${it.label ? `<p class="hint" style="margin:6px 0 4px">${it.label}</p>` : ''}<div class="seg seg-wrap" role="group" aria-label="${it.label || it.key}">${it.options.map(([v, l]) => `<button type="button" data-seg="${it.key}" data-v="${v}" aria-pressed="${v === it.value}">${l}</button>`).join('')}</div>`;
          if (it.type === 'check') return `<label class="check"><input type="checkbox" id="${id}" data-k="${it.key}"${it.value ? ' checked' : ''}> ${it.label}</label>`;
          if (it.type === 'buttons') return `<div class="btn-row">${it.items.map((b) => `<button type="button" data-btn="${b.key}" class="${b.primary ? 'primary' : ''}">${b.label}</button>`).join('')}</div>`;
          if (it.type === 'text') return `<label class="field">${it.label}<div class="row"><input type="text" id="${id}" data-k="${it.key}" value="${it.value || ''}" placeholder="${it.placeholder || ''}" spellcheck="false" style="flex:1;min-width:0;border:1px solid var(--line-strong);border-radius:8px;padding:5px 8px;background:var(--surface)"><button type="button" data-apply="${it.key}">적용</button></div></label>`;
          if (it.type === 'hint') return `<p class="hint">${it.text}</p>`;
          return '';
        }).join('')}
      </section>`).join('') + `
      <section class="ctl">
        <h3><label for="num-seed">난수 시드</label></h3>
        <div class="row"><input type="number" id="num-seed" min="1" max="999999" value="${state.seed}"><button type="button" id="btn-reseed">새 난수로</button></div>
      </section>`;
    ctrl.innerHTML = html;
    const showOut = (k) => { const o = ctrl.querySelector(`[data-o="${k}"]`); if (o) o.textContent = fmts[k](values[k]); };
    Object.keys(fmts).forEach(showOut);
    ctrl.querySelectorAll('input[type=range]').forEach((el) => el.addEventListener('input', () => {
      const k = el.dataset.k; values[k] = +el.value; showOut(k); onChange(k, values[k], values);
    }));
    ctrl.querySelectorAll('select').forEach((el) => el.addEventListener('change', () => { const k = el.dataset.k; values[k] = el.value; onChange(k, values[k], values); }));
    ctrl.querySelectorAll('input[type=checkbox]').forEach((el) => el.addEventListener('change', () => { const k = el.dataset.k; values[k] = el.checked; onChange(k, values[k], values); }));
    ctrl.querySelectorAll('[data-seg]').forEach((el) => el.addEventListener('click', () => {
      const k = el.dataset.seg;
      values[k] = el.dataset.v;
      ctrl.querySelectorAll(`[data-seg="${k}"]`).forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === values[k]));
      onChange(k, values[k], values);
    }));
    ctrl.querySelectorAll('[data-btn]').forEach((el) => el.addEventListener('click', () => onChange(el.dataset.btn, true, values)));
    ctrl.querySelectorAll('[data-apply]').forEach((el) => el.addEventListener('click', () => {
      const k = el.dataset.apply; values[k] = ctrl.querySelector(`#c-${k}`).value; onChange(k, values[k], values);
    }));
    ctrl.querySelectorAll('input[type=text]').forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const k = el.dataset.k; values[k] = el.value; onChange(k, values[k], values); } }));
    $('#num-seed').addEventListener('change', (e) => { state.seed = Math.max(1, Math.round(+e.target.value) || 1); goStep(state.step); });
    $('#btn-reseed').addEventListener('click', () => { state.seed = 1 + Math.floor(Math.random() * 999999); goStep(state.step); });
    return {
      values,
      set(k, v) {
        values[k] = v;
        const el = ctrl.querySelector(`#c-${k}`);
        if (el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v; }
        ctrl.querySelectorAll(`[data-seg="${k}"]`).forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === String(v)));
        if (fmts[k]) showOut(k);
      },
    };
  }

  function makeCtx() {
    return {
      el: $('#scene'), extra: $('#scene-extra'), seed: state.seed, S, M4: RVL.m4, D: RVL.dist, H: RVL.hist,
      rng: (off = 0) => RVL.rng.createRng(state.seed + off),
      legend: (items) => { $('#legend').innerHTML = items.map(([cls, label]) => `<li><span class="sw ${cls}"></span>${label}</li>`).join(''); },
      readouts: (rows) => { $('#readouts').innerHTML = rows.map(([k, v]) => `<div class="ro"><dt>${k}</dt><dd>${v}</dd></div>`).join(''); },
      controls,
      every: (ms, fn) => { const id = setInterval(fn, ms); cleanups.push(() => clearInterval(id)); return id; },
      later: (ms, fn) => { const id = setTimeout(fn, ms); cleanups.push(() => clearTimeout(id)); return id; },
      raf: (fn) => { let id = requestAnimationFrame(function loop(t) { if (fn(t) !== false) id = requestAnimationFrame(loop); }); cleanups.push(() => cancelAnimationFrame(id)); },
      stopAll: () => { cleanups.forEach((f) => f()); cleanups = []; },
      link: (path) => ROOT + path,
      math: (el) => S.renderMath(el),
    };
  }

  function goStep(i) {
    if (i < 0 || i >= SCENES.length) return;
    cleanups.forEach((f) => f()); cleanups = [];
    if (inst && inst.destroy) inst.destroy();
    state.step = i;
    $('#scene').innerHTML = ''; $('#scene-extra').innerHTML = ''; $('#readouts').innerHTML = ''; $('#legend').innerHTML = '';
    const ctx = makeCtx();
    inst = SCENES[i].create(ctx);
    inst.render();
    S.buildStepCard($('#step-card'), SCENES, i, inst, goStep);
    writeURL();
  }

  function init() {
    buildLayout();
    readURL();
    S.wireTools({ onPresent: () => inst && inst.render(), beforeShare: writeURL });
    S.wireStepRail(goStep);
    S.wireStepKeys(goStep, () => state.step);
    let rt = null, lastW = window.innerWidth;
    window.addEventListener('resize', () => {
      if (Math.abs(window.innerWidth - lastW) < 4) return;
      lastW = window.innerWidth;
      clearTimeout(rt); rt = setTimeout(() => inst && inst.render(), 120);
    });
    goStep(state.step);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
