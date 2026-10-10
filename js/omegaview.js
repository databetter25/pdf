/* 모듈 3 보기 컴포넌트 (PRD_module3 5.1, F3-01~F3-16)
 *   GridView    유한 표본공간(주사위·동전)의 칸. 칸마다 결과와 X(ω), 역상 강조, 사건 선택
 *   ValueChart  실수축 위의 분포 P_X (점+수직선), 반복 실험의 상대도수 막대, 예상 변동 범위, 값 선택
 *   SquareView  정사각형 [0,1]² 위의 점, 값 띠, {X ≤ x} 영역, 직사각형 선택 (Canvas + SVG)
 *   SegmentView 선분 U에서 Y = g(U)로 옮겨지는 같은 확률의 띠 10개
 *   ArrowLayer  표본공간에서 실수축으로 이어지는 화살표 (가리킨 것만)
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});
  const reduceMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const css = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
  const fmtV = (v) => (Number.isInteger(v) ? String(v) : (+v.toFixed(3)).toString());

  /* ───────────── GridView ───────────── */
  class GridView {
    constructor(el, opts = {}) {
      this.el = el;
      this.opts = opts;
      this.svg = d3.select(el).append('svg').attr('class', 'omega-svg').attr('role', 'grid');
      this.g = this.svg.append('g');
      this.focusId = null;
      if (root.ResizeObserver) {
        let lw = el.clientWidth;
        new ResizeObserver(() => { const w = el.clientWidth; if (Math.abs(w - lw) > 2 && this.st) { lw = w; this.render(this.st); } }).observe(el);
      }
    }

    render(st) {
      this.st = st;
      const sp = st.space;
      const W = Math.max(260, this.el.clientWidth || 360);
      const hasHead = sp.id === 'dice2';
      const head = hasHead ? 26 : 0;
      const maxCell = sp.id === 'dice2' ? 64 : 92;
      const cell = Math.max(34, Math.min(maxCell, Math.floor((W - head - 4) / sp.cols)));
      const gw = cell * sp.cols, gh = cell * sp.rows;
      const H = gh + head + 4;
      this.svg.attr('viewBox', `0 0 ${gw + head + 4} ${H}`).attr('width', gw + head + 4).attr('height', H)
        .attr('aria-label', `${sp.name}의 표본공간, 결과 ${sp.outcomes.length}가지`);
      this.g.attr('transform', `translate(${head + 2},${head + 2})`);
      this.cell = cell;

      // 머리글 (주사위 두 개)
      const heads = hasHead ? [
        ...d3.range(6).map((i) => ({ k: 'c' + i, x: i * cell + cell / 2, y: -9, t: `b=${i + 1}` })),
        ...d3.range(6).map((i) => ({ k: 'r' + i, x: -14, y: i * cell + cell / 2 + 4, t: `a=${i + 1}`, rot: true })),
      ] : [];
      this.g.selectAll('text.ghead').data(heads, (d) => d.k).join('text').attr('class', 'ghead')
        .attr('x', (d) => d.x).attr('y', (d) => d.y).attr('text-anchor', 'middle')
        .attr('transform', (d) => (d.rot ? `rotate(-90 ${d.x} ${d.y - 4})` : null)).text((d) => d.t);

      const pmax = st.probs ? Math.max(...sp.outcomes.map((o) => st.probs.get(o.id) || 0)) : 0;
      const self = this;
      const cells = this.g.selectAll('g.cell').data(sp.outcomes, (o) => o.id).join((en) => {
        const g = en.append('g').attr('class', 'cell').attr('tabindex', 0).attr('role', 'gridcell');
        g.append('rect').attr('class', 'cell-bg');
        g.append('text').attr('class', 'cell-lab');
        g.append('text').attr('class', 'cell-val');
        g.on('pointerenter', (ev, o) => self.opts.onHover && self.opts.onHover(o.id))
          .on('pointerleave', () => self.opts.onHover && self.opts.onHover(null))
          .on('click', (ev, o) => self.opts.onClick && self.opts.onClick(o.id))
          .on('focus', (ev, o) => { self.focusId = o.id; self.opts.onHover && self.opts.onHover(o.id); })
          .on('blur', () => self.opts.onHover && self.opts.onHover(null))
          .on('keydown', (ev, o) => self._key(ev, o));
        return g;
      });
      cells.attr('transform', (o) => `translate(${o.col * cell},${o.row * cell})`)
        .attr('class', (o) => 'cell' + (st.hl && st.hl.has(o.id) ? ' hl' : '') + (st.sel && st.sel.has(o.id) ? ' sel' : '') + (st.invalid && st.invalid.has(o.id) ? ' invalid' : ''))
        .attr('aria-label', (o) => {
          const v = st.values ? st.values.get(o.id) : undefined;
          return `${o.label}${v !== undefined ? (isFinite(v) ? `, X = ${fmtV(v)}` : ', X 정의되지 않음') : ''}`;
        });
      cells.select('rect').attr('x', 1.5).attr('y', 1.5).attr('width', cell - 3).attr('height', cell - 3).attr('rx', 6)
        .style('fill-opacity', (o) => (st.loaded && st.probs ? 0.25 + 0.75 * (st.probs.get(o.id) / pmax) : null));
      const showV = !!st.values;
      cells.select('text.cell-lab').attr('x', showV ? 6 : cell / 2).attr('y', showV ? 14 : cell / 2 + 5)
        .attr('text-anchor', showV ? 'start' : 'middle').attr('class', 'cell-lab' + (showV ? '' : ' big'))
        .text((o) => (sp.id === 'dice2' && showV ? `${o.v.a},${o.v.b}` : o.label));
      cells.select('text.cell-val').attr('x', cell / 2).attr('y', cell / 2 + (cell > 50 ? 10 : 8)).attr('text-anchor', 'middle')
        .text((o) => {
          if (!showV) return '';
          const v = st.values.get(o.id);
          return isFinite(v) ? fmtV(v) : '—';
        });
    }

    _key(ev, o) {
      const sp = this.st.space;
      const mv = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[ev.key];
      if (mv) {
        ev.preventDefault();
        ev.stopPropagation();
        const t = sp.outcomes.find((q) => q.row === o.row + mv[0] && q.col === o.col + mv[1]);
        if (t) this.focus(t.id);
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        this.opts.onClick && this.opts.onClick(o.id);
      }
    }
    focus(id) {
      this.g.selectAll('g.cell').filter((o) => o.id === id).node()?.focus();
    }
    flash(id) {
      const c = this.g.selectAll('g.cell').filter((o) => o.id === id);
      c.classed('flash', true);
      setTimeout(() => c.classed('flash', false), reduceMotion() ? 0 : 650);
    }
    /** 칸 중심의 화면 좌표 */
    center(id) {
      const n = this.g.selectAll('g.cell').filter((o) => o.id === id).select('rect').node();
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }

  /* ───────────── ValueChart ───────────── */
  class ValueChart {
    constructor(el, opts = {}) {
      this.el = el;
      this.opts = opts;
      this.svg = d3.select(el).append('svg').attr('class', 'value-svg');
      this.title = this.svg.append('title');
      this.g = this.svg.append('g');
      ['grid', 'shade', 'ghost', 'bars', 'whisk', 'stems', 'labels', 'hit'].forEach((k) => (this[k] = this.g.append('g').attr('class', 'v-' + k)));
      this.gx = this.g.append('g').attr('class', 'axis axis-x');
      this.gy = this.g.append('g').attr('class', 'axis axis-y');
      this.yl = this.g.append('text').attr('class', 'axis-label');
      this.xl = this.g.append('text').attr('class', 'axis-label');
      if (root.ResizeObserver) {
        let lw = el.clientWidth;
        new ResizeObserver(() => { const w = el.clientWidth; if (Math.abs(w - lw) > 2 && this.m) { lw = w; this.render(this.m); } }).observe(el);
      }
    }

    render(m) {
      this.m = m;
      const W = Math.max(260, this.el.clientWidth || 420);
      const H = m.height || Math.round(Math.max(220, Math.min(300, W * 0.55)));
      const mg = { top: 22, right: 14, bottom: 42, left: 50 };
      const iw = W - mg.left - mg.right, ih = H - mg.top - mg.bottom;
      this.mg = mg; this.ih = ih;
      this.svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
      this.g.attr('transform', `translate(${mg.left},${mg.top})`);
      this.title.text(m.aria || 'X의 분포');
      const xs = m.list.map((d) => d.x);
      const lo = xs.length ? xs[0] : 0, hi = xs.length ? xs[xs.length - 1] : 1;
      let gap = Infinity;
      for (let i = 1; i < xs.length; i++) gap = Math.min(gap, xs[i] - xs[i - 1]);
      if (!isFinite(gap)) gap = 1;
      const pad = Math.max(gap * 0.7, (hi - lo) * 0.04, 0.5);
      const x = (this.x = d3.scaleLinear().domain([lo - pad, hi + pad]).range([0, iw]));
      const freqMax = m.freq ? Math.max(0, ...[...m.freq.values()]) : 0;
      const whiskMax = m.band && m.n ? Math.max(...m.list.map((d) => d.p + 2 * Math.sqrt(d.p * (1 - d.p) / m.n))) : 0;
      const ghostIn = (m.ghost || []).filter((d) => d.x >= lo - pad && d.x <= hi + pad);
      const ghostMax = ghostIn.length ? Math.max(...ghostIn.map((d) => d.p)) : 0;
      const yMax = Math.max(0.05, ...m.list.map((d) => d.p), freqMax, whiskMax, ghostMax) * 1.15;
      const y = (this.y = d3.scaleLinear().domain([0, yMax]).nice(5).range([ih, 0]));

      const allInt = xs.every((v) => Number.isInteger(v));
      const xa = d3.axisBottom(x).tickSizeOuter(0).tickPadding(6);
      if (allInt && hi - lo <= 40) {
        const every = Math.max(1, Math.ceil((hi - lo + 1) / Math.max(2, iw / 28)));
        xa.tickValues(d3.range(Math.ceil(lo), Math.floor(hi) + 1, every)).tickFormat(d3.format('d'));
      } else xa.ticks(Math.max(4, Math.floor(iw / 70)));
      this.gx.attr('transform', `translate(0,${ih})`).call(xa);
      this.gy.call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2~f')).tickSizeOuter(0));
      this.grid.call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat('')).select('.domain').remove();
      this.yl.attr('transform', `translate(${-mg.left + 13},${ih / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(m.yLabel || '확률');
      this.xl.attr('x', iw / 2).attr('y', ih + 36).attr('text-anchor', 'middle').text(m.xLabel || 'X의 값');

      // X ≤ x 음영
      const leX = m.leX;
      this.shade.selectAll('rect').data(leX != null && isFinite(leX) ? [leX] : []).join('rect').attr('class', 'iv-band')
        .attr('x', 0).attr('y', 0).attr('height', ih).attr('width', (v) => Math.max(0, Math.min(iw, x(v + gap * 0.5 - 1e-9) - 0)));

      // 이전 분포 그림자
      this.ghost.selectAll('line').data((m.ghost || []).filter((d) => d.x >= lo - pad && d.x <= hi + pad)).join('line').attr('class', 'ghost-stem')
        .attr('x1', (d) => x(d.x)).attr('x2', (d) => x(d.x)).attr('y1', ih).attr('y2', (d) => y(d.p));

      // 반복 실험의 상대도수 막대
      const bw = Math.max(3, Math.min(28, (x(lo + gap) - x(lo)) * 0.62));
      const fr = m.freq ? m.list.map((d) => ({ x: d.x, f: m.freq.get(d.x) || 0 })) : [];
      this.bars.selectAll('rect').data(fr, (d) => d.x).join('rect').attr('class', 'bar freq-bar')
        .attr('x', (d) => x(d.x) - bw / 2).attr('width', bw).attr('y', (d) => y(d.f)).attr('height', (d) => Math.max(0, ih - y(d.f)));

      // 예상 변동 범위
      const wk = m.band && m.n ? m.list.map((d) => {
        const se = Math.sqrt(d.p * (1 - d.p) / m.n), f = m.freq ? m.freq.get(d.x) || 0 : 0;
        return { x: d.x, lo: Math.max(0, d.p - 2 * se), hi: d.p + 2 * se, miss: Math.abs(f - d.p) > 2 * se + 1e-9 };
      }) : [];
      const cap = Math.min(10, bw * 0.5);
      const wg = this.whisk.selectAll('g').data(wk, (d) => d.x).join((en) => { const g = en.append('g'); g.append('line').attr('class', 'w-v'); g.append('line').attr('class', 'w-lo'); g.append('line').attr('class', 'w-hi'); return g; })
        .attr('class', (d) => 'whisk' + (d.miss ? ' miss' : ''));
      wg.select('.w-v').attr('x1', (d) => x(d.x)).attr('x2', (d) => x(d.x)).attr('y1', (d) => y(d.lo)).attr('y2', (d) => y(d.hi));
      wg.select('.w-lo').attr('x1', (d) => x(d.x) - cap / 2).attr('x2', (d) => x(d.x) + cap / 2).attr('y1', (d) => y(d.lo)).attr('y2', (d) => y(d.lo));
      wg.select('.w-hi').attr('x1', (d) => x(d.x) - cap / 2).attr('x2', (d) => x(d.x) + cap / 2).attr('y1', (d) => y(d.hi)).attr('y2', (d) => y(d.hi));

      // 이론 분포: 점 + 수직선
      const on = (d) => (m.hlValues ? m.hlValues.has(d.x) : leX != null ? d.x <= leX + 1e-9 : false);
      const anyHl = !!m.hlValues || leX != null;
      this.stems.selectAll('line').data(m.list, (d) => d.x).join('line')
        .attr('class', (d) => 'stem' + (anyHl ? (on(d) ? ' on' : ' off') : ''))
        .attr('x1', (d) => x(d.x)).attr('x2', (d) => x(d.x)).attr('y1', ih).attr('y2', (d) => y(d.p));
      this.stems.selectAll('circle').data(m.list, (d) => d.x).join('circle')
        .attr('class', (d) => 'stem-dot' + (anyHl ? (on(d) ? ' on' : ' off') : '')).attr('r', 5)
        .attr('cx', (d) => x(d.x)).attr('cy', (d) => y(d.p));
      const labs = m.fracText && m.list.length <= 13 ? m.list : [];
      this.labels.selectAll('text').data(labs, (d) => d.x).join('text').attr('class', (d) => 'stem-frac' + (anyHl && on(d) ? ' on' : ''))
        .attr('x', (d) => x(d.x)).attr('y', (d) => y(d.p) - 10).attr('text-anchor', 'middle').text((d) => m.fracText.get(d.x) || '');

      // 클릭 영역
      const hw = Math.max(8, Math.min(30, (x(lo + gap) - x(lo)) / 2));
      const self = this;
      this.hit.selectAll('rect').data(m.list, (d) => d.x).join('rect').attr('class', 'v-hit')
        .attr('x', (d) => x(d.x) - hw).attr('width', hw * 2).attr('y', 0).attr('height', ih + 20)
        .attr('tabindex', this.opts.onPick ? 0 : null).attr('role', this.opts.onPick ? 'button' : null)
        .attr('aria-label', (d) => `X = ${fmtV(d.x)}, 확률 ${d.p.toFixed(4)}`)
        .on('click', (ev, d) => self.opts.onPick && self.opts.onPick(d.x))
        .on('keydown', (ev, d) => { if ((ev.key === 'Enter' || ev.key === ' ') && self.opts.onPick) { ev.preventDefault(); self.opts.onPick(d.x); } })
        .on('pointerenter', (ev, d) => self.opts.onHoverValue && self.opts.onHoverValue(d.x))
        .on('pointerleave', () => self.opts.onHoverValue && self.opts.onHoverValue(null));
    }

    /** 값 x의 막대 끝(축 위) 화면 좌표 */
    anchor(v) {
      if (!this.x) return null;
      const r = this.svg.node().getBoundingClientRect();
      const vb = this.svg.attr('viewBox').split(' ').map(Number);
      const s = r.width / vb[2];
      return { x: r.left + (this.mg.left + this.x(v)) * s, y: r.top + (this.mg.top + this.ih) * s };
    }
  }

  /* ───────────── SquareView ───────────── */
  const G = 200;
  class SquareView {
    constructor(el, opts = {}) {
      this.el = el;
      this.opts = opts;
      el.classList.add('square-wrap');
      this.canvas = d3.select(el).append('canvas').attr('class', 'square-canvas').node();
      this.svg = d3.select(el).append('svg').attr('class', 'square-svg');
      this.g = this.svg.append('g');
      this.gAx = this.g.append('g');
      this.gSel = this.g.append('g');
      this.gHover = this.g.append('g');
      this.field = null;
      this.off = document.createElement('canvas');
      this.off.width = G; this.off.height = G;
      this.drag = null;
      const ov = this.g.append('rect').attr('class', 'overlay').attr('fill', 'transparent');
      this.ov = ov;
      ov.on('pointermove', (ev) => this._move(ev))
        .on('pointerleave', () => { if (!this.drag) this.opts.onHover && this.opts.onHover(null); })
        .on('pointerdown', (ev) => { if (!this.opts.onRect) return; ev.preventDefault(); const p = this._uv(ev); this.drag = { u0: p.u, v0: p.v }; ov.node().setPointerCapture && ov.node().setPointerCapture(ev.pointerId); })
        .on('pointerup', (ev) => { if (this.drag) { const p = this._uv(ev); const r = this._rect(this.drag, p); this.drag = null; if (r.u1 - r.u0 > 0.01 && r.v1 - r.v0 > 0.01) this.opts.onRect(r); } });
      if (root.ResizeObserver) {
        let lw = el.clientWidth;
        new ResizeObserver(() => { const w = el.clientWidth; if (Math.abs(w - lw) > 2 && this.m) { lw = w; this.render(this.m); } }).observe(el);
      }
    }
    _rect(a, p) { return { u0: Math.min(a.u0, p.u), u1: Math.max(a.u0, p.u), v0: Math.min(a.v0, p.v), v1: Math.max(a.v0, p.v) }; }
    _uv(ev) {
      const [px, py] = d3.pointer(ev, this.g.node());
      return { u: Math.max(0, Math.min(1, px / this.S)), v: Math.max(0, Math.min(1, 1 - py / this.S)) };
    }
    _move(ev) {
      const p = this._uv(ev);
      if (this.drag && this.opts.onRect) { this._drawSel(this._rect(this.drag, p), true); return; }
      this.opts.onHover && this.opts.onHover(p);
    }

    /** X의 값을 G×G 격자 중점에서 미리 계산 */
    setField(f) {
      const vals = new Float32Array(G * G);
      let lo = Infinity, hi = -Infinity;
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const v = f({ u: (i + 0.5) / G, v: 1 - (j + 0.5) / G });
        vals[j * G + i] = isFinite(v) ? v : NaN;
        if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
      }
      const sorted = Float32Array.from(vals.filter((v) => !isNaN(v))).sort();
      this.field = { vals, lo, hi, sorted };
    }

    render(m) {
      this.m = m;
      const S = (this.S = Math.max(220, Math.min(440, (this.el.clientWidth || 360) - 44)));
      const pad = { l: 34, t: 8, b: 30, r: 10 };
      const W = S + pad.l + pad.r, H = S + pad.t + pad.b;
      const dpr = root.devicePixelRatio || 1;
      const cv = this.canvas;
      cv.width = Math.round(S * dpr); cv.height = Math.round(S * dpr);
      cv.style.width = S + 'px'; cv.style.height = S + 'px';
      cv.style.left = pad.l + 'px'; cv.style.top = pad.t + 'px';
      this.svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
      this.el.style.height = H + 'px';
      this.el.style.width = W + 'px';
      this.g.attr('transform', `translate(${pad.l},${pad.t})`);
      this.ov.attr('width', S).attr('height', S).style('cursor', this.opts.onRect ? 'crosshair' : 'default');
      this.pad = pad;

      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = css('--chart-surface') || '#fff';
      ctx.fillRect(0, 0, S, S);

      // 격자 칠하기 (값 띠 / 영역)
      const F = this.field;
      if (F && (m.mode === 'bands' || m.mode === 'region')) {
        const octx = this.off.getContext('2d');
        const img = octx.createImageData(G, G);
        const rgb = (hex) => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
        const acc = rgb(css('--series-1') || '#2a78d6'), org = rgb(css('--series-2') || '#e0602b');
        let qs = null;
        if (m.mode === 'bands') { const s = F.sorted; qs = [1, 2, 3, 4, 5].map((k) => s[Math.floor(s.length * k / 6)]); }
        for (let p = 0; p < G * G; p++) {
          const v = F.vals[p];
          let a = 0, c = acc;
          if (isNaN(v)) { a = 0; }
          else if (m.mode === 'bands') { let b = 0; while (b < 5 && v > qs[b]) b++; a = 0.07 + b * 0.085; }
          else {
            if (v <= m.threshold + 1e-12) a = 0.42;
            if (m.strip && v > m.strip[0] && v <= m.strip[1]) { a = 0.75; c = org; }
          }
          img.data[p * 4] = c[0]; img.data[p * 4 + 1] = c[1]; img.data[p * 4 + 2] = c[2]; img.data[p * 4 + 3] = Math.round(a * 255);
        }
        octx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = m.mode === 'bands';
        ctx.drawImage(this.off, 0, 0, S, S);
      }

      // 점
      const P = m.points;
      if (P && P.n) {
        ctx.fillStyle = css('--ink') || '#172034';
        const n = P.n, r = n <= 300 ? 2.6 : n <= 3000 ? 1.5 : 0.9;
        ctx.globalAlpha = n <= 3000 ? 0.85 : Math.max(0.25, Math.min(0.7, 3000 / n));
        const sel = m.rect;
        for (let i = 0; i < n; i++) {
          const u = P.U[i], v = P.V[i];
          if (sel && m.mode === 'plain') ctx.fillStyle = u >= sel.u0 && u <= sel.u1 && v >= sel.v0 && v <= sel.v1 ? (css('--series-2') || '#e0602b') : (css('--ink') || '#172034');
          ctx.beginPath(); ctx.arc(u * S, (1 - v) * S, r, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // 축
      const sx = d3.scaleLinear().domain([0, 1]).range([0, S]), sy = d3.scaleLinear().domain([0, 1]).range([S, 0]);
      this.gAx.selectAll('*').remove();
      this.gAx.append('rect').attr('class', 'square-frame').attr('width', S).attr('height', S);
      this.gAx.append('g').attr('class', 'axis').attr('transform', `translate(0,${S})`).call(d3.axisBottom(sx).ticks(4).tickSizeOuter(0));
      this.gAx.append('g').attr('class', 'axis').call(d3.axisLeft(sy).ticks(4).tickSizeOuter(0));
      this.gAx.append('text').attr('class', 'axis-label').attr('x', S / 2).attr('y', S + 28).attr('text-anchor', 'middle').text('u');
      this.gAx.append('text').attr('class', 'axis-label').attr('x', -30).attr('y', S / 2 + 4).text('v');
      this._drawSel(m.rect, false);
      this._drawHover(m.hover);
    }

    _drawSel(r, live) {
      const S = this.S;
      this.gSel.selectAll('rect').data(r ? [r] : []).join('rect').attr('class', 'sel-rect' + (live ? ' live' : ''))
        .attr('x', (d) => d.u0 * S).attr('y', (d) => (1 - d.v1) * S).attr('width', (d) => (d.u1 - d.u0) * S).attr('height', (d) => (d.v1 - d.v0) * S);
    }
    _drawHover(h) {
      const S = this.S;
      const g = this.gHover.selectAll('g').data(h ? [h] : []).join((en) => { const k = en.append('g'); k.append('circle').attr('r', 6); k.append('text'); return k; });
      g.attr('class', 'sq-hover').attr('transform', (d) => `translate(${d.u * S},${(1 - d.v) * S})`);
      g.select('text').attr('x', (d) => (d.u > 0.6 ? -10 : 10)).attr('y', (d) => (d.v > 0.85 ? 18 : -10))
        .attr('text-anchor', (d) => (d.u > 0.6 ? 'end' : 'start')).text((d) => d.label || '');
    }
    setHover(h) { if (this.m) { this.m.hover = h; this._drawHover(h); } }
    /** (u, v)의 화면 좌표 */
    anchor(u, v) {
      const r = this.canvas.getBoundingClientRect();
      return { x: r.left + u * r.width, y: r.top + (1 - v) * r.height };
    }
  }

  /* ───────────── SegmentView ───────────── */
  class SegmentView {
    constructor(el) {
      this.el = el;
      this.svg = d3.select(el).append('svg').attr('class', 'segment-svg');
      this.g = this.svg.append('g');
      if (root.ResizeObserver) {
        let lw = el.clientWidth;
        new ResizeObserver(() => { const w = el.clientWidth; if (Math.abs(w - lw) > 2 && this.m) { lw = w; this.render(this.m); } }).observe(el);
      }
    }
    render(m) {
      this.m = m;
      const W = Math.max(260, this.el.clientWidth || 380), H = 300;
      const mg = { l: 20, r: 20, t: 40, b: 46 };
      const iw = W - mg.l - mg.r;
      this.svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
      this.g.attr('transform', `translate(${mg.l},0)`);
      this.g.selectAll('*').remove();
      const yTop = mg.t, yBot = H - mg.b;
      const xu = d3.scaleLinear().domain([0, 1]).range([0, iw]);
      const xy = d3.scaleLinear().domain(m.range).range([0, iw]).clamp(true);
      const K = 10;
      const bands = d3.range(K).map((i) => {
        const u0 = i / K, u1 = (i + 1) / K;
        let y0 = m.g(Math.max(u0, 1e-9)), y1 = m.g(Math.min(u1, 1 - 1e-9));
        return { i, u0, u1, y0: Math.min(y0, y1), y1: Math.max(y0, y1) };
      });
      const cl = (v) => Math.max(m.range[0], Math.min(m.range[1], v));
      this.g.selectAll('path.band').data(bands).join('path').attr('class', (b) => 'seg-band' + (b.i % 2 ? ' alt' : ''))
        .attr('d', (b) => {
          const inc = m.g(0.75) >= m.g(0.25);
          const ya = inc ? b.y0 : b.y1, yb = inc ? b.y1 : b.y0;
          return `M${xu(b.u0)},${yTop}L${xu(b.u1)},${yTop}L${xy(cl(yb))},${yBot}L${xy(cl(ya))},${yBot}Z`;
        });
      this.g.append('g').attr('class', 'axis').attr('transform', `translate(0,${yTop})`).call(d3.axisTop(xu).ticks(5).tickSizeOuter(0));
      this.g.append('g').attr('class', 'axis').attr('transform', `translate(0,${yBot})`).call(d3.axisBottom(xy).ticks(Math.max(4, Math.floor(iw / 70))).tickSizeOuter(0));
      this.g.append('text').attr('class', 'axis-label').attr('x', 0).attr('y', 14).text('U ~ U(0, 1): 폭 0.1인 칸 10개, 칸마다 확률 0.1');
      this.g.append('text').attr('class', 'axis-label').attr('x', 0).attr('y', H - 8).text(`${m.label}: 같은 확률 0.1이 늘어나거나 줄어든 폭에 퍼짐`);
    }
  }

  /* ───────────── ArrowLayer ───────────── */
  class ArrowLayer {
    constructor(container) {
      this.c = container;
      container.style.position = 'relative';
      this.svg = d3.select(container).append('svg').attr('class', 'arrow-layer').attr('aria-hidden', 'true');
      const mk = this.svg.append('defs').append('marker').attr('id', 'arrowhead').attr('viewBox', '0 0 10 10')
        .attr('refX', 9).attr('refY', 5).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto-start-reverse');
      mk.append('path').attr('d', 'M0,0L10,5L0,10z').attr('class', 'arrow-head');
      this.g = this.svg.append('g');
    }
    draw(list) {
      const r = this.c.getBoundingClientRect();
      this.svg.attr('width', r.width).attr('height', r.height);
      const rel = (p) => ({ x: p.x - r.left, y: p.y - r.top });
      const items = (list || []).filter((a) => a && a.from && a.to).map((a) => ({ f: rel(a.from), t: rel(a.to), cls: a.cls || '' }));
      this.g.selectAll('path').data(items).join('path').attr('class', (a) => 'arrow ' + a.cls).attr('marker-end', 'url(#arrowhead)')
        .attr('d', (a) => {
          const dx = a.t.x - a.f.x, dy = a.t.y - a.f.y;
          const horiz = Math.abs(dx) > Math.abs(dy);
          const c1 = horiz ? { x: a.f.x + dx * 0.45, y: a.f.y } : { x: a.f.x, y: a.f.y + dy * 0.45 };
          const c2 = horiz ? { x: a.t.x - dx * 0.35, y: a.t.y - 30 } : { x: a.t.x, y: a.t.y - dy * 0.35 };
          return `M${a.f.x},${a.f.y}C${c1.x},${c1.y} ${c2.x},${c2.y} ${a.t.x},${a.t.y - 3}`;
        });
    }
    clear() { this.g.selectAll('path').remove(); }
  }

  RVL.GridView = GridView;
  RVL.ValueChart = ValueChart;
  RVL.SquareView = SquareView;
  RVL.SegmentView = SegmentView;
  RVL.ArrowLayer = ArrowLayer;
  RVL.fmtV = fmtV;
})(typeof window !== 'undefined' ? window : globalThis);
