const categories = ["All", "Figurines", "Home", "Desk", "Accessories"];
let activeCategory = "All";

function renderFilters() {
  const container = document.getElementById("filters");
  if (!container) return;
  container.innerHTML = categories
    .map(
      (cat) =>
        `<button class="filter-pill ${cat === activeCategory ? "active" : ""}" data-cat="${cat}">${cat}</button>`
    )
    .join("");
  container.querySelectorAll("[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.getAttribute("data-cat");
      renderFilters();
      renderShopGrid();
    });
  });
}

function renderShopGrid() {
  const grid = document.getElementById("shop-grid");
  if (!grid) return;
  const filtered =
    activeCategory === "All" ? products : products.filter((p) => p.category === activeCategory);

  document.getElementById("item-count").textContent = `${filtered.length} item${
    filtered.length === 1 ? "" : "s"
  } ready to print and ship.`;

  grid.innerHTML = productsError ? productsErrorHTML() : filtered.map((p, i) => productCardHTML(p, i, i + 1)).join("");
  wireAddButtons(grid);
  initReveal();
}

whenReady(() => {
  renderFilters();
  renderShopGrid();
});
