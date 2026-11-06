(() => {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lightMq = matchMedia("(prefers-color-scheme: light)");

  const toggle = document.querySelector(".theme-toggle");
  const current = () => root.dataset.theme || (lightMq.matches ? "light" : "dark");
  const syncToggle = () => {
    if (!toggle) return;
    const now = current();
    toggle.dataset.current = now;
    toggle.setAttribute("aria-label", `dark / light theme, ${now} active`);
  };
  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = current() === "dark" ? "light" : "dark";
      const apply = () => {
        root.dataset.theme = next;
        try {
          localStorage.setItem("theme", next);
        } catch {}
        document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
          m.content = next === "light" ? "#efefef" : "#060606";
        });
        syncToggle();
        window.dispatchEvent(new Event("themechange"));
      };
      if (reduce) {
        apply();
      } else if (document.startViewTransition) {
        document.startViewTransition(apply);
      } else {
        root.classList.add("theme-fade");
        apply();
        setTimeout(() => root.classList.remove("theme-fade"), 600);
      }
    });
  }
  lightMq.addEventListener("change", syncToggle);
  syncToggle();

  const header = document.querySelector(".site-header");
  const sentinel = document.querySelector(".sentinel");
  if (header && sentinel && window.IntersectionObserver) {
    new IntersectionObserver(([e]) => {
      header.classList.toggle("is-stuck", !e.isIntersecting);
      document.documentElement.classList.toggle("scrolled", !e.isIntersecting);
    }).observe(sentinel);
  }

  const revealables = [...document.querySelectorAll("[data-reveal]")];
  const showAll = () => revealables.forEach((el) => el.classList.add("is-in"));
  if (reduce || !window.IntersectionObserver) {
    showAll();
  } else {
    document.querySelectorAll(".section").forEach((section) => {
      section.querySelectorAll("[data-reveal]").forEach((el, i) => {
        el.style.transitionDelay = `${Math.min(i, 8) * 60}ms`;
        el.addEventListener("transitionend", () => el.style.removeProperty("transition-delay"), { once: true });
      });
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    revealables.forEach((el) => io.observe(el));
  }

  if (!reduce && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".row").forEach((row) => {
      let pending = 0;
      let x = 0;
      let y = 0;
      row.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        const box = row.getBoundingClientRect();
        x = e.clientX - box.left;
        y = e.clientY - box.top;
        if (pending) return;
        pending = requestAnimationFrame(() => {
          pending = 0;
          row.style.setProperty("--mx", `${x}px`);
          row.style.setProperty("--my", `${y}px`);
        });
      });
    });
  }
})();
