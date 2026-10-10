/* 메인 히스토그램 차트 (D3 v7, SVG)
 * - 막대 쪼개기/합치기: 새 구간의 시작 높이를 직전 막대들의 겹친 폭 가중평균으로 잡아
 *   부모 막대가 둘로 갈라지는 것처럼 보이게 한다 (PRD F-12).
 * - 이론 곡선은 처음 보일 때 왼쪽에서 오른쪽으로 그려진다 (F-22 공개 순간).
 */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});
  const reduceMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let uid = 0;

  function yFormat(max, mode) {
    if (mode === 'count') return max >= 10 ? d3.format(',~d') : d3.format('~g');
    return d3.format(max >= 10 ? ',.0f' : max >= 1 ? '.1~f' : max >= 0.1 ? '.2~f' : '.3~f');
  }

  /** 직전 막대들의 화면 높이를 새 구간 [x0,x1]에 대해 겹친 폭으로 가중평균 */
  function overlapTop(prevGeo, d, base) {
    let s = 0, wsum = 0;
    for (const p of prevGeo) {
      const ov = Math.min(p.x1, d.x1) - Math.max(p.x0, d.x0);
      if (ov > 0) { s += ov * p.top; wsum += ov; }
    }
    return wsum > 0 ? s / wsum : base;
  }

  class HistChart {
    constructor(el, opts = {}) {
      this.el = el;
      this.opts = opts;
      this.id = 'hc' + ++uid;
      el.classList.add('hist-chart');
      this.svg = d3.select(el).append('svg').attr('class', 'hist-svg').attr('role', 'img');
      this.title = this.svg.append('title');
      this.clip = this.svg.append('defs').append('clipPath').attr('id', this.id + '-clip').append('rect');
      this.root = this.svg.append('g');
      this.gGrid = this.root.append('g').attr('class', 'grid');
      this.gBand = this.root.append('g').attr('class', 'band-layer');
      const plot = this.root.append('g').attr('clip-path', `url(#${this.id}-clip)`);
      this.gBars = plot.append('g').attr('class', 'bars');
      this.gTheoryArea = plot.append('g').attr('class', 'theory-area');
      this.gGhost = plot.append('g').attr('class', 'ghost');
      this.gWhisk = plot.append('g').attr('class', 'whiskers');
      this.gTheory = plot.append('g').attr('class', 'theory');
      this.gPoly = plot.append('g').attr('class', 'poly');
      this.gDrop = plot.append('g').attr('class', 'drops');
      this.gHover = plot.append('g').attr('class', 'hover');
      this.gX = this.root.append('g').attr('class', 'axis axis-x');
      this.gY = this.root.append('g').attr('class', 'axis axis-y');
      this.yLabel = this.root.append('text').attr('class', 'axis-label');
      this.xLabel = this.root.append('text').attr('class', 'axis-label');
      this.overlay = this.root.append('rect').attr('class', 'overlay').attr('fill', 'transparent');
      this.gHandles = this.root.append('g').attr('class', 'handles');
      this.tip = d3.select(el).append('div').attr('class', 'chart-tip').attr('role', 'status').property('hidden', true);
      this.prev = null;
      this.theoryShown = false;
      this.overlay
        .on('pointermove', (ev) => this._hover(ev))
        .on('pointerdown', (ev) => this._hover(ev))
        .on('pointerleave', () => this._hideTip());
      if (root.ResizeObserver) {
        let lastW = el.clientWidth;
        new ResizeObserver(() => {
          const w = el.clientWidth;
          if (Math.abs(w - lastW) > 2 && this.model) { lastW = w; this.render(this.model, { duration: 0, reveal: false }); }
        }).observe(el);
      }
    }

    render(m, o = {}) {
      this.model = m;
      const dur = reduceMotion() ? 0 : (o.duration ?? 280);
      const W = Math.max(280, this.el.clientWidth || 640);
      const H = this.opts.height || Math.round(Math.max(250, Math.min(440, W * 0.56)));
      const mg = this.opts.margin || { top: 14, right: 14, bottom: 46, left: 60 };
      const iw = W - mg.left - mg.right, ih = H - mg.top - mg.bottom;
      this.mg = mg; this.iw = iw; this.ih = ih;
      this.svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
      this.title.text(m.ariaLabel || '히스토그램');
      this.root.attr('transform', `translate(${mg.left},${mg.top})`);
      this.clip.attr('x', 0).attr('y', -4).attr('width', iw).attr('height', ih + 4);
      this.overlay.attr('width', iw).attr('height', ih);

      const x = d3.scaleLinear().domain(m.xDomain).range([0, iw]);
      const y = d3.scaleLinear().domain([0, m.yMax]).nice(6).range([ih, 0]);
      const yCap = y.domain()[1] * 1.6;
      this.x = x; this.y = y;
      const t = this.svg.transition().duration(dur).ease(d3.easeCubicOut);

      /* 축과 격자 */
      const xAxis = d3.axisBottom(x).tickSizeOuter(0).tickPadding(6);
      if (m.kind === 'discrete') {
        const span = m.bins.xmax - m.bins.xmin + 1;
        const every = Math.max(1, Math.ceil(span / Math.max(2, iw / 34)));
        xAxis.tickValues(d3.range(m.bins.xmin, m.bins.xmax + 1, every)).tickFormat(d3.format('d'));
      } else {
        xAxis.ticks(Math.max(4, Math.floor(iw / 72)));
      }
      this.gX.attr('transform', `translate(0,${ih})`).call(xAxis);
      const yTicks = Math.max(3, Math.floor(ih / 52));
      this.gY.transition(t).call(d3.axisLeft(y).ticks(yTicks).tickFormat(yFormat(y.domain()[1], m.mode)).tickSizeOuter(0).tickPadding(6));
      this.gGrid.transition(t).call(d3.axisLeft(y).ticks(yTicks).tickSize(-iw).tickFormat(''));
      this.gGrid.select('.domain').remove();
      this.yLabel.attr('transform', `translate(${-mg.left + 14},${ih / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(m.yLabel);
      this.xLabel.attr('x', iw / 2).attr('y', ih + 38).attr('text-anchor', 'middle').text(m.xLabel || 'x');

      /* 막대 */
      const { k, width: w, origin: o0 } = m.bins;
      const geo = new Array(k);
      for (let j = 0; j < k; j++) {
        geo[j] = { j, x0: x(o0 + j * w), x1: x(o0 + (j + 1) * w), top: y(Math.min(m.heights[j], yCap)), cls: m.barClass ? m.barClass[j] : '' };
      }
      const bw = iw / k;
      const domainKey = m.xDomain.join(',') + '|' + W + '|' + H;
      const key = `${o0}|${w}|${k}|${domainKey}`;
      let sel = this.gBars.selectAll('rect.bar');
      if (!this.prev || this.prev.key !== key) {
        const prevGeo = this.prev && this.prev.domainKey === domainKey ? this.prev.geo : null;
        sel.interrupt().remove();
        sel = this.gBars.selectAll('rect.bar').data(geo).join('rect')
          .attr('x', (d) => d.x0)
          .attr('width', (d) => Math.max(0, d.x1 - d.x0))
          .attr('y', (d) => (prevGeo ? overlapTop(prevGeo, d, ih) : ih))
          .attr('height', (d) => ih - (prevGeo ? overlapTop(prevGeo, d, ih) : ih));
      } else {
        sel = sel.data(geo);
      }
      sel.attr('class', (d) => 'bar ' + d.cls).attr('stroke-width', bw >= 5 ? 1 : bw >= 2.5 ? 0.5 : 0);
      if (dur > 0) sel.transition(t).attr('y', (d) => d.top).attr('height', (d) => Math.max(0, ih - d.top));
      else sel.interrupt().attr('y', (d) => d.top).attr('height', (d) => Math.max(0, ih - d.top));
      this.prev = { key, domainKey, geo };

      /* 직전 상태(그림자) */
      const ghost = this.gGhost.selectAll('path').data(m.ghost ? [m.ghost] : []);
      ghost.join('path').attr('class', 'ghost-line').attr('d', (g) => {
        let d = `M${x(g.origin)},${ih}`;
        for (let j = 0; j < g.heights.length; j++) {
          const yy = y(Math.min(g.heights[j], yCap));
          d += `L${x(g.origin + j * g.width)},${yy}L${x(g.origin + (j + 1) * g.width)},${yy}`;
        }
        return d + `L${x(g.origin + g.heights.length * g.width)},${ih}`;
      });

      /* 예상 변동 범위 (기댓값 ± 2 표준오차) */
      const wb = m.band || [];
      const capW = Math.max(3, Math.min(10, bw * 0.35));
      const wg = this.gWhisk.selectAll('g.whisk').data(wb, (b) => b.j);
      wg.exit().remove();
      const wge = wg.enter().append('g').attr('class', 'whisk');
      wge.append('line').attr('class', 'whisk-v');
      wge.append('line').attr('class', 'whisk-cap whisk-lo');
      wge.append('line').attr('class', 'whisk-cap whisk-hi');
      wge.append('circle').attr('class', 'whisk-exp').attr('r', 2.6);
      const wall = wge.merge(wg).classed('miss', (b) => !b.inside);
      const cx = (b) => x(b.mid);
      wall.select('.whisk-v').attr('x1', cx).attr('x2', cx).attr('y1', (b) => y(Math.min(b.lo, yCap))).attr('y2', (b) => y(Math.min(b.hi, yCap)));
      wall.select('.whisk-lo').attr('x1', (b) => cx(b) - capW / 2).attr('x2', (b) => cx(b) + capW / 2).attr('y1', (b) => y(b.lo)).attr('y2', (b) => y(b.lo));
      wall.select('.whisk-hi').attr('x1', (b) => cx(b) - capW / 2).attr('x2', (b) => cx(b) + capW / 2).attr('y1', (b) => y(Math.min(b.hi, yCap))).attr('y2', (b) => y(Math.min(b.hi, yCap)));
      wall.select('.whisk-exp').attr('cx', cx).attr('cy', (b) => y(Math.min(b.exp, yCap)));

      /* 이론 분포 */
      this._renderTheory(m, x, y, yCap, t, dur, o);

      /* 도수다각형 */
      const showPoly = m.poly && m.poly.length > 1;
      const polyLine = d3.line().x((p) => x(p[0])).y((p) => y(Math.min(p[1], yCap)));
      const pp = this.gPoly.selectAll('path.poly-line').data(showPoly ? [m.poly] : []);
      pp.exit().remove();
      const ppe = pp.enter().append('path').attr('class', 'poly-line').attr('d', polyLine);
      if (dur > 0) pp.transition(t).attr('d', polyLine); else pp.attr('d', polyLine);
      ppe.attr('d', polyLine);
      const dots = this.gPoly.selectAll('circle.poly-dot').data(showPoly && m.poly.length <= 45 ? m.poly : []);
      dots.exit().remove();
      dots.enter().append('circle').attr('class', 'poly-dot').attr('r', 3.2)
        .attr('cx', (p) => x(p[0])).attr('cy', (p) => y(Math.min(p[1], yCap)));
      (dur > 0 ? dots.transition(t) : dots).attr('cx', (p) => x(p[0])).attr('cy', (p) => y(Math.min(p[1], yCap)));

      /* 선택 구간 */
      this._renderInterval(m, x, ih, o);
    }

    _renderTheory(m, x, y, yCap, t, dur, o) {
      const th = m.showTheory ? m.theory : null;
      const justRevealed = th && !this.theoryShown && o.reveal !== false && dur > 0;
      this.theoryShown = !!th;
      const curve = th && th.type === 'curve' ? [th.points] : [];
      const stems = th && th.type === 'stems' ? th.points : [];
      const line = d3.line().x((p) => x(p[0])).y((p) => y(Math.min(p[1], yCap)));

      const cp = this.gTheory.selectAll('path.theory-line').data(curve);
      cp.exit().remove();
      const cpe = cp.enter().append('path').attr('class', 'theory-line').attr('d', line);
      if (dur > 0) cp.transition(t).attr('d', line); else cp.attr('d', line);
      if (justRevealed && curve.length) {
        cpe.each(function () {
          const L = this.getTotalLength();
          d3.select(this).attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L)
            .transition().duration(1500).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0)
            .on('end', function () { d3.select(this).attr('stroke-dasharray', null); });
        });
      }

      // 구간 아래 면적 (연속형)
      const iv = m.interval;
      let areaPts = [];
      if (curve.length && iv && iv.on) {
        const [a, b] = iv.a <= iv.b ? [iv.a, iv.b] : [iv.b, iv.a];
        const pts = th.points;
        const interp = (xv) => {
          for (let i = 1; i < pts.length; i++) {
            if (pts[i][0] >= xv) {
              const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
              return [xv, x1 === x0 ? y1 : y0 + (y1 - y0) * (xv - x0) / (x1 - x0)];
            }
          }
          return [xv, 0];
        };
        if (b > a) areaPts = [interp(a), ...pts.filter((p) => p[0] > a && p[0] < b), interp(b)];
      }
      const area = d3.area().x((p) => x(p[0])).y0(y(0)).y1((p) => y(Math.min(p[1], yCap)));
      this.gTheoryArea.selectAll('path').data(areaPts.length ? [areaPts] : []).join('path').attr('class', 'theory-fill').attr('d', area);

      // 이산형: 점 + 수직선
      const sl = this.gTheory.selectAll('line.stem').data(stems, (p) => p[0]);
      sl.exit().remove();
      const sle = sl.enter().append('line').attr('class', 'stem')
        .attr('x1', (p) => x(p[0])).attr('x2', (p) => x(p[0])).attr('y1', y(0)).attr('y2', y(0));
      const sc = this.gTheory.selectAll('circle.stem-dot').data(stems, (p) => p[0]);
      sc.exit().remove();
      const sce = sc.enter().append('circle').attr('class', 'stem-dot').attr('r', 4.5)
        .attr('cx', (p) => x(p[0])).attr('cy', y(0));
      const stemDur = justRevealed ? 700 : dur;
      const all = sle.merge(sl), allc = sce.merge(sc);
      const tt = (s, i) => (stemDur > 0 ? s.transition().duration(stemDur).delay(justRevealed ? (d, k) => k * 40 : 0).ease(d3.easeCubicOut) : s);
      tt(all).attr('x1', (p) => x(p[0])).attr('x2', (p) => x(p[0])).attr('y1', y(0)).attr('y2', (p) => y(Math.min(p[1], yCap)));
      tt(allc).attr('cx', (p) => x(p[0])).attr('cy', (p) => y(Math.min(p[1], yCap)));
    }

    _renderInterval(m, x, ih, o) {
      const iv = m.interval && m.interval.on ? m.interval : null;
      const band = this.gBand.selectAll('rect').data(iv ? [iv] : []);
      band.join('rect').attr('class', 'iv-band')
        .attr('x', (d) => x(Math.min(d.bandLo, d.bandHi))).attr('width', (d) => Math.abs(x(d.bandHi) - x(d.bandLo)))
        .attr('y', 0).attr('height', ih);
      const hd = iv ? [{ which: 'a', v: iv.a }, { which: 'b', v: iv.b }] : [];
      const g = this.gHandles.selectAll('g.handle').data(hd, (d) => d.which);
      g.exit().remove();
      const ge = g.enter().append('g').attr('class', 'handle').attr('tabindex', 0)
        .attr('role', 'slider');
      ge.append('line').attr('class', 'handle-line');
      ge.append('circle').attr('class', 'handle-grip').attr('r', 9);
      ge.append('text').attr('class', 'handle-label').attr('text-anchor', 'middle');
      const self = this;
      ge.call(d3.drag().container(this.root.node())
        .on('drag', function (ev, d) {
          const dom = self.model.xDomain;
          const v = Math.max(dom[0], Math.min(dom[1], self.x.invert(ev.x)));
          self.opts.onHandle && self.opts.onHandle(d.which, v);
        }));
      ge.on('keydown', function (ev, d) {
        const step = self.model.kind === 'discrete' ? 1 : (self.model.xDomain[1] - self.model.xDomain[0]) / 100;
        const cur = self.model.interval[d.which];
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') { ev.preventDefault(); self.opts.onHandle(d.which, cur - step); }
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') { ev.preventDefault(); self.opts.onHandle(d.which, cur + step); }
      });
      const all = ge.merge(g);
      all.attr('transform', (d) => `translate(${x(d.v)},0)`)
        .attr('aria-label', (d) => (d.which === 'a' ? '구간 왼쪽 끝 a' : '구간 오른쪽 끝 b'))
        .attr('aria-valuenow', (d) => d.v);
      all.select('line').attr('y1', 0).attr('y2', ih);
      all.select('circle').attr('cy', 10);
      all.select('text').attr('y', 14).text((d) => d.which);
    }

    _hover(ev) {
      const m = this.model;
      if (!m || !this.opts.tooltip) return;
      const [px, py] = d3.pointer(ev, this.root.node());
      const v = this.x.invert(px);
      const j = Math.floor((v - m.bins.origin) / m.bins.width);
      if (j < 0 || j >= m.bins.k) return this._hideTip();
      const html = this.opts.tooltip(j);
      if (!html) return this._hideTip();
      const x0 = this.x(m.bins.origin + j * m.bins.width), x1 = this.x(m.bins.origin + (j + 1) * m.bins.width);
      this.gHover.selectAll('rect').data([j]).join('rect').attr('class', 'hover-bar')
        .attr('x', x0).attr('width', Math.max(1, x1 - x0)).attr('y', 0).attr('height', this.ih);
      this.tip.html(html).property('hidden', false);
      const tw = this.tip.node().offsetWidth, th = this.tip.node().offsetHeight;
      let left = px + this.mg.left + 14;
      if (left + tw > this.el.clientWidth - 4) left = px + this.mg.left - tw - 14;
      let top = Math.max(0, py + this.mg.top - th / 2);
      this.tip.style('left', Math.max(0, left) + 'px').style('top', top + 'px');
    }
    _hideTip() {
      this.tip.property('hidden', true);
      this.gHover.selectAll('rect').remove();
    }

    /** 난수 하나가 떨어져 막대 j에 쌓이는 애니메이션 */
    drop(v, j) {
      if (reduceMotion() || !this.model) return;
      const top = this.y(this.model.heights[j] || 0);
      this.gDrop.append('circle').attr('class', 'drop').attr('r', 4.5)
        .attr('cx', this.x(v)).attr('cy', -6)
        .transition().duration(240).ease(d3.easeQuadIn).attr('cy', Math.max(0, top - 5))
        .transition().duration(160).attr('opacity', 0).remove();
    }
  }

  RVL.HistChart = HistChart;
})(typeof window !== 'undefined' ? window : globalThis);
