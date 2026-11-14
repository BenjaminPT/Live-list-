/* Ritual — тепловая карта и график настроения */
(function () {
  const R = (window.R = window.R || {});
  R.fmt = (d, o) => new Intl.DateTimeFormat(R.locale, o).format(d);
  R.num1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', R.lang === 'ru' ? ',' : '.');

  /* сетка клеток: weeks недель, сдвиг off (в неделях, <= 0), колонки = недели, строки = Пн..Вс */
  R.heatGrid = (h, weeks, off = 0) => {
    const end = R.addDays(R.weekStart(R.today()), off * 7 + 6);
    const start = R.addDays(end, -weeks * 7 + 1);
    const lv = R.levels(h, start, end);
    const cells = lv.map((c, i) =>
      `<i class="cell${c.fut ? ' fut' : c.lvl ? ' l' + c.lvl : ''}${c.ex ? ' ex' : ''}${c.off ? ' off' : ''}" data-k="${c.k}" style="--c:${Math.floor(i / 7)}"></i>`
    ).join('');
    return { cells, start, end };
  };

  /* сглаженная кривая Catmull-Rom → Bezier */
  function smooth(pts, yMin, yMax) {
    if (pts.length < 2) return '';
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const cl = (y) => Math.max(yMin, Math.min(yMax, y));
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = cl(p1.y + (p2.y - p0.y) / 6);
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = cl(p2.y - (p3.y - p1.y) / 6);
      d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x},${p2.y}`;
    }
    return d;
  }

  /* pts: [{i, v}] i — индекс по оси X (0..n-1); labels: [{i, t}] */
  R.moodChart = (pts, n, labels) => {
    const W = 340, H = 230, Lm = 26, Rm = 12, T = 12, B = 28;
    const iw = W - Lm - Rm, ih = H - T - B;
    const X = (i) => Lm + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const Y = (v) => T + ((10 - v) / 9) * ih;
    let g = '';
    for (let v = 1; v <= 10; v++) g += `<text x="${Lm - 9}" y="${Y(v) + 3.5}" class="ax" text-anchor="end">${v}</text>`;
    labels.forEach((l) => {
      g += `<line x1="${X(l.i)}" x2="${X(l.i)}" y1="${T}" y2="${T + ih}" class="vl"/>`;
      g += `<text x="${X(l.i)}" y="${H - 8}" class="ax" text-anchor="middle">${l.t}</text>`;
    });
    if (!pts.length) return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${R.t('Нет записей')}">${g}</svg>`;
    const P = pts.map((p) => ({ x: +X(p.i).toFixed(1), y: +Y(p.v).toFixed(1), v: p.v }));
    const x1 = P[0].x, x2 = P[P.length - 1].x;
    const stops = P.map((p) => `<stop offset="${x2 === x1 ? 0 : ((p.x - x1) / (x2 - x1)).toFixed(3)}" stop-color="${R.moodColor(p.v)}"/>`).join('');
    const path = smooth(P, T, T + ih);
    const dots = P.map((p, i) => `<circle class="pt" cx="${p.x}" cy="${p.y}" r="4.6" fill="${R.moodColor(p.v)}" style="--i:${i}"/>`).join('');
    const label = R.t('График настроения: {n} точек, среднее {a}', { n: pts.length, a: R.num1(R.avg(pts.map((p) => p.v))) });
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${label}">
      <defs><linearGradient id="mg" gradientUnits="userSpaceOnUse" x1="${x1}" x2="${x2 === x1 ? x1 + 1 : x2}" y1="0" y2="0">${stops}</linearGradient></defs>
      ${g}${path ? `<path class="line" d="${path}" fill="none" stroke="url(#mg)" stroke-width="3.2" stroke-linecap="round"/>` : ''}${dots}</svg>`;
  };
})();
