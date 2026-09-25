function renderProductDetail() {
  const root = document.getElementById("product-root");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const product = slug ? getProductBySlug(slug) : null;

  if (productsError) {
    root.innerHTML = `<a href="shop.html" class="back-link">&larr; Back to shop</a>${productsErrorHTML()}`;
    return;
  }

  if (!product) {
    root.innerHTML = `
      <a href="shop.html" class="back-link">&larr; Back to shop</a>
      <h1>Product not found</h1>
      <p>We couldn't find that item. <a href="shop.html">Head back to the shop</a>.</p>`;
    return;
  }

  root.innerHTML = `
    <a href="shop.html" class="back-link">&larr; Back to shop</a>
    <div class="detail-grid">
      <div class="detail-media tilt" style="background:${esc(product.color)}22">
        <img src="${esc(product.image)}" alt="${esc(product.name)}" id="detail-img" />
      </div>
      <div>
        <span class="detail-tag" style="background:${esc(product.color)}33;color:${esc(product.color)}">${esc(product.category)}</span>
        <h1 class="detail-title">${esc(product.name)}</h1>
        <p class="detail-price font-display">$${product.price.toFixed(2)}</p>
        <p class="detail-desc">${esc(product.description)}</p>
        <dl class="detail-meta">
          <div>
            <dt>Material</dt>
            <dd>${esc(product.material)}</dd>
          </div>
          <div>
            <dt>Print time</dt>
            <dd>${esc(product.printTimeHours)}h</dd>
          </div>
        </dl>
        <div class="detail-actions">
          <div class="qty-pill">
            <button class="qty-btn" id="qty-dec">&minus;</button>
            <span class="qty-value" id="qty-value">1</span>
            <button class="qty-btn" id="qty-inc">+</button>
          </div>
          <button class="btn btn-add-detail" id="add-to-cart" style="background:${product.color}">Add to cart</button>
        </div>
      </div>
    </div>`;

  let qty = 1;
  const qtyValue = document.getElementById("qty-value");
  document.getElementById("qty-dec").addEventListener("click", () => {
    qty = Math.max(1, qty - 1);
    qtyValue.textContent = String(qty);
  });
  document.getElementById("qty-inc").addEventListener("click", () => {
    qty += 1;
    qtyValue.textContent = String(qty);
  });
  document.getElementById("add-to-cart").addEventListener("click", (e) => {
    FX.addWithFx(product, qty, document.getElementById("detail-img"), e);
  });
  FX.initTilt(root);
  document.title = `${product.name} — Ubiquitous Craft`;
}

whenReady(renderProductDetail);
