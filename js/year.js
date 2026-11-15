/* Ritual — данные для «Ваш год в привычках» */
(function () {
  const R = (window.R = window.R || {});

  R.yearsAvailable = () => {
    const now = R.today().getFullYear();
    let min = now;
    R.state.habits.forEach((h) => { min = Math.min(min, +h.created.slice(0, 4)); });
    R.state.entries.forEach((e) => { min = Math.min(min, new Date(e.ts).getFullYear()); });
    const out = [];
    for (let y = now; y >= min; y--) out.push(y);
    return out;
  };

  /* доля выполненных привычек в день (null — нечего выполнять) */
  R.dayScore = (k) => {
    const due = R.state.habits.filter((h) => !h.archived && h.type !== 'avoid' && k >= h.created && (R.isDone(h, k) || !R.isExcused(h, k)));
    if (!due.length) return { sc: null, n: 0 };
    return { sc: due.filter((h) => R.isDone(h, k)).length / due.length, n: due.length };
  };

  /* год, о котором показывать итоги в декабре и первой половине января */
  R.yearBanner = () => {
    const t = R.today(), m = t.getMonth();
    const yr = m === 11 ? t.getFullYear() : m === 0 && t.getDate() <= 14 ? t.getFullYear() - 1 : null;
    if (yr == null || !R.state.habits.length) return null;
    return (R.state.reviews['y' + yr] || {}).seen ? null : yr;
  };

  R.yearReview = (year) => {
    const t = R.today(), s = new Date(year, 0, 1), eFull = new Date(year, 11, 31);
    if (s > t) return null;
    const e = eFull > t ? t : eFull, sk = R.dkey(s), ek = R.dkey(e);
    const st = R.state;
    const perMonth = Array(12).fill(0), perWd = Array(7).fill(0), hours = Array(24).fill(0);
    let total = 0, held = 0;
    const dayDone = {}, perHabit = [];

    st.habits.forEach((h) => {
      if (h.type === 'avoid') {
        for (let d = new Date(Math.max(s, R.parse(h.created))); d <= e; d = R.addDays(d, 1)) if (R.isDone(h, R.dkey(d))) held++;
        return;
      }
      const Lg = st.logs[h.id] || {};
      let n = 0;
      Object.keys(Lg).forEach((k) => {
        if (k < sk || k > ek || !R.isDone(h, k)) return;
        n++; total++;
        const d = R.parse(k);
        perMonth[d.getMonth()]++; perWd[(d.getDay() + 6) % 7]++; dayDone[k] = (dayDone[k] || 0) + 1;
        if (Lg[k].t != null) hours[Math.floor(Lg[k].t / 60) % 24]++;
      });
      if (n) perHabit.push({ h, n, rate: R.habitRate(h, s, e) });
    });
    perHabit.sort((a, b) => b.n - a.n);

    /* день за днём: общая шкала года и идеальные дни */
    const scores = [];
    let perfect = 0;
    for (let d = s; d <= eFull; d = R.addDays(d, 1)) {
      const k = R.dkey(d);
      if (d > t) { scores.push({ k, sc: null, fut: true }); continue; }
      const r = R.dayScore(k);
      if (r.sc === 1 && r.n >= 3) perfect++;
      scores.push({ k, sc: r.sc });
    }

    /* лучшая серия внутри года (привычки «N в неделю» считаются неделями — их пропускаем) */
    let bestStreak = null;
    st.habits.forEach((h) => {
      if (h.type !== 'avoid' && !R.hasDays(h) && h.perWeek < 7) return;
      let run = 0, from = null;
      for (let d = new Date(Math.max(s, R.parse(h.created))); d <= e; d = R.addDays(d, 1)) {
        const k = R.dkey(d);
        if (R.isDone(h, k)) {
          if (!run) from = d;
          run++;
          if (!bestStreak || run > bestStreak.n) bestStreak = { h, n: run, from, to: d };
        } else if (!R.isExcused(h, k)) run = 0;
      }
    });

    const max = (a) => a.reduce((bi, v, i) => (v > a[bi] ? i : bi), 0);
    const hourTotal = hours.reduce((a, b) => a + b, 0);

    /* настроение */
    const es = st.entries.filter((x) => new Date(x.ts).getFullYear() === year);
    const mm = Array.from({ length: 12 }, () => []);
    const tags = {};
    es.forEach((x) => { mm[new Date(x.ts).getMonth()].push(x.mood); (x.tags || []).forEach((g) => (tags[g] = (tags[g] || 0) + 1)); });
    const mAvg = mm.map((v) => (v.length ? R.avg(v) : null));
    let bestMonth = null;
    mAvg.forEach((v, i) => { if (v != null && mm[i].length >= 2 && (bestMonth == null || v > mAvg[bestMonth])) bestMonth = i; });

    const ach = Object.entries(st.ach || {}).filter(([, d]) => d && d !== '0' && d.startsWith(String(year))).map(([id]) => R.ACH.find((a) => a.id === id)).filter(Boolean);
    const goals = st.habits.filter((h) => { const g = R.goalInfo(h); return g && g.reached && h.goal.start.startsWith(String(year)); }).length;

    return {
      year, s, e, days: R.daysBetween(s, e) + 1, total, held, activeDays: Object.keys(dayDone).length, perfect, scores,
      perMonth, busiestMonth: total ? max(perMonth) : null, perWd, bestWd: total ? max(perWd) : null, peakHour: hourTotal >= 5 ? max(hours) : null,
      top: perHabit[0] || null, runners: perHabit.slice(1, 3), bestStreak, habitsCount: perHabit.length,
      mood: { n: es.length, avg: es.length ? R.avg(es.map((x) => x.mood)) : null, perMonth: mAvg, bestMonth, tags: Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0]) },
      ach, goals, photos: es.filter((x) => x.photos && x.photos.length).length, voice: es.filter((x) => x.voice && x.voice.length).length,
      empty: total === 0 && held === 0 && es.length === 0
    };
  };

  /* сетка года: колонки = недели, строки = Пн..Вс; cls — класс цвета ячеек */
  R.yearGrid = (scores, jan1) => {
    const w = (jan1.getDay() + 6) % 7;
    let cells = '';
    for (let i = 0; i < w; i++) cells += `<i class="cell fut" style="--c:0"></i>`;
    scores.forEach((x, i) => {
      const lvl = x.sc == null || x.sc === 0 ? 0 : x.sc < 0.34 ? 1 : x.sc < 0.67 ? 2 : x.sc < 1 ? 3 : 4;
      cells += `<i class="cell${x.fut ? ' fut' : lvl ? ' l' + lvl : ''}" style="--c:${Math.floor((w + i) / 7)}"></i>`;
    });
    return cells;
  };
})();
