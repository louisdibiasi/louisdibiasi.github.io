(() => {
  const fig = document.querySelector(".portrait");
  const cv = fig && fig.querySelector("canvas");
  const ctx = cv && cv.getContext && cv.getContext("2d");
  if (!ctx) return;

  const RAMP = " .:-=+*#%@";
  const TOP = RAMP.length - 1;
  const CW = 5;
  const CH = 9;
  const SETTLE = 0.8;
  const SWEEP = 1.0;
  const REACH = 90;
  const RIPPLE_MS = 1400;
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lightMq = matchMedia("(prefers-color-scheme: light)");

  let src = null;
  let cols = 0;
  let rows = 0;
  let W = 0;
  let H = 0;
  let ox = 0;
  let oy = 0;
  let base;
  let delay;
  let energy;
  let fg = "#e6e6e6";
  let light = false;
  let clock = 0;
  let last = 0;
  let raf = 0;
  let onScreen = true;
  let live = false;
  let ripple = -1;
  const ptr = { x: -999, y: -999, on: false };

  const hash = (n) => {
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };

  function theme() {
    fg = getComputedStyle(root).getPropertyValue("--fg").trim() || fg;
    light = root.dataset.theme ? root.dataset.theme === "light" : lightMq.matches;
  }

  function build() {
    const w = fig.clientWidth;
    if (!w) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w;
    H = fig.clientHeight || w;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor(W / CW);
    rows = Math.floor(H / CH);
    ox = (W - cols * CW + CW) / 2;
    oy = (H - rows * CH + CH) / 2;

    const off = document.createElement("canvas");
    off.width = cols;
    off.height = rows;
    const o = off.getContext("2d", { willReadFrequently: true });
    o.drawImage(src, 0, 0, cols, rows);
    const px = o.getImageData(0, 0, cols, rows).data;
    const n = cols * rows;
    const lum = new Float32Array(n);
    for (let i = 0; i < n; i++) lum[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
    const blur = (arr, horizontal) => {
      const out = new Float32Array(n);
      const R = 5;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let s = 0;
          let k = 0;
          for (let d = -R; d <= R; d++) {
            const cc = horizontal ? c + d : c;
            const rr = horizontal ? r : r + d;
            if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
            s += arr[rr * cols + cc];
            k++;
          }
          out[r * cols + c] = s / k;
        }
      }
      return out;
    };
    const soft = blur(blur(lum, true), false);
    for (let i = 0; i < n; i++) lum[i] = lum[i] + (lum[i] - soft[i]) * 1.6;
    const sorted = Float32Array.from(lum).sort();
    const lo = sorted[Math.floor(n * 0.03)];
    const span = Math.max(1, sorted[Math.floor(n * 0.99)] - lo);

    base = new Float32Array(n);
    delay = new Float32Array(n);
    energy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      base[i] = Math.pow(Math.min(1, Math.max(0, (lum[i] - lo) / span)), 0.7);
      delay[i] = ((i % cols) / cols + Math.floor(i / cols) / rows) * 0.5 * SWEEP + hash(i) * 0.12;
    }
    ctx.font = `${(CW / 0.6).toFixed(2)}px "Geist Mono", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    return true;
  }

  function draw(dt) {
    const t = clock / 1000;
    const intro = !reduce && t < SWEEP + SETTLE + 0.2;
    const decay = Math.exp(-dt / 320);
    const tick = Math.floor(clock / 70);
    let ring = -1;
    let fade = 0;
    if (ripple >= 0) {
      const age = clock - ripple;
      if (age > RIPPLE_MS) ripple = -1;
      else {
        ring = age * 0.35;
        fade = 1 - age / RIPPLE_MS;
      }
    }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = fg;
    let alpha = -1;
    for (let r = 0, i = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++, i++) {
        let v = base[i];
        const x = ox + c * CW;
        const y = oy + r * CH;
        let dx = 0;
        let dy = 0;
        if (!reduce) {
          v += 0.07 * Math.sin(c * 0.33 + clock * 0.0006) * Math.sin(r * 0.47 - clock * 0.00043);
          const ex = x - ptr.x;
          const ey = y - ptr.y;
          const d = Math.hypot(ex, ey) || 1;
          let inf = ptr.on && d < REACH ? (1 - d / REACH) ** 2 : 0;
          if (ring >= 0) inf = Math.max(inf, Math.max(0, 1 - Math.abs(d - ring) / 28) * fade);
          const e = (energy[i] = Math.max(energy[i] * decay, inf));
          if (e > 0.01) {
            v += e * 0.34;
            dx = (ex / d) * e * 2.2;
            dy = (ey / d) * e * 2.2;
          }
        }
        let idx = Math.round(Math.min(1, Math.max(0, v)) * TOP);
        if (intro) {
          const p = (t - delay[i]) / SETTLE;
          if (p < 1) {
            const settled = p <= 0 ? 0 : 1 - Math.pow(2, -10 * p);
            if (hash(i * 31 + tick) >= settled) idx = 1 + Math.floor(hash(i * 17 + tick * 7) * TOP);
          }
        }
        if (!idx) continue;
        const a = 0.42 + idx * 0.064;
        if (a !== alpha) ctx.globalAlpha = alpha = a;
        ctx.fillText(RAMP[idx], x + dx, y + dy);
      }
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min(Math.max(now - last, 0), 50);
    last = now;
    clock += dt;
    draw(dt);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || reduce || !live || !onScreen || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function first() {
    theme();
    try {
      if (!build()) return;
      if (reduce) clock = 1e7;
      draw(0);
    } catch {
      return;
    }
    fig.classList.add("is-live");
    live = true;
    start();
  }

  const retheme = () => {
    theme();
    if (live && !raf) draw(0);
  };
  window.addEventListener("themechange", retheme);
  lightMq.addEventListener("change", retheme);

  if (!reduce) {
    const place = (e) => {
      const b = cv.getBoundingClientRect();
      ptr.x = e.clientX - b.left;
      ptr.y = e.clientY - b.top;
    };
    fig.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      place(e);
      ptr.on = true;
    });
    fig.addEventListener("pointerleave", () => {
      ptr.on = false;
    });
    fig.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      place(e);
      ripple = clock;
    });
  }

  if (window.IntersectionObserver) {
    new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) start();
      else stop();
    }).observe(fig);
  }
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  if (window.ResizeObserver) {
    let pending = 0;
    new ResizeObserver(() => {
      if (!live || fig.clientWidth === W) return;
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        try {
          build();
          if (!raf) draw(0);
        } catch {
          fig.classList.remove("is-live");
          live = false;
          stop();
        }
      });
    }).observe(fig);
  }

  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    src = img;
    const fonts = document.fonts && document.fonts.load ? document.fonts.load('12px "Geist Mono"', "@#") : Promise.resolve();
    fonts.then(first, first);
  };
  img.src = fig.dataset.src || "assets/avatar-gray.jpg";
})();
