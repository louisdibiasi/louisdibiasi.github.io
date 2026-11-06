(() => {
  const cv = document.querySelector(".field");
  if (!cv) return;
  let ctx = null;
  try {
    ctx = cv.getContext("2d");
  } catch {}
  if (!ctx) {
    cv.hidden = true;
    return;
  }

  const RAMP = " .:-=+*";
  const TOP = RAMP.length - 1;
  const CW = 14;
  const CH = 22;
  const REACH = 140;
  const STEP = 50;
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lightMq = matchMedia("(prefers-color-scheme: light)");

  let W = 0;
  let H = 0;
  let cols = 0;
  let rows = 0;
  let fg = "#ececec";
  let maxA = 0.07;
  let clock = 0;
  let last = 0;
  let raf = 0;
  const ptr = { x: -1e4, y: -1e4 };

  const hash = (x, y) => {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let u = x - xi;
    let v = y - yi;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  function theme() {
    fg = getComputedStyle(root).getPropertyValue("--fg").trim() || fg;
    const light = root.dataset.theme ? root.dataset.theme === "light" : lightMq.matches;
    maxA = light ? 0.09 : 0.07;
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / CW);
    rows = Math.ceil(H / CH);
    ctx.font = '13px "Geist Mono", ui-monospace, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  }

  function draw() {
    const t = clock / 1000;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = fg;
    for (let r = 0; r < rows; r++) {
      const y = r * CH + CH / 2;
      for (let c = 0; c < cols; c++) {
        const x = c * CW + CW / 2;
        let v = noise(c * 0.08 + t * 0.045, r * 0.13 - t * 0.03) * 0.65 + noise(c * 0.21 - t * 0.07, r * 0.29 + t * 0.04) * 0.35;
        v = (v - 0.44) / 0.56;
        const d = Math.hypot(x - ptr.x, y - ptr.y);
        const b = d < REACH ? (1 - d / REACH) ** 2 : 0;
        v = Math.min(1, v + b * 0.55);
        if (v <= 0) continue;
        ctx.globalAlpha = maxA * (0.35 + 0.65 * v) * (1 + b * 1.2);
        ctx.fillText(RAMP[Math.max(1, Math.ceil(v * TOP))], x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = now - last;
    if (dt < STEP) return;
    last = now;
    clock += Math.min(dt, 120);
    draw();
  }

  function start() {
    if (raf || reduce || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function init() {
    try {
      theme();
      size();
      clock = 42000;
      draw();
    } catch {
      cv.hidden = true;
      return;
    }
    cv.classList.add("is-on");
    start();

    const retheme = () => {
      theme();
      if (!raf) draw();
    };
    window.addEventListener("themechange", retheme);
    lightMq.addEventListener("change", retheme);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

    let pending = 0;
    window.addEventListener("resize", () => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        size();
        draw();
      }, 150);
    });

    if (!reduce) {
      window.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        ptr.x = e.clientX;
        ptr.y = e.clientY;
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", () => {
        ptr.x = ptr.y = -1e4;
      });
    }
  }

  const ready = document.fonts && document.fonts.load ? document.fonts.load('13px "Geist Mono"', ".:-=+*") : Promise.resolve();
  ready.then(init, init);
})();
