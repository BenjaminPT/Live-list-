# Ritual — трекер привычек (PWA)

Офлайн-приложение: привычки с тепловыми картами, дневник настроения, аналитика.
Без сборки и зависимостей: чистые HTML/CSS/JS. Данные хранятся только на устройстве.

## Запуск
PWA и service worker работают только по HTTP(S) (или на localhost):

    cd ritual
    python3 -m http.server 8080      # открыть http://localhost:8080

## Публикация (бесплатно)
Загрузите папку на Netlify Drop, GitHub Pages или Cloudflare Pages — это статический сайт.
После открытия по HTTPS: Chrome/Edge → «Установить», Safari iOS → «Поделиться» → «На экран Домой».

## Структура
- index.html, manifest.json, sw.js — оболочка PWA и офлайн-кэш
- css/style.css — дизайн-токены и компоненты
- js/store.js — данные, серии, статистика, корреляции
- js/anim.js — пружинные анимации (Web Animations API + CSS linear())
- js/charts.js — тепловая карта и график настроения
- js/ui.js — экраны, шторки, события
- js/icons.js — иконки

При изменении файлов поднимите VERSION в sw.js, чтобы клиенты обновили кэш.
