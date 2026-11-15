/* Ritual — данные и расчёты. Привычки/записи — в localStorage, фото и голос — в IndexedDB. Без аккаунтов. */
(function () {
  const R = (window.R = window.R || {});
  const L = (s) => s; /* маркер «строка для перевода» */
  const KEY = 'ritual.v1';
  const pad = (n) => String(n).padStart(2, '0');
  const DAY = 864e5;

  R.pad = pad;
  R.dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  R.parse = (k) => { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  R.addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  R.today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  R.weekStart = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  R.daysBetween = (a, b) => Math.round((b - a) / DAY);
  R.uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  R.avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  R.fmtTime = (m) => `${m >= 0 ? Math.floor(m / 60) : 0}:${pad(m % 60)}`;
  R.fmtDur = (s) => `${Math.floor(s / 60)}:${pad(Math.round(s % 60))}`;
  /* день недели 0=Пн..6=Вс на нужном языке */
  R.wd = (i, w = 'short') => new Intl.DateTimeFormat(R.locale, { weekday: w }).format(new Date(2024, 0, 1 + i));

  /* причины пропусков: «уважительные» не обрывают серию */
  R.MISS = {
    sick: { label: L('Болезнь'), excuse: true },
    trip: { label: L('Поездка'), excuse: true },
    force: { label: L('Форс-мажор'), excuse: true },
    tired: { label: L('Устал'), excuse: false },
    forgot: { label: L('Забыл'), excuse: false },
    lazy: { label: L('Не хотелось'), excuse: false }
  };
  R.HUES = [350, 28, 48, 150, 185, 215, 255, 290];
  R.TAGS = [L('Прогулка'), L('Природа'), L('Друзья'), L('Семья'), L('Работа'), L('Спорт'), L('Дом'), L('Отдых'), L('Учёба'), L('Творчество'), L('Рефлексия'), L('Одиночество')];

  /* ---------- шаблоны привычек ---------- */
  R.TEMPLATES = [
    { k: 'water', name: L('Выпить воды'), icon: 'drop', hue: 215, type: 'count', target: 8, unit: L('стак.'), core: true },
    { k: 'morning', name: L('Утренняя зарядка'), icon: 'sun', hue: 48, type: 'check' },
    { k: 'train', name: L('Тренировка'), icon: 'dumbbell', hue: 150, type: 'check', days: [0, 2, 4] },
    { k: 'walk', name: L('Прогулка 30 минут'), icon: 'walk', hue: 28, type: 'check' },
    { k: 'read', name: L('Чтение'), icon: 'leaf', hue: 290, type: 'check', perWeek: 5 },
    { k: 'meditate', name: L('Медитация'), icon: 'spark', hue: 255, type: 'check' },
    { k: 'sleep', name: L('Сон до 23:00'), icon: 'moon', hue: 255, type: 'check' },
    { k: 'journal', name: L('Журнал'), icon: 'book', hue: 350, type: 'check', core: true, auto: 'journal' },
    { k: 'stretch', name: L('Растяжка'), icon: 'bolt', hue: 48, type: 'check', days: [1, 3, 5] },
    { k: 'vitamins', name: L('Витамины'), icon: 'apple', hue: 150, type: 'check' },
    { k: 'language', name: L('Изучение языка'), icon: 'star', hue: 185, type: 'check', perWeek: 5 },
    { k: 'gratitude', name: L('Три благодарности'), icon: 'heart', hue: 350, type: 'check' },
    { k: 'nosocial', name: L('Без соцсетей'), icon: 'phone', hue: 185, type: 'avoid' },
    { k: 'nosugar', name: L('Без сладкого'), icon: 'apple', hue: 28, type: 'avoid' },
    { k: 'nocaffeine', name: L('Кофе только до 14:00'), icon: 'coffee', hue: 28, type: 'avoid' }
  ];
  /* создаёт привычки из шаблонов на языке интерфейса */
  R.addFromTemplates = (keys) => {
    const out = [];
    keys.forEach((k) => {
      const t = R.TEMPLATES.find((x) => x.k === k);
      if (!t) return;
      const h = {
        id: R.uid(), name: R.t(t.name), icon: t.icon, hue: t.hue, type: t.type, target: t.target || 1, unit: t.unit ? R.t(t.unit) : '',
        perWeek: t.perWeek || 7, days: t.days ? [...t.days] : null, core: !!t.core, auto: t.auto || null, goal: null, tpl: t.k,
        created: R.dkey(R.today()), order: R.state.habits.length
      };
      R.state.habits.push(h); out.push(h);
    });
    R.state.settings.onboard = false;
    R.save();
    return out;
  };

  /* ---------- тема ---------- */
  const lightMq = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : { matches: false };
  R.light = false;
  R.applyTheme = () => {
    const pref = (R.state && R.state.settings.theme) || 'auto';
    R.light = pref === 'light' || (pref === 'auto' && lightMq.matches);
    document.documentElement.dataset.theme = R.light ? 'light' : 'dark';
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = R.light ? '#f3f3f6' : '#000000';
    const c = document.querySelector('meta[name=color-scheme]');
    if (c) c.content = R.light ? 'light' : 'dark';
  };
  if (lightMq.addEventListener) lightMq.addEventListener('change', () => { R.applyTheme(); R.onTheme && R.onTheme(); });

  /* ---------- хранилище ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DEF_SETTINGS = () => ({ name: '', demo: false, haptics: true, remind: '', lang: 'auto', theme: 'dark', onboard: false });
  R.emptyState = () => ({ v: 2, habits: [], logs: {}, entries: [], heavy: {}, reviews: {}, ach: null, settings: DEF_SETTINGS() });

  function seedDemo() {
    const t3 = R.t;
    const rnd = rng(42);
    const t = R.today();
    const mk = (name, icon, hue, type, o = {}) => ({
      id: R.uid(), name: t3(name), icon, hue, type, target: o.target || 1, unit: o.unit ? t3(o.unit) : '',
      perWeek: o.perWeek || 7, days: o.days || null, core: !!o.core, auto: o.auto || null, goal: o.goal || null,
      created: R.dkey(R.addDays(t, -(o.age || 170))), order: 0
    });
    const hs = [
      mk('Выпить воды', 'drop', 215, 'count', { target: 8, unit: 'стак.', core: true }),
      mk('Журнал', 'book', 350, 'check', { core: true, auto: 'journal', age: 80 }),
      mk('Прогулка с собакой', 'paw', 48, 'check'),
      mk('Тренировка', 'dumbbell', 150, 'check', { days: [0, 2, 4] }),
      mk('Без Инсты', 'phone', 185, 'avoid', { age: 90 }),
      mk('Чтение', 'leaf', 290, 'check', { perWeek: 5, goal: { n: 40, deadline: R.dkey(R.addDays(t, 24)), start: R.dkey(R.addDays(t, -22)) } }),
      mk('Сон до 23:00', 'moon', 255, 'check')
    ];
    hs.forEach((h, i) => (h.order = i));
    const probs = [0.82, 0.76, 0.72, 0.8, 0.9, 0.55, 0.6];
    const reasons = Object.keys(R.MISS);
    const logs = {};
    hs.forEach((h, i) => {
      const Lg = (logs[h.id] = {});
      const cr = R.parse(h.created);
      const span = Math.round((t - cr) / DAY);
      for (let n = 0; n <= span; n++) {
        const d = R.addDays(cr, n), k = R.dkey(d);
        const p = probs[i] * (0.72 + 0.28 * (n / Math.max(1, span)));
        const isToday = k === R.dkey(t);
        if (h.type === 'avoid') { if (!isToday && rnd() < 0.1) Lg[k] = { v: 0, slip: true }; continue; }
        if (h.days && !h.days.includes((d.getDay() + 6) % 7) && rnd() < 0.92) continue;
        if (isToday && i > 1) continue;
        if (rnd() < p) {
          const tm = 8 * 60 + Math.floor(rnd() * 14 * 60);
          if (h.type === 'count') Lg[k] = { v: Math.max(3, Math.min(10, h.target - 2 + Math.floor(rnd() * 4))), t: tm };
          else Lg[k] = { v: 1, t: i === 6 ? 7 * 60 + Math.floor(rnd() * 90) : tm };
        } else if (rnd() < 0.16) Lg[k] = { miss: reasons[Math.floor(rnd() * reasons.length)] };
      }
    });
    const title = {
      hi: ['Долгая прогулка с Мишей', 'Идеальный спокойный день', 'Всё получилось', 'Зарядился на неделю'],
      mid: ['Нормальный день', 'Дома было уютно', 'Обычный рабочий день', 'Хороший день, но мысли путаются'],
      lo: ['Нужен отдых', 'Тяжёлый день', 'Устал, хочу тишины']
    };
    const entries = [];
    for (let n = 75; n >= 0; n--) {
      if (rnd() > 0.72) continue;
      const d = R.addDays(t, -n), k = R.dkey(d);
      const dn = (h) => !!(logs[hs[h].id][k] && logs[hs[h].id][k].v);
      let m = 4.6 + rnd() * 2.2 + (dn(3) ? 1.7 : 0) + (dn(2) ? 0.9 : 0) + (dn(6) ? 0.8 : 0) + (rnd() - 0.5) * 2;
      m = Math.max(1, Math.min(10, Math.round(m)));
      const set = m >= 8 ? title.hi : m >= 5 ? title.mid : title.lo;
      const tags = [];
      if (dn(3)) tags.push(R.TAGS[5]);
      while (tags.length < 1 + Math.floor(rnd() * 3)) {
        const tg = R.TAGS[Math.floor(rnd() * R.TAGS.length)];
        if (!tags.includes(tg)) tags.push(tg);
      }
      const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8 + Math.floor(rnd() * 14), Math.floor(rnd() * 60)).getTime();
      entries.push({ id: R.uid(), ts, mood: m, title: set[Math.floor(rnd() * set.length)], text: '', tags });
    }
    /* «Журнал» отмечается автоматически: день с записью = выполнено */
    const jl = logs[hs[1].id];
    Object.keys(jl).forEach((k) => delete jl[k]);
    entries.forEach((e) => { const d = new Date(e.ts); jl[R.dkey(d)] = { v: 1, t: d.getHours() * 60 + d.getMinutes(), auto: true }; });
    const s = R.emptyState();
    s.habits = hs; s.logs = logs; s.entries = entries; s.settings.demo = true;
    return s;
  }
  R.seedDemo = seedDemo;

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.habits)) {
        s.logs = s.logs || {}; s.entries = s.entries || []; s.heavy = s.heavy || {}; s.reviews = s.reviews || {};
        s.settings = Object.assign(DEF_SETTINGS(), s.settings);
        return s;
      }
    } catch (e) {}
    return null;
  }
  R.state = load() || (() => { const e = R.emptyState(); e.settings.onboard = true; return e; })();
  R.setLang(R.state.settings.lang);
  R.applyTheme();

  let timer;
  R.save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(R.state)); } catch (e) {} }, 150);
  };
  R.saveNow = () => { clearTimeout(timer); try { localStorage.setItem(KEY, JSON.stringify(R.state)); } catch (e) {} };
  R.replaceState = (s) => {
    R.state = s;
    R.setLang(s.settings.lang); R.applyTheme();
    if (!s.ach) { s.ach = {}; R.checkAch(true); }
    R.saveNow();
  };

  /* ---------- привычки и отметки ---------- */
  R.activeHabits = () => R.state.habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
  R.getLog = (h, k) => (R.state.logs[h.id] || {})[k];
  R.setLog = (h, k, patch) => {
    const Lg = R.state.logs[h.id] || (R.state.logs[h.id] = {});
    const nx = Object.assign({}, Lg[k], patch);
    Object.keys(nx).forEach((key) => nx[key] == null && delete nx[key]);
    if (!nx.v && !nx.miss && !nx.note && !nx.slip) delete Lg[k]; else Lg[k] = nx;
    if (h.type !== 'avoid' && k < h.created) h.created = k;
    R.save();
  };

  /* расписание: привычка «назначена» на день? */
  R.hasDays = (h) => h.type !== 'avoid' && Array.isArray(h.days) && h.days.length > 0 && h.days.length < 7;
  R.isDue = (h, k) => !R.hasDays(h) || h.days.includes((R.parse(k).getDay() + 6) % 7);

  /* прогресс дня 0..1 */
  R.progress = (h, k) => {
    const l = R.getLog(h, k);
    if (h.type === 'avoid') {
      if (k < h.created || k > R.dkey(R.today())) return 0;
      return l && l.slip ? 0 : 1;
    }
    if (!l || !l.v) return 0;
    return h.type === 'count' ? Math.min(1, l.v / h.target) : 1;
  };
  R.isDone = (h, k) => R.progress(h, k) >= 1;
  /* выходной по расписанию: день не назначен и не выполнен */
  R.isOff = (h, k) => h.type !== 'avoid' && !R.isDue(h, k) && !R.isDone(h, k);
  R.isExcused = (h, k) => {
    if (R.isDone(h, k)) return false;
    if (R.isOff(h, k)) return true;
    const l = R.getLog(h, k);
    if (l && l.miss && R.MISS[l.miss] && R.MISS[l.miss].excuse) return true;
    return !!(R.state.heavy[k] && !h.core && h.type !== 'avoid');
  };

  /* отметка «сегодня» с карточки */
  R.checkIn = (h) => {
    const k = R.dkey(R.today());
    const now = new Date();
    const tm = now.getHours() * 60 + now.getMinutes();
    const l = R.getLog(h, k) || {};
    if (h.type === 'avoid') R.setLog(h, k, l.slip ? { slip: null, v: null } : { slip: true, v: 0 });
    else if (h.type === 'count') R.setLog(h, k, { v: (l.v || 0) + 1, t: l.t != null && l.v >= h.target ? l.t : tm, miss: null });
    else R.setLog(h, k, l.v ? { v: null, t: null, auto: null } : { v: 1, t: tm, miss: null, auto: null });
  };

  /* ---------- серии ---------- */
  const weekMode = (h) => h.type !== 'avoid' && !R.hasDays(h) && h.perWeek < 7;
  const weekMet = (h, ws) => {
    let c = 0;
    for (let j = 0; j < 7; j++) { const k = R.dkey(R.addDays(ws, j)); if (R.isDone(h, k) || R.isExcused(h, k)) c++; }
    return c >= h.perWeek;
  };
  R.streakUnit = (h) => (weekMode(h) ? 'нед.' : 'дн.');

  R.streak = (h) => {
    const t = R.today();
    let n = 0;
    if (weekMode(h)) {
      let ws = R.weekStart(t);
      const cr = R.weekStart(R.parse(h.created));
      for (let i = 0; i < 520 && ws >= cr; i++) {
        if (weekMet(h, ws)) n++; else if (i > 0) break;
        ws = R.addDays(ws, -7);
      }
      return n;
    }
    let d = t;
    for (let i = 0; i < 4000; i++) {
      const k = R.dkey(d);
      if (h.type === 'avoid' && k < h.created) break;
      if (k < h.created && !R.getLog(h, k)) break;
      if (R.isDone(h, k)) n++;
      else if (R.isExcused(h, k)) { /* серия сохраняется */ }
      else if (i === 0) { /* сегодня ещё можно успеть */ }
      else break;
      d = R.addDays(d, -1);
    }
    return n;
  };

  R.longest = (h) => {
    const t = R.today();
    const cr = R.parse(h.created);
    let best = 0, run = 0;
    if (weekMode(h)) {
      const cur = R.weekStart(t);
      for (let ws = R.weekStart(cr); ws <= cur; ws = R.addDays(ws, 7)) {
        if (weekMet(h, ws)) { run++; best = Math.max(best, run); }
        else if (ws.getTime() !== cur.getTime()) run = 0;
      }
      return best;
    }
    for (let d = cr; d <= t; d = R.addDays(d, 1)) {
      const k = R.dkey(d);
      if (R.isDone(h, k)) { run++; best = Math.max(best, run); }
      else if (!R.isExcused(h, k)) run = 0;
    }
    return best;
  };

  /* цель с дедлайном: N выполненных дней к дате */
  R.goalInfo = (h) => {
    const g = h.goal;
    if (!g || !g.n) return null;
    const t = R.today();
    let done = 0;
    for (let d = R.parse(g.start); d <= t; d = R.addDays(d, 1)) if (R.isDone(h, R.dkey(d))) done++;
    const left = g.deadline ? R.daysBetween(t, R.parse(g.deadline)) : null;
    const reached = done >= g.n;
    const need = Math.max(0, g.n - done);
    return {
      n: g.n, done: Math.min(done, g.n), pct: Math.min(1, done / g.n), left, reached, need,
      failed: !reached && left != null && left < 0,
      behind: !reached && left != null && left >= 0 && need > left + 1
    };
  };

  R.stats = (h) => {
    const Lg = R.state.logs[h.id] || {};
    const t = R.today();
    let total = 0, tsum = 0, tn = 0;
    if (h.type === 'avoid') {
      for (let d = R.parse(h.created); d <= t; d = R.addDays(d, 1)) if (R.isDone(h, R.dkey(d))) total++;
    } else {
      Object.keys(Lg).forEach((k) => {
        if (R.isDone(h, k)) { total++; if (Lg[k].t != null) { tsum += Lg[k].t; tn++; } }
      });
    }
    let goal, c30, target30;
    if (weekMode(h)) {
      target30 = Math.max(1, Math.ceil((h.perWeek * 30) / 7)); c30 = 0;
      for (let i = 0; i < 30; i++) { const k = R.dkey(R.addDays(t, -i)); if (R.isDone(h, k) || R.isExcused(h, k)) c30++; }
      goal = Math.min(1, c30 / target30);
    } else {
      let el = 0, dn = 0;
      for (let i = 0; i < 30; i++) {
        const k = R.dkey(R.addDays(t, -i));
        if (k < h.created) continue;
        if (R.isDone(h, k)) { dn++; el++; } else if (!R.isExcused(h, k)) el++;
      }
      c30 = dn; target30 = Math.max(1, el); goal = el ? dn / el : 0;
    }
    return {
      streak: R.streak(h), longest: R.longest(h), total, started: h.created,
      avgT: tn ? Math.round(tsum / tn) : null, goal, c30, target30, goalInfo: R.goalInfo(h)
    };
  };

  /* уровни яркости клеток тепловой карты */
  R.levels = (h, s, e) => {
    const out = [];
    const tk = R.dkey(R.today());
    let run = 0;
    for (let d = R.addDays(s, -40); d <= e; d = R.addDays(d, 1)) {
      const k = R.dkey(d);
      const fut = k > tk;
      let lvl = 0, ex = false, off = false;
      if (!fut) {
        const p = R.progress(h, k);
        if (p >= 1) { run++; lvl = h.type === 'count' ? 4 : run >= 5 ? 4 : run >= 2 ? 3 : 2; }
        else if (p > 0) lvl = p < 0.34 ? 1 : p < 0.67 ? 2 : 3;
        else if (R.isOff(h, k)) off = true;
        else if (R.isExcused(h, k)) ex = true; /* серия не рвётся */
        else run = 0;
      }
      if (d >= s) out.push({ k, lvl, ex, off, fut });
    }
    return out;
  };

  /* доля выполнения за период (для итогов) */
  R.habitRate = (h, s, e) => {
    const t = R.today();
    const from = new Date(Math.max(s, R.parse(h.created)));
    const to = new Date(Math.min(e, t));
    let el = 0, dn = 0;
    for (let d = from; d <= to; d = R.addDays(d, 1)) {
      const k = R.dkey(d);
      if (R.isExcused(h, k)) continue;
      el++;
      if (R.isDone(h, k)) dn++;
    }
    return el ? dn / el : null;
  };

  R.weekdayRates = (h) => {
    const t = R.today();
    const el = Array(7).fill(0), dn = Array(7).fill(0);
    for (let i = 0; i < 84; i++) {
      const d = R.addDays(t, -i), k = R.dkey(d);
      if (k < h.created && h.type === 'avoid') continue;
      const wd = (d.getDay() + 6) % 7;
      if (R.isExcused(h, k)) continue;
      el[wd]++;
      if (R.isDone(h, k)) dn[wd]++;
    }
    return el.map((n, i) => (n ? dn[i] / n : 0));
  };

  /* ---------- настроение ---------- */
  const STOPS = [[1, 218], [3, 198], [4, 172], [5, 148], [6, 125], [7, 86], [8, 52], [9, 36], [10, 22]];
  R.moodColor = (v) => {
    v = Math.max(1, Math.min(10, v));
    let h = STOPS[0][1];
    for (let i = 1; i < STOPS.length; i++) {
      if (v <= STOPS[i][0]) {
        const [a, ha] = STOPS[i - 1], [b, hb] = STOPS[i];
        h = ha + ((hb - ha) * (v - a)) / (b - a);
        break;
      }
      h = STOPS[i][1];
    }
    return R.light ? `hsl(${Math.round(h)} 88% 38%)` : `hsl(${Math.round(h)} 92% 62%)`;
  };
  R.moodByDay = () => {
    const m = {};
    R.state.entries.forEach((e) => { const k = R.dkey(new Date(e.ts)); (m[k] = m[k] || []).push(e.mood); });
    Object.keys(m).forEach((k) => (m[k] = R.avg(m[k])));
    return m;
  };
  /* как привычки влияют на настроение: средняя оценка в дни с привычкой и без неё */
  R.correlations = () => {
    const md = R.moodByDay();
    const keys = Object.keys(md);
    return R.activeHabits().map((h) => {
      const a = [], b = [];
      keys.forEach((k) => {
        if (R.isExcused(h, k)) return;
        (R.isDone(h, k) ? a : b).push(md[k]);
      });
      if (a.length < 3 || b.length < 3) return null;
      return { h, delta: R.avg(a) - R.avg(b), n: a.length + b.length };
    }).filter(Boolean).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  };
  const entryDays = () => new Set(R.state.entries.map((e) => R.dkey(new Date(e.ts))));
  R.entryStreak = () => {
    const days = entryDays();
    let n = 0, d = R.today();
    if (!days.has(R.dkey(d))) d = R.addDays(d, -1);
    while (days.has(R.dkey(d))) { n++; d = R.addDays(d, -1); }
    return n;
  };
  R.entryLongest = () => {
    const ks = [...entryDays()].sort();
    let best = 0, run = 0, prev = null;
    ks.forEach((k) => {
      run = prev && R.daysBetween(R.parse(prev), R.parse(k)) === 1 ? run + 1 : 1;
      best = Math.max(best, run); prev = k;
    });
    return best;
  };

  /* привычки с авто-отметкой «Журнал»: день с записью = выполнено */
  R.syncJournalHabits = (k) => {
    const es = R.state.entries.filter((e) => R.dkey(new Date(e.ts)) === k).sort((a, b) => a.ts - b.ts);
    R.state.habits.forEach((h) => {
      if (h.auto !== 'journal' || h.archived) return;
      const l = R.getLog(h, k) || {};
      if (es.length && !l.v) { const d = new Date(es[0].ts); R.setLog(h, k, { v: 1, t: d.getHours() * 60 + d.getMinutes(), auto: true, miss: null }); }
      else if (!es.length && l.auto) R.setLog(h, k, { v: null, t: null, auto: null });
    });
  };

  /* ---------- достижения ---------- */
  R.achStats = () => {
    const st = R.state;
    let total = 0, early = 0, maxL = 0, care = Object.keys(st.heavy).length > 0, goal = false;
    st.habits.forEach((h) => {
      const Lg = st.logs[h.id] || {};
      Object.keys(Lg).forEach((k) => {
        if (R.isDone(h, k)) { total++; if (h.type !== 'avoid' && Lg[k].t != null && Lg[k].t < 480) early++; }
        if (Lg[k].miss && R.MISS[Lg[k].miss] && R.MISS[Lg[k].miss].excuse) care = true;
      });
      maxL = Math.max(maxL, R.longest(h));
      const g = R.goalInfo(h); if (g && g.reached) goal = true;
    });
    let perfect = false;
    const t = R.today();
    for (let i = 0; i < 400 && !perfect; i++) {
      const k = R.dkey(R.addDays(t, -i));
      const hs = R.activeHabits().filter((h) => h.type !== 'avoid' && k >= h.created && R.isDue(h, k));
      if (hs.length >= 3 && hs.every((h) => R.isDone(h, k))) perfect = true;
    }
    const es = st.entries;
    return {
      total, early, maxL, care, goal, perfect, entries: es.length, jlong: R.entryLongest(),
      photo: es.some((e) => e.photos && e.photos.length), voice: es.some((e) => e.voice && e.voice.length),
      mood10: es.some((e) => e.mood === 10), reviews: Object.keys(st.reviews).filter((k) => k[0] !== 'y').length, created: st.habits.length
    };
  };
  R.ACH = [
    { id: 'first', icon: 'check', title: L('Первый шаг'), desc: L('Первая отметка привычки'), test: (s) => s.total >= 1 },
    { id: 's7', icon: 'flame', title: L('Неделя огня'), desc: L('Серия из 7 подряд'), test: (s) => s.maxL >= 7, prog: (s) => [s.maxL, 7] },
    { id: 's30', icon: 'flame', title: L('Месяц силы'), desc: L('Серия из 30 подряд'), test: (s) => s.maxL >= 30, prog: (s) => [s.maxL, 30] },
    { id: 's100', icon: 'bolt', title: L('Сотня'), desc: L('Серия из 100 подряд'), test: (s) => s.maxL >= 100, prog: (s) => [s.maxL, 100] },
    { id: 't100', icon: 'star', title: L('Сто отметок'), desc: L('Всего 100 отметок'), test: (s) => s.total >= 100, prog: (s) => [s.total, 100] },
    { id: 't500', icon: 'star', title: L('Пять сотен'), desc: L('Всего 500 отметок'), test: (s) => s.total >= 500, prog: (s) => [s.total, 500] },
    { id: 'perfect', icon: 'sun', title: L('Идеальный день'), desc: L('Все привычки дня выполнены (от 3 привычек)'), test: (s) => s.perfect },
    { id: 'early', icon: 'coffee', title: L('Жаворонок'), desc: L('15 отметок до 8 утра'), test: (s) => s.early >= 15, prog: (s) => [s.early, 15] },
    { id: 'goal', icon: 'target', title: L('Цель достигнута'), desc: L('Выполнена цель с дедлайном'), test: (s) => s.goal },
    { id: 'care', icon: 'shield', title: L('Забота о себе'), desc: L('Тяжёлый день или уважительный пропуск'), test: (s) => s.care },
    { id: 'j1', icon: 'book', title: L('Первая запись'), desc: L('Первая запись в дневнике'), test: (s) => s.entries >= 1 },
    { id: 'j10', icon: 'note', title: L('Дневник в ритме'), desc: L('10 записей в дневнике'), test: (s) => s.entries >= 10, prog: (s) => [s.entries, 10] },
    { id: 'j7', icon: 'calendar', title: L('Неделя рефлексии'), desc: L('Записи 7 дней подряд'), test: (s) => s.jlong >= 7, prog: (s) => [s.jlong, 7] },
    { id: 'photo', icon: 'image', title: L('Кадр дня'), desc: L('Запись с фото'), test: (s) => s.photo },
    { id: 'voice', icon: 'mic', title: L('Голос дня'), desc: L('Голосовая запись'), test: (s) => s.voice },
    { id: 'mood10', icon: 'heart', title: L('Лучший день'), desc: L('Настроение 10 из 10'), test: (s) => s.mood10 },
    { id: 'review', icon: 'chart', title: L('Подведение итогов'), desc: L('Открыть недельный обзор'), test: (s) => s.reviews >= 1 }
  ];
  /* возвращает только что открытые; silent — тихо записать всё уже заработанное */
  R.checkAch = (silent) => {
    const st = R.state;
    st.ach = st.ach || {};
    const s = R.achStats(), fresh = [];
    R.ACH.forEach((a) => {
      if (!st.ach[a.id] && a.test(s)) { st.ach[a.id] = silent ? '0' : R.dkey(R.today()); if (!silent) fresh.push(a); }
    });
    if (fresh.length || silent) R.save();
    return fresh;
  };

  /* ---------- недельный обзор ---------- */
  R.weekRange = (off) => { const s = R.addDays(R.weekStart(R.today()), off * 7); return { s, e: R.addDays(s, 6) }; };
  R.review = (off) => {
    const { s, e } = R.weekRange(off), p = R.weekRange(off - 1);
    const hs = R.activeHabits();
    const rates = hs.map((h) => ({ h, r: R.habitRate(h, s, e) })).filter((x) => x.r != null).sort((a, b) => b.r - a.r);
    const prev = hs.map((h) => R.habitRate(h, p.s, p.e)).filter((x) => x != null);
    const md = R.moodByDay();
    const moodIn = (a, b) => { const v = []; for (let d = a; d <= b; d = R.addDays(d, 1)) { const k = R.dkey(d); if (md[k] != null) v.push(md[k]); } return v; };
    const mv = moodIn(s, e), pv = moodIn(p.s, p.e);
    let done = 0, perfect = 0, bestDay = null;
    const t = R.today();
    for (let d = s; d <= e && d <= t; d = R.addDays(d, 1)) {
      const k = R.dkey(d);
      const dn = hs.filter((h) => R.isDone(h, k)).length;
      done += dn;
      const due = hs.filter((h) => h.type !== 'avoid' && k >= h.created && R.isDue(h, k));
      if (due.length >= 3 && due.every((h) => R.isDone(h, k))) perfect++;
      if (dn > 0 && (!bestDay || dn > bestDay.n)) bestDay = { d, n: dn };
    }
    let top = null;
    hs.forEach((h) => { const st = R.streak(h); if (st > 0 && (!top || st > top.n)) top = { h, n: st }; });
    return {
      s, e, rates, rate: rates.length ? R.avg(rates.map((x) => x.r)) : null, prevRate: prev.length ? R.avg(prev) : null,
      mood: mv.length ? R.avg(mv) : null, prevMood: pv.length ? R.avg(pv) : null, done, perfect, bestDay, top,
      best: rates[0] || null, worst: rates.length > 1 ? rates[rates.length - 1] : null, key: R.dkey(s)
    };
  };

  /* ---------- фото и голос: IndexedDB ---------- */
  let dbp;
  const openDB = () => dbp || (dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no idb'));
    const q = indexedDB.open('ritual-media', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('m');
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  }));
  const tx = (mode, fn) => openDB().then((db) => new Promise((res, rej) => {
    const t = db.transaction('m', mode);
    const r = fn(t.objectStore('m'));
    t.oncomplete = () => res(r && r.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
  const urls = {};
  R.media = {
    put: (id, blob) => tx('readwrite', (s) => s.put(blob, id)),
    get: (id) => tx('readonly', (s) => s.get(id)),
    del: (id) => { if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; } return tx('readwrite', (s) => s.delete(id)).catch(() => {}); },
    clear: () => { Object.values(urls).forEach((u) => URL.revokeObjectURL(u)); Object.keys(urls).forEach((k) => delete urls[k]); return tx('readwrite', (s) => s.clear()).catch(() => {}); }
  };
  R.mediaUrl = async (id) => {
    if (urls[id]) return urls[id];
    try { const b = await R.media.get(id); if (!b) return null; return (urls[id] = URL.createObjectURL(b)); } catch (e) { return null; }
  };
  R.compressImage = (file, max = 1280, q = 0.82) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * sc)), h = Math.max(1, Math.round(img.naturalHeight * sc));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
  const toDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  R.mediaIds = (e) => [...(e.photos || []), ...(e.voice || []).map((v) => v.id)];

  R.exportAll = async () => {
    const media = {};
    for (const e of R.state.entries) {
      for (const id of R.mediaIds(e)) {
        try { const b = await R.media.get(id); if (b) media[id] = await toDataURL(b); } catch (err) {}
      }
    }
    return Object.assign({}, R.state, { media });
  };
  R.importAll = async (d) => {
    const media = d.media || {};
    delete d.media;
    await R.media.clear();
    for (const id of Object.keys(media)) {
      try { const b = await (await fetch(media[id])).blob(); await R.media.put(id, b); } catch (err) {}
    }
    const base = R.emptyState();
    d.entries = d.entries || []; d.heavy = d.heavy || {}; d.reviews = d.reviews || {};
    d.settings = Object.assign(base.settings, d.settings);
    R.replaceState(d);
  };
  R.wipeAll = async () => { await R.media.clear(); R.replaceState(R.emptyState()); };

  if (!R.state.ach) { R.state.ach = {}; R.checkAch(true); }
  R.save();
})();
