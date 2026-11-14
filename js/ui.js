/* Ritual — интерфейс: экраны, шторки, события. Тексты — через T() (см. i18n.js) */
(function () {
  const R = window.R;
  const T = R.t, L = (s) => s;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = R.icon;
  const S = () => R.state;
  const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  const TABS = [
    { id: 'habits', label: L('Привычки'), icon: 'grid' },
    { id: 'journal', label: L('Дневник'), icon: 'book' },
    { id: 'analyze', label: L('Анализ'), icon: 'chart' },
    { id: 'more', label: L('Ещё'), icon: 'sliders' }
  ];
  let cur = 'habits';
  let deferredInstall = null;
  const A = { p: 'week', off: 0 };
  const J = { q: '', tag: null, kind: null };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const noG = (s) => s.replace(/\s?г\./g, '');
  const unitWord = (n, h) => (R.streakUnit(h) === 'нед.' ? R.pl(n, ['неделя', 'недели', 'недель'], ['week', 'weeks']) : R.pl(n, ['день', 'дня', 'дней'], ['day', 'days']));
  const dayWord = (n) => R.pl(n, ['день', 'дня', 'дней'], ['day', 'days']);

  /* ================= шторки ================= */
  const stack = [];
  let ignorePop = 0;

  function openSheet({ html, full = false, onMount, focus }) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap' + (full ? ' full' : '');
    wrap.innerHTML = `<div class="backdrop"></div><section class="sheet" role="dialog" aria-modal="true"><div class="grab" aria-hidden="true"><i></i></div><div class="sheet-body">${html}</div></section>`;
    $('#sheets').appendChild(wrap);
    const sheet = $('.sheet', wrap), back = $('.backdrop', wrap);
    const api = { el: wrap, sheet, body: $('.sheet-body', wrap), full, close: (pop) => closeSheet(api, pop) };
    stack.push(api);
    history.pushState({ r: stack.length }, '');
    document.body.classList.add('sheet-open');
    R.anim(back, [{ opacity: 0 }, { opacity: 1 }], { dur: 320, ease: 'ease-out' });
    R.anim(sheet, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { sp: 'sheet' });
    if (full) R.anim($('#view'), [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.95)', opacity: 0.45 }], { dur: 420, ease: 'cubic-bezier(.22,.8,.3,1)', fill: 'forwards' });
    bindDrag(api);
    onMount && onMount(api);
    if (focus) setTimeout(() => { const f = $(focus, sheet); f && f.focus({ preventScroll: true }); }, 380);
    return api;
  }

  function closeSheet(api, fromPop) {
    const i = stack.indexOf(api);
    if (i < 0) return;
    stack.splice(i, 1);
    if (!fromPop) { ignorePop++; history.back(); }
    const sheet = api.sheet, cs = getComputedStyle(sheet).transform;
    const from = cs && cs !== 'none' ? cs : 'translateY(0)';
    R.anim(sheet, [{ transform: from }, { transform: 'translateY(105%)' }], { dur: 300, ease: 'cubic-bezier(.45,0,.75,.4)', fill: 'forwards' });
    R.anim($('.backdrop', api.el), [{ opacity: 1 }, { opacity: 0 }], { dur: 300, fill: 'forwards' });
    if (api.full && !stack.some((s) => s.full)) {
      R.anim($('#view'), [{ transform: 'scale(.95)', opacity: 0.45 }, { transform: 'scale(1)', opacity: 1 }], { dur: 420, ease: 'cubic-bezier(.22,.8,.3,1)', fill: 'forwards' }).finished.then(() => { $('#view').getAnimations().forEach((a) => a.cancel()); }).catch(() => {});
    }
    setTimeout(() => {
      api.el.remove();
      if (!stack.length) document.body.classList.remove('sheet-open');
      if (api.onClose) api.onClose();
    }, R.reduced() ? 0 : 310);
  }
  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop--; return; }
    const v = $('.viewer');
    if (v) { v.remove(); return; }
    const top = stack[stack.length - 1];
    if (top) closeSheet(top, true);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const v = $('.viewer');
    if (v) { v.remove(); return; }
    if (stack.length) stack[stack.length - 1].close();
  });

  function bindDrag(api) {
    const grab = $('.grab', api.el), sheet = api.sheet;
    let y0 = 0, dy = 0, t0 = 0, on = false;
    grab.addEventListener('pointerdown', (e) => { on = true; y0 = e.clientY; t0 = performance.now(); dy = 0; grab.setPointerCapture(e.pointerId); });
    grab.addEventListener('pointermove', (e) => { if (!on) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
    const end = () => {
      if (!on) return; on = false;
      const v = dy / Math.max(1, performance.now() - t0);
      if (dy > 110 || v > 0.6) { api.close(); return; }
      R.anim(sheet, [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { sp: 'snappy', fill: 'none' });
      sheet.style.transform = '';
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
    grab.addEventListener('dblclick', () => api.close());
  }

  /* ================= тосты ================= */
  let toastT;
  function toast(msg, undo) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button type="button" class="undo">${T('Отменить')}</button>` : ''}`;
    el.classList.add('show');
    R.anim(el, [{ opacity: 0, transform: 'translate(-50%,18px) scale(.96)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], { sp: 'bouncy' });
    clearTimeout(toastT);
    const hide = () => {
      R.anim(el, [{ opacity: 1, transform: 'translate(-50%,0)' }, { opacity: 0, transform: 'translate(-50%,10px)' }], { dur: 240, fill: 'forwards' }).finished.then(() => { el.classList.remove('show'); el.getAnimations().forEach((a) => a.cancel()); }).catch(() => {});
    };
    toastT = setTimeout(hide, 4200);
    const b = $('.undo', el);
    if (b) b.onclick = () => { undo(); hide(); };
  }
  R.toast = toast;
  /* после действия: если открыто достижение — показать его вместо обычного сообщения */
  function done(msg) {
    const un = R.checkAch();
    if (un.length) { R.haptic([20, 50, 30]); toast(T('Достижение: {n}', { n: T(un[0].title) })); } else if (msg) toast(msg);
  }

  /* ================= навигация ================= */
  function buildNav() {
    const nav = $('#nav');
    nav.setAttribute('aria-label', T('Разделы'));
    nav.innerHTML = `<div class="nav-in"><div class="nav-ind"></div>${TABS.map((t) => `<button type="button" data-tab="${t.id}" aria-label="${T(t.label)}"><span>${ic(t.icon, 22)}</span><b>${T(t.label)}</b></button>`).join('')}</div>`;
  }
  function setNav(animate) {
    const i = TABS.findIndex((t) => t.id === cur), ind = $('.nav-ind');
    const from = ind._i == null ? i : ind._i;
    ind.style.transform = `translateX(${i * 100}%)`;
    if (animate && from !== i) R.anim(ind, [{ transform: `translateX(${from * 100}%) scaleX(1.1)` }, { transform: `translateX(${i * 100}%) scaleX(1)` }], { sp: 'soft', fill: 'none' });
    ind._i = i;
    $$('#nav [data-tab]').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === cur ? 'page' : 'false'));
    const fab = $('#fab'), show = cur === 'habits' || cur === 'journal';
    fab.setAttribute('aria-label', cur === 'journal' ? T('Новая запись') : T('Новая привычка'));
    fab.classList.toggle('hide', !show);
  }
  let navTok = 0;
  async function go(tab) {
    const tok = ++navTok;
    const dir = TABS.findIndex((t) => t.id === tab) > TABS.findIndex((t) => t.id === cur) ? 1 : -1;
    cur = tab;
    setNav(true);
    const v = $('#view');
    if (!R.reduced()) await R.anim(v, [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-dir * 16}px)` }], { dur: 150, ease: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).finished.catch(() => {});
    if (tok !== navTok) return;
    v.getAnimations().forEach((a) => a.cancel());
    window.scrollTo(0, 0);
    render({ dir });
    v.focus({ preventScroll: true });
  }

  /* ================= экраны ================= */
  const greet = () => { const h = new Date().getHours(); return h < 5 ? T('Доброй ночи') : h < 12 ? T('Доброе утро') : h < 18 ? T('Добрый день') : T('Добрый вечер'); };
  const dayLabel = () => cap(R.fmt(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }));
  const monthLabel = (d) => cap(noG(R.fmt(d, { month: 'long', year: 'numeric' })));

  function ring(dn, total) {
    const C = 2 * Math.PI * 22, p = total ? dn / total : 0;
    return `<div class="ring" role="img" aria-label="${T('Выполнено {a} из {b}', { a: dn, b: total })}"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="22" class="rb"/><circle cx="26" cy="26" r="22" class="rf" stroke-dasharray="${(p * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 26 26)"/></svg><b>${dn}<small>/${total}</small></b></div>`;
  }

  function cardHTML(h) {
    const tk = R.dkey(R.today()), p = R.progress(h, tk), isDone = p >= 1, l = R.getLog(h, tk) || {};
    const st = R.streak(h), g = R.heatGrid(h, 9, 0);
    const rest = !R.isDue(h, tk) && !isDone;
    let label;
    if (h.type === 'avoid') label = l.slip ? T('Был срыв') : T('Держусь');
    else if (h.type === 'count') label = isDone ? T('Готово') : `+1 · ${l.v || 0}/${h.target}`;
    else label = isDone ? T('Выполнено') : rest ? T('Выходной') : T('Отметить');
    const cls = h.type === 'avoid' ? (l.slip ? 'slip' : 'done') : isDone ? 'done' : '';
    const exc = R.isExcused(h, tk) && !isDone && !rest;
    return `<article class="card${rest ? ' rest' : ''}" data-id="${h.id}" style="--h:${h.hue}" tabindex="0" role="button" aria-label="${esc(T(h.name))}, ${T('открыть подробности')}">
      <div class="card-top"><span class="ci">${ic(h.icon, 17)}</span><span class="cn">${esc(T(h.name))}</span>${st ? `<span class="cs" title="${T('Серия')}">${ic('flame', 13)}${st}</span>` : ''}</div>
      <div class="mini" style="--cols:9">${g.cells}</div>
      <button type="button" class="chk ${cls}" data-act="check" style="--p:${h.type === 'count' ? p : isDone ? 1 : 0}" aria-pressed="${isDone}">${isDone && h.type !== 'avoid' ? ic('check', 18, 2.6) : ''}<span>${exc ? T('Пропуск учтён') : label}</span></button></article>`;
  }

  function reviewDue() {
    const t = R.today(), dow = (t.getDay() + 6) % 7, rv = S().reviews || {};
    if (!R.activeHabits().length) return null;
    if (dow === 0 && !rv[R.dkey(R.addDays(R.weekStart(t), -7))]) return -1;
    if (dow === 6 && !rv[R.dkey(R.weekStart(t))]) return 0;
    return null;
  }

  function habitsView() {
    const tk = R.dkey(R.today()), heavy = !!S().heavy[tk];
    const all = R.activeHabits().filter((h) => !heavy || h.core);
    const dueList = all.filter((h) => R.isDue(h, tk) || R.isDone(h, tk));
    const dn = dueList.filter((h) => R.isDone(h, tk)).length;
    const sorted = [...all.filter((h) => dueList.includes(h)), ...all.filter((h) => !dueList.includes(h))];
    const nm = S().settings.name;
    const rd = reviewDue();
    return `<header class="top"><div><p class="eyebrow">${dayLabel()}</p><h1>${greet()}${nm ? ', ' + esc(nm) : ''}</h1></div><div id="ringbox">${ring(dn, dueList.length)}</div></header>
      <div class="chips-row">
        <button type="button" class="chip ${heavy ? 'on' : ''}" data-act="heavy" aria-pressed="${heavy}">${ic('snow', 16)}${T('Тяжёлый день')}</button>
        ${S().settings.demo ? `<button type="button" class="chip ghost" data-act="cleardemo">${T('Демо-данные · начать с нуля')}</button>` : ''}
      </div>
      ${rd != null ? `<button type="button" class="banner" data-act="review" data-off="${rd}"><span class="bi">${ic('chart', 20)}</span><span><b>${T('Итоги недели готовы')}</b><small>${T('Посмотрите, как прошла неделя')}</small></span>${ic('chevR', 18)}</button>` : ''}
      ${heavy ? `<p class="note">${T('Режим тяжёлого дня: остались только главные привычки, остальные не прервут серии.')}</p>` : ''}
      ${sorted.length ? `<section class="grid" id="grid">${sorted.map(cardHTML).join('')}</section>` : `<div class="empty">${ic('spark', 34)}<p>${T('Пока нет привычек. Нажмите «+», чтобы создать первую.')}</p></div>`}`;
  }

  /* ---------- дневник ---------- */
  function entryMatches(e) {
    if (J.tag && !(e.tags || []).includes(J.tag)) return false;
    if (J.kind === 'photo' && !(e.photos || []).length) return false;
    if (J.kind === 'voice' && !(e.voice || []).length) return false;
    if (J.q) {
      const q = J.q.toLowerCase();
      const hay = `${e.title || ''} ${T(e.title || '')} ${e.text || ''} ${(e.tags || []).map((x) => x + ' ' + T(x)).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }
  function entryHTML(e) {
    const d = new Date(e.ts), c = R.moodColor(e.mood);
    const dt = R.fmt(d, { weekday: 'short' }) + ' ' + R.pad(d.getHours()) + ':' + R.pad(d.getMinutes());
    const ph = (e.photos || []).slice(0, 3).map((id) => `<img class="ph" data-mid="${id}" src="${GIF}" alt="${T('Фото')}" width="56" height="56">`).join('');
    const more = (e.photos || []).length > 3 ? `<span class="vbadge">+${e.photos.length - 3}</span>` : '';
    const vb = (e.voice || []).length ? `<span class="vbadge">${ic('mic', 13)}${R.fmtDur(e.voice[0].dur)}${e.voice.length > 1 ? ' ×' + e.voice.length : ''}</span>` : '';
    const title = e.title ? esc(T(e.title)) : T('Без названия');
    return `<article class="entry" data-eid="${e.id}" style="--mc:${c}" tabindex="0" role="button" aria-label="${T('Запись')}: ${title}, ${T('настроение')} ${e.mood}">
      <div class="eh"><span>${dt}</span></div><div class="et">${title}</div>${e.text ? `<p class="ent">${esc(e.text)}</p>` : ''}
      ${ph || vb ? `<div class="atts-row">${ph}${more}${vb}</div>` : ''}
      <div class="tags">${(e.tags || []).map((x) => `<span class="tag">${esc(T(x))}</span>`).join('')}</div><div class="em">${e.mood}</div></article>`;
  }
  function entriesHTML() {
    const es = [...S().entries].filter(entryMatches).sort((a, b) => b.ts - a.ts);
    if (!es.length) return `<div class="empty">${ic(S().entries.length ? 'search' : 'book', 34)}<p>${S().entries.length ? T('Ничего не найдено') : T('Здесь будут ваши записи с оценкой настроения. Нажмите «+».')}</p></div>`;
    let html = '', month = '';
    es.forEach((e) => {
      const m = monthLabel(new Date(e.ts));
      if (m !== month) { month = m; html += `<h2 class="month">${m}</h2>`; }
      html += entryHTML(e);
    });
    return html;
  }
  function jchipsHTML() {
    const cnt = {};
    S().entries.forEach((e) => (e.tags || []).forEach((t) => (cnt[t] = (cnt[t] || 0) + 1)));
    const tags = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 7).map((x) => x[0]);
    const hasPh = S().entries.some((e) => (e.photos || []).length), hasV = S().entries.some((e) => (e.voice || []).length);
    const ch = (attr, val, on, inner) => `<button type="button" class="chip ${on ? 'on' : ''}" data-${attr}="${esc(val)}" aria-pressed="${on}">${inner}</button>`;
    return (hasPh ? ch('kind', 'photo', J.kind === 'photo', ic('image', 15) + T('Фото')) : '') + (hasV ? ch('kind', 'voice', J.kind === 'voice', ic('mic', 15) + T('Голос')) : '') + tags.map((t) => ch('jtag', t, J.tag === t, esc(T(t)))).join('');
  }
  function journalView() {
    const st = R.entryStreak();
    return `<header class="top"><div><p class="eyebrow">${noG(R.fmt(new Date(), { month: 'long', year: 'numeric' }))}</p><h1>${T('Дневник')}</h1></div><div class="badge" title="${T('Дней подряд с записью')}">${ic('flame', 16)}<b>${st}</b></div></header>
      ${S().entries.length ? `<div class="search"><span class="si">${ic('search', 18)}</span><input id="jq" type="search" enterkeyhint="search" value="${esc(J.q)}" placeholder="${T('Поиск по дневнику')}" aria-label="${T('Поиск по дневнику')}" autocomplete="off"><button type="button" class="sx ${J.q ? '' : 'hide'}" data-act="clearq" aria-label="${T('Очистить')}">${ic('x', 16)}</button></div>
      <div class="chs jchips" id="jchips">${jchipsHTML()}</div>` : ''}
      <div id="elist">${entriesHTML()}</div>`;
  }
  async function hydrateMedia(root) {
    $$('img[data-mid]', root).forEach(async (img) => {
      if (img.dataset.done) return;
      img.dataset.done = '1';
      const u = await R.mediaUrl(img.dataset.mid);
      if (u) img.src = u; else img.classList.add('gone');
    });
    $$('audio[data-mid]', root).forEach(async (au) => {
      if (au.dataset.done) return;
      au.dataset.done = '1';
      const u = await R.mediaUrl(au.dataset.mid);
      if (u) au.src = u;
    });
  }

  /* ---------- анализ ---------- */
  function rangeOf(p, off) {
    const t = R.today();
    if (p === 'week') { const s = R.addDays(R.weekStart(t), off * 7); return { s, e: R.addDays(s, 6) }; }
    if (p === 'month') { const s = new Date(t.getFullYear(), t.getMonth() + off, 1); return { s, e: new Date(s.getFullYear(), s.getMonth() + 1, 0) }; }
    const y = t.getFullYear() + off;
    return { s: new Date(y, 0, 1), e: new Date(y, 11, 31) };
  }
  const shortM = (d) => R.fmt(d, { month: 'short' }).replace('.', '');
  function rangeLabel(p, off) {
    const { s, e } = rangeOf(p, off);
    if (p === 'week') return s.getMonth() === e.getMonth() ? `${s.getDate()}–${e.getDate()} ${shortM(e)}` : `${s.getDate()} ${shortM(s)}–${e.getDate()} ${shortM(e)}`;
    if (p === 'month') return cap(R.fmt(s, { month: 'long' }));
    return String(s.getFullYear());
  }
  const entriesIn = (s, e) => S().entries.filter((x) => x.ts >= s.getTime() && x.ts < R.addDays(e, 1).getTime());

  function analyzeView() {
    const { s, e } = rangeOf(A.p, A.off), pr = rangeOf(A.p, A.off - 1);
    const es = entriesIn(s, e), pes = entriesIn(pr.s, pr.e);
    const md = R.moodByDay();
    let pts = [], n, labels = [];
    if (A.p === 'year') {
      n = 12;
      for (let m = 0; m < 12; m++) {
        const vals = Object.keys(md).filter((k) => k.startsWith(`${s.getFullYear()}-${R.pad(m + 1)}-`)).map((k) => md[k]);
        if (vals.length) pts.push({ i: m, v: R.avg(vals) });
        labels.push({ i: m, t: R.fmt(new Date(2000, m, 1), { month: 'narrow' }) });
      }
    } else {
      n = Math.round((e - s) / 864e5) + 1;
      for (let i = 0; i < n; i++) {
        const k = R.dkey(R.addDays(s, i));
        if (md[k] != null) pts.push({ i, v: md[k] });
        if (A.p === 'week' || i % 5 === 0) labels.push({ i, t: String(R.addDays(s, i).getDate()) });
      }
    }
    const a = es.length ? R.avg(es.map((x) => x.mood)) : 0, pa = pes.length ? R.avg(pes.map((x) => x.mood)) : 0;
    const trend = (v, pv) => (!pv ? 'flat' : v > pv + 0.05 ? 'up' : v < pv - 0.05 ? 'down' : 'flat');
    const chips = [];
    for (let o = -7; o <= 0; o++) chips.push(`<button type="button" class="rc ${o === A.off ? 'on' : ''}" data-off="${o}" aria-pressed="${o === A.off}">${rangeLabel(A.p, o)}</button>`);

    const tg = {};
    es.forEach((x) => (x.tags || []).forEach((t) => (tg[t] = tg[t] || []).push(x.mood)));
    const tags = Object.entries(tg).sort((x, y) => y[1].length - x[1].length).slice(0, 6);

    const rates = R.activeHabits().map((h) => ({ h, r: R.habitRate(h, s, e) })).filter((x) => x.r != null).sort((x, y) => y.r - x.r);
    const total = rates.length ? Math.round(R.avg(rates.map((x) => x.r)) * 100) : null;
    const prRates = R.activeHabits().map((h) => R.habitRate(h, pr.s, pr.e)).filter((x) => x != null);
    const ptotal = prRates.length ? Math.round(R.avg(prRates) * 100) : null;
    const best = rates[0], worst = rates.length > 1 ? rates[rates.length - 1] : null;

    const cor = R.correlations().slice(0, 5);
    const mx = Math.max(1, ...cor.map((c) => Math.abs(c.delta)));

    const rs = {};
    R.activeHabits().forEach((h) => {
      const Lg = S().logs[h.id] || {};
      Object.keys(Lg).forEach((k) => { if (Lg[k].miss && k >= R.dkey(s) && k <= R.dkey(e)) rs[Lg[k].miss] = (rs[Lg[k].miss] || 0) + 1; });
    });
    const rsl = Object.entries(rs).sort((x, y) => y[1] - x[1]);
    const rmax = Math.max(1, ...rsl.map((x) => x[1]));
    const ach = Object.keys(S().ach || {}).length;

    return `<header class="top"><div><p class="eyebrow">${T('Настроение и привычки')}</p><h1>${T('Анализ')}</h1></div>
      <label class="select"><select id="per" aria-label="${T('Период')}"><option value="week" ${A.p === 'week' ? 'selected' : ''}>${T('Неделя')}</option><option value="month" ${A.p === 'month' ? 'selected' : ''}>${T('Месяц')}</option><option value="year" ${A.p === 'year' ? 'selected' : ''}>${T('Год')}</option></select>${ic('chevD', 14)}</label></header>
      <div class="duo">
        <button type="button" class="lk" data-act="review" data-off="${A.p === 'week' ? Math.min(0, A.off) : -1}"><span class="bi">${ic('chart', 18)}</span><span><b>${T('Итоги недели')}</b><small>${T('Обзор и фокус')}</small></span></button>
        <button type="button" class="lk" data-act="ach"><span class="bi gold">${ic('award', 18)}</span><span><b>${T('Достижения')}</b><small>${ach} / ${R.ACH.length}</small></span></button>
      </div>
      <div class="rchips" id="rchips">${chips.join('')}</div>
      <section class="panel"><h3>${T('Настроение по времени')}</h3><div id="chartbox">${R.moodChart(pts, n, labels)}</div>${pts.length ? '' : `<p class="muted center">${T('За этот период записей нет')}</p>`}</section>
      <section class="tiles">
        <div class="tile"><p class="tl">${ic('star', 14)}${T('Средняя оценка')}</p><div class="big" style="color:${a ? R.moodColor(a) : 'var(--muted)'}"><span data-count="${a}" data-dec="1">${a ? R.num1(a) : '—'}</span><em class="tr ${trend(a, pa)}">${ic(trend(a, pa), 18, 2.4)}</em></div><p class="tf">${T('Прошлый период')}: ${pa ? R.num1(pa) : '—'}</p></div>
        <div class="tile"><p class="tl">${ic('list', 14)}${T('Всего записей')}</p><div class="big"><span data-count="${es.length}">${es.length}</span><em class="tr ${trend(es.length, pes.length)}">${ic(trend(es.length, pes.length), 18, 2.4)}</em></div><p class="tf">${T('Прошлый период')}: ${pes.length}</p></div>
      </section>
      <section class="panel"><h3>${T('Итоги привычек')}</h3>${total == null ? `<p class="muted">${T('Пока недостаточно данных.')}</p>` : `<div class="sum"><div class="sumbig"><span data-count="${total}">${total}</span>%</div><p>${T('выполнено')}${ptotal != null ? ` · ${total >= ptotal ? '+' : '−'}${Math.abs(total - ptotal)} ${T('п.п. к прошлому периоду')}` : ''}</p></div>
        <ul class="plain">${best ? `<li><span class="dot" style="background:hsl(${best.h.hue} 85% 60%)"></span>${T('Лучше всего')}: <b>${esc(T(best.h.name))}</b> — ${Math.round(best.r * 100)}%</li>` : ''}${worst ? `<li><span class="dot" style="background:hsl(${worst.h.hue} 85% 60%)"></span>${T('Просело')}: <b>${esc(T(worst.h.name))}</b> — ${Math.round(worst.r * 100)}%</li>` : ''}</ul>`}</section>
      <section class="panel"><h3>${T('Что вы делали')}</h3>${tags.length ? `<div class="tg3">${tags.map(([t, v]) => `<div class="tgi"><span>${esc(T(t))}</span><div class="dots">${v.slice(0, 5).map((m) => `<i style="background:${R.moodColor(m)}"></i>`).join('')}</div><small>${T('{n}× · ср. {a}', { n: v.length, a: R.num1(R.avg(v)) })}</small></div>`).join('')}</div>` : `<p class="muted">${T('Добавляйте теги к записям дневника — здесь появится статистика.')}</p>`}</section>
      <section class="panel"><h3>${T('Как привычки влияют на настроение')}</h3><p class="muted sm">${T('Разница средней оценки в дни с привычкой и без неё')}</p>${cor.length ? `<ul class="cor">${cor.map((c) => `<li><span class="cn2" style="--h:${c.h.hue}">${ic(c.h.icon, 16)}${esc(T(c.h.name))}</span><div class="bar"><i class="${c.delta >= 0 ? 'pos' : 'neg'}" style="--w:${Math.max(4, (Math.abs(c.delta) / mx) * 100)}%"></i></div><b class="${c.delta >= 0 ? 'pos' : 'neg'}">${c.delta >= 0 ? '+' : '−'}${R.num1(Math.abs(c.delta))}</b></li>`).join('')}</ul>` : `<p class="muted">${T('Нужно хотя бы по 3 дня с записью и без привычки.')}</p>`}</section>
      ${rsl.length ? `<section class="panel"><h3>${T('Причины пропусков')}</h3><ul class="cor">${rsl.map(([k, v]) => `<li><span class="cn2">${T(R.MISS[k].label)}${R.MISS[k].excuse ? ` <small class="ok">${T('серия сохранена')}</small>` : ''}</span><div class="bar"><i class="pos" style="--w:${(v / rmax) * 100}%"></i></div><b>${v}</b></li>`).join('')}</ul></section>` : ''}`;
  }

  /* ---------- «Ещё» ---------- */
  function notifState() {
    const sup = 'Notification' in window;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return { sup, ios, standalone, perm: sup ? Notification.permission : 'unsupported' };
  }
  function moreView() {
    const st = S().settings, arch = S().habits.filter((h) => h.archived);
    const ns = notifState();
    const seg = (name, cur0, items) => `<div class="seg" role="radiogroup">${items.map(([v, t]) => `<button type="button" role="radio" aria-checked="${cur0 === v}" class="${cur0 === v ? 'on' : ''}" data-${name}="${v}">${t}</button>`).join('')}</div>`;
    let nhint;
    if (!ns.sup) nhint = ns.ios && !ns.standalone ? T('На iPhone уведомления работают только в приложении, добавленном на экран «Домой» (iOS 16.4+): «Поделиться» → «На экран Домой». Пока можно добавить напоминание в календарь — оно сработает всегда.') : T('Этот браузер не поддерживает уведомления. Добавьте напоминание в календарь — оно сработает всегда.');
    else if (ns.perm === 'denied') nhint = T('Уведомления запрещены в настройках браузера. Напоминание в календаре всё равно сработает.');
    else nhint = T('Уведомление приходит, пока приложение открыто или запущено в фоне. Без сервера фоновые пуши невозможны — для надёжности добавьте напоминание в календарь.');
    return `<header class="top"><div><p class="eyebrow">Ritual</p><h1>${T('Ещё')}</h1></div></header>
      <section class="panel form"><h3>${T('Профиль')}</h3><label class="fl">${T('Как к вам обращаться')}<input id="nm" type="text" maxlength="24" value="${esc(st.name)}" placeholder="${T('Имя')}" autocomplete="given-name"></label></section>
      <section class="panel form"><h3>${T('Оформление')}</h3>
        <div class="fl"><span>${T('Тема')}</span>${seg('theme', st.theme || 'auto', [['auto', T('Авто')], ['dark', T('Тёмная')], ['light', T('Светлая')]])}</div>
        <div class="fl"><span>${T('Язык')}</span>${seg('lang', st.lang || 'auto', [['auto', T('Авто')], ['ru', 'Русский'], ['en', 'English']])}</div></section>
      <section class="panel form"><h3>${T('Напоминание')}</h3>
        <label class="fl">${T('Ежедневно в')}<input id="rm" type="time" value="${esc(st.remind || '')}"></label>
        <div class="row2 tight">${ns.sup && ns.perm === 'default' ? `<button type="button" class="btn" data-act="notif">${ic('bell', 18)}${T('Включить уведомления')}</button>` : ''}${ns.sup && ns.perm === 'granted' ? `<button type="button" class="btn" data-act="testnotif">${ic('bell', 18)}${T('Проверить')}</button>` : ''}<button type="button" class="btn" data-act="ics">${ic('calendar', 18)}${T('В календарь')}</button></div>
        <p class="muted sm">${nhint}</p></section>
      <section class="panel"><button type="button" class="lk wide" data-act="ach"><span class="bi gold">${ic('award', 18)}</span><span><b>${T('Достижения')}</b><small>${Object.keys(S().ach || {}).length} / ${R.ACH.length}</small></span>${ic('chevR', 18)}</button></section>
      <section class="panel form"><h3>${T('Приложение')}</h3>
        <label class="sw"><span>${T('Вибрация при отметках')}</span><input type="checkbox" role="switch" id="hp" ${st.haptics !== false ? 'checked' : ''}><i></i></label>
        ${deferredInstall ? `<button type="button" class="btn wide" data-act="install">${ic('install', 18)}${T('Установить как приложение')}</button>` : `<p class="muted sm">${T('Установка: в Chrome/Edge — значок «Установить» в адресной строке, в Safari — «Поделиться» → «На экран Домой».')}</p>`}</section>
      <section class="panel form"><h3>${T('Данные')}</h3><p class="muted sm">${T('Всё хранится только на этом устройстве. Делайте экспорт, чтобы перенести данные или сохранить копию (фото и голос входят в файл).')}</p>
        <div class="row2"><button type="button" class="btn" data-act="export">${ic('download', 18)}${T('Экспорт')}</button><button type="button" class="btn" data-act="import">${ic('upload', 18)}${T('Импорт')}</button></div>
        <input type="file" id="imp" accept="application/json,.json" hidden>
        <button type="button" class="btn danger wide" data-act="reset">${ic('trash', 18)}${T('Удалить все данные')}</button></section>
      ${arch.length ? `<section class="panel"><h3>${T('Архив')}</h3><ul class="plain">${arch.map((h) => `<li class="arch"><span class="cn2" style="--h:${h.hue}">${ic(h.icon, 16)}${esc(T(h.name))}</span><button type="button" class="chip" data-restore="${h.id}">${T('Вернуть')}</button></li>`).join('')}</ul></section>` : ''}
      <p class="muted center sm foot">Ritual · ${T('офлайн-приложение')} · 2.0</p>`;
  }

  const VIEWS = { habits: habitsView, journal: journalView, analyze: analyzeView, more: moreView };

  function render(o = {}) {
    const v = $('#view');
    v.innerHTML = VIEWS[cur]();
    const anim = !o.quiet;
    if (anim) R.anim(v, [{ opacity: 0, transform: `translateX(${(o.dir || 0) * 24}px)` }, { opacity: 1, transform: 'translateX(0)' }], { sp: 'soft' });
    after(anim);
  }

  function after(anim) {
    const v = $('#view');
    if (cur === 'habits') {
      if (anim) {
        R.stagger($$('.card', v), { step: 50, from: 24 });
        $$('.mini', v).forEach((m, mi) => $$('.cell', m).forEach((c) => R.anim(c, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { sp: 'soft', delay: 140 + mi * 50 + (+c.style.getPropertyValue('--c')) * 16 })));
        ringAnim();
      }
    }
    if (cur === 'journal') { if (anim) R.stagger($$('.entry', v), { step: 55, from: 20 }); hydrateMedia(v); }
    if (cur === 'analyze') {
      const rc = $('#rchips'); if (rc) rc.scrollLeft = rc.scrollWidth;
      $$('[data-count]', v).forEach((el) => { const dec = el.dataset.dec; R.countUp(el, +el.dataset.count, (n) => (dec ? R.num1(n) : String(Math.round(n)))); });
      drawChart();
      if (anim) R.stagger($$('.panel,.tile,.duo', v), { step: 60, from: 18 });
    }
    if (cur === 'more') {
      if (anim) R.stagger($$('.panel', v), { step: 55, from: 16 });
      const nm = $('#nm'); if (nm) nm.oninput = () => { S().settings.name = nm.value.trim(); R.save(); };
      const rm = $('#rm'); if (rm) rm.onchange = () => { S().settings.remind = rm.value; S().settings.lastRemind = null; R.save(); toast(rm.value ? T('Напомню в {t}', { t: rm.value }) : T('Напоминание выключено')); };
      const hp = $('#hp'); if (hp) hp.onchange = () => { S().settings.haptics = hp.checked; R.save(); if (hp.checked) R.haptic(20); };
      const imp = $('#imp'); if (imp) imp.onchange = importFile;
    }
  }

  function ringAnim() {
    const f = $('#ringbox .rf');
    if (!f) return;
    const to = f.getAttribute('stroke-dasharray'), C = 2 * Math.PI * 22;
    R.anim(f, [{ strokeDasharray: `0 ${C}` }, { strokeDasharray: to }], { sp: 'soft', delay: 220 });
  }

  function drawChart() {
    const line = $('#chartbox .line');
    if (line && !R.reduced()) {
      const len = line.getTotalLength ? line.getTotalLength() : 600;
      line.style.strokeDasharray = len;
      R.anim(line, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { dur: 1300, ease: 'cubic-bezier(.4,0,.15,1)', delay: 150 }).finished.then(() => { line.style.strokeDasharray = ''; }).catch(() => {});
    }
    $$('#chartbox .pt').forEach((p) => R.anim(p, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { sp: 'bouncy', delay: 320 + (+p.style.getPropertyValue('--i')) * 80 }));
  }

  /* точечное обновление карточки без перерисовки всей сетки */
  function refreshCard(h, popChanged) {
    const old = $(`.card[data-id="${h.id}"]`);
    if (!old) return;
    const t = document.createElement('div');
    t.innerHTML = cardHTML(h);
    const nw = t.firstElementChild;
    old.replaceWith(nw);
    const cells = $$('.cell:not(.fut)', nw), last = cells[cells.length - 1];
    if (popChanged && last) R.anim(last, [{ transform: 'scale(.3)' }, { transform: 'scale(1)' }], { sp: 'bouncy', fill: 'none' });
    const btn = $('.chk', nw);
    if (btn) R.anim(btn, [{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { sp: 'bouncy', fill: 'none' });
    updateRing();
  }
  function updateRing() {
    const tk = R.dkey(R.today());
    const hs = R.activeHabits().filter((x) => (!S().heavy[tk] || x.core) && (R.isDue(x, tk) || R.isDone(x, tk)));
    const rb = $('#ringbox');
    if (rb) { rb.innerHTML = ring(hs.filter((x) => R.isDone(x, tk)).length, hs.length); ringAnim(); }
  }

  /* ================= события ================= */
  function bindEvents() {
    $('#nav').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b && b.dataset.tab !== cur) go(b.dataset.tab);
    });
    $('#view').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (act) {
        e.stopPropagation();
        const a = act.dataset.act;
        if (a === 'check') {
          const card = act.closest('.card'), h = S().habits.find((x) => x.id === card.dataset.id);
          const k = R.dkey(R.today());
          const before = R.isDone(h, k), snap = JSON.parse(JSON.stringify(R.getLog(h, k) || {}));
          R.checkIn(h);
          const after = R.isDone(h, k);
          const slipNow = h.type === 'avoid' && (R.getLog(h, k) || {}).slip;
          refreshCard(h, true);
          const nb = $(`.card[data-id="${h.id}"] .chk`);
          if ((after && !before && h.type !== 'avoid') || (h.type === 'count' && after)) { R.burst(nb, h.hue); R.haptic([14, 40, 18]); } else R.haptic(10);
          const restore = () => { if (Object.keys(snap).length) R.state.logs[h.id][k] = snap; else delete R.state.logs[h.id][k]; R.save(); refreshCard(h, true); };
          if (h.type === 'avoid' && slipNow) toast(T('Срыв отмечен. Серия начнётся заново'), () => { R.setLog(h, k, { slip: null, v: null }); refreshCard(h, false); });
          else if (before && !after) toast(T('Отметка снята'), restore);
          else done();
          return;
        }
        if (a === 'heavy') {
          const k = R.dkey(R.today());
          if (S().heavy[k]) delete S().heavy[k]; else S().heavy[k] = true;
          R.save(); R.haptic(14); render(); done(S().heavy[k] ? T('Тяжёлый день: сегодня только главное') : T('Обычный режим')); return;
        }
        if (a === 'cleardemo') { if (confirm(T('Удалить демо-данные и начать с чистого листа?'))) { R.wipeAll().then(() => render()); } return; }
        if (a === 'install' && deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; render({ quiet: true }); }); return; }
        if (a === 'export') return exportData();
        if (a === 'import') return $('#imp').click();
        if (a === 'reset') { if (confirm(T('Удалить все привычки, записи, фото и настройки? Это нельзя отменить.'))) { R.wipeAll().then(() => { toast(T('Данные удалены')); applyEnv(); }); } return; }
        if (a === 'review') return openReview(+act.dataset.off);
        if (a === 'ach') return openAch();
        if (a === 'clearq') { J.q = ''; const i = $('#jq'); i.value = ''; i.focus(); refreshJournal(); return; }
        if (a === 'notif') { Notification.requestPermission().then(() => { render({ quiet: true }); }); return; }
        if (a === 'testnotif') { notify(T('Ritual'), T('Так будет выглядеть напоминание.')); return; }
        if (a === 'ics') return exportICS();
        return;
      }
      const seg = e.target.closest('.seg [data-theme], .seg [data-lang]');
      if (seg) {
        if (seg.dataset.theme) { S().settings.theme = seg.dataset.theme; R.applyTheme(); } else { S().settings.lang = seg.dataset.lang; R.setLang(seg.dataset.lang); }
        R.save(); R.haptic(10); applyEnv(); return;
      }
      const rc = e.target.closest('.rc');
      if (rc) { A.off = +rc.dataset.off; render({ quiet: true }); R.anim($('#chartbox'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { sp: 'soft' }); return; }
      const rs = e.target.closest('[data-restore]');
      if (rs) { const h = S().habits.find((x) => x.id === rs.dataset.restore); h.archived = false; R.save(); render({ quiet: true }); toast(T('Привычка возвращена')); return; }
      const kd = e.target.closest('[data-kind]');
      if (kd) { J.kind = J.kind === kd.dataset.kind ? null : kd.dataset.kind; refreshJournal(true); return; }
      const jt = e.target.closest('[data-jtag]');
      if (jt) { J.tag = J.tag === jt.dataset.jtag ? null : jt.dataset.jtag; refreshJournal(true); return; }
      const card = e.target.closest('.card');
      if (card) return openDetail(S().habits.find((x) => x.id === card.dataset.id));
      const en = e.target.closest('.entry');
      if (en) return openEntry(S().entries.find((x) => x.id === en.dataset.eid));
    });
    $('#view').addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && (e.target.matches('.card') || e.target.matches('.entry'))) { e.preventDefault(); e.target.click(); }
    });
    $('#view').addEventListener('input', (e) => {
      if (e.target.id === 'jq') {
        J.q = e.target.value.trim();
        $('.sx').classList.toggle('hide', !J.q);
        clearTimeout(refreshJournal.t);
        refreshJournal.t = setTimeout(() => refreshJournal(), 120);
      }
    });
    $('#view').addEventListener('change', (e) => {
      if (e.target.id === 'per') { A.p = e.target.value; A.off = 0; render({ quiet: true }); R.anim($('#chartbox'), [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { sp: 'soft' }); }
    });
    $('#fab').addEventListener('click', () => (cur === 'journal' ? openEntry() : openHabitEditor()));
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; if (cur === 'more') render({ quiet: true }); });
  }

  function refreshJournal(chips) {
    const list = $('#elist');
    if (!list) return;
    if (chips) $('#jchips').innerHTML = jchipsHTML();
    list.innerHTML = entriesHTML();
    R.stagger($$('.entry', list), { step: 30, from: 10, max: 8 });
    hydrateMedia(list);
  }

  /* смена языка/темы/сброс: перерисовать всё */
  function applyEnv() {
    buildNav(); setNav(false);
    render({ quiet: true });
  }
  R.onTheme = () => applyEnv();

  /* ================= экспорт / импорт ================= */
  async function exportData() {
    toast(T('Готовлю файл…'));
    const data = await R.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ritual-backup-${R.dkey(R.today())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(T('Копия данных сохранена'));
  }
  function importFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.habits) || typeof d.logs !== 'object') throw new Error('bad');
        if (!confirm(T('Заменить текущие данные данными из файла?'))) return;
        await R.importAll(d);
        toast(T('Данные импортированы')); applyEnv();
      } catch (err) { toast(T('Не удалось прочитать файл')); }
    };
    r.readAsText(f);
    e.target.value = '';
  }

  /* ================= напоминания ================= */
  function notify(title, body) {
    const opts = { body, icon: 'icons/icon-192.png', tag: 'ritual-daily' };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then((r) => r.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch (e) {} });
    else { try { new Notification(title, opts); } catch (e) {} }
  }
  function checkReminder() {
    const st = S().settings;
    if (!st.remind || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date(), hm = `${R.pad(now.getHours())}:${R.pad(now.getMinutes())}`, k = R.dkey(now);
    if (hm < st.remind || st.lastRemind === k) return;
    const tk = R.dkey(R.today()), left = R.activeHabits().filter((h) => !R.isDone(h, tk) && !R.isExcused(h, tk));
    st.lastRemind = k; R.save();
    if (!left.length) return;
    notify('Ritual', T('Осталось привычек: {n}. {list}', { n: left.length, list: left.slice(0, 3).map((h) => T(h.name)).join(', ') }));
  }
  /* .ics с повторением — работает в календаре iOS/Android/Mac без сервера */
  function exportICS() {
    const tm = S().settings.remind;
    if (!tm) { toast(T('Сначала выберите время напоминания')); return; }
    const [hh, mm] = tm.split(':');
    const d = R.today();
    const stamp = `${d.getFullYear()}${R.pad(d.getMonth() + 1)}${R.pad(d.getDate())}`;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ritual//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:ritual-daily-${stamp}@ritual`, `DTSTAMP:${stamp}T000000Z`,
      `DTSTART:${stamp}T${hh}${mm}00`, `DTEND:${stamp}T${hh}${mm}00`, 'RRULE:FREQ=DAILY', `SUMMARY:${T('Ritual: отметить привычки')}`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${T('Ritual: отметить привычки')}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'ritual-reminder.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(T('Откройте файл, чтобы добавить напоминание в календарь'));
  }

  /* ================= детали привычки ================= */
  const fmtLong = (k) => cap(R.fmt(R.parse(k), { weekday: 'long', day: 'numeric', month: 'long' }));
  const schedText = (h) => {
    if (h.type === 'avoid') return T('Каждый день');
    if (R.hasDays(h)) return [...h.days].sort().map((i) => R.wd(i)).join(' · ');
    if (h.perWeek < 7) return T('{n} раз в неделю', { n: h.perWeek });
    return T('Каждый день');
  };

  function openDetail(h) {
    let off = 0;
    const WEEKS = 20;
    const html = () => {
      const st = R.stats(h), g = R.heatGrid(h, WEEKS, off), wr = R.weekdayRates(h), gi = st.goalInfo;
      const range = noG(`${R.fmt(g.start, { day: 'numeric', month: 'short', year: 'numeric' })} — ${R.fmt(g.end > R.today() ? R.today() : g.end, { day: 'numeric', month: 'short', year: 'numeric' })}`);
      const Lg = S().logs[h.id] || {}, keys = Object.keys(Lg).filter((k) => Lg[k].v || Lg[k].miss || Lg[k].note || Lg[k].slip).sort().reverse().slice(0, 80);
      let rec = '', mon = '';
      keys.forEach((k) => {
        const l = Lg[k], m = monthLabel(R.parse(k));
        if (m !== mon) { mon = m; rec += `<h4 class="rm">${m}</h4>`; }
        const meta = l.slip ? `<span class="rtag bad">${T('Срыв')}</span>` : l.miss ? `<span class="rtag ${R.MISS[l.miss].excuse ? 'ok' : ''}">${T(R.MISS[l.miss].label)}</span>` : l.v ? (h.type === 'count' ? `${l.v} ${esc(T(h.unit))}` : l.t != null ? R.fmtTime(l.t) : '✓') : '';
        rec += `<button type="button" class="rec" data-day="${k}"><span>${shortM(R.parse(k)) ? R.parse(k).getDate() + ' ' + shortM(R.parse(k)) : ''}</span><em>${l.note ? esc(l.note) : ''}</em><b>${meta}</b></button>`;
      });
      const unit = unitWord(st.longest, h);
      let goalTile;
      if (gi) {
        const foot = gi.reached ? T('Цель достигнута') : gi.failed ? T('Срок истёк') : gi.left == null ? T('без срока') : gi.left === 0 ? T('Последний день') : T('Осталось {n} {d}', { n: gi.left, d: dayWord(gi.left) });
        goalTile = `<div class="tile ${gi.reached ? 'won' : ''}"><p class="tl">${ic('target', 14)}${T('Цель')}</p><div class="big sm2"><span data-c="${gi.done}">${gi.done}</span><em class="of">/${gi.n}</em></div><div class="pbar"><i style="--w:${gi.pct * 100}%"></i></div><p class="tf ${gi.behind || gi.failed ? 'warn' : ''}">${foot}${gi.behind ? ' · ' + T('нужен ускоренный темп') : ''}</p></div>`;
      } else {
        goalTile = `<div class="tile"><p class="tl">${ic('trophy', 14)}${T('Выполнение за 30 дней')}</p><div class="big"><span data-c="${Math.round(st.goal * 100)}">${Math.round(st.goal * 100)}</span>%</div><div class="pbar"><i style="--w:${st.goal * 100}%"></i></div><p class="tf">${T('{a} из {b}', { a: st.c30, b: st.target30 })}</p></div>`;
      }
      return `<div class="dhead"><button type="button" class="rbtn" data-d="edit" aria-label="${T('Редактировать')}">${ic('pencil', 18)}</button><h2><span class="ci2">${ic(h.icon, 20)}</span><span class="dn">${esc(T(h.name))}</span></h2><button type="button" class="rbtn" data-d="close" aria-label="${T('Закрыть')}">${ic('x', 20)}</button></div>
      <p class="dsub">${ic('repeat', 14)}${schedText(h)}${h.auto === 'journal' ? ` · ${T('авто из дневника')}` : ''}</p>
      <div class="heatpanel"><div class="hw"><div class="dow">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<span>${R.wd(i, 'narrow')}</span>`).join('')}</div><div class="heat" style="--cols:${WEEKS}" id="heat">${g.cells}</div></div>
        <div class="hf"><button type="button" class="rbtn sm" data-d="prev" aria-label="${T('Раньше')}">${ic('chevL', 16)}</button><span>${range}</span><button type="button" class="rbtn sm" data-d="next" aria-label="${T('Позже')}" ${off >= 0 ? 'disabled' : ''}>${ic('chevR', 16)}</button></div></div>
      <div class="tiles4">
        <div class="tile"><p class="tl">${ic('flame', 14)}${T('Серия')}</p><div class="big"><span data-c="${st.streak}">${st.streak}</span></div><p class="tf">${T('Лучшая')}: ${st.longest} ${unit}</p></div>
        <div class="tile"><p class="tl">${ic('check', 14)}${T('Всего отметок')}</p><div class="big"><span data-c="${st.total}">${st.total}</span></div><p class="tf">${T('С {d}', { d: R.parse(st.started).getDate() + ' ' + shortM(R.parse(st.started)) })}</p></div>
        <div class="tile"><p class="tl">${ic('clock', 14)}${T('Обычно в')}</p><div class="big sm2">${st.avgT != null ? R.fmtTime(st.avgT) : '—'}</div><p class="tf">${T('среднее время отметки')}</p></div>
        ${goalTile}
      </div>
      <section class="dpanel"><h3>${T('Лучшие дни недели')}</h3><div class="wd">${wr.map((r, i) => `<div><i style="--hh:${Math.max(6, r * 100)}%"></i><span>${R.wd(i)}</span></div>`).join('')}</div></section>
      <h3 class="rt">${T('Записи')}</h3><div class="recs">${rec || `<p class="muted">${T('Пока пусто — нажмите на клетку календаря, чтобы отметить день.')}</p>`}</div>`;
    };
    const api = openSheet({
      full: true,
      html: `<div class="detail" style="--h:${h.hue}">${html()}</div>`,
      onMount: (a) => {
        const root = $('.detail', a.body);
        const paint = (animate) => {
          root.innerHTML = html();
          $$('[data-c]', root).forEach((el) => R.countUp(el, +el.dataset.c));
          if (animate) {
            $$('.cell', root).forEach((c) => R.anim(c, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { sp: 'soft', delay: 60 + (+c.style.getPropertyValue('--c')) * 14 }));
            R.stagger($$('.tile,.dpanel,.heatpanel', root), { step: 60, from: 16 });
            $$('.wd i', root).forEach((i, n) => R.anim(i, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { sp: 'bouncy', delay: 260 + n * 45 }));
            $$('.pbar i', root).forEach((i) => R.anim(i, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { sp: 'soft', delay: 320 }));
          }
        };
        a.repaint = () => paint(false);
        paint(true);
        root.addEventListener('click', (e) => {
          const d = e.target.closest('[data-d]');
          if (d) {
            const v = d.dataset.d;
            if (v === 'close') a.close();
            else if (v === 'edit') openHabitEditor(h);
            else if (v === 'prev') { off -= WEEKS; paint(true); }
            else if (v === 'next' && off < 0) { off = Math.min(0, off + WEEKS); paint(true); }
            return;
          }
          const c = e.target.closest('.cell:not(.fut)') || e.target.closest('[data-day]');
          if (c) openDay(h, c.dataset.k || c.dataset.day, () => a.repaint());
        });
      }
    });
    api.onClose = () => { render({ quiet: true }); };
    detailApi = api;
  }
  let detailApi = null;

  /* ================= правка дня ================= */
  function openDay(h, k, cb) {
    const paint = () => {
      const l = R.getLog(h, k) || {}, isDone = R.isDone(h, k);
      const future = k > R.dkey(R.today());
      let ctl;
      if (h.type === 'count') ctl = `<div class="stepper"><button type="button" data-s="-1" aria-label="${T('Меньше')}" ${!l.v ? 'disabled' : ''}>${ic('minus', 22)}</button><div class="sv"><b>${l.v || 0}</b><small>${T('из {n}', { n: h.target })} ${esc(T(h.unit))}</small></div><button type="button" data-s="1" aria-label="${T('Больше')}">${ic('plus', 22)}</button></div>`;
      else if (h.type === 'avoid') ctl = `<button type="button" class="bigtog ${l.slip ? 'bad' : 'on'}" data-s="slip" aria-pressed="${!!l.slip}">${l.slip ? T('Был срыв') : T('Держался')}<small>${T('нажмите, чтобы изменить')}</small></button>`;
      else ctl = `<button type="button" class="bigtog ${isDone ? 'on' : ''}" data-s="tog" aria-pressed="${isDone}">${isDone ? ic('check', 22, 2.6) + T('Выполнено') : T('Не выполнено')}<small>${T('нажмите, чтобы изменить')}</small></button>`;
      const showMiss = !isDone && h.type !== 'avoid' && !future;
      const grp = (ex) => Object.entries(R.MISS).filter(([, m]) => m.excuse === ex).map(([key, m]) => `<button type="button" class="chip ${l.miss === key ? 'on' : ''}" data-m="${key}" aria-pressed="${l.miss === key}">${T(m.label)}</button>`).join('');
      const off = R.isOff(h, k) && !future;
      return `<div style="--h:${h.hue}"><div class="dayhead"><h2>${fmtLong(k)}</h2><p class="muted">${esc(T(h.name))}${off ? ' · ' + T('не по расписанию') : ''}</p></div>${future ? `<p class="muted">${T('Этот день ещё не наступил.')}</p>` : ctl}
        ${showMiss && !off ? `<div class="miss"><p class="ml">${T('Почему пропустили?')}</p><p class="ms">${T('Уважительная причина — серия сохранится')}</p><div class="chs">${grp(true)}</div><p class="ms">${T('Обычный пропуск — серия прервётся')}</p><div class="chs">${grp(false)}</div></div>` : ''}
        ${future ? '' : `<label class="fl">${T('Заметка')}<textarea id="dn" rows="2" maxlength="200" placeholder="${T('Как прошло?')}">${esc(l.note || '')}</textarea></label>`}
        <button type="button" class="btn primary wide" data-s="ok">${T('Готово')}</button></div>`;
    };
    const a = openSheet({
      html: paint(),
      onMount: (a) => {
        const apply = (fn) => { fn(); R.haptic(12); a.body.innerHTML = paint(); cb && cb(); const ch = $('.bigtog,.stepper .sv', a.body); ch && R.anim(ch, [{ transform: 'scale(.95)' }, { transform: 'scale(1)' }], { sp: 'bouncy', fill: 'none' }); };
        a.body.addEventListener('click', (e) => {
          const s = e.target.closest('[data-s]');
          const m = e.target.closest('[data-m]');
          const now = new Date(), tm = k === R.dkey(R.today()) ? now.getHours() * 60 + now.getMinutes() : null;
          if (m) return apply(() => { const l = R.getLog(h, k) || {}; R.setLog(h, k, { miss: l.miss === m.dataset.m ? null : m.dataset.m, v: null, t: null }); });
          if (!s) return;
          const v = s.dataset.s, l = R.getLog(h, k) || {};
          if (v === 'ok') return a.close();
          if (v === 'tog') return apply(() => R.setLog(h, k, l.v ? { v: null, t: null, auto: null } : { v: 1, t: tm, miss: null, auto: null }));
          if (v === 'slip') return apply(() => R.setLog(h, k, l.slip ? { slip: null, v: null } : { slip: true, v: 0 }));
          if (v === '1' || v === '-1') return apply(() => { const nv = Math.max(0, (l.v || 0) + +v); R.setLog(h, k, { v: nv || null, t: nv ? (l.t != null ? l.t : tm) : null, miss: nv ? null : l.miss }); });
        });
        a.body.addEventListener('change', (e) => { if (e.target.id === 'dn') { R.setLog(h, k, { note: e.target.value.trim() || null }); cb && cb(); } });
      }
    });
    a.onClose = () => { cb && cb(); done(); };
  }

  /* ================= редактор привычки ================= */
  function openHabitEditor(h) {
    const edit = !!h;
    const d = h ? { ...h, days: h.days ? [...h.days] : [] } : { name: '', icon: 'spark', hue: 350, type: 'check', target: 8, unit: T('раз'), perWeek: 7, days: [], core: false, auto: null, goal: null };
    d.sched = R.hasDays(d) ? 'days' : d.perWeek < 7 ? 'week' : 'daily';
    d.goalOn = !!(d.goal && d.goal.n);
    d.gN = d.goalOn ? d.goal.n : 30;
    d.gDate = d.goalOn && d.goal.deadline ? d.goal.deadline : '';
    const body = () => {
      const tyHint = { check: T('Сделал — отметил.'), count: T('Например, 8 стаканов воды: считаем по нажатиям.'), avoid: T('Каждый день засчитывается сам, пока вы не отметите срыв.') }[d.type];
      return `<div class="dayhead"><h2>${edit ? T('Редактировать') : T('Новая привычка')}</h2></div>
      <label class="fl">${T('Название')}<input id="hn" type="text" maxlength="32" value="${esc(d.name)}" placeholder="${T('Например, Утренняя зарядка')}" autocomplete="off"><small class="err" id="her" role="alert"></small></label>
      <div class="fl"><span>${T('Тип')}</span><div class="seg" role="radiogroup">${[['check', T('Отметка')], ['count', T('Счётчик')], ['avoid', T('Воздержание')]].map(([v, t]) => `<button type="button" role="radio" aria-checked="${d.type === v}" class="${d.type === v ? 'on' : ''}" data-ty="${v}">${t}</button>`).join('')}</div><small class="muted">${tyHint}</small></div>
      ${d.type === 'count' ? `<div class="row2"><label class="fl">${T('Цель в день')}<input id="ht" type="number" min="1" max="999" inputmode="numeric" value="${d.target}"></label><label class="fl">${T('Единица')}<input id="hu" type="text" maxlength="10" value="${esc(d.unit)}"></label></div>` : ''}
      ${d.type !== 'avoid' ? `<div class="fl"><span>${T('Расписание')}</span><div class="seg" role="radiogroup">${[['daily', T('Каждый день')], ['week', T('N в неделю')], ['days', T('По дням')]].map(([v, t]) => `<button type="button" role="radio" aria-checked="${d.sched === v}" class="${d.sched === v ? 'on' : ''}" data-sc="${v}">${t}</button>`).join('')}</div>
        ${d.sched === 'week' ? `<div class="stepper sm"><button type="button" data-pw="-1" aria-label="${T('Меньше')}" ${d.perWeek <= 1 ? 'disabled' : ''}>${ic('minus', 18)}</button><div class="sv"><b>${d.perWeek >= 7 ? 6 : d.perWeek} ${T('раз в неделю')}</b><small>${T('серия считается в неделях')}</small></div><button type="button" data-pw="1" aria-label="${T('Больше')}" ${d.perWeek >= 6 ? 'disabled' : ''}>${ic('plus', 18)}</button></div>` : ''}
        ${d.sched === 'days' ? `<div class="wdays" role="group" aria-label="${T('Дни недели')}">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<button type="button" class="wdb ${d.days.includes(i) ? 'on' : ''}" data-wd="${i}" aria-pressed="${d.days.includes(i)}">${R.wd(i)}</button>`).join('')}</div><small class="muted">${T('В остальные дни привычка не нужна: серия не прерывается.')}</small>` : ''}
        <small class="err" id="wer" role="alert"></small></div>` : ''}
      <div class="fl"><span>${T('Цель с дедлайном')}</span>
        <label class="sw nb"><span>${T('Поставить цель')}<small>${T('Выполнить привычку N дней к дате')}</small></span><input type="checkbox" role="switch" id="hg" ${d.goalOn ? 'checked' : ''}><i></i></label>
        ${d.goalOn ? `<div class="row2"><label class="fl">${T('Сколько дней')}<input id="gn" type="number" min="1" max="3650" inputmode="numeric" value="${d.gN}"></label><label class="fl">${T('Дедлайн')}<input id="gd" type="date" min="${R.dkey(R.today())}" value="${d.gDate}"></label></div><small class="muted">${T('Дедлайн можно не указывать.')}</small>` : ''}</div>
      ${d.type === 'check' ? `<label class="sw"><span>${T('Отмечать из дневника')}<small>${T('Запись в дневнике автоматически засчитывает привычку')}</small></span><input type="checkbox" role="switch" id="ha" ${d.auto === 'journal' ? 'checked' : ''}><i></i></label>` : ''}
      <div class="fl"><span>${T('Иконка')}</span><div class="picks">${R.ICON_PICK.map((n) => `<button type="button" class="pk ${d.icon === n ? 'on' : ''}" data-ic="${n}" aria-label="${n}" aria-pressed="${d.icon === n}">${ic(n, 20)}</button>`).join('')}</div></div>
      <div class="fl"><span>${T('Цвет')}</span><div class="picks hues">${R.HUES.map((x) => `<button type="button" class="hu ${d.hue === x ? 'on' : ''}" data-hu="${x}" style="--h:${x}" aria-label="${T('Цвет')} ${x}" aria-pressed="${d.hue === x}"></button>`).join('')}</div></div>
      <label class="sw"><span>${T('Главная привычка')}<small>${T('Остаётся в «тяжёлый день»')}</small></span><input type="checkbox" role="switch" id="hc" ${d.core ? 'checked' : ''}><i></i></label>
      <div class="row2">${edit ? `<button type="button" class="btn" data-x="arch">${ic('archive', 18)}${T('В архив')}</button>` : '<span></span>'}<button type="button" class="btn primary" data-x="save">${T('Сохранить')}</button></div>
      ${edit ? `<button type="button" class="btn danger wide" data-x="del">${ic('trash', 18)}${T('Удалить навсегда')}</button>` : ''}`;
    };
    openSheet({
      html: body(),
      focus: edit ? null : '#hn',
      onMount: (a) => {
        const sync = () => {
          const n = $('#hn', a.body); if (n) d.name = n.value;
          const t = $('#ht', a.body); if (t) d.target = Math.max(1, +t.value || 1);
          const u = $('#hu', a.body); if (u) d.unit = u.value;
          const c = $('#hc', a.body); if (c) d.core = c.checked;
          const g = $('#hg', a.body); if (g) d.goalOn = g.checked;
          const gn = $('#gn', a.body); if (gn) d.gN = Math.max(1, +gn.value || 1);
          const gd = $('#gd', a.body); if (gd) d.gDate = gd.value;
          const au = $('#ha', a.body); if (au) d.auto = au.checked ? 'journal' : null;
        };
        const redo = () => { sync(); a.body.innerHTML = body(); };
        a.body.addEventListener('change', (e) => { if (e.target.id === 'hg') redo(); });
        a.body.addEventListener('click', (e) => {
          const t = e.target.closest('button'); if (!t) return;
          if (t.dataset.ty) { sync(); d.type = t.dataset.ty; if (d.type === 'avoid') { d.sched = 'daily'; d.auto = null; } if (d.type !== 'check') d.auto = null; return redo(); }
          if (t.dataset.sc) { sync(); d.sched = t.dataset.sc; if (d.sched === 'week' && d.perWeek >= 7) d.perWeek = 4; return redo(); }
          if (t.dataset.pw) { sync(); d.perWeek = Math.max(1, Math.min(6, (d.perWeek >= 7 ? 6 : d.perWeek) + +t.dataset.pw)); return redo(); }
          if (t.dataset.wd != null) { sync(); const i = +t.dataset.wd, p = d.days.indexOf(i); if (p >= 0) d.days.splice(p, 1); else d.days.push(i); t.classList.toggle('on'); t.setAttribute('aria-pressed', p < 0); R.anim(t, [{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { sp: 'bouncy', fill: 'none' }); R.haptic(8); return; }
          if (t.dataset.ic) { sync(); d.icon = t.dataset.ic; return redo(); }
          if (t.dataset.hu) { sync(); d.hue = +t.dataset.hu; return redo(); }
          if (t.dataset.x === 'save') {
            sync();
            const shake = (el) => R.anim(el, [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { dur: 260, fill: 'none' });
            if (!d.name.trim()) { $('#her', a.body).textContent = T('Введите название'); $('#hn', a.body).focus(); shake($('#hn', a.body)); return; }
            if (d.type !== 'avoid' && d.sched === 'days' && !d.days.length) { $('#wer', a.body).textContent = T('Выберите хотя бы один день'); shake($('.wdays', a.body)); return; }
            const out = {
              name: d.name.trim(), icon: d.icon, hue: d.hue, type: d.type, target: d.target, unit: d.unit, core: d.core, auto: d.type === 'check' ? d.auto : null,
              days: d.type !== 'avoid' && d.sched === 'days' ? [...d.days].sort() : null,
              perWeek: d.type !== 'avoid' && d.sched === 'week' ? Math.min(6, d.perWeek) : 7,
              goal: d.goalOn ? { n: d.gN, deadline: d.gDate || null, start: (edit && h.goal && h.goal.start) || R.dkey(R.today()) } : null
            };
            let nh;
            if (edit) { Object.assign(h, out); nh = h; } else { nh = { ...out, id: R.uid(), created: R.dkey(R.today()), order: S().habits.length }; S().habits.push(nh); }
            if (nh.auto === 'journal') { const days = new Set(S().entries.map((e) => R.dkey(new Date(e.ts)))); days.forEach((k) => R.syncJournalHabits(k)); }
            R.save(); R.haptic(14); a.close();
            if (detailApi && edit) { detailApi.close(); }
            setTimeout(() => { cur = 'habits'; setNav(true); render(); done(edit ? T('Сохранено') : T('Привычка добавлена')); }, 320);
          }
          if (t.dataset.x === 'arch') { h.archived = true; R.save(); a.close(); if (detailApi) detailApi.close(); setTimeout(() => { render({ quiet: true }); toast(T('Привычка в архиве'), () => { h.archived = false; R.save(); render({ quiet: true }); }); }, 320); }
          if (t.dataset.x === 'del') {
            if (!confirm(T('Удалить «{n}» и всю её историю?', { n: T(h.name) }))) return;
            S().habits = S().habits.filter((x) => x.id !== h.id); delete S().logs[h.id]; R.save(); a.close(); if (detailApi) detailApi.close();
            setTimeout(() => { render({ quiet: true }); toast(T('Привычка удалена')); }, 320);
          }
        });
      }
    });
  }

  /* ================= запись дневника: фото и голос ================= */
  function openViewer(ids, i) {
    const v = document.createElement('div');
    v.className = 'viewer';
    v.setAttribute('role', 'dialog');
    v.setAttribute('aria-label', T('Фото'));
    v.innerHTML = `<img alt="${T('Фото')}"><button type="button" class="rbtn vx" aria-label="${T('Закрыть')}">${ic('x', 20)}</button>${ids.length > 1 ? `<button type="button" class="rbtn vp" aria-label="${T('Раньше')}">${ic('chevL', 20)}</button><button type="button" class="rbtn vn" aria-label="${T('Позже')}">${ic('chevR', 20)}</button>` : ''}`;
    document.body.appendChild(v);
    const img = $('img', v);
    const show = async (n) => { i = (n + ids.length) % ids.length; const u = await R.mediaUrl(ids[i]); if (u) img.src = u; R.anim(img, [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'scale(1)' }], { sp: 'soft' }); };
    R.anim(v, [{ opacity: 0 }, { opacity: 1 }], { dur: 260 });
    show(i);
    v.addEventListener('click', (e) => {
      if (e.target.closest('.vp')) return show(i - 1);
      if (e.target.closest('.vn')) return show(i + 1);
      if (e.target === img) return;
      v.remove();
    });
  }

  function openEntry(en) {
    const edit = !!en;
    const d = en ? { ...en, tags: [...(en.tags || [])], photos: [...(en.photos || [])], voice: (en.voice || []).map((x) => ({ ...x })) } : { mood: 7, title: '', text: '', tags: [], ts: Date.now(), photos: [], voice: [] };
    const orig = en ? R.mediaIds(en) : [];
    const fresh = [];
    let saved = false, rec = null, recT = 0, recTick = null;
    const all = [...new Set([...R.TAGS, ...S().entries.flatMap((x) => x.tags || [])])];
    const body = () => `<div class="dayhead"><h2>${edit ? T('Запись') : T('Как ты сегодня?')}</h2></div>
      <div class="moodbox" id="mb" style="--mc:${R.moodColor(d.mood)}"><div class="mnum" id="mn">${d.mood}</div>
        <input type="range" id="mr" min="1" max="10" step="1" value="${d.mood}" aria-label="${T('Оценка настроения от 1 до 10')}"><div class="mscale"><span>${T('Плохо')}</span><span>${T('Отлично')}</span></div></div>
      <label class="fl">${T('Заголовок')}<input id="et" type="text" maxlength="60" value="${esc(d.title)}" placeholder="${T('Коротко о дне')}" autocomplete="off"></label>
      <label class="fl">${T('Заметка')}<textarea id="ex" rows="3" maxlength="600" placeholder="${T('Что произошло, что почувствовал(а)')}">${esc(d.text)}</textarea></label>
      <div class="fl"><span>${T('Фото и голос')}</span>
        ${d.photos.length ? `<div class="atts">${d.photos.map((id, i) => `<div class="att"><img data-mid="${id}" data-vi="${i}" src="${GIF}" alt="${T('Фото')} ${i + 1}"><button type="button" class="rm" data-rmp="${i}" aria-label="${T('Удалить фото')}">${ic('x', 14, 2.6)}</button></div>`).join('')}</div>` : ''}
        ${d.voice.map((v, i) => `<div class="vrow"><audio controls preload="metadata" data-mid="${v.id}" aria-label="${T('Голосовая запись')} ${i + 1}"></audio><button type="button" class="rbtn sm" data-rmv="${i}" aria-label="${T('Удалить запись')}">${ic('trash', 16)}</button></div>`).join('')}
        <div class="row2 tight"><button type="button" class="btn" data-x="photo">${ic('image', 18)}${T('Фото')}</button><button type="button" class="btn recbtn ${rec ? 'on' : ''}" data-x="rec" aria-pressed="${!!rec}">${rec ? ic('stop', 18) + T('Стоп') + ' <span id="rt" class="tnum">0:00</span>' : ic('mic', 18) + T('Голос')}</button></div>
        <input type="file" id="pf" accept="image/*" multiple hidden></div>
      <div class="fl"><span>${T('Теги')}</span><div class="chs" id="tg">${all.map((t) => `<button type="button" class="chip ${d.tags.includes(t) ? 'on' : ''}" data-t="${esc(t)}" aria-pressed="${d.tags.includes(t)}">${esc(T(t))}</button>`).join('')}</div>
        <div class="addtag"><input id="nt" type="text" maxlength="18" placeholder="${T('Свой тег')}" aria-label="${T('Свой тег')}"><button type="button" class="chip" data-addtag>${ic('plus', 14)}${T('Добавить')}</button></div></div>
      <div class="row2">${edit ? `<button type="button" class="btn danger" data-x="del">${ic('trash', 18)}${T('Удалить')}</button>` : '<span></span>'}<button type="button" class="btn primary" data-x="save">${T('Сохранить')}</button></div>`;
    const a = openSheet({
      html: body(),
      onMount: (a) => {
        const sync = () => { const t = $('#et', a.body), x = $('#ex', a.body); if (t) d.title = t.value; if (x) d.text = x.value; };
        const redo = () => { sync(); a.body.innerHTML = body(); hydrateMedia(a.body); };
        hydrateMedia(a.body);
        const stopRec = (discard) => {
          if (!rec) return;
          rec.discard = !!discard;
          try { rec.mr.stop(); } catch (e) {}
        };
        const startRec = async () => {
          if (!navigator.mediaDevices || !window.MediaRecorder) return toast(T('Запись звука не поддерживается в этом браузере'));
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
            const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
            const chunks = [], t0 = performance.now();
            rec = { mr, discard: false };
            mr.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
            mr.onstop = async () => {
              stream.getTracks().forEach((t) => t.stop());
              clearInterval(recTick);
              const r = rec; rec = null;
              if (!r.discard && chunks.length) {
                const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/mp4' });
                const id = R.uid();
                try { await R.media.put(id, blob); d.voice.push({ id, dur: Math.max(1, Math.round((performance.now() - t0) / 1000)), mime: blob.type }); fresh.push(id); } catch (e) { toast(T('Не удалось сохранить запись')); }
              }
              if (document.body.contains(a.body)) redo();
            };
            mr.start();
            recT = 0;
            recTick = setInterval(() => { recT++; const el = $('#rt', a.body); if (el) el.textContent = R.fmtDur(recT); if (recT >= 180) stopRec(); }, 1000);
            redo();
            R.haptic(15);
          } catch (e) { rec = null; toast(T('Нет доступа к микрофону')); }
        };
        a.body.addEventListener('input', (e) => {
          if (e.target.id === 'mr') {
            d.mood = +e.target.value;
            const mb = $('#mb', a.body), mn = $('#mn', a.body);
            mb.style.setProperty('--mc', R.moodColor(d.mood)); mn.textContent = d.mood;
            R.anim(mn, [{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { sp: 'bouncy', fill: 'none' });
            R.haptic(6);
          }
        });
        a.body.addEventListener('change', async (e) => {
          if (e.target.id !== 'pf') return;
          const files = [...e.target.files];
          e.target.value = '';
          for (const f of files.slice(0, 8)) {
            try { const b = await R.compressImage(f); const id = R.uid(); await R.media.put(id, b); d.photos.push(id); fresh.push(id); } catch (err) { toast(T('Не удалось добавить фото')); }
          }
          redo();
        });
        const addTag = () => { const i = $('#nt', a.body), v = i.value.trim(); if (!v) return; sync(); if (!d.tags.includes(v)) d.tags.push(v); if (!all.includes(v)) all.push(v); redo(); };
        a.body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'nt') { e.preventDefault(); addTag(); } });
        a.body.addEventListener('click', (e) => {
          const im = e.target.closest('img[data-vi]');
          if (im) return openViewer(d.photos, +im.dataset.vi);
          const t = e.target.closest('button'); if (!t) return;
          if (t.dataset.rmp != null) { sync(); d.photos.splice(+t.dataset.rmp, 1); return redo(); }
          if (t.dataset.rmv != null) { sync(); d.voice.splice(+t.dataset.rmv, 1); return redo(); }
          if (t.dataset.t != null) { sync(); const i = d.tags.indexOf(t.dataset.t); if (i >= 0) d.tags.splice(i, 1); else d.tags.push(t.dataset.t); t.classList.toggle('on'); t.setAttribute('aria-pressed', i < 0); R.anim(t, [{ transform: 'scale(.92)' }, { transform: 'scale(1)' }], { sp: 'bouncy', fill: 'none' }); R.haptic(8); return; }
          if (t.hasAttribute('data-addtag')) return addTag();
          if (t.dataset.x === 'photo') return $('#pf', a.body).click();
          if (t.dataset.x === 'rec') return rec ? stopRec() : startRec();
          if (t.dataset.x === 'save') {
            if (rec) { toast(T('Сначала остановите запись')); return; }
            sync();
            const r = { id: edit ? en.id : R.uid(), ts: d.ts, mood: d.mood, title: d.title.trim(), text: d.text.trim(), tags: d.tags, photos: d.photos, voice: d.voice };
            if (!r.photos.length) delete r.photos;
            if (!r.voice.length) delete r.voice;
            const keep = new Set(R.mediaIds(r));
            orig.filter((id) => !keep.has(id)).forEach((id) => R.media.del(id));
            fresh.filter((id) => !keep.has(id)).forEach((id) => R.media.del(id));
            if (edit) { Object.keys(en).forEach((k) => delete en[k]); Object.assign(en, r); } else S().entries.push(r);
            R.syncJournalHabits(R.dkey(new Date(r.ts)));
            saved = true;
            R.save(); R.haptic(14); a.close();
            setTimeout(() => { cur = 'journal'; setNav(true); render({ quiet: edit }); done(T('Запись сохранена')); }, 320);
          }
          if (t.dataset.x === 'del') {
            if (!confirm(T('Удалить эту запись?'))) return;
            R.mediaIds(en).forEach((id) => R.media.del(id));
            S().entries = S().entries.filter((x) => x.id !== en.id);
            R.syncJournalHabits(R.dkey(new Date(en.ts)));
            saved = true; R.save(); a.close();
            setTimeout(() => { render({ quiet: true }); toast(T('Запись удалена')); }, 320);
          }
        });
        a.onClose = () => {
          if (rec) stopRec(true);
          if (!saved) fresh.forEach((id) => R.media.del(id));
        };
      }
    });
  }

  /* ================= недельный обзор ================= */
  function openReview(off0) {
    let off = off0 === 0 ? 0 : -1;
    const html = () => {
      const rv = R.review(off), rd = Math.round((rv.rate || 0) * 100);
      const delta = rv.rate != null && rv.prevRate != null ? Math.round((rv.rate - rv.prevRate) * 100) : null;
      const key = rv.key, prevKey = R.dkey(R.addDays(rv.s, -7));
      const store = S().reviews[key] || {}, prevIntent = (S().reviews[prevKey] || {}).intent;
      const C = 2 * Math.PI * 54;
      const cor = R.correlations().filter((c) => c.delta > 0.3)[0];
      const lines = [];
      if (rv.rate == null) lines.push(T('Пока мало данных для итогов.'));
      else {
        if (delta != null && delta >= 8) lines.push(T('Отличный рост: на {n} п.п. лучше прошлой недели.', { n: delta }));
        else if (delta != null && delta <= -8) lines.push(T('Неделя была сложнее прошлой. Это нормально — выберите одну привычку и начните с неё.'));
        else lines.push(T('Стабильная неделя — ритм держится.'));
        if (rv.best && rv.best.r > 0) lines.push(T('Главная опора недели — «{n}».', { n: T(rv.best.h.name) }));
        if (cor) lines.push(T('В дни с «{n}» настроение выше на {a}.', { n: T(cor.h.name), a: R.num1(cor.delta) }));
      }
      const range = `${R.fmt(rv.s, { day: 'numeric', month: 'short' })} – ${R.fmt(rv.e, { day: 'numeric', month: 'short' })}`.replace(/\./g, '');
      return `<div class="dayhead"><h2>${T('Итоги недели')}</h2><p class="muted">${range}</p></div>
        <div class="seg" role="radiogroup"><button type="button" role="radio" aria-checked="${off === -1}" class="${off === -1 ? 'on' : ''}" data-ro="-1">${T('Прошлая')}</button><button type="button" role="radio" aria-checked="${off === 0}" class="${off === 0 ? 'on' : ''}" data-ro="0">${T('Эта неделя')}</button></div>
        <div class="rvhero"><div class="bigring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" class="rb"/><circle cx="60" cy="60" r="54" class="rf" stroke-dasharray="${((rv.rate || 0) * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/></svg><div class="bn"><span data-c="${rd}">${rd}</span>%</div></div>
          <div class="rvd"><p class="muted sm">${T('выполнено')}</p>${delta != null ? `<p class="dl ${delta >= 0 ? 'pos' : 'neg'}">${ic(delta >= 0 ? 'up' : 'down', 16, 2.4)}${delta >= 0 ? '+' : '−'}${Math.abs(delta)} ${T('п.п. к прошлой')}</p>` : ''}</div></div>
        <div class="tiles">
          <div class="tile"><p class="tl">${ic('check', 14)}${T('Отметок')}</p><div class="big sm2"><span data-c="${rv.done}">${rv.done}</span></div><p class="tf">${T('Идеальных дней')}: ${rv.perfect}</p></div>
          <div class="tile"><p class="tl">${ic('star', 14)}${T('Настроение')}</p><div class="big sm2" style="color:${rv.mood ? R.moodColor(rv.mood) : 'var(--muted)'}">${rv.mood ? R.num1(rv.mood) : '—'}</div><p class="tf">${T('Прошлая')}: ${rv.prevMood ? R.num1(rv.prevMood) : '—'}</p></div>
        </div>
        <section class="dpanel"><ul class="plain">
          ${rv.best ? `<li><span class="dot" style="background:hsl(${rv.best.h.hue} 85% 60%)"></span>${T('Лучше всего')}: <b>${esc(T(rv.best.h.name))}</b> — ${Math.round(rv.best.r * 100)}%</li>` : ''}
          ${rv.worst ? `<li><span class="dot" style="background:hsl(${rv.worst.h.hue} 85% 60%)"></span>${T('Просело')}: <b>${esc(T(rv.worst.h.name))}</b> — ${Math.round(rv.worst.r * 100)}%</li>` : ''}
          ${rv.bestDay ? `<li>${ic('sun', 15)}${T('Самый продуктивный день')}: <b>${cap(R.fmt(rv.bestDay.d, { weekday: 'long' }))}</b> (${rv.bestDay.n})</li>` : ''}
          ${rv.top ? `<li>${ic('flame', 15)}${T('Лучшая серия')}: <b>${esc(T(rv.top.h.name))}</b> — ${rv.top.n} ${unitWord(rv.top.n, rv.top.h)}</li>` : ''}
        </ul></section>
        <section class="dpanel insight"><h3>${ic('spark', 16)}${T('Вывод недели')}</h3><p>${lines.join(' ')}</p></section>
        ${prevIntent ? `<section class="dpanel"><h3>${T('Ваш фокус с прошлой недели')}</h3><p class="muted">${esc(prevIntent)}</p></section>` : ''}
        <label class="fl">${T('Фокус на следующую неделю')}<textarea id="rvi" rows="2" maxlength="160" placeholder="${T('Например: гулять каждый вечер')}">${esc(store.intent || '')}</textarea></label>
        <button type="button" class="btn primary wide" data-s="ok">${T('Готово')}</button>`;
    };
    const mark = () => { const rv = R.review(off); const r = (S().reviews[rv.key] = S().reviews[rv.key] || {}); r.seen = true; R.save(); };
    mark();
    openSheet({
      full: true,
      html: `<div class="review">${html()}</div>`,
      onMount: (a) => {
        const root = $('.review', a.body);
        const paint = (anim) => {
          root.innerHTML = html();
          $$('[data-c]', root).forEach((el) => R.countUp(el, +el.dataset.c, undefined, 1100));
          const rf = $('.bigring .rf', root);
          if (rf && anim) { const to = rf.getAttribute('stroke-dasharray'), C = 2 * Math.PI * 54; R.anim(rf, [{ strokeDasharray: `0 ${C}` }, { strokeDasharray: to }], { dur: 1200, ease: 'cubic-bezier(.3,.7,.2,1)', delay: 120 }); }
          if (anim) R.stagger($$('.tile,.dpanel,.rvhero', root), { step: 70, from: 14 });
        };
        paint(true);
        root.addEventListener('click', (e) => {
          const ro = e.target.closest('[data-ro]');
          if (ro) { off = +ro.dataset.ro; mark(); paint(true); return; }
          if (e.target.closest('[data-s=ok]')) a.close();
        });
        root.addEventListener('change', (e) => {
          if (e.target.id === 'rvi') { const rv = R.review(off); const r = (S().reviews[rv.key] = S().reviews[rv.key] || {}); r.intent = e.target.value.trim(); R.save(); }
        });
        a.onClose = () => { render({ quiet: true }); done(); };
      }
    });
  }

  /* ================= достижения ================= */
  function openAch() {
    const st = R.achStats(), un = S().ach || {};
    const n = R.ACH.filter((x) => un[x.id]).length;
    const card = (x) => {
      const on = !!un[x.id], p = !on && x.prog ? x.prog(st) : null;
      const when = on && un[x.id] !== '0' ? R.fmt(R.parse(un[x.id]), { day: 'numeric', month: 'short' }).replace('.', '') : '';
      return `<div class="ach ${on ? 'on' : ''}"><span class="aic">${ic(on ? x.icon : 'lock', 22)}</span><b>${T(x.title)}</b><small>${T(x.desc)}</small>${on ? `<em>${when}</em>` : p ? `<div class="pbar"><i style="--w:${Math.min(100, (p[0] / p[1]) * 100)}%"></i></div><em>${Math.min(p[0], p[1])} / ${p[1]}</em>` : ''}</div>`;
    };
    openSheet({
      full: true,
      html: `<div class="dhead"><span></span><h2>${T('Достижения')}</h2><button type="button" class="rbtn close" data-d="close" aria-label="${T('Закрыть')}">${ic('x', 20)}</button></div><p class="dsub center">${n} / ${R.ACH.length}</p><div class="achgrid">${R.ACH.map(card).join('')}</div>`,
      onMount: (a) => {
        R.stagger($$('.ach', a.body), { step: 35, from: 14, max: 12 });
        a.body.addEventListener('click', (e) => { if (e.target.closest('[data-d=close]')) a.close(); });
      }
    });
  }

  /* ================= старт ================= */
  function boot() {
    buildNav();
    bindEvents();
    setNav(false);
    render();
    R.anim($('#nav'), [{ transform: 'translate(-50%,90px)', opacity: 0 }, { transform: 'translate(-50%,0)', opacity: 1 }], { sp: 'soft', delay: 150 });
    R.anim($('#fab'), [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { sp: 'bouncy', delay: 450 });
    setInterval(checkReminder, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminder(); if (!stack.length && cur === 'habits') render({ quiet: true }); } });
    checkReminder();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
