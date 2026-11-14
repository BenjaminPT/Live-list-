/* Ritual — интерфейс: экраны, шторки, события */
(function () {
  const R = window.R;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = R.icon;
  const S = () => R.state;
  const TABS = [
    { id: 'habits', label: 'Привычки', icon: 'grid' },
    { id: 'journal', label: 'Дневник', icon: 'book' },
    { id: 'analyze', label: 'Анализ', icon: 'chart' },
    { id: 'more', label: 'Ещё', icon: 'sliders' }
  ];
  let cur = 'habits';
  let deferredInstall = null;
  const A = { p: 'week', off: 0 };

  /* ================= шторки ================= */
  const stack = [];
  let ignorePop = 0;

  function openSheet({ html, full = false, onMount, focus }) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap' + (full ? ' full' : '');
    wrap.innerHTML = `<div class="backdrop"></div><section class="sheet" role="dialog" aria-modal="true"><div class="grab" aria-hidden="true"><i></i></div><div class="sheet-body">${html}</div></section>`;
    $('#sheets').appendChild(wrap);
    const sheet = $('.sheet', wrap), back = $('.backdrop', wrap);
    const api = { el: wrap, sheet, body: $('.sheet-body', wrap), close: (pop) => closeSheet(api, pop) };
    stack.push(api);
    history.pushState({ r: stack.length }, '');
    document.body.classList.add('sheet-open');
    R.anim(back, [{ opacity: 0 }, { opacity: 1 }], { dur: 240, ease: 'ease-out' });
    R.anim(sheet, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { sp: 'soft' });
    if (full) R.anim($('#view'), [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.94)', opacity: 0.5 }], { dur: 320, ease: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    bindDrag(api);
    onMount && onMount(api);
    if (focus) setTimeout(() => { const f = $(focus, sheet); f && f.focus({ preventScroll: true }); }, 350);
    return api;
  }

  function closeSheet(api, fromPop) {
    const i = stack.indexOf(api);
    if (i < 0) return;
    stack.splice(i, 1);
    if (!fromPop) { ignorePop++; history.back(); }
    const sheet = api.sheet, cs = getComputedStyle(sheet).transform;
    const from = cs && cs !== 'none' ? cs : 'translateY(0)';
    R.anim(sheet, [{ transform: from }, { transform: 'translateY(105%)' }], { dur: 240, ease: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' });
    R.anim($('.backdrop', api.el), [{ opacity: 1 }, { opacity: 0 }], { dur: 240, fill: 'forwards' });
    if (api.full || api.el.classList.contains('full')) {
      if (!stack.some((s) => s.el.classList.contains('full'))) {
        R.anim($('#view'), [{ transform: 'scale(.94)', opacity: 0.5 }, { transform: 'scale(1)', opacity: 1 }], { dur: 300, ease: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).finished.then(() => { $('#view').getAnimations().forEach((a) => a.cancel()); });
      }
    }
    setTimeout(() => {
      api.el.remove();
      if (!stack.length) document.body.classList.remove('sheet-open');
      if (api.onClose) api.onClose();
    }, R.reduced() ? 0 : 250);
  }
  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop--; return; }
    const top = stack[stack.length - 1];
    if (top) closeSheet(top, true);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close();
  });

  function bindDrag(api) {
    const grab = $('.grab', api.el), sheet = api.sheet;
    let y0 = 0, dy = 0, t0 = 0, on = false;
    grab.addEventListener('pointerdown', (e) => { on = true; y0 = e.clientY; t0 = performance.now(); dy = 0; grab.setPointerCapture(e.pointerId); sheet.style.transition = 'none'; });
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
    el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button" class="undo">Отменить</button>' : ''}`;
    el.classList.add('show');
    R.anim(el, [{ opacity: 0, transform: 'translate(-50%,16px) scale(.96)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], { sp: 'bouncy' });
    clearTimeout(toastT);
    const hide = () => {
      R.anim(el, [{ opacity: 1 }, { opacity: 0 }], { dur: 180, fill: 'forwards' }).finished.then(() => { el.classList.remove('show'); el.getAnimations().forEach((a) => a.cancel()); });
    };
    toastT = setTimeout(hide, 4200);
    const b = $('.undo', el);
    if (b) b.onclick = () => { undo(); hide(); };
  }
  R.toast = toast;

  /* ================= навигация ================= */
  function buildNav() {
    $('#nav').innerHTML = `<div class="nav-in"><div class="nav-ind"></div>${TABS.map((t) => `<button type="button" data-tab="${t.id}" aria-label="${t.label}"><span>${ic(t.icon, 22)}</span><b>${t.label}</b></button>`).join('')}</div>`;
    $('#nav').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b && b.dataset.tab !== cur) go(b.dataset.tab);
    });
  }
  function setNav(animate) {
    const i = TABS.findIndex((t) => t.id === cur), ind = $('.nav-ind');
    const from = ind._i == null ? i : ind._i;
    ind.style.transform = `translateX(${i * 100}%)`;
    if (animate && from !== i) R.anim(ind, [{ transform: `translateX(${from * 100}%) scaleX(1.12)` }, { transform: `translateX(${i * 100}%) scaleX(1)` }], { sp: 'bouncy', fill: 'none' });
    ind._i = i;
    $$('#nav [data-tab]').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === cur ? 'page' : 'false'));
    const fab = $('#fab'), show = cur === 'habits' || cur === 'journal';
    fab.setAttribute('aria-label', cur === 'journal' ? 'Новая запись' : 'Новая привычка');
    fab.classList.toggle('hide', !show);
  }
  function go(tab) {
    const dir = TABS.findIndex((t) => t.id === tab) > TABS.findIndex((t) => t.id === cur) ? 1 : -1;
    cur = tab;
    setNav(true);
    window.scrollTo(0, 0);
    render({ dir });
  }

  /* ================= экраны ================= */
  const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'; };
  const dayLabel = () => { const s = R.fmt(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };

  function ring(done, total) {
    const C = 2 * Math.PI * 22, p = total ? done / total : 0;
    return `<div class="ring" role="img" aria-label="Выполнено ${done} из ${total}"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="22" class="rb"/><circle cx="26" cy="26" r="22" class="rf" stroke-dasharray="${(p * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 26 26)"/></svg><b>${done}<small>/${total}</small></b></div>`;
  }

  function cardHTML(h) {
    const tk = R.dkey(R.today()), p = R.progress(h, tk), done = p >= 1, l = R.getLog(h, tk) || {};
    const st = R.streak(h), g = R.heatGrid(h, 9, 0);
    let label;
    if (h.type === 'avoid') label = l.slip ? 'Был срыв' : 'Держусь';
    else if (h.type === 'count') label = done ? 'Готово' : `+1 · ${l.v || 0}/${h.target}`;
    else label = done ? 'Выполнено' : 'Отметить';
    const cls = h.type === 'avoid' ? (l.slip ? 'slip' : 'done') : done ? 'done' : '';
    const exc = R.isExcused(h, tk) && !done;
    return `<article class="card" data-id="${h.id}" style="--h:${h.hue}" tabindex="0" role="button" aria-label="${esc(h.name)}, открыть подробности">
      <div class="card-top"><span class="ci">${ic(h.icon, 17)}</span><span class="cn">${esc(h.name)}</span>${st ? `<span class="cs" title="Серия">${ic('flame', 13)}${st}</span>` : ''}</div>
      <div class="mini" style="--cols:9">${g.cells}</div>
      <button type="button" class="chk ${cls}" data-act="check" style="--p:${h.type === 'count' ? p : done ? 1 : 0}" aria-pressed="${done}">${done && h.type !== 'avoid' ? ic('check', 18, 2.6) : ''}<span>${exc ? 'Пропуск учтён' : label}</span></button></article>`;
  }

  function habitsView() {
    const tk = R.dkey(R.today()), heavy = !!S().heavy[tk];
    const hs = R.activeHabits().filter((h) => !heavy || h.core);
    const done = hs.filter((h) => R.isDone(h, tk)).length;
    const nm = S().settings.name;
    return `<header class="top"><div><p class="eyebrow">${dayLabel()}</p><h1>${greet()}${nm ? ', ' + esc(nm) : ''}</h1></div><div id="ringbox">${ring(done, hs.length)}</div></header>
      <div class="chips-row">
        <button type="button" class="chip ${heavy ? 'on' : ''}" data-act="heavy" aria-pressed="${heavy}">${ic('snow', 16)}Тяжёлый день</button>
        ${S().settings.demo ? '<button type="button" class="chip ghost" data-act="cleardemo">Демо-данные · начать с нуля</button>' : ''}
      </div>
      ${heavy ? '<p class="note">Режим тяжёлого дня: остались только главные привычки, остальные не прервут серии.</p>' : ''}
      ${hs.length ? `<section class="grid" id="grid">${hs.map(cardHTML).join('')}</section>` : `<div class="empty">${ic('spark', 34)}<p>Пока нет привычек. Нажмите «+», чтобы создать первую.</p></div>`}`;
  }

  function journalView() {
    const es = [...S().entries].sort((a, b) => b.ts - a.ts);
    const st = R.entryStreak();
    let html = `<header class="top"><div><p class="eyebrow">${R.fmt(new Date(), { month: 'long', year: 'numeric' }).replace(/ г\./, '')}</p><h1>Дневник</h1></div><div class="badge" title="Дней подряд с записью">${ic('flame', 16)}<b>${st}</b></div></header>`;
    if (!es.length) return html + `<div class="empty">${ic('book', 34)}<p>Здесь будут ваши записи с оценкой настроения. Нажмите «+».</p></div>`;
    let month = '';
    es.forEach((e) => {
      const d = new Date(e.ts), m0 = R.fmt(d, { month: 'long', year: 'numeric' }).replace(/ г\./, ''), m = m0.charAt(0).toUpperCase() + m0.slice(1);
      if (m !== month) { month = m; html += `<h2 class="month">${m}</h2>`; }
      const c = R.moodColor(e.mood);
      const dt = R.fmt(d, { weekday: 'short' }) + ' ' + R.pad(d.getHours()) + ':' + R.pad(d.getMinutes());
      html += `<article class="entry" data-eid="${e.id}" style="--mc:${c}" tabindex="0" role="button" aria-label="Запись: ${esc(e.title)}, настроение ${e.mood}">
        <div class="eh"><span>${dt}</span></div><div class="et">${esc(e.title || 'Без названия')}</div>${e.text ? `<p class="ent">${esc(e.text)}</p>` : ''}
        <div class="tags">${(e.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div><div class="em">${e.mood}</div></article>`;
    });
    return html;
  }

  function rangeOf(p, off) {
    const t = R.today();
    if (p === 'week') { const s = R.addDays(R.weekStart(t), off * 7); return { s, e: R.addDays(s, 6) }; }
    if (p === 'month') { const s = new Date(t.getFullYear(), t.getMonth() + off, 1); return { s, e: new Date(s.getFullYear(), s.getMonth() + 1, 0) }; }
    const y = t.getFullYear() + off;
    return { s: new Date(y, 0, 1), e: new Date(y, 11, 31) };
  }
  function rangeLabel(p, off) {
    const { s, e } = rangeOf(p, off);
    if (p === 'week') return s.getMonth() === e.getMonth() ? `${s.getDate()}–${e.getDate()} ${R.fmt(e, { month: 'short' }).replace('.', '')}` : `${s.getDate()} ${R.fmt(s, { month: 'short' }).replace('.', '')}–${e.getDate()} ${R.fmt(e, { month: 'short' }).replace('.', '')}`;
    if (p === 'month') { const m = R.fmt(s, { month: 'long' }); return m.charAt(0).toUpperCase() + m.slice(1); }
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

    /* теги */
    const tg = {};
    es.forEach((x) => (x.tags || []).forEach((t) => (tg[t] = tg[t] || []).push(x.mood)));
    const tags = Object.entries(tg).sort((x, y) => y[1].length - x[1].length).slice(0, 6);

    /* итоги по привычкам */
    const rates = R.activeHabits().map((h) => ({ h, r: R.habitRate(h, s, e) })).filter((x) => x.r != null).sort((x, y) => y.r - x.r);
    const total = rates.length ? Math.round(R.avg(rates.map((x) => x.r)) * 100) : null;
    const prRates = R.activeHabits().map((h) => R.habitRate(h, pr.s, pr.e)).filter((x) => x != null);
    const ptotal = prRates.length ? Math.round(R.avg(prRates) * 100) : null;
    const best = rates[0], worst = rates.length > 1 ? rates[rates.length - 1] : null;

    /* влияние на настроение */
    const cor = R.correlations().slice(0, 5);
    const mx = Math.max(1, ...cor.map((c) => Math.abs(c.delta)));

    /* причины пропусков */
    const rs = {};
    R.activeHabits().forEach((h) => {
      const L = S().logs[h.id] || {};
      Object.keys(L).forEach((k) => { if (L[k].miss && k >= R.dkey(s) && k <= R.dkey(e)) rs[L[k].miss] = (rs[L[k].miss] || 0) + 1; });
    });
    const rsl = Object.entries(rs).sort((x, y) => y[1] - x[1]);
    const rmax = Math.max(1, ...rsl.map((x) => x[1]));

    return `<header class="top"><div><p class="eyebrow">Настроение и привычки</p><h1>Анализ</h1></div>
      <label class="select"><select id="per" aria-label="Период"><option value="week" ${A.p === 'week' ? 'selected' : ''}>Неделя</option><option value="month" ${A.p === 'month' ? 'selected' : ''}>Месяц</option><option value="year" ${A.p === 'year' ? 'selected' : ''}>Год</option></select>${ic('chevD', 14)}</label></header>
      <div class="rchips" id="rchips">${chips.join('')}</div>
      <section class="panel"><h3>Настроение по времени</h3><div id="chartbox">${R.moodChart(pts, n, labels)}</div>${pts.length ? '' : '<p class="muted center">За этот период записей нет</p>'}</section>
      <section class="tiles">
        <div class="tile"><p class="tl">${ic('star', 14)}Средняя оценка</p><div class="big" style="color:${a ? R.moodColor(a) : 'var(--muted)'}"><span data-count="${a}" data-dec="1">${a ? R.num1(a) : '—'}</span><em class="tr ${trend(a, pa)}">${ic(trend(a, pa), 18, 2.4)}</em></div><p class="tf">Прошлый период: ${pa ? R.num1(pa) : '—'}</p></div>
        <div class="tile"><p class="tl">${ic('list', 14)}Всего записей</p><div class="big"><span data-count="${es.length}">${es.length}</span><em class="tr ${trend(es.length, pes.length)}">${ic(trend(es.length, pes.length), 18, 2.4)}</em></div><p class="tf">Прошлый период: ${pes.length}</p></div>
      </section>
      <section class="panel"><h3>Итоги привычек</h3>${total == null ? '<p class="muted">Пока недостаточно данных.</p>' : `<div class="sum"><div class="sumbig"><span data-count="${total}">${total}</span>%</div><p>выполнено${ptotal != null ? ` · ${total >= ptotal ? '+' : '−'}${Math.abs(total - ptotal)} п.п. к прошлому периоду` : ''}</p></div>
        <ul class="plain">${best ? `<li><span class="dot" style="background:hsl(${best.h.hue} 85% 60%)"></span>Лучше всего: <b>${esc(best.h.name)}</b> — ${Math.round(best.r * 100)}%</li>` : ''}${worst ? `<li><span class="dot" style="background:hsl(${worst.h.hue} 85% 60%)"></span>Просело: <b>${esc(worst.h.name)}</b> — ${Math.round(worst.r * 100)}%</li>` : ''}</ul>`}</section>
      <section class="panel"><h3>Что вы делали</h3>${tags.length ? `<div class="tg3">${tags.map(([t, v]) => `<div class="tgi"><span>${esc(t)}</span><div class="dots">${v.slice(0, 5).map((m) => `<i style="background:${R.moodColor(m)}"></i>`).join('')}</div><small>${v.length}× · ср. ${R.num1(R.avg(v))}</small></div>`).join('')}</div>` : '<p class="muted">Добавляйте теги к записям дневника — здесь появится статистика.</p>'}</section>
      <section class="panel"><h3>Как привычки влияют на настроение</h3><p class="muted sm">Разница средней оценки в дни с привычкой и без неё</p>${cor.length ? `<ul class="cor">${cor.map((c) => `<li><span class="cn2" style="--h:${c.h.hue}">${ic(c.h.icon, 16)}${esc(c.h.name)}</span><div class="bar"><i class="${c.delta >= 0 ? 'pos' : 'neg'}" style="--w:${Math.max(4, (Math.abs(c.delta) / mx) * 100)}%"></i></div><b class="${c.delta >= 0 ? 'pos' : 'neg'}">${c.delta >= 0 ? '+' : '−'}${R.num1(Math.abs(c.delta))}</b></li>`).join('')}</ul>` : '<p class="muted">Нужно хотя бы по 3 дня с записью и без привычки.</p>'}</section>
      ${rsl.length ? `<section class="panel"><h3>Причины пропусков</h3><ul class="cor">${rsl.map(([k, v]) => `<li><span class="cn2">${R.MISS[k].label}${R.MISS[k].excuse ? ' <small class="ok">серия сохранена</small>' : ''}</span><div class="bar"><i class="pos" style="--w:${(v / rmax) * 100}%"></i></div><b>${v}</b></li>`).join('')}</ul></section>` : ''}`;
  }

  function moreView() {
    const st = S().settings, arch = S().habits.filter((h) => h.archived);
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    return `<header class="top"><div><p class="eyebrow">Ritual</p><h1>Ещё</h1></div></header>
      <section class="panel form"><h3>Профиль</h3><label class="fl">Как к вам обращаться<input id="nm" type="text" maxlength="24" value="${esc(st.name)}" placeholder="Имя" autocomplete="given-name"></label></section>
      <section class="panel form"><h3>Напоминание</h3>
        <label class="fl">Ежедневно в<input id="rm" type="time" value="${esc(st.remind || '')}"></label>
        <p class="muted sm">${perm === 'unsupported' ? 'Браузер не поддерживает уведомления.' : perm === 'denied' ? 'Уведомления запрещены в настройках браузера.' : 'Напоминание сработает, пока приложение открыто или установлено на устройство. Для 100% надёжности добавьте будильник в системе.'}</p></section>
      <section class="panel form"><h3>Приложение</h3>
        <label class="sw"><span>Вибрация при отметках</span><input type="checkbox" role="switch" id="hp" ${st.haptics !== false ? 'checked' : ''}><i></i></label>
        ${deferredInstall ? `<button type="button" class="btn wide" data-act="install">${ic('install', 18)}Установить как приложение</button>` : '<p class="muted sm">Установка: в Chrome/Edge — значок «Установить» в адресной строке, в Safari — «Поделиться» → «На экран Домой».</p>'}</section>
      <section class="panel form"><h3>Данные</h3><p class="muted sm">Всё хранится только на этом устройстве. Делайте экспорт, чтобы перенести данные или сохранить копию.</p>
        <div class="row2"><button type="button" class="btn" data-act="export">${ic('download', 18)}Экспорт</button><button type="button" class="btn" data-act="import">${ic('upload', 18)}Импорт</button></div>
        <input type="file" id="imp" accept="application/json,.json" hidden>
        <button type="button" class="btn danger wide" data-act="reset">${ic('trash', 18)}Удалить все данные</button></section>
      ${arch.length ? `<section class="panel"><h3>Архив</h3><ul class="plain">${arch.map((h) => `<li class="arch"><span class="cn2" style="--h:${h.hue}">${ic(h.icon, 16)}${esc(h.name)}</span><button type="button" class="chip" data-restore="${h.id}">Вернуть</button></li>`).join('')}</ul></section>` : ''}
      <p class="muted center sm foot">Ritual · офлайн-приложение · версия 1.0</p>`;
  }

  const VIEWS = { habits: habitsView, journal: journalView, analyze: analyzeView, more: moreView };

  function render(o = {}) {
    const v = $('#view');
    v.innerHTML = VIEWS[cur]();
    const anim = !o.quiet;
    if (anim) R.anim(v, [{ opacity: 0, transform: `translateX(${(o.dir || 0) * 28}px)` }, { opacity: 1, transform: 'translateX(0)' }], { sp: 'soft' });
    after(anim);
  }

  function after(anim) {
    const v = $('#view');
    if (cur === 'habits') {
      if (anim) {
        R.stagger($$('.card', v), { step: 45, from: 22, scale: 0 });
        $$('.mini', v).forEach((m, mi) => $$('.cell', m).forEach((c) => R.anim(c, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { sp: 'bouncy', delay: 120 + mi * 45 + (+c.style.getPropertyValue('--c')) * 14 })));
        ringAnim();
      }
    }
    if (cur === 'journal' && anim) R.stagger($$('.entry', v), { step: 50, from: 20 });
    if (cur === 'analyze') {
      const rc = $('#rchips'); if (rc) rc.scrollLeft = rc.scrollWidth;
      $$('[data-count]', v).forEach((el) => { const dec = el.dataset.dec; R.countUp(el, +el.dataset.count, (n) => (dec ? R.num1(n) : String(Math.round(n)))); });
      drawChart();
      if (anim) R.stagger($$('.panel,.tile', v), { step: 55, from: 18 });
    }
    if (cur === 'more') {
      if (anim) R.stagger($$('.panel', v), { step: 50, from: 16 });
      const nm = $('#nm'); if (nm) nm.oninput = () => { S().settings.name = nm.value.trim(); R.save(); };
      const rm = $('#rm');
      if (rm) rm.onchange = async () => {
        S().settings.remind = rm.value; R.save();
        if (rm.value && 'Notification' in window && Notification.permission === 'default') { await Notification.requestPermission(); render({ quiet: true }); }
        toast(rm.value ? `Напомню в ${rm.value}` : 'Напоминание выключено');
      };
      const hp = $('#hp'); if (hp) hp.onchange = () => { S().settings.haptics = hp.checked; R.save(); if (hp.checked) R.haptic(20); };
      const imp = $('#imp'); if (imp) imp.onchange = importFile;
    }
  }

  function ringAnim() {
    const f = $('#ringbox .rf');
    if (!f) return;
    const to = f.getAttribute('stroke-dasharray'), C = 2 * Math.PI * 22;
    R.anim(f, [{ strokeDasharray: `0 ${C}` }, { strokeDasharray: to }], { sp: 'soft', delay: 200 });
  }

  function drawChart() {
    const line = $('#chartbox .line');
    if (line && !R.reduced()) {
      const len = line.getTotalLength ? line.getTotalLength() : 600;
      line.style.strokeDasharray = len;
      R.anim(line, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { dur: 1100, ease: 'cubic-bezier(.4,0,.2,1)', delay: 150 }).finished.then(() => { line.style.strokeDasharray = ''; }).catch(() => {});
    }
    $$('#chartbox .pt').forEach((p) => R.anim(p, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { sp: 'bouncy', delay: 300 + (+p.style.getPropertyValue('--i')) * 70 }));
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
    if (popChanged && last) R.anim(last, [{ transform: 'scale(.2)' }, { transform: 'scale(1)' }], { sp: 'bouncy', fill: 'none' });
    const btn = $('.chk', nw);
    if (btn) R.anim(btn, [{ transform: 'scale(.92)' }, { transform: 'scale(1)' }], { sp: 'bouncy', fill: 'none' });
    const tk = R.dkey(R.today());
    const hs = R.activeHabits().filter((x) => !S().heavy[tk] || x.core);
    const rb = $('#ringbox');
    if (rb) { rb.innerHTML = ring(hs.filter((x) => R.isDone(x, tk)).length, hs.length); ringAnim(); }
  }

  /* ================= события ================= */
  function bindEvents() {
    $('#view').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (act) {
        e.stopPropagation();
        const a = act.dataset.act;
        if (a === 'check') {
          const card = act.closest('.card'), h = S().habits.find((x) => x.id === card.dataset.id);
          const before = R.isDone(h, R.dkey(R.today())), l0 = R.getLog(h, R.dkey(R.today())) || {};
          const snap = JSON.parse(JSON.stringify(l0));
          R.checkIn(h);
          const after = R.isDone(h, R.dkey(R.today()));
          const slipNow = h.type === 'avoid' && (R.getLog(h, R.dkey(R.today())) || {}).slip;
          refreshCard(h, true);
          const nb = $(`.card[data-id="${h.id}"] .chk`);
          if ((after && !before && h.type !== 'avoid') || (h.type === 'count' && after)) { R.burst(nb, h.hue); R.haptic([14, 40, 18]); }
          else R.haptic(10);
          if (h.type === 'avoid' && slipNow) toast('Срыв отмечен. Серия начнётся заново', () => { R.setLog(h, R.dkey(R.today()), { slip: null, v: null }); refreshCard(h, false); });
          else if (before && !after) toast('Отметка снята', () => { R.state.logs[h.id][R.dkey(R.today())] = snap; if (!Object.keys(snap).length) delete R.state.logs[h.id][R.dkey(R.today())]; R.save(); refreshCard(h, true); });
          return;
        }
        if (a === 'heavy') {
          const k = R.dkey(R.today());
          if (S().heavy[k]) delete S().heavy[k]; else S().heavy[k] = true;
          R.save(); R.haptic(14); render({ quiet: false }); toast(S().heavy[k] ? 'Тяжёлый день: сегодня только главное' : 'Обычный режим'); return;
        }
        if (a === 'cleardemo') { if (confirm('Удалить демо-данные и начать с чистого листа?')) { R.replaceState({ v: 1, habits: [], logs: {}, entries: [], heavy: {}, settings: { name: '', demo: false, haptics: true, remind: '' } }); render(); } return; }
        if (a === 'install' && deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; render({ quiet: true }); }); return; }
        if (a === 'export') return exportData();
        if (a === 'import') return $('#imp').click();
        if (a === 'reset') { if (confirm('Удалить все привычки, записи и настройки? Это нельзя отменить.')) { R.replaceState({ v: 1, habits: [], logs: {}, entries: [], heavy: {}, settings: { name: '', demo: false, haptics: true, remind: '' } }); toast('Данные удалены'); render(); } return; }
      }
      const rc = e.target.closest('.rc');
      if (rc) { A.off = +rc.dataset.off; render({ quiet: true }); const box = $('#chartbox'); R.anim(box, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { sp: 'soft' }); return; }
      const rs = e.target.closest('[data-restore]');
      if (rs) { const h = S().habits.find((x) => x.id === rs.dataset.restore); h.archived = false; R.save(); render({ quiet: true }); toast('Привычка возвращена'); return; }
      const card = e.target.closest('.card');
      if (card) return openDetail(S().habits.find((x) => x.id === card.dataset.id));
      const en = e.target.closest('.entry');
      if (en) return openEntry(S().entries.find((x) => x.id === en.dataset.eid));
    });
    $('#view').addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && (e.target.matches('.card') || e.target.matches('.entry'))) { e.preventDefault(); e.target.click(); }
    });
    $('#view').addEventListener('change', (e) => {
      if (e.target.id === 'per') { A.p = e.target.value; A.off = 0; render({ quiet: true }); R.anim($('#chartbox'), [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { sp: 'soft' }); }
    });
    $('#fab').addEventListener('click', () => (cur === 'journal' ? openEntry() : openHabitEditor()));
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; if (cur === 'more') render({ quiet: true }); });
  }

  /* ================= экспорт / импорт ================= */
  function exportData() {
    const blob = new Blob([JSON.stringify(S(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ritual-backup-${R.dkey(R.today())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Копия данных сохранена');
  }
  function importFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.habits) || typeof d.logs !== 'object') throw new Error('bad');
        if (!confirm('Заменить текущие данные данными из файла?')) return;
        d.entries = d.entries || []; d.heavy = d.heavy || {};
        d.settings = Object.assign({ name: '', demo: false, haptics: true, remind: '' }, d.settings);
        R.replaceState(d); toast('Данные импортированы'); render();
      } catch (err) { toast('Не удалось прочитать файл'); }
    };
    r.readAsText(f);
    e.target.value = '';
  }

  /* ================= детали привычки ================= */
  const dowHead = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'].map((x) => `<span>${x}</span>`).join('');
  const fmtLong = (k) => { const s = R.fmt(R.parse(k), { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };

  function openDetail(h) {
    let off = 0;
    const WEEKS = 20;
    const html = () => {
      const st = R.stats(h), g = R.heatGrid(h, WEEKS, off), wr = R.weekdayRates(h);
      const range = `${R.fmt(g.start, { day: 'numeric', month: 'short', year: 'numeric' })} — ${R.fmt(g.end > R.today() ? R.today() : g.end, { day: 'numeric', month: 'short', year: 'numeric' })}`.replace(/ г\./g, '');
      const L = S().logs[h.id] || {}, keys = Object.keys(L).filter((k) => L[k].v || L[k].miss || L[k].note || L[k].slip).sort().reverse().slice(0, 80);
      let rec = '', mon = '';
      keys.forEach((k) => {
        const l = L[k], m = R.fmt(R.parse(k), { month: 'long', year: 'numeric' });
        if (m !== mon) { mon = m; rec += `<h4 class="rm">${m.charAt(0).toUpperCase() + m.slice(1)}</h4>`; }
        const meta = l.slip ? '<span class="rtag bad">Срыв</span>' : l.miss ? `<span class="rtag ${R.MISS[l.miss].excuse ? 'ok' : ''}">${R.MISS[l.miss].label}</span>` : l.v ? (h.type === 'count' ? `${l.v} ${esc(h.unit)}` : l.t != null ? R.fmtTime(l.t) : '✓') : '';
        rec += `<button type="button" class="rec" data-day="${k}"><span>${R.fmt(R.parse(k), { day: 'numeric', month: 'short' }).replace('.', '')}</span><em>${l.note ? esc(l.note) : ''}</em><b>${meta}</b></button>`;
      });
      const unit = R.streakUnit(h);
      return `<div class="dhead"><button type="button" class="rbtn" data-d="edit" aria-label="Редактировать">${ic('pencil', 18)}</button><h2><span class="ci2">${ic(h.icon, 20)}</span>${esc(h.name)}</h2><button type="button" class="rbtn close" data-d="close" aria-label="Закрыть">${ic('x', 20)}</button></div>
      <div class="heatpanel"><div class="hw"><div class="dow">${dowHead}</div><div class="heat" style="--cols:${WEEKS}" id="heat">${g.cells}</div></div>
        <div class="hf"><button type="button" class="rbtn sm" data-d="prev" aria-label="Раньше">${ic('chevL', 16)}</button><span>${range}</span><button type="button" class="rbtn sm" data-d="next" aria-label="Позже" ${off >= 0 ? 'disabled' : ''}>${ic('chevR', 16)}</button></div></div>
      <div class="tiles4">
        <div class="tile"><p class="tl">${ic('flame', 14)}Серия</p><div class="big"><span data-c="${st.streak}">${st.streak}</span></div><p class="tf">Лучшая: ${st.longest} ${unit}</p></div>
        <div class="tile"><p class="tl">${ic('check', 14)}Всего отметок</p><div class="big"><span data-c="${st.total}">${st.total}</span></div><p class="tf">С ${R.fmt(R.parse(st.started), { day: 'numeric', month: 'short' }).replace('.', '')}</p></div>
        <div class="tile"><p class="tl">${ic('clock', 14)}Обычно в</p><div class="big sm2">${st.avgT != null ? R.fmtTime(st.avgT) : '—'}</div><p class="tf">среднее время отметки</p></div>
        <div class="tile"><p class="tl">${ic('trophy', 14)}Цель 30 дней</p><div class="big"><span data-c="${Math.round(st.goal * 100)}">${Math.round(st.goal * 100)}</span>%</div><div class="pbar"><i style="--w:${st.goal * 100}%"></i></div><p class="tf">${st.c30} из ${st.target30}</p></div>
      </div>
      <section class="dpanel"><h3>Лучшие дни недели</h3><div class="wd">${wr.map((r, i) => `<div><i style="--hh:${Math.max(6, r * 100)}%"></i><span>${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i]}</span></div>`).join('')}</div></section>
      <h3 class="rt">Записи</h3><div class="recs">${rec || '<p class="muted">Пока пусто — нажмите на клетку календаря, чтобы отметить день.</p>'}</div>`;
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
            $$('.cell', root).forEach((c) => R.anim(c, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { sp: 'bouncy', delay: 60 + (+c.style.getPropertyValue('--c')) * 12 }));
            R.stagger($$('.tile,.dpanel,.heatpanel', root), { step: 55, from: 16 });
            $$('.wd i', root).forEach((i, n) => R.anim(i, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { sp: 'bouncy', delay: 250 + n * 40 }));
            $$('.pbar i', root).forEach((i) => R.anim(i, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { sp: 'soft', delay: 300 }));
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
    api.full = true;
    api.onClose = () => { render({ quiet: true }); };
    detailApi = api;
  }
  let detailApi = null;

  /* ================= правка дня ================= */
  function openDay(h, k, done) {
    const paint = () => {
      const l = R.getLog(h, k) || {}, isDone = R.isDone(h, k);
      const future = k > R.dkey(R.today());
      let ctl;
      if (h.type === 'count') ctl = `<div class="stepper"><button type="button" data-s="-1" aria-label="Меньше" ${!l.v ? 'disabled' : ''}>${ic('plus', 22).replace('M12 5v14M5 12h14', 'M5 12h14')}</button><div class="sv"><b>${l.v || 0}</b><small>из ${h.target} ${esc(h.unit)}</small></div><button type="button" data-s="1" aria-label="Больше">${ic('plus', 22)}</button></div>`;
      else if (h.type === 'avoid') ctl = `<button type="button" class="bigtog ${l.slip ? 'bad' : 'on'}" data-s="slip" aria-pressed="${!!l.slip}">${l.slip ? 'Был срыв' : 'Держался'}<small>нажмите, чтобы изменить</small></button>`;
      else ctl = `<button type="button" class="bigtog ${isDone ? 'on' : ''}" data-s="tog" aria-pressed="${isDone}">${isDone ? ic('check', 22, 2.6) + 'Выполнено' : 'Не выполнено'}<small>нажмите, чтобы изменить</small></button>`;
      const showMiss = !isDone && h.type !== 'avoid' && !future;
      const grp = (ex) => Object.entries(R.MISS).filter(([, m]) => m.excuse === ex).map(([key, m]) => `<button type="button" class="chip ${l.miss === key ? 'on' : ''}" data-m="${key}" aria-pressed="${l.miss === key}">${m.label}</button>`).join('');
      return `<div style="--h:${h.hue}"><div class="dayhead"><h2>${fmtLong(k)}</h2><p class="muted">${esc(h.name)}</p></div>${future ? '<p class="muted">Этот день ещё не наступил.</p>' : ctl}
        ${showMiss ? `<div class="miss"><p class="ml">Почему пропустили?</p><p class="ms">Уважительная причина — серия сохранится</p><div class="chs">${grp(true)}</div><p class="ms">Обычный пропуск — серия прервётся</p><div class="chs">${grp(false)}</div></div>` : ''}
        ${future ? '' : `<label class="fl">Заметка<textarea id="dn" rows="2" maxlength="200" placeholder="Как прошло?">${esc(l.note || '')}</textarea></label>`}
        <button type="button" class="btn primary wide" data-s="ok">Готово</button></div>`;
    };
    const a = openSheet({
      html: paint(),
      onMount: (a) => {
        const apply = (fn) => { fn(); R.haptic(12); a.body.innerHTML = paint(); done && done(); const ch = $('.bigtog,.stepper .sv', a.body); ch && R.anim(ch, [{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { sp: 'bouncy', fill: 'none' }); };
        a.body.addEventListener('click', (e) => {
          const s = e.target.closest('[data-s]');
          const m = e.target.closest('[data-m]');
          const now = new Date(), tm = k === R.dkey(R.today()) ? now.getHours() * 60 + now.getMinutes() : null;
          if (m) return apply(() => { const l = R.getLog(h, k) || {}; R.setLog(h, k, { miss: l.miss === m.dataset.m ? null : m.dataset.m, v: null, t: null }); });
          if (!s) return;
          const v = s.dataset.s, l = R.getLog(h, k) || {};
          if (v === 'ok') return a.close();
          if (v === 'tog') return apply(() => R.setLog(h, k, l.v ? { v: null, t: null } : { v: 1, t: tm, miss: null }));
          if (v === 'slip') return apply(() => R.setLog(h, k, l.slip ? { slip: null, v: null } : { slip: true, v: 0 }));
          if (v === '1' || v === '-1') return apply(() => { const nv = Math.max(0, (l.v || 0) + +v); R.setLog(h, k, { v: nv || null, t: nv ? (l.t != null ? l.t : tm) : null, miss: nv ? null : l.miss }); });
        });
        a.body.addEventListener('change', (e) => { if (e.target.id === 'dn') { R.setLog(h, k, { note: e.target.value.trim() || null }); done && done(); } });
      }
    });
    a.onClose = () => { done && done(); };
  }

  /* ================= редактор привычки ================= */
  function openHabitEditor(h) {
    const edit = !!h;
    const d = h ? { ...h } : { name: '', icon: 'spark', hue: 350, type: 'check', target: 8, unit: 'раз', perWeek: 7, core: false };
    const body = () => `<div class="dayhead"><h2>${edit ? 'Редактировать' : 'Новая привычка'}</h2></div>
      <label class="fl">Название<input id="hn" type="text" maxlength="32" value="${esc(d.name)}" placeholder="Например, Утренняя зарядка" autocomplete="off"><small class="err" id="her" role="alert"></small></label>
      <div class="fl"><span>Тип</span><div class="seg" role="radiogroup">${[['check', 'Отметка'], ['count', 'Счётчик'], ['avoid', 'Воздержание']].map(([v, t]) => `<button type="button" role="radio" aria-checked="${d.type === v}" class="${d.type === v ? 'on' : ''}" data-ty="${v}">${t}</button>`).join('')}</div>
        <small class="muted">${{ check: 'Сделал — отметил.', count: 'Например, 8 стаканов воды: считаем по нажатиям.', avoid: 'Каждый день засчитывается сам, пока вы не отметите срыв.' }[d.type]}</small></div>
      ${d.type === 'count' ? `<div class="row2"><label class="fl">Цель в день<input id="ht" type="number" min="1" max="999" inputmode="numeric" value="${d.target}"></label><label class="fl">Единица<input id="hu" type="text" maxlength="10" value="${esc(d.unit)}"></label></div>` : ''}
      ${d.type !== 'avoid' ? `<div class="fl"><span>Цель в неделю</span><div class="stepper sm"><button type="button" data-pw="-1" aria-label="Меньше" ${d.perWeek <= 1 ? 'disabled' : ''}>${ic('plus', 18).replace('M12 5v14M5 12h14', 'M5 12h14')}</button><div class="sv"><b>${d.perWeek === 7 ? 'Каждый день' : d.perWeek + ' раз(а)'}</b><small>${d.perWeek === 7 ? 'серия в днях' : 'серия в неделях'}</small></div><button type="button" data-pw="1" aria-label="Больше" ${d.perWeek >= 7 ? 'disabled' : ''}>${ic('plus', 18)}</button></div></div>` : ''}
      <div class="fl"><span>Иконка</span><div class="picks">${R.ICON_PICK.map((n) => `<button type="button" class="pk ${d.icon === n ? 'on' : ''}" data-ic="${n}" aria-label="${n}" aria-pressed="${d.icon === n}">${ic(n, 20)}</button>`).join('')}</div></div>
      <div class="fl"><span>Цвет</span><div class="picks hues">${R.HUES.map((x) => `<button type="button" class="hu ${d.hue === x ? 'on' : ''}" data-hu="${x}" style="--h:${x}" aria-label="Цвет ${x}" aria-pressed="${d.hue === x}"></button>`).join('')}</div></div>
      <label class="sw"><span>Главная привычка<small>Остаётся в «тяжёлый день»</small></span><input type="checkbox" role="switch" id="hc" ${d.core ? 'checked' : ''}><i></i></label>
      <div class="row2">${edit ? `<button type="button" class="btn" data-x="arch">${ic('archive', 18)}В архив</button>` : '<span></span>'}<button type="button" class="btn primary" data-x="save">Сохранить</button></div>
      ${edit ? `<button type="button" class="btn danger wide" data-x="del">${ic('trash', 18)}Удалить навсегда</button>` : ''}`;
    const a = openSheet({
      html: body(),
      focus: edit ? null : '#hn',
      onMount: (a) => {
        const sync = () => { const n = $('#hn', a.body); if (n) d.name = n.value; const t = $('#ht', a.body); if (t) d.target = Math.max(1, +t.value || 1); const u = $('#hu', a.body); if (u) d.unit = u.value; const c = $('#hc', a.body); if (c) d.core = c.checked; };
        const redo = () => { sync(); a.body.innerHTML = body(); };
        a.body.addEventListener('click', (e) => {
          const t = e.target.closest('button'); if (!t) return;
          if (t.dataset.ty) { sync(); d.type = t.dataset.ty; return redo(); }
          if (t.dataset.pw) { sync(); d.perWeek = Math.max(1, Math.min(7, d.perWeek + +t.dataset.pw)); return redo(); }
          if (t.dataset.ic) { sync(); d.icon = t.dataset.ic; return redo(); }
          if (t.dataset.hu) { sync(); d.hue = +t.dataset.hu; return redo(); }
          if (t.dataset.x === 'save') {
            sync();
            if (!d.name.trim()) { $('#her', a.body).textContent = 'Введите название'; $('#hn', a.body).focus(); R.anim($('#hn', a.body), [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { dur: 240, fill: 'none' }); return; }
            d.name = d.name.trim();
            if (edit) Object.assign(h, d);
            else { const nh = { ...d, id: R.uid(), created: R.dkey(R.today()), order: S().habits.length }; S().habits.push(nh); }
            R.save(); R.haptic(14); a.close();
            if (detailApi && edit) { detailApi.close(); }
            setTimeout(() => { cur = 'habits'; setNav(true); render(); toast(edit ? 'Сохранено' : 'Привычка добавлена'); }, 280);
          }
          if (t.dataset.x === 'arch') { h.archived = true; R.save(); a.close(); if (detailApi) detailApi.close(); setTimeout(() => { render({ quiet: true }); toast('Привычка в архиве', () => { h.archived = false; R.save(); render({ quiet: true }); }); }, 280); }
          if (t.dataset.x === 'del') {
            if (!confirm(`Удалить «${h.name}» и всю её историю?`)) return;
            S().habits = S().habits.filter((x) => x.id !== h.id); delete S().logs[h.id]; R.save(); a.close(); if (detailApi) detailApi.close();
            setTimeout(() => { render({ quiet: true }); toast('Привычка удалена'); }, 280);
          }
        });
      }
    });
  }

  /* ================= запись дневника ================= */
  function openEntry(en) {
    const edit = !!en;
    const d = en ? { ...en, tags: [...(en.tags || [])] } : { mood: 7, title: '', text: '', tags: [], ts: Date.now() };
    const all = [...new Set([...R.TAGS, ...S().entries.flatMap((x) => x.tags || [])])];
    const body = () => `<div class="dayhead"><h2>${edit ? 'Запись' : 'Как ты сегодня?'}</h2></div>
      <div class="moodbox" id="mb" style="--mc:${R.moodColor(d.mood)}"><div class="mnum" id="mn">${d.mood}</div>
        <input type="range" id="mr" min="1" max="10" step="1" value="${d.mood}" aria-label="Оценка настроения от 1 до 10"><div class="mscale"><span>Плохо</span><span>Отлично</span></div></div>
      <label class="fl">Заголовок<input id="et" type="text" maxlength="60" value="${esc(d.title)}" placeholder="Коротко о дне" autocomplete="off"></label>
      <label class="fl">Заметка<textarea id="ex" rows="3" maxlength="600" placeholder="Что произошло, что почувствовал(а)">${esc(d.text)}</textarea></label>
      <div class="fl"><span>Теги</span><div class="chs" id="tg">${all.map((t) => `<button type="button" class="chip ${d.tags.includes(t) ? 'on' : ''}" data-t="${esc(t)}" aria-pressed="${d.tags.includes(t)}">${esc(t)}</button>`).join('')}</div>
        <div class="addtag"><input id="nt" type="text" maxlength="18" placeholder="Свой тег"><button type="button" class="chip" data-addtag>${ic('plus', 14)}Добавить</button></div></div>
      <div class="row2">${edit ? `<button type="button" class="btn danger" data-x="del">${ic('trash', 18)}Удалить</button>` : '<span></span>'}<button type="button" class="btn primary" data-x="save">Сохранить</button></div>`;
    openSheet({
      html: body(),
      onMount: (a) => {
        const sync = () => { d.title = $('#et', a.body).value; d.text = $('#ex', a.body).value; };
        const redo = () => { sync(); a.body.innerHTML = body(); };
        a.body.addEventListener('input', (e) => {
          if (e.target.id === 'mr') {
            d.mood = +e.target.value;
            const mb = $('#mb', a.body), mn = $('#mn', a.body);
            mb.style.setProperty('--mc', R.moodColor(d.mood)); mn.textContent = d.mood;
            R.anim(mn, [{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { sp: 'bouncy', fill: 'none' });
            R.haptic(6);
          }
        });
        const addTag = () => { const i = $('#nt', a.body), v = i.value.trim(); if (!v) return; sync(); if (!d.tags.includes(v)) d.tags.push(v); if (!all.includes(v)) all.push(v); redo(); };
        a.body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'nt') { e.preventDefault(); addTag(); } });
        a.body.addEventListener('click', (e) => {
          const t = e.target.closest('button'); if (!t) return;
          if (t.dataset.t != null) { sync(); const i = d.tags.indexOf(t.dataset.t); if (i >= 0) d.tags.splice(i, 1); else d.tags.push(t.dataset.t); t.classList.toggle('on'); t.setAttribute('aria-pressed', i < 0); R.anim(t, [{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { sp: 'bouncy', fill: 'none' }); R.haptic(8); return; }
          if (t.hasAttribute('data-addtag')) return addTag();
          if (t.dataset.x === 'save') {
            sync();
            const rec = { id: edit ? en.id : R.uid(), ts: d.ts, mood: d.mood, title: d.title.trim(), text: d.text.trim(), tags: d.tags };
            if (edit) Object.assign(en, rec); else S().entries.push(rec);
            R.save(); R.haptic(14); a.close();
            setTimeout(() => { cur = 'journal'; setNav(true); render({ quiet: edit }); toast('Запись сохранена'); }, 280);
          }
          if (t.dataset.x === 'del') {
            if (!confirm('Удалить эту запись?')) return;
            S().entries = S().entries.filter((x) => x.id !== en.id); R.save(); a.close();
            setTimeout(() => { render({ quiet: true }); toast('Запись удалена'); }, 280);
          }
        });
      }
    });
  }

  /* ================= напоминания ================= */
  function checkReminder() {
    const st = S().settings;
    if (!st.remind || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date(), hm = `${R.pad(now.getHours())}:${R.pad(now.getMinutes())}`, k = R.dkey(now);
    if (hm < st.remind || st.lastRemind === k) return;
    const tk = R.dkey(R.today()), left = R.activeHabits().filter((h) => !R.isDone(h, tk) && !R.isExcused(h, tk));
    st.lastRemind = k; R.save();
    if (!left.length) return;
    const opts = { body: `Осталось привычек: ${left.length}. ${left.slice(0, 3).map((h) => h.name).join(', ')}`, icon: 'icons/icon-192.png', tag: 'ritual-daily' };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then((r) => r.showNotification('Ritual', opts)).catch(() => new Notification('Ritual', opts));
    else new Notification('Ritual', opts);
  }

  /* ================= старт ================= */
  function boot() {
    buildNav();
    bindEvents();
    setNav(false);
    render();
    R.anim($('#nav'), [{ transform: 'translate(-50%,90px)', opacity: 0 }, { transform: 'translate(-50%,0)', opacity: 1 }], { sp: 'bouncy', delay: 150 });
    R.anim($('#fab'), [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { sp: 'bouncy', delay: 450 });
    setInterval(checkReminder, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminder(); if (!stack.length && cur === 'habits') render({ quiet: true }); } });
    checkReminder();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
