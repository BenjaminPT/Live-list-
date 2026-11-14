/* Ritual — данные и расчёты. Всё хранится локально (localStorage), без аккаунтов. */
(function () {
  const R = (window.R = window.R || {});
  const KEY = 'ritual.v1';
  const pad = (n) => String(n).padStart(2, '0');

  R.pad = pad;
  R.dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  R.parse = (k) => { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  R.addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  R.today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  R.weekStart = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  R.uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  R.avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  R.fmtTime = (m) => `${m >= 0 ? Math.floor(m / 60) : 0}:${pad(m % 60)}`;

  /* причины пропусков: «уважительные» не обрывают серию */
  R.MISS = {
    sick: { label: 'Болезнь', excuse: true },
    trip: { label: 'Поездка', excuse: true },
    force: { label: 'Форс-мажор', excuse: true },
    tired: { label: 'Устал', excuse: false },
    forgot: { label: 'Забыл', excuse: false },
    lazy: { label: 'Не хотелось', excuse: false }
  };
  R.HUES = [350, 28, 48, 150, 185, 215, 255, 290];
  R.TAGS = ['Прогулка', 'Природа', 'Друзья', 'Семья', 'Работа', 'Спорт', 'Дом', 'Отдых', 'Учёба', 'Творчество', 'Рефлексия', 'Одиночество'];

  /* ---------- хранилище ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedDemo() {
    const rnd = rng(42);
    const t = R.today();
    const mk = (name, icon, hue, type, o = {}) => ({
      id: R.uid(), name, icon, hue, type, target: o.target || 1, unit: o.unit || '',
      perWeek: o.perWeek || 7, core: !!o.core, created: R.dkey(R.addDays(t, -(o.age || 170))), order: 0
    });
    const hs = [
      mk('Выпить воды', 'drop', 215, 'count', { target: 8, unit: 'стак.', core: true }),
      mk('Журнал', 'book', 350, 'check', { core: true }),
      mk('Прогулка с собакой', 'paw', 48, 'check'),
      mk('Тренировка', 'dumbbell', 150, 'check', { perWeek: 4 }),
      mk('Без Инсты', 'phone', 185, 'avoid', { age: 90 }),
      mk('Чтение', 'leaf', 290, 'check', { perWeek: 5 }),
      mk('Сон до 23:00', 'moon', 255, 'check')
    ];
    hs.forEach((h, i) => (h.order = i));
    const probs = [0.82, 0.76, 0.72, 0.5, 0.9, 0.55, 0.6];
    const reasons = Object.keys(R.MISS);
    const logs = {};
    hs.forEach((h, i) => {
      const L = (logs[h.id] = {});
      const cr = R.parse(h.created);
      const span = Math.round((t - cr) / 864e5);
      for (let n = 0; n <= span; n++) {
        const d = R.addDays(cr, n), k = R.dkey(d);
        const p = probs[i] * (0.72 + 0.28 * (n / Math.max(1, span)));
        const isToday = k === R.dkey(t);
        if (h.type === 'avoid') { if (!isToday && rnd() < 0.1) L[k] = { v: 0, slip: true }; continue; }
        if (isToday && i > 1) continue;
        if (rnd() < p) {
          const tm = 8 * 60 + Math.floor(rnd() * 14 * 60);
          if (h.type === 'count') L[k] = { v: Math.max(3, Math.min(10, h.target - 2 + Math.floor(rnd() * 4))), t: tm };
          else L[k] = { v: 1, t: h.name === 'Сон до 23:00' ? 7 * 60 + Math.floor(rnd() * 90) : tm };
        } else if (rnd() < 0.16) L[k] = { miss: reasons[Math.floor(rnd() * reasons.length)] };
      }
    });
    const title = {
      hi: ['Долгая прогулка с Мишей', 'Идеальный спокойный день', 'Всё получилось', 'Зарядился на неделю'],
      mid: ['Нормальный день', 'Дома было уютно', 'Обычный рабочий день', 'Хороший день, но мысли путаются'],
      lo: ['Нужен отдых', 'Тяжёлый день', 'Устал, хочу тишины']
    };
    const entries = [];
    for (let n = 75; n >= 0; n--) {
      if (rnd() > 0.58) continue;
      const d = R.addDays(t, -n), k = R.dkey(d);
      const dn = (h) => !!(logs[hs[h].id][k] && logs[hs[h].id][k].v);
      let m = 4.6 + rnd() * 2.2 + (dn(3) ? 1.7 : 0) + (dn(2) ? 0.9 : 0) + (dn(6) ? 0.8 : 0) + (rnd() - 0.5) * 2;
      m = Math.max(1, Math.min(10, Math.round(m)));
      const set = m >= 8 ? title.hi : m >= 5 ? title.mid : title.lo;
      const tags = [];
      if (dn(3)) tags.push('Спорт');
      while (tags.length < 1 + Math.floor(rnd() * 3)) {
        const tg = R.TAGS[Math.floor(rnd() * R.TAGS.length)];
        if (!tags.includes(tg)) tags.push(tg);
      }
      const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8 + Math.floor(rnd() * 14), Math.floor(rnd() * 60)).getTime();
      entries.push({ id: R.uid(), ts, mood: m, title: set[Math.floor(rnd() * set.length)], text: '', tags });
    }
    return { v: 1, habits: hs, logs, entries, heavy: {}, settings: { name: '', demo: true, haptics: true, remind: '' } };
  }
  R.seedDemo = seedDemo;

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.habits)) {
        s.logs = s.logs || {}; s.entries = s.entries || []; s.heavy = s.heavy || {};
        s.settings = Object.assign({ name: '', demo: false, haptics: true, remind: '' }, s.settings);
        return s;
      }
    } catch (e) {}
    return null;
  }
  R.state = load() || seedDemo();

  let timer;
  R.save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(R.state)); } catch (e) {} }, 150);
  };
  R.saveNow = () => { clearTimeout(timer); try { localStorage.setItem(KEY, JSON.stringify(R.state)); } catch (e) {} };
  R.replaceState = (s) => { R.state = s; R.saveNow(); };
  R.save();

  /* ---------- привычки и отметки ---------- */
  R.activeHabits = () => R.state.habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
  R.getLog = (h, k) => (R.state.logs[h.id] || {})[k];
  R.setLog = (h, k, patch) => {
    const L = R.state.logs[h.id] || (R.state.logs[h.id] = {});
    const nx = Object.assign({}, L[k], patch);
    Object.keys(nx).forEach((key) => nx[key] == null && delete nx[key]);
    if (!nx.v && !nx.miss && !nx.note && !nx.slip) delete L[k]; else L[k] = nx;
    if (h.type !== 'avoid' && k < h.created) h.created = k;
    R.save();
  };

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
  R.isExcused = (h, k) => {
    if (R.isDone(h, k)) return false;
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
    else if (h.type === 'count') R.setLog(h, k, l.v >= h.target ? { v: null, t: null } : { v: (l.v || 0) + 1, t: tm, miss: null });
    else R.setLog(h, k, l.v ? { v: null, t: null } : { v: 1, t: tm, miss: null });
  };

  /* ---------- серии ---------- */
  const weekMode = (h) => h.type !== 'avoid' && h.perWeek < 7;
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

  R.stats = (h) => {
    const L = R.state.logs[h.id] || {};
    const t = R.today();
    let total = 0, tsum = 0, tn = 0;
    if (h.type === 'avoid') {
      for (let d = R.parse(h.created); d <= t; d = R.addDays(d, 1)) if (R.isDone(h, R.dkey(d))) total++;
    } else {
      Object.keys(L).forEach((k) => {
        if (R.isDone(h, k)) { total++; if (L[k].t != null) { tsum += L[k].t; tn++; } }
      });
    }
    const perWeek = h.type === 'avoid' ? 7 : h.perWeek;
    const target30 = Math.max(1, Math.ceil((perWeek * 30) / 7));
    let c30 = 0;
    for (let i = 0; i < 30; i++) { const k = R.dkey(R.addDays(t, -i)); if (R.isDone(h, k) || R.isExcused(h, k)) c30++; }
    return {
      streak: R.streak(h), longest: R.longest(h), total, started: h.created,
      avgT: tn ? Math.round(tsum / tn) : null, goal: Math.min(1, c30 / target30), c30, target30
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
      let lvl = 0, ex = false;
      if (!fut) {
        const p = R.progress(h, k);
        if (p >= 1) { run++; lvl = h.type === 'count' ? 4 : run >= 5 ? 4 : run >= 2 ? 3 : 2; }
        else if (p > 0) lvl = p < 0.34 ? 1 : p < 0.67 ? 2 : 3;
        else if (R.isExcused(h, k)) ex = true; /* серия не рвётся */
        else run = 0;
      }
      if (d >= s) out.push({ k, lvl, ex, fut });
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
    return `hsl(${Math.round(h)} 92% 62%)`;
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
  R.entryStreak = () => {
    const days = new Set(R.state.entries.map((e) => R.dkey(new Date(e.ts))));
    let n = 0, d = R.today();
    if (!days.has(R.dkey(d))) d = R.addDays(d, -1);
    while (days.has(R.dkey(d))) { n++; d = R.addDays(d, -1); }
    return n;
  };
})();
