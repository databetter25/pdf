/* 연동 그래프 (PRD_module2 5.1, F2-01~F2-22)
 *   위: 표본 점(러그·점 도표) / 히스토그램 / 이론 PDF·PMF, 넓이 음영, 접선 표시
 *   아래: ECDF(계단) + 이론 CDF(곡선·계단과 열린/닫힌 점), DKW 띠, Dn, 커서(x / p / 구간), 접선
 * 두 그래프는 같은 x 척도와 같은 여백을 써서 세로로 정확히 맞물린다.
 * topEl을 null로 주면 아래 그래프만 그린다 (모듈 3의 CDF 미니 그래프).
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});
  const reduceMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let uid = 0;

  function mkSvg(el, cls) {
    const svg = d3.select(el).append('svg').attr('class', 'cdf-svg ' + cls);
    const id = 'cv' + ++uid;
    const clip = svg.append('defs').append('clipPath').attr('id', id).append('rect');
    const g = svg.append('g');
    const layers = {};
    ['grid', 'band', 'shade', 'bars', 'area', 'curve', 'stems', 'ecdf', 'marks', 'cursor', 'anim'].forEach((k) => {
      layers[k] = g.append('g').attr('class', 'l-' + k);
    });
    ['band', 'shade', 'bars', 'area', 'curve', 'stems', 'ecdf', 'marks', 'anim'].forEach((k) => layers[k].attr('clip-path', `url(#${id})`));
    const gx = g.append('g').attr('class', 'axis axis-x');
    const gy = g.append('g').attr('class', 'axis axis-y');
    const yl = g.append('text').attr('class', 'axis-label');
    const xl = g.append('text').attr('class', 'axis-label');
    const overlay = g.append('rect').attr('class', 'overlay').attr('fill', 'transparent');
    layers.handles = g.append('g').attr('class', 'l-handles');
    return { svg, g, clip, layers, gx, gy, yl, xl, overlay, title: svg.append('title') };
  }
  const fmt3 = (v) => (isFinite(v) ? (+v.toFixed(3)).toString() : '—');
  function polyPath(polys, x, y) {
    let d = '';
    for (const p of polys) {
      if (!p.length) continue;
      d += `M${x(p[0][0])},${y(p[0][1])}`;
      for (let i = 1; i < p.length; i++) d += `L${x(p[i][0])},${y(p[i][1])}`;
    }
    return d;
  }

  class CdfView {
    constructor(topEl, botEl, opts = {}) {
      this.opts = opts;
      this.topEl = topEl;
      this.botEl = botEl;
      this.T = topEl ? mkSvg(topEl, 'cdf-top') : null;
      this.B = mkSvg(botEl, 'cdf-bot');
      this.drag = null;
      const bind = (P, which) => {
        P.overlay.style('cursor', 'crosshair')
          .on('pointerdown', (ev) => { ev.preventDefault(); this._pointer(ev, which, true); P.overlay.node().setPointerCapture && P.overlay.node().setPointerCapture(ev.pointerId); })
          .on('pointermove', (ev) => { if (ev.buttons & 1 || ev.pointerType === 'touch') this._pointer(ev, which, false); })
          .on('pointerup pointercancel', () => { this.drag = null; });
      };
      if (this.T) bind(this.T, 'top');
      bind(this.B, 'bot');
      if (root.ResizeObserver) {
        let lw = botEl.clientWidth;
        new ResizeObserver(() => { const w = botEl.clientWidth; if (Math.abs(w - lw) > 2 && this.m) { lw = w; this.render(this.m, { duration: 0 }); } }).observe(botEl);
      }
    }

    _pointer(ev, which, start) {
      const m = this.m;
      if (!m || !this.opts.onPointer) return;
      const P = which === 'top' ? this.T : this.B;
      const [px, py] = d3.pointer(ev, P.g.node());
      const xv = Math.max(m.xDomain[0], Math.min(m.xDomain[1], this.x.invert(px)));
      const c = m.cursor || {};
      if (c.mode === 'p' && which === 'bot') {
        return this.opts.onPointer('p', Math.max(0.001, Math.min(0.999, this.yB.invert(py))));
      }
      if (c.mode === 'interval') {
        if (start || !this.drag) this.drag = Math.abs(xv - c.a) <= Math.abs(xv - c.b) ? 'a' : 'b';
        return this.opts.onPointer(this.drag, xv);
      }
      if (c.mode === 'p') return; // 위 그래프에서는 p를 바꾸지 않는다
      this.opts.onPointer('x', xv);
    }

    size() {
      const W = Math.max(280, this.botEl.clientWidth || 640);
      const mg = this.opts.margin || { top: 12, right: 18, bottom: 40, left: 54 };
      const hT = this.opts.heightTop || Math.round(Math.max(170, Math.min(250, W * 0.27)));
      const hB = this.opts.heightBot || Math.round(Math.max(220, Math.min(330, W * 0.36)));
      return { W, mg, hT, hB, iw: W - mg.left - mg.right };
    }

    render(m, o = {}) {
      this.m = m;
      const dur = reduceMotion() ? 0 : (o.duration ?? 250);
      const { W, mg, hT, hB, iw } = this.size();
      const x = (this.x = d3.scaleLinear().domain(m.xDomain).range([0, iw]));
      this.mg = mg; this.iw = iw;
      const xAxis = () => {
        const a = d3.axisBottom(x).tickSizeOuter(0).tickPadding(6);
        if (m.kind === 'discrete') {
          const lo = Math.ceil(m.xDomain[0]), hi = Math.floor(m.xDomain[1]);
          const every = Math.max(1, Math.ceil((hi - lo + 1) / Math.max(2, iw / 34)));
          a.tickValues(d3.range(lo, hi + 1, every)).tickFormat(d3.format('d'));
        } else a.ticks(Math.max(4, Math.floor(iw / 72)));
        return a;
      };
      if (this.T && m.top) this._renderTop(m, x, xAxis, W, hT, mg, iw, dur);
      this._renderBot(m, x, xAxis, W, hB, mg, iw, dur);
    }

    _frame(P, W, H, mg, iw) {
      const ih = H - mg.top - mg.bottom;
      P.svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
      P.g.attr('transform', `translate(${mg.left},${mg.top})`);
      P.clip.attr('x', -2).attr('y', -6).attr('width', iw + 4).attr('height', ih + 8);
      P.overlay.attr('width', iw).attr('height', ih);
      return ih;
    }

    _renderTop(m, x, xAxis, W, H, mg, iw, dur) {
      const P = this.T, L = P.layers, t = m.top;
      const ih = this._frame(P, W, H, mg, iw);
      P.title.text(t.aria || '위 그래프');
      const y = (this.yT = d3.scaleLinear().domain([0, t.yMax || 1]).nice(5).range([ih, 0]));
      const yCap = y.domain()[1] * 1.5;
      P.gx.attr('transform', `translate(0,${ih})`).call(xAxis());
      const showY = t.mode !== 'rug';
      P.gy.style('display', showY ? null : 'none');
      if (showY) P.gy.call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(t.yMax >= 10 ? ',~d' : '.2~f')).tickSizeOuter(0));
      L.grid.call(d3.axisLeft(y).ticks(4).tickSize(-iw).tickFormat('')).style('display', showY ? null : 'none').select('.domain').remove();
      P.yl.attr('transform', `translate(${-mg.left + 14},${ih / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(t.yLabel || '');
      P.xl.attr('x', iw / 2).attr('y', ih + 34).attr('text-anchor', 'middle').text(m.xLabel || 'x');

      // 음영 구간 (넓이)
      const sh = t.shade;
      L.shade.selectAll('rect').data(sh && !t.curve && !t.stems ? [sh] : []).join('rect').attr('class', 'shade-band')
        .attr('x', (s) => x(Math.max(m.xDomain[0], s.from))).attr('width', (s) => Math.max(0, x(Math.min(m.xDomain[1], s.to)) - x(Math.max(m.xDomain[0], s.from))))
        .attr('y', 0).attr('height', ih);

      // 막대 (히스토그램 / 이산 상대도수)
      const bars = t.mode === 'hist' ? t.bars || [] : [];
      L.bars.selectAll('rect').data(bars).join('rect').attr('class', (b) => 'bar' + (b.cls ? ' ' + b.cls : ''))
        .attr('x', (b) => x(b.x0)).attr('width', (b) => Math.max(0.5, x(b.x1) - x(b.x0) - (x(b.x1) - x(b.x0) > 4 ? 1 : 0)))
        .attr('y', (b) => y(Math.min(b.h, yCap))).attr('height', (b) => Math.max(0, ih - y(Math.min(b.h, yCap))));

      // 러그 (연속형 표본) / 점 도표 (이산형 표본)
      const rug = t.mode === 'rug' && t.rug ? t.rug : null;
      let dIn = '', dOut = '';
      if (rug && rug.ticks) {
        for (const v of rug.ticks) {
          const px = x(v);
          const seg = `M${px},${ih - 26}V${ih}`;
          if (rug.cut != null && v <= rug.cut) dIn += seg; else dOut += seg;
        }
      }
      L.ecdf.selectAll('path.rug-in').data(rug && rug.ticks ? [0] : []).join('path').attr('class', 'rug-in').attr('d', dIn);
      L.ecdf.selectAll('path.rug-out').data(rug && rug.ticks ? [0] : []).join('path').attr('class', 'rug-out').attr('d', dOut);
      const dots = rug && rug.dots ? rug.dots : [];
      const r = rug && rug.dots ? Math.max(2, Math.min(6, (ih / Math.max(1, rug.maxStack)) / 2.3)) : 3;
      L.ecdf.selectAll('circle.dot').data(dots).join('circle').attr('class', (d) => 'dot' + (rug.cut != null && d.x <= rug.cut ? ' in' : ''))
        .attr('r', r).attr('cx', (d) => x(d.x)).attr('cy', (d) => ih - r - d.k * r * 2.1);
      P.svg.select('.rug-note').remove();
      if (rug && rug.note) P.g.append('text').attr('class', 'rug-note map-region-label').attr('x', 4).attr('y', 12).text(rug.note);

      // 이론 곡선 + 넓이
      const line = d3.line().x((p) => x(p[0])).y((p) => y(Math.min(p[1], yCap)));
      L.curve.selectAll('path').data(t.curve ? [t.curve] : []).join('path').attr('class', 'theory-line').attr('d', line);
      let area = [];
      if (t.curve && sh) {
        area = t.curve.filter((p) => p[0] >= sh.from && p[0] <= sh.to);
        const interp = (xv) => {
          const c = t.curve;
          for (let i = 1; i < c.length; i++) if (c[i][0] >= xv) { const [a0, b0] = c[i - 1], [a1, b1] = c[i]; return [xv, a1 === a0 ? b1 : b0 + (b1 - b0) * (xv - a0) / (a1 - a0)]; }
          return [xv, 0];
        };
        if (sh.to > sh.from) area = [interp(Math.max(sh.from, c0(t.curve))), ...area, interp(Math.min(sh.to, cN(t.curve)))];
      }
      function c0(c) { return c[0][0]; }
      function cN(c) { return c[c.length - 1][0]; }
      const ar = d3.area().x((p) => x(p[0])).y0(ih).y1((p) => y(Math.min(p[1], yCap)));
      L.area.selectAll('path').data(area.length > 1 ? [area] : []).join('path').attr('class', 'theory-fill').attr('d', ar);

      // 막대 그래프형 이론 (PMF·질량)
      const stems = t.stems || [];
      L.stems.selectAll('line').data(stems).join('line').attr('class', (s) => 'stem' + (s.on ? ' on' : '') + (s.off ? ' off' : ''))
        .attr('x1', (s) => x(s.x)).attr('x2', (s) => x(s.x)).attr('y1', ih).attr('y2', (s) => y(Math.min(s.y, yCap)));
      L.stems.selectAll('circle').data(stems).join('circle').attr('class', (s) => 'stem-dot' + (s.on ? ' on' : '') + (s.off ? ' off' : ''))
        .attr('r', 4.5).attr('cx', (s) => x(s.x)).attr('cy', (s) => y(Math.min(s.y, yCap)));
      L.stems.selectAll('text').data(stems.filter((s) => s.label)).join('text').attr('class', 'stem-label')
        .attr('x', (s) => x(s.x) + 7).attr('y', (s) => y(Math.min(s.y, yCap)) + 4).text((s) => s.label);

      // 표시 (접선 단계의 f(x) 높이)
      const mk = t.mark;
      L.marks.selectAll('line').data(mk ? [mk] : []).join('line').attr('class', 'mark-line')
        .attr('x1', (d) => x(d.x)).attr('x2', (d) => x(d.x)).attr('y1', ih).attr('y2', (d) => y(Math.min(d.y, yCap)));
      L.marks.selectAll('circle').data(mk ? [mk] : []).join('circle').attr('class', 'mark-dot').attr('r', 5)
        .attr('cx', (d) => x(d.x)).attr('cy', (d) => y(Math.min(d.y, yCap)));
      L.marks.selectAll('text').data(mk && mk.label ? [mk] : []).join('text').attr('class', 'mark-label')
        .attr('x', (d) => Math.min(iw - 4, x(d.x) + 8)).attr('y', (d) => Math.max(12, y(Math.min(d.y, yCap)) - 8))
        .attr('text-anchor', (d) => (x(d.x) > iw - 90 ? 'end' : 'start')).text((d) => d.label);

      // 커서
      this._cursorLines(P, m, x, ih, true);
    }

    _renderBot(m, x, xAxis, W, H, mg, iw, dur) {
      const P = this.B, L = P.layers;
      const ih = this._frame(P, W, H, mg, iw);
      P.title.text(m.aria || '누적분포함수 그래프');
      const y = (this.yB = d3.scaleLinear().domain([0, 1]).range([ih, 0]));
      P.gx.attr('transform', `translate(0,${ih})`).call(xAxis());
      P.gy.call(d3.axisLeft(y).tickValues([0, 0.25, 0.5, 0.75, 1]).tickFormat(d3.format('.2~f')).tickSizeOuter(0));
      L.grid.call(d3.axisLeft(y).tickValues([0.25, 0.5, 0.75, 1]).tickSize(-iw).tickFormat('')).select('.domain').remove();
      P.yl.attr('transform', `translate(${-mg.left + 14},${ih / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(m.yLabel || '누적확률');
      P.xl.attr('x', iw / 2).attr('y', ih + 34).attr('text-anchor', 'middle').text(m.xLabel || 'x');

      // DKW 띠
      const band = m.band;
      const step = d3.area().curve(d3.curveStepAfter).x((p) => x(p[0])).y0((p) => y(p[1])).y1((p) => y(p[2]));
      L.band.selectAll('path').data(band ? [band] : []).join('path').attr('class', 'dkw-band').attr('d', step);

      // 이론 CDF
      const c = m.cdf;
      L.curve.selectAll('path').data(c && c.show ? [c] : []).join('path').attr('class', 'theory-line cdf-line').attr('d', (cc) => polyPath(cc.polys, x, y));
      const jumps = c && c.show ? c.jumps || [] : [];
      L.stems.selectAll('line').data(jumps).join('line').attr('class', (j) => 'jump-line' + (j.cls ? ' ' + j.cls : ''))
        .attr('x1', (j) => x(j.x)).attr('x2', (j) => x(j.x)).attr('y1', (j) => y(j.lo)).attr('y2', (j) => y(j.hi));
      L.stems.selectAll('circle.open').data(jumps).join('circle').attr('class', (j) => 'open' + (j.cls ? ' ' + j.cls : ''))
        .attr('r', 4.2).attr('cx', (j) => x(j.x)).attr('cy', (j) => y(j.lo));
      L.stems.selectAll('circle.closed').data(jumps).join('circle').attr('class', (j) => 'closed' + (j.cls ? ' ' + j.cls : ''))
        .attr('r', 4.2).attr('cx', (j) => x(j.x)).attr('cy', (j) => y(j.hi));

      // ECDF
      const e = m.ecdf;
      const stepLine = d3.line().curve(d3.curveStepAfter).x((p) => x(p[0])).y((p) => y(p[1]));
      L.ecdf.selectAll('path').data(e && e.points && e.points.length ? [e.points] : []).join('path').attr('class', 'ecdf-line').attr('d', stepLine);

      // Dn
      const dn = m.dn;
      L.marks.selectAll('line.dn').data(dn ? [dn] : []).join('line').attr('class', 'dn')
        .attr('x1', (d) => x(d.x)).attr('x2', (d) => x(d.x)).attr('y1', (d) => y(d.y1)).attr('y2', (d) => y(d.y2));
      L.marks.selectAll('text.dn-label').data(dn ? [dn] : []).join('text').attr('class', 'dn-label')
        .attr('x', (d) => (x(d.x) > iw - 110 ? x(d.x) - 8 : x(d.x) + 8)).attr('text-anchor', (d) => (x(d.x) > iw - 110 ? 'end' : 'start'))
        .attr('y', (d) => y((d.y1 + d.y2) / 2) + 4).text((d) => `Dₙ = ${d.d.toFixed(3)}`);

      // 접선
      const tg = m.tangent;
      L.marks.selectAll('line.tangent').data(tg ? [tg] : []).join('line').attr('class', 'tangent')
        .attr('x1', (d) => x(d.x - d.half)).attr('x2', (d) => x(d.x + d.half))
        .attr('y1', (d) => y(d.y - d.slope * d.half)).attr('y2', (d) => y(d.y + d.slope * d.half));
      L.marks.selectAll('text.tangent-label').data(tg ? [tg] : []).join('text').attr('class', 'mark-label tangent-label')
        .attr('x', (d) => Math.min(iw - 4, x(d.x) + 10)).attr('y', (d) => Math.min(ih - 8, y(d.y) + 18))
        .attr('text-anchor', (d) => (x(d.x) > iw - 120 ? 'end' : 'start')).text((d) => `기울기 = ${d.slope.toFixed(3)}`);

      this._cursorLines(P, m, x, ih, false);
    }

    _cursorLines(P, m, x, ih, isTop) {
      const L = P.layers, c = m.cursor || {};
      const y = this.yB;
      const lines = [], dots = [], hl = [], labels = [];
      if (c.mode === 'x' && isFinite(c.x)) {
        lines.push({ x: c.x, cls: 'cur' });
        if (!isTop) {
          if (isFinite(c.ecdf)) { dots.push({ x: c.x, y: c.ecdf, cls: 'cur-e' }); hl.push({ y: c.ecdf, x: c.x, cls: 'guide-e' }); }
          if (isFinite(c.cdf)) { dots.push({ x: c.x, y: c.cdf, cls: 'cur-t' }); hl.push({ y: c.cdf, x: c.x, cls: 'guide-t' }); }
        }
      }
      if (c.mode === 'p' && isFinite(c.p)) {
        if (isFinite(c.qT)) lines.push({ x: c.qT, cls: 'q-t' });
        if (isFinite(c.qE) && !isTop) lines.push({ x: c.qE, cls: 'q-e' });
        if (!isTop) {
          hl.push({ y: c.p, x: m.xDomain[1], cls: 'guide-p', full: true });
          if (isFinite(c.qT)) dots.push({ x: c.qT, y: c.p, cls: 'cur-t' });
          if (isFinite(c.qE)) dots.push({ x: c.qE, y: c.p, cls: 'cur-e' });
        }
      }
      if (c.mode === 'interval') {
        lines.push({ x: c.a, cls: 'iv' }, { x: c.b, cls: 'iv' });
        if (!isTop && isFinite(c.Flo) && isFinite(c.Fhi)) {
          hl.push({ y: c.Flo, x: c.a, cls: 'guide-t' }, { y: c.Fhi, x: c.b, cls: 'guide-t' });
          labels.push({ x: c.b, y1: c.Flo, y2: c.Fhi, text: c.label || '' });
        }
      }
      const yOf = (v) => (isTop ? 0 : y(v));
      L.cursor.selectAll('line.vline').data(lines).join('line').attr('class', (d) => 'vline ' + d.cls)
        .attr('x1', (d) => x(d.x)).attr('x2', (d) => x(d.x)).attr('y1', 0).attr('y2', ih);
      L.cursor.selectAll('line.hline').data(isTop ? [] : hl).join('line').attr('class', (d) => 'hline ' + d.cls)
        .attr('x1', 0).attr('x2', (d) => (d.full ? this.iw : x(d.x))).attr('y1', (d) => y(d.y)).attr('y2', (d) => y(d.y));
      L.cursor.selectAll('circle').data(dots).join('circle').attr('class', (d) => 'cdot ' + d.cls).attr('r', 5.5)
        .attr('cx', (d) => x(d.x)).attr('cy', (d) => yOf(d.y));
      // 구간 확률 괄호
      const br = L.cursor.selectAll('g.bracket').data(labels).join((en) => {
        const g = en.append('g').attr('class', 'bracket');
        g.append('path'); g.append('text');
        return g;
      });
      br.select('path').attr('d', (d) => { const bx = Math.min(this.iw - 6, x(d.x) + 10); return `M${bx - 5},${y(d.y1)}H${bx}V${y(d.y2)}H${bx - 5}`; });
      br.select('text').attr('x', (d) => Math.min(this.iw - 10, x(d.x) + 16)).attr('y', (d) => (y(d.y1) + y(d.y2)) / 2 + 4)
        .attr('text-anchor', (d) => (x(d.x) > this.iw - 150 ? 'end' : 'start'))
        .attr('dx', (d) => (x(d.x) > this.iw - 150 ? -26 : 0)).text((d) => d.text);
      // 손잡이 (구간 모드)
      const hd = c.mode === 'interval' ? [{ k: 'a', v: c.a }, { k: 'b', v: c.b }] : [];
      const hg = P.layers.handles.selectAll('g.handle').data(hd, (d) => d.k).join((en) => {
        const g = en.append('g').attr('class', 'handle');
        g.append('circle').attr('class', 'handle-grip').attr('r', 8);
        g.append('text').attr('class', 'handle-label').attr('text-anchor', 'middle').attr('y', 4);
        return g;
      });
      hg.attr('transform', (d) => `translate(${x(d.v)},${isTop ? 9 : ih - 9})`).select('text').text((d) => d.k);
      hg.style('pointer-events', 'none');
    }

    /** 역변환 표본추출 한 번: y축의 u에서 가로로 CDF를 만나고 세로로 x축까지 */
    inverseShot(u, xt, done) {
      const P = this.B, x = this.x, y = this.yB;
      if (!x || reduceMotion()) { done && done(); return; }
      const ih = y(0), y0 = y(u), X = x(xt);
      const g = P.layers.anim.append('g').attr('class', 'shot');
      const h = g.append('line').attr('class', 'shot-line').attr('x1', 0).attr('x2', 0).attr('y1', y0).attr('y2', y0);
      const v = g.append('line').attr('class', 'shot-line').attr('x1', X).attr('x2', X).attr('y1', y0).attr('y2', y0);
      const dot = g.append('circle').attr('class', 'shot-dot').attr('r', 5).attr('cx', 0).attr('cy', y0);
      g.append('text').attr('class', 'shot-label').attr('x', 6).attr('y', y0 - 6).text(`u = ${u.toFixed(3)}`);
      const T1 = 520, T2 = 380;
      h.transition().duration(T1).ease(d3.easeCubicInOut).attr('x2', X);
      dot.transition().duration(T1).ease(d3.easeCubicInOut).attr('cx', X)
        .transition().duration(T2).ease(d3.easeQuadIn).attr('cy', ih);
      v.transition().delay(T1).duration(T2).ease(d3.easeQuadIn).attr('y2', ih);
      g.transition().delay(T1 + T2 + 700).duration(600).style('opacity', 0.0).remove();
      setTimeout(() => done && done(), T1 + T2);
    }

    /** 위 그래프에 점 하나가 떨어지는 애니메이션 */
    dropTop(xv) {
      if (!this.T || !this.x || reduceMotion()) return;
      const ih = this.yT ? this.yT(0) : 100;
      this.T.layers.anim.append('circle').attr('class', 'drop').attr('r', 4.5).attr('cx', this.x(xv)).attr('cy', -4)
        .transition().duration(260).ease(d3.easeQuadIn).attr('cy', ih - 6)
        .transition().duration(220).attr('opacity', 0).remove();
    }
  }

  RVL.CdfView = CdfView;
  RVL.cdfFmt = fmt3;
})(typeof window !== 'undefined' ? window : globalThis);
