/* Ritual — локализация. Ключ = русский текст, перевод лежит в js/lang-en.js (R.EN).
   Нет перевода → показывается исходный русский текст. Новый язык: добавить словарь и пункт в настройках. */
(function () {
  const R = (window.R = window.R || {});
  R.lang = 'ru';
  R.locale = 'ru';

  R.detectLang = (pref) => {
    if (pref === 'ru' || pref === 'en') return pref;
    const n = ((navigator.languages && navigator.languages[0]) || navigator.language || 'ru').toLowerCase();
    return /^(ru|be|uk|kk)/.test(n) ? 'ru' : 'en';
  };
  R.setLang = (pref) => {
    R.lang = R.detectLang(pref);
    R.locale = R.lang;
    document.documentElement.lang = R.lang;
    document.title = R.lang === 'ru' ? 'Ritual — трекер привычек' : 'Ritual — habit tracker';
  };

  /* перевод строки; {name} подставляется из v */
  R.t = (s, v) => {
    let o = s;
    if (R.lang === 'en' && R.EN && R.EN[s] !== undefined) o = R.EN[s];
    if (v) o = o.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));
    return o;
  };

  /* склонение: ru = [1, 2-4, 5+], en = [one, other] */
  R.pl = (n, ru, en) => {
    n = Math.abs(n);
    if (R.lang === 'en') return n === 1 ? en[0] : en[1];
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? ru[0] : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? ru[1] : ru[2];
  };

  R.setLang('auto');
})();
