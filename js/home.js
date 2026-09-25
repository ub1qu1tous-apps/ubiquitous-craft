function productCardHTML(product, index, number) {
  return `
    <div class="card reveal" style="transition-delay:${index * 90}ms">
      <a href="product.html?slug=${encodeURIComponent(product.slug)}">
        <div class="card-media" style="background:${esc(product.color)}22">
          ${number ? `<span class="card-num">${number}</span>` : ""}
          <img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy" />
        </div>
      </a>
      <div class="card-body">
        <a href="product.html?slug=${encodeURIComponent(product.slug)}">
          <h3>${esc(product.name)}</h3>
        </a>
        <p class="card-blurb">${esc(product.blurb)}</p>
        <div class="card-footer">
          <span class="card-price">$${product.price.toFixed(2)}</span>
          <button class="btn-add" style="background:${product.color}" data-add="${product.id}">Add +</button>
        </div>
      </div>
    </div>`;
}

function wireAddButtons(root) {
  root.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const product = getProductById(btn.getAttribute("data-add"));
      if (!product) return;
      const img = btn.closest(".card").querySelector(".card-media img");
      FX.addWithFx(product, 1, img, e);
    });
  });
  FX.initTilt(root);
}

function renderFloaters() {
  const container = document.getElementById("hero-floaters");
  if (!container) return;
  const spots = [
    { left: "4%", top: "8%", r: "-8deg", depth: 0.8 },
    { left: "13%", top: "62%", r: "6deg", depth: 1.3 },
    { left: "84%", top: "10%", r: "8deg", depth: 0.7 },
    { left: "80%", top: "58%", r: "-6deg", depth: 1.2 },
  ];
  container.innerHTML = products
    .slice(0, spots.length)
    .map((p, i) => {
      const s = spots[i];
      return `<div class="par" data-depth="${s.depth}" style="left:${s.left};top:${s.top}">
        <div class="sticker" style="--r:${s.r};animation-duration:${5 + i}s"><img src="${esc(p.image)}" alt="" /></div>
      </div>`;
    })
    .join("");
}

function renderMarquee() {
  const track = document.getElementById("marquee-track");
  if (!track) return;
  const words = ["PRINTED TO ORDER", "SMALL BATCH", "FRESH PLA", "LAYER BY LAYER", "MADE TO SMILE"];
  track.innerHTML = [...words, ...words, ...words, ...words].map((t) => `<span>${t} ✦</span>`).join("");
}

domReady.then(() => {
  renderMarquee();
  const grid = document.getElementById("featured-grid");
  if (grid) grid.innerHTML = `<p class="drawer-empty">Loading products…</p>`;
});

whenReady(() => {
  renderFloaters();
  const grid = document.getElementById("featured-grid");
  if (grid) {
    grid.innerHTML = productsError
      ? productsErrorHTML()
      : products.slice(0, 4).map((p, i) => productCardHTML(p, i)).join("");
    wireAddButtons(grid);
  }
  initReveal();
});
