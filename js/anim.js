/* Ritual — анимации. Пружина считается один раз и превращается в CSS linear() easing,
   поэтому одна и та же физика работает и в Web Animations API, и в CSS-переходах (--spring). */
(function () {
  const R = (window.R = window.R || {});
  const mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  R.reduced = () => mq.matches;

  const cache = {};
  const hasLinear = !!(window.CSS && CSS.supports && CSS.supports('animation-timing-function', 'linear(0, 1)'));
  /* [жёсткость, затухание, масса]: затухание близко к критическому — мягко и без «дрожи» */
  R.SP = { snappy: [360, 36, 1], soft: [150, 25, 1], sheet: [135, 24.5, 1], bouncy: [210, 21, 1], gentle: [95, 20, 1] };

  R.spring = (stiffness, damping, mass = 1) => {
    const key = [stiffness, damping, mass].join();
    if (cache[key]) return cache[key];
    const dt = 1 / 120;
    let x = 0, v = 0, settled = 0;
    const out = [];
    for (let i = 0; i < 1500; i++) {
      const a = (-stiffness * (x - 1) - damping * v) / mass;
      v += a * dt;
      x += v * dt;
      out.push(x);
      if (Math.abs(x - 1) < 0.0015 && Math.abs(v) < 0.02) { if (++settled > 4) break; } else settled = 0;
    }
    const n = Math.min(72, out.length);
    const pts = [0];
    for (let i = 1; i <= n; i++) pts.push(out[Math.min(out.length - 1, Math.round((i * (out.length - 1)) / n))]);
    pts[pts.length - 1] = 1;
    return (cache[key] = {
      duration: Math.round(out.length * dt * 1000),
      easing: hasLinear ? `linear(${pts.map((p) => p.toFixed(4)).join(',')})` : 'cubic-bezier(.2,.9,.3,1)'
    });
  };

  /* общие токены движения для CSS */
  const s = R.spring(...R.SP.soft);
  const root = document.documentElement.style;
  root.setProperty('--spring', s.easing);
  root.setProperty('--spring-d', Math.min(s.duration, 520) + 'ms');
  const sb = R.spring(...R.SP.bouncy);
  root.setProperty('--pop', sb.easing);
  root.setProperty('--pop-d', Math.min(sb.duration, 520) + 'ms');

  root.setProperty('--ease', 'cubic-bezier(.22,.8,.3,1)');

  const noop = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });

  /* R.anim(el, keyframes, {sp, delay, dur, ease, fill}) */
  R.anim = (el, frames, o = {}) => {
    if (!el || !el.animate || R.reduced()) return noop();
    const { sp = 'soft', delay = 0, dur, ease, fill = 'backwards' } = o;
    const sp0 = dur ? null : R.spring(...R.SP[sp]);
    return el.animate(frames, { duration: dur || sp0.duration, easing: ease || (sp0 && sp0.easing) || 'ease-out', delay, fill });
  };

  /* мини-таймлайн в духе GSAP (WAAPI, без зависимостей):
     const t = R.tl({ defaults: { sp: 'soft' } });
     t.add(el, frames, '<')            // одновременно с предыдущим
      .add(els, frames, { at: '<.1', each: 60 })   // каскад, старт через 100 мс после начала предыдущего
      .add(el2, frames, '+=80')       // через 80 мс после конца предыдущего
      .label('x').add(el3, frames, 'x+=40');
     Позиции: число (мс от начала), '<' / '<n' (от старта предыдущего), '>' / '+=n' / '-=n' (от конца), 'метка±n'. */
  R.tl = (o = {}) => {
    const def = o.defaults || {}, labels = {}, anims = [];
    let lastStart = 0, lastEnd = 0;
    const at = (pos) => {
      if (pos == null || pos === '>') return lastEnd;
      if (typeof pos === 'number') return pos;
      let m;
      if ((m = /^<(-?\d*\.?\d*)$/.exec(pos))) return lastStart + (+m[1] || 0);
      if ((m = /^([+-])=(\d*\.?\d+)$/.exec(pos))) return lastEnd + (m[1] === '-' ? -1 : 1) * +m[2];
      if ((m = /^([A-Za-z]\w*)(?:([+-])=(\d*\.?\d+))?$/.exec(pos)) && m[1] in labels) return labels[m[1]] + (m[2] ? (m[2] === '-' ? -1 : 1) * +m[3] : 0);
      return lastEnd;
    };
    const api = {
      label: (n, pos) => { labels[n] = at(pos); return api; },
      add(els, frames, pos) {
        const opt = typeof pos === 'object' && pos !== null ? pos : { at: pos };
        const list = els && els.length != null && !els.nodeType ? [...els] : [els];
        const base = at(opt.at), each = opt.each || 0, max = opt.max == null ? 12 : opt.max;
        let end = base;
        list.forEach((el, i) => {
          const d = base + Math.min(i, max) * each;
          const a = R.anim(el, frames, Object.assign({}, def, opt, { delay: d }));
          anims.push(a);
          const dur = a.effect ? a.effect.getComputedTiming().duration : 0;
          end = Math.max(end, d + dur);
        });
        lastStart = base; lastEnd = end;
        return api;
      },
      cancel: () => anims.forEach((a) => a.cancel && a.cancel()),
      get duration() { return lastEnd; }
    };
    return api;
  };

  /* каскадное появление: мягкий подъём + проявление */
  R.stagger = (els, o = {}) => {
    const { step = 55, from = 14, max = 10, sp = 'soft', at = 0 } = o;
    R.tl().add(els, [
      { opacity: 0, transform: `translateY(${from}px) scale(.985)` },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], { at, each: step, max, sp });
  };

  R.countUp = (el, to, fmt = (n) => String(Math.round(n)), ms = 1000) => {
    if (!el) return;
    if (R.reduced() || to === 0) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 5)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* вспышка частиц вокруг элемента при отметке */
  R.burst = (el, hue) => {
    if (!el || R.reduced()) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 10; i++) {
      const d = document.createElement('i');
      d.className = 'spark';
      d.style.cssText = `left:${cx}px;top:${cy}px;background:hsl(${hue} 90% ${60 + (i % 3) * 8}%)`;
      document.body.appendChild(d);
      const ang = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
      const dist = 34 + Math.random() * 26;
      const a = d.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(0)`, opacity: 0 }
      ], { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' });
      a.onfinish = () => d.remove();
    }
  };

  R.haptic = (ms = 12) => {
    try {
      if (R.state && R.state.settings.haptics !== false && navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {}
  };
})();
