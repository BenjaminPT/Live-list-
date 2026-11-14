/* Ritual — пружинная анимация на Web Animations API (без внешних библиотек, работает офлайн).
   Пружина симулируется один раз и превращается в CSS linear() easing. */
(function () {
  const R = (window.R = window.R || {});
  const mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  R.reduced = () => mq.matches;

  const cache = {};
  const hasLinear = !!(window.CSS && CSS.supports && CSS.supports('animation-timing-function', 'linear(0, 1)'));
  R.SP = { snappy: [480, 32, 1], soft: [240, 24, 1], bouncy: [340, 17, 1], gentle: [140, 20, 1] };

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
    const n = Math.min(64, out.length);
    const pts = [0];
    for (let i = 1; i <= n; i++) pts.push(out[Math.min(out.length - 1, Math.round((i * (out.length - 1)) / n))]);
    pts[pts.length - 1] = 1;
    return (cache[key] = {
      duration: Math.round(out.length * dt * 1000),
      easing: hasLinear ? `linear(${pts.map((p) => p.toFixed(4)).join(',')})` : 'cubic-bezier(.2,.9,.3,1)'
    });
  };

  const noop = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });

  /* R.anim(el, keyframes, {sp:'soft'|'snappy'|'bouncy', delay, dur, ease, fill}) */
  R.anim = (el, frames, o = {}) => {
    if (!el || !el.animate || R.reduced()) return noop();
    const { sp = 'soft', delay = 0, dur, ease, fill = 'backwards' } = o;
    const s = dur ? null : R.spring(...R.SP[sp]);
    return el.animate(frames, { duration: dur || s.duration, easing: ease || (s && s.easing) || 'ease-out', delay, fill });
  };

  /* каскадное появление */
  R.stagger = (els, o = {}) => {
    const { step = 40, from = 14, max = 12, sp = 'soft', scale = 1 } = o;
    els.forEach((el, i) =>
      R.anim(el, [
        { opacity: 0, transform: `translateY(${from}px) scale(${scale === 1 ? 1 : 0.96})` },
        { opacity: 1, transform: 'translateY(0) scale(1)' }
      ], { sp, delay: Math.min(i, max) * step })
    );
  };

  R.countUp = (el, to, fmt = (n) => String(Math.round(n)), ms = 900) => {
    if (!el) return;
    if (R.reduced() || to === 0) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
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
      ], { duration: 560, easing: 'cubic-bezier(.2,.8,.3,1)' });
      a.onfinish = () => d.remove();
    }
  };

  R.haptic = (ms = 12) => {
    try {
      if (R.state && R.state.settings.haptics !== false && navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {}
  };
})();
