(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLORS = ["#ff6b6b", "#ffd93d", "#4ecdc4", "#a66dd4", "#ff9f45", "#4d96ff"];

  /* ---------- 3D tilt + glare ---------- */
  function initTilt(root) {
    (root || document).querySelectorAll(".tilt:not([data-tilt])").forEach((el) => {
      el.dataset.tilt = "1";
      if (!el.querySelector(".glare")) {
        const g = document.createElement("div");
        g.className = "glare";
        el.appendChild(g);
      }
      const max = el.classList.contains("detail-media") ? 10 : 20;
      el.addEventListener("mousemove", (e) => {
        if (reduce) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.classList.add("tilting");
        el.style.setProperty("--ry", `${(x - 0.5) * max}deg`);
        el.style.setProperty("--rx", `${-(y - 0.5) * max}deg`);
        el.style.setProperty("--gx", `${x * 100}%`);
        el.style.setProperty("--gy", `${y * 100}%`);
        el.style.setProperty("--px", `${(0.5 - x) * 14}px`);
        el.style.setProperty("--py", `${(0.5 - y) * 14}px`);
      });
      el.addEventListener("mouseleave", () => el.classList.remove("tilting"));
    });
  }

  /* ---------- Fly to cart + confetti ---------- */
  function flyToCart(srcEl, onDone) {
    const cart = document.getElementById("cart-btn");
    if (!cart || !srcEl || reduce) {
      onDone();
      return;
    }
    const from = srcEl.getBoundingClientRect();
    const to = cart.getBoundingClientRect();
    const size = Math.min(from.width, from.height, 220);
    const left = from.left + (from.width - size) / 2;
    const top = from.top + (from.height - size) / 2;
    const el = document.createElement("div");
    el.className = "fly";
    el.style.cssText = `left:${left}px;top:${top}px;width:${size}px;height:${size}px;background-image:url("${
      srcEl.currentSrc || srcEl.src
    }")`;
    document.body.appendChild(el);
    const dx = to.left + to.width / 2 - (left + size / 2);
    const dy = to.top + to.height / 2 - (top + size / 2);
    const anim = el.animate(
      [
        { transform: "translate(0,0) scale(1) rotate(0deg)", borderRadius: "18px" },
        {
          transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 140}px) scale(0.55) rotate(200deg)`,
          borderRadius: "40%",
          offset: 0.45,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(0.16) rotate(360deg)`, borderRadius: "50%" },
      ],
      { duration: 900, easing: "cubic-bezier(.5,0,.3,1)" }
    );
    anim.onfinish = () => {
      el.remove();
      onDone();
    };
  }

  function confetti(x, y, color) {
    if (reduce) return;
    const palette = [color, "#ffd93d", "#4ecdc4", "#ff6b6b", "#a66dd4"];
    for (let i = 0; i < 28; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.style.cssText = `left:${x}px;top:${y}px;background:${palette[i % palette.length]}`;
      document.body.appendChild(c);
      const ang = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 160;
      const px = Math.cos(ang) * v;
      const py = Math.sin(ang) * v - 80;
      const a = c.animate(
        [
          { transform: "translate(0,0) rotate(0)", opacity: 1 },
          { transform: `translate(${px}px, ${py}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${px * 1.15}px, ${py + 180}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
        ],
        { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.4,1)" }
      );
      a.onfinish = () => c.remove();
    }
  }

  function addWithFx(product, qty, srcEl, evt, after) {
    const finish = () => {
      addToCart(product.id, qty);
      showToast(qty > 1 ? `Added ${qty} × "${product.name}" to cart` : `Added "${product.name}" to cart`);
      if (after) after();
    };
    if (evt) confetti(evt.clientX, evt.clientY, product.color);
    flyToCart(srcEl, finish);
  }

  /* ---------- Hero: headline reveal, mouse + scroll parallax ---------- */
  function initHero() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const h = document.getElementById("headline");
    if (h) {
      let i = 0;
      h.innerHTML = h.innerHTML
        .split(/<br\s*\/?>/i)
        .map((line) =>
          line
            .trim()
            .split(/\s+/)
            .map((w) => `<span class="w"><span style="--i:${i++}">${w}</span></span>`)
            .join(" ")
        )
        .join("<br />");
    }
    requestAnimationFrame(() => hero.classList.add("play"));

    if (reduce) return;
    hero.addEventListener("mousemove", (e) => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      hero.querySelectorAll(".par").forEach((el) => {
        const d = parseFloat(el.dataset.depth || "1");
        el.style.transform = `translate(${-nx * 80 * d}px, ${-ny * 80 * d}px)`;
      });
    });
    const bg = hero.querySelector(".hero-bg");
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (ticking || !bg) return;
        ticking = true;
        requestAnimationFrame(() => {
          if (window.scrollY < 1200) bg.style.transform = `translateY(${window.scrollY * 0.3}px)`;
          ticking = false;
        });
      },
      { passive: true }
    );
  }

  /* ---------- Page transition curtain ---------- */
  function initCurtain() {
    if (reduce) {
      document.documentElement.classList.remove("pt-in");
      return;
    }
    const cur = document.createElement("div");
    cur.className = "curtain";
    cur.innerHTML = COLORS.map((c) => `<div style="background:${c}"></div>`).join("");
    document.body.appendChild(cur);
    const bars = [...cur.children];

    let coming = false;
    try {
      coming = sessionStorage.getItem("pt") === "1";
      sessionStorage.removeItem("pt");
    } catch (e) {}

    if (coming) {
      bars.forEach((b, i) => {
        b.style.transform = "scaleY(1)";
        b.style.transformOrigin = "top";
        b.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], {
          duration: 650,
          delay: 120 + i * 60,
          easing: "cubic-bezier(.7,0,.3,1)",
          fill: "forwards",
        });
      });
    }
    document.documentElement.classList.remove("pt-in");

    window.addEventListener("pageshow", (e) => {
      if (!e.persisted) return;
      bars.forEach((b) => {
        b.getAnimations().forEach((a) => a.cancel());
        b.style.transform = "scaleY(0)";
      });
    });

    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.protocol !== location.protocol || url.host !== location.host) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (!/\.html?$/i.test(url.pathname) && url.pathname !== "/") return;

      e.preventDefault();
      bars.forEach((b, i) => {
        b.style.transformOrigin = "bottom";
        b.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
          duration: 450,
          delay: i * 50,
          easing: "cubic-bezier(.7,0,.3,1)",
          fill: "forwards",
        });
      });
      setTimeout(() => {
        try {
          sessionStorage.setItem("pt", "1");
        } catch (err) {}
        location.href = a.href;
      }, 450 + bars.length * 50 + 40);
    });
  }

  window.FX = { initTilt, flyToCart, confetti, addWithFx };

  document.addEventListener("DOMContentLoaded", () => {
    initCurtain();
    initHero();
    initTilt();
  });
})();
