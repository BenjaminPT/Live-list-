/* Ritual — иконки (одно семейство, stroke 2) */
(function () {
  const R = (window.R = window.R || {});
  const P = {
    drop: '<path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3z"/>',
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/>',
    dumbbell: '<path d="M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12"/>',
    paw: '<circle cx="6.5" cy="10" r="1.7"/><circle cx="10.5" cy="6.5" r="1.7"/><circle cx="15.5" cy="6.5" r="1.7"/><circle cx="19" cy="10" r="1.7"/><path d="M8 17.5c0-3 2.3-5.5 4-5.5s4 2.5 4 5.5c0 2-2 1.8-4 1.2-2-.6-4 .8-4-1.2z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
    leaf: '<path d="M5 19c0-8 4-13 14-14 0 10-5 14-13 14zM5 19l7-7"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8"/>',
    coffee: '<path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
    bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8l3 8M9 6h3"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    apple: '<path d="M12 8c-1-2-4-2.5-5.5-.5C5 9.5 5.5 14 8 17c1.5 1.8 2.5 1.5 4 1 1.5.5 2.5.8 4-1 2.5-3 3-7.5 1.5-9.5C16 5.5 13 6 12 8zM12 8c0-2 1-3.5 2.5-4"/>',
    walk: '<circle cx="13" cy="4.5" r="1.7"/><path d="M12 8.5l-3 4 3 2.2V21M12 8.5l3 3 3 .5M9 12.5 7 16"/>',
    flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 1.5 1 2.5 2 2.5 0-3-1-5 1-8z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chevL: '<path d="M14.5 5 7.5 12l7 7"/>',
    chevR: '<path d="M9.5 5l7 7-7 7"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>',
    up: '<path d="M7 17 17 7M9 7h8v8"/>',
    down: '<path d="M7 7l10 10M17 9v8H9"/>',
    flat: '<path d="M5 12h14M14 7l5 5-5 5"/>',
    pencil: '<path d="M4 20l1-4L16 5a2.1 2.1 0 0 1 3 3L8 19z"/>',
    trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
    download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 20h14"/>',
    upload: '<path d="M12 15V4M7.5 8 12 3.5 16.5 8M5 20h14"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
    chart: '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    sliders: '<path d="M5 8h8M17 8h2M5 16h2M11 16h8"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    list: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 9h6M9 13h6M9 17h3"/>',
    install: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M12 8v6M9.5 11.5 12 14l2.5-2.5"/>',
    archive: '<rect x="3.5" y="5" width="17" height="4" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>'
  };
  R.ICON_PICK = ['drop', 'book', 'dumbbell', 'paw', 'heart', 'moon', 'sun', 'leaf', 'spark', 'coffee', 'music', 'phone', 'bike', 'star', 'bolt', 'apple', 'walk', 'flame'];
  R.icon = (name, size = 20, sw = 2) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.spark}</svg>`;
})();
