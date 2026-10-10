/* 보조 차트: 수렴 그래프(F-32), (n, Δx) 지도(F-31) */
(function (root) {
  'use strict';
  const RVL = (root.RVL = root.RVL || {});

  const SUP = { 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷' };
  function fmtN(n) {
    const e = Math.round(Math.log10(n));
    if (Math.abs(n - Math.pow(10, e)) < 1e-9 && e >= 4) return '10' + SUP[e];
    return d3.format(',')(n);
  }
  const DECADES = [10, 100, 1000, 1e4, 1e5, 1e6];

  function frame(el, height) {
    const svg = d3.select(el).append('svg').attr('class', 'mini-svg');
    const g = svg.append('g');
    return {
      svg, g,
      size() {
        const W = Math.max(240, el.clientWidth || 320);
        const H = height;
        const mg = { top: 12, right: 14, bottom: 40, left: 54 };
        svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
        g.attr('transform', `translate(${mg.left},${mg.top})`);
        return { W, H, mg, iw: W - mg.left - mg.right, ih: H - mg.top - mg.bottom };
      },
    };
  }

  class ConvChart {
    constructor(el) {
      this.el = el;
      this.f = frame(el, 220);
      const g = this.f.g;
      this.gGrid = g.append('g').attr('class', 'grid');
      this.gX = g.append('g').attr('class', 'axis');
      this.gY = g.append('g').attr('class', 'axis');
      this.ref = g.append('path').attr('class', 'ref-line');
      this.refLabel = g.append('text').attr('class', 'ref-label');
      this.line = g.append('path').attr('class', 'conv-line');
      this.gDots = g.append('g');
      this.xl = g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle').text('n (표본 크기, 로그 눈금)');
      this.yl = g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle');
      if (root.ResizeObserver) new ResizeObserver(() => this.data && this.render(this.data)).observe(el);
    }
    render(data) {
      this.data = data;
      const { iw, ih, mg } = this.f.size();
      const pts = data.points.filter((p) => p.err > 0 && isFinite(p.err));
      if (!pts.length) return;
      const nMax = Math.max(1000, d3.max(pts, (p) => p.n));
      const x = d3.scaleLog().domain([10, nMax]).range([0, iw]);
      const lo = d3.min(pts, (p) => p.err), hi = d3.max(pts, (p) => p.err);
      const y = d3.scaleLog().domain([lo / 1.8, hi * 1.8]).range([ih, 0]);
      const yt = y.ticks(6).filter((v) => { const m = v / Math.pow(10, Math.floor(Math.log10(v) + 1e-9)); return Math.abs(m - 1) < 1e-6 || Math.abs(m - 3) < 1e-6; });
      this.gGrid.call(d3.axisLeft(y).tickValues(yt).tickSize(-iw).tickFormat('')).select('.domain').remove();
      this.gX.attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).tickValues(DECADES.filter((v) => v <= nMax)).tickFormat(fmtN).tickSizeOuter(0));
      this.gY.call(d3.axisLeft(y).tickValues(yt).tickFormat(d3.format('.1~g')).tickSizeOuter(0));
      this.xl.attr('x', iw / 2).attr('y', ih + 34);
      this.yl.attr('transform', `translate(${-mg.left + 12},${ih / 2}) rotate(-90)`).text(data.yLabel);
      const line = d3.line().x((p) => x(p.n)).y((p) => y(p.err));
      this.line.attr('d', line(pts));
      if (data.refSlope && pts.length > 1) {
        const p0 = pts[0];
        const ref = [p0.n, nMax].map((n) => ({ n, err: p0.err * Math.pow(n / p0.n, data.refSlope) }));
        this.ref.attr('d', line(ref)).attr('display', null);
        const last = ref[1];
        this.refLabel.attr('display', null).attr('x', x(last.n) - 4).attr('y', Math.max(10, Math.min(ih - 6, y(last.err) - 8)))
          .attr('text-anchor', 'end').text(data.refLabel);
      } else {
        this.ref.attr('display', 'none');
        this.refLabel.attr('display', 'none');
      }
      const dots = this.gDots.selectAll('circle').data(pts).join('circle')
        .attr('class', (p) => 'conv-dot' + (p.current ? ' current' : ''))
        .attr('r', (p) => (p.current ? 6 : 4))
        .attr('cx', (p) => x(p.n)).attr('cy', (p) => y(p.err));
      dots.selectAll('title').data((p) => [p]).join('title').text((p) => `n = ${d3.format(',')(p.n)}\n오차 = ${p.err.toPrecision(3)}`);
    }
  }

  class MapChart {
    /** onMove(n, dx) */
    constructor(el, onMove) {
      this.el = el;
      this.onMove = onMove;
      this.f = frame(el, 220);
      const g = this.f.g;
      this.noisy = g.append('path').attr('class', 'map-noisy');
      this.coarse = g.append('rect').attr('class', 'map-coarse');
      this.noisyLabel = g.append('text').attr('class', 'map-region-label');
      this.coarseLabel = g.append('text').attr('class', 'map-region-label');
      this.gX = g.append('g').attr('class', 'axis');
      this.gY = g.append('g').attr('class', 'axis');
      this.path = g.append('path').attr('class', 'map-path');
      this.pathLabel = g.append('text').attr('class', 'ref-label');
      this.dot = g.append('circle').attr('class', 'map-dot').attr('r', 8).attr('tabindex', 0)
        .attr('role', 'slider').attr('aria-label', 'n과 Δx를 함께 고르는 점');
      this.xl = g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle').text('n (표본 크기)');
      this.yl = g.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle').text('Δx (구간 폭)');
      const self = this;
      this.dot.call(d3.drag().container(g.node()).on('drag', (ev) => {
        if (!self.x) return;
        const n = Math.max(10, Math.min(1e6, self.x.invert(Math.max(0, Math.min(self.iw, ev.x)))));
        const dx = self.y.invert(Math.max(0, Math.min(self.ih, ev.y)));
        self.onMove(n, dx);
      }));
      this.dot.on('keydown', (ev) => {
        const d = self.data; if (!d) return;
        const f = { ArrowRight: [2, 1], ArrowLeft: [0.5, 1], ArrowUp: [1, 2], ArrowDown: [1, 0.5] }[ev.key];
        if (f) { ev.preventDefault(); self.onMove(d.n * f[0], d.dx * f[1]); }
      });
      if (root.ResizeObserver) new ResizeObserver(() => this.data && this.render(this.data)).observe(el);
    }
    render(d) {
      this.data = d;
      const { iw, ih, mg } = this.f.size();
      this.iw = iw; this.ih = ih;
      const R = d.R;
      const x = (this.x = d3.scaleLog().domain([10, 1e6]).range([0, iw]).clamp(true));
      const y = (this.y = d3.scaleLog().domain([R / 400, R / 5]).range([ih, 0]).clamp(true));
      const ns = d3.range(0, 61).map((i) => 10 * Math.pow(1e5, i / 60));
      // 들쭉날쭉: 구간당 기대 표본 수 n·Δx/R < 5  ⇔  Δx < 5R/n
      const area = d3.area().x((n) => x(n)).y0(ih).y1((n) => y(Math.max(R / 400, Math.min(R / 5, (5 * R) / n))));
      this.noisy.attr('d', area(ns));
      const yc = y(R / 12);
      this.coarse.attr('x', 0).attr('y', 0).attr('width', iw).attr('height', Math.max(0, yc));
      this.noisyLabel.attr('x', 6).attr('y', ih - 8).text('들쭉날쭉: 구간마다 표본이 너무 적음');
      this.coarseLabel.attr('x', iw - 6).attr('y', 14).attr('text-anchor', 'end').text('뭉툭함: 구간이 너무 넓음');
      this.gX.attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).tickValues(DECADES).tickFormat(fmtN).tickSizeOuter(0));
      const yt = [R / 400, R / 100, R / 25, R / 5].map((v) => +v.toPrecision(2));
      this.gY.call(d3.axisLeft(y).tickValues(yt).tickFormat(d3.format('.2~g')).tickSizeOuter(0));
      this.xl.attr('x', iw / 2).attr('y', ih + 34);
      this.yl.attr('transform', `translate(${-mg.left + 12},${ih / 2}) rotate(-90)`);
      if (d.sigma && isFinite(d.sigma)) {
        const line = d3.line().x((n) => x(n)).y((n) => y(3.49 * d.sigma * Math.pow(n, -1 / 3)));
        this.path.attr('d', line(ns)).attr('display', null);
        const nL = 2e5;
        this.pathLabel.attr('display', null).attr('x', x(nL)).attr('y', y(3.49 * d.sigma * Math.pow(nL, -1 / 3)) - 8)
          .attr('text-anchor', 'middle').text('Scott 규칙');
      } else {
        this.path.attr('display', 'none'); this.pathLabel.attr('display', 'none');
      }
      this.dot.attr('cx', x(d.n)).attr('cy', y(d.dx)).attr('aria-valuetext', `n = ${d.n}, Δx = ${d.dx.toPrecision(3)}`);
    }
  }

  RVL.ConvChart = ConvChart;
  RVL.MapChart = MapChart;
  RVL.fmtN = fmtN;
})(typeof window !== 'undefined' ? window : globalThis);
