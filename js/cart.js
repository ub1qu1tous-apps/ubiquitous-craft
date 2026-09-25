/* Visitors keep a guest cart in localStorage. Logged-in users keep their cart in the
   Supabase `cart_items` table; `cartCache` is the in-memory copy the UI reads, and every
   change is written through to the database. */
const GUEST_CART_KEY = "uc-cart";
const MAX_QTY = 99;
let cartCache = [];

function cartUserId() {
  const u = Auth.currentUser();
  return u ? u.id : null;
}

function readGuestCart() {
  try {
    const c = JSON.parse(localStorage.getItem(GUEST_CART_KEY));
    return Array.isArray(c) ? c : [];
  } catch {
    return [];
  }
}

function writeGuestCart(cart) {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  } catch {}
}

// Load the cart for the current visitor/user; merges a guest cart into the account cart on login.
async function loadCart() {
  const uid = cartUserId();
  if (!uid) {
    cartCache = readGuestCart();
    return;
  }
  try {
    const { data, error } = await db.from("cart_items").select("product_id, qty");
    if (error) throw error;
    cartCache = data.map((r) => ({ id: String(r.product_id), qty: r.qty }));
    const guest = readGuestCart().filter((g) => getProductById(g.id));
    if (guest.length) {
      guest.forEach((g) => {
        const existing = cartCache.find((i) => i.id === g.id);
        if (existing) existing.qty = Math.min(MAX_QTY, existing.qty + g.qty);
        else cartCache.push({ id: g.id, qty: Math.min(MAX_QTY, g.qty) });
      });
      const rows = cartCache.map((i) => ({ user_id: uid, product_id: Number(i.id), qty: i.qty }));
      const res = await db.from("cart_items").upsert(rows, { onConflict: "user_id,product_id" });
      if (res.error) throw res.error;
      localStorage.removeItem(GUEST_CART_KEY);
    }
  } catch (e) {
    console.error("Could not load the saved cart", e);
    cartCache = [];
  }
}

function getCart() {
  return cartCache;
}

// Write one cart line (or its removal) to wherever the cart lives.
async function pushCartItem(id) {
  const uid = cartUserId();
  if (!uid) return writeGuestCart(cartCache);
  const item = cartCache.find((i) => i.id === id);
  const res = item
    ? await db.from("cart_items").upsert({ user_id: uid, product_id: Number(id), qty: item.qty }, { onConflict: "user_id,product_id" })
    : await db.from("cart_items").delete().eq("user_id", uid).eq("product_id", Number(id));
  if (res.error) {
    console.error(res.error);
    showToast("Couldn't save your cart. Check your connection.");
  }
}

function addToCart(productId, qty = 1) {
  const existing = cartCache.find((i) => i.id === productId);
  if (existing) existing.qty = Math.min(MAX_QTY, existing.qty + qty);
  else cartCache.push({ id: productId, qty: Math.min(MAX_QTY, qty) });
  pushCartItem(productId);
  renderCartUI();
}

function removeFromCart(productId) {
  cartCache = cartCache.filter((i) => i.id !== productId);
  pushCartItem(productId);
  renderCartUI();
}

function setCartQuantity(productId, qty) {
  if (qty <= 0) {
    removeFromCart(productId);
    return;
  }
  const item = cartCache.find((i) => i.id === productId);
  if (item) item.qty = Math.min(MAX_QTY, qty);
  pushCartItem(productId);
  renderCartUI();
}

async function clearCart() {
  cartCache = [];
  renderCartUI();
  const uid = cartUserId();
  if (!uid) return writeGuestCart([]);
  const res = await db.from("cart_items").delete().eq("user_id", uid);
  if (res.error) {
    console.error(res.error);
    showToast("Couldn't save your cart. Check your connection.");
  }
}

// Resolves when the catalog, the session and the cart are loaded and the page markup exists.
const appReady = (async () => {
  await Promise.all([productsReady, Auth.ready]);
  await loadCart();
})();

function whenReady(fn) {
  return Promise.all([appReady, domReady]).then(fn);
}
function wireEmptyControl(ctl, rowSelector, onDone) {
  if (!ctl) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const showButton = () => {
    ctl.innerHTML = `<button class="empty-link" type="button">Empty cart</button>`;
    ctl.querySelector("button").addEventListener("click", showConfirm);
  };

  const showConfirm = () => {
    ctl.innerHTML = `<span class="empty-confirm">Are you sure?
      <button class="empty-yes" type="button">Yes, empty</button>
      <button class="empty-no" type="button">Cancel</button></span>`;
    ctl.querySelector(".empty-no").addEventListener("click", showButton);
    ctl.querySelector(".empty-yes").addEventListener("click", () => {
      ctl.querySelectorAll("button").forEach((b) => (b.disabled = true));
      const rows = [...document.querySelectorAll(rowSelector)];
      rows.forEach((row, i) => {
        row.style.animationDelay = `${i * 80}ms`;
        row.classList.add(i % 2 ? "swipe-right" : "swipe-left");
      });
      const wait = reduce ? 0 : 450 + rows.length * 80;
      setTimeout(() => {
        clearCart();
        showToast("Cart emptied");
        if (onDone) onDone();
      }, wait);
    });
  };

  showButton();
}

function getCartWithProducts() {
  return getCart()
    .map((item) => ({ ...item, product: getProductById(item.id) }))
    .filter((i) => i.product);
}

function getCartSubtotal() {
  return getCartWithProducts().reduce((sum, i) => sum + i.product.price * i.qty, 0);
}

function getCartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

/* ---------- Shared UI: navbar badge + drawer + toasts ---------- */

function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

function renderCartUI() {
  const count = getCartCount();
  const badge = document.getElementById("cart-badge");
  if (badge) {
    badge.textContent = String(count);
    badge.classList.toggle("visible", count > 0);
    badge.classList.remove("pulse");
    void badge.offsetWidth;
    if (count > 0) badge.classList.add("pulse");
  }

  const body = document.getElementById("drawer-body");
  const footer = document.getElementById("drawer-footer");
  if (!body) return;

  const items = getCartWithProducts();

  if (items.length === 0) {
    body.innerHTML = `<p class="drawer-empty">Your cart is empty. Go add something fun!</p>`;
    if (footer) footer.style.display = "none";
    return;
  }

  body.innerHTML =
    `<div class="cart-toolbar"><span>${count} item${count === 1 ? "" : "s"}</span><span id="drawer-empty-ctl"></span></div>` +
    items
    .map(
      (item) => `
      <div class="cart-row" data-id="${item.product.id}">
        <div class="cart-row-media" style="background:${item.product.color}22">
          <img src="${esc(item.product.thumb)}" alt="${esc(item.product.name)}" />
        </div>
        <div class="cart-row-info">
          <p class="cart-row-name">${esc(item.product.name)}</p>
          <p class="cart-row-price">$${item.product.price.toFixed(2)}</p>
          <div class="qty-controls">
            <button class="qty-btn" data-action="dec" data-id="${item.product.id}">&minus;</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" data-action="inc" data-id="${item.product.id}">+</button>
            <button class="remove-link" data-action="remove" data-id="${item.product.id}">remove</button>
          </div>
        </div>
      </div>`
    )
    .join("");

  wireEmptyControl(document.getElementById("drawer-empty-ctl"), ".cart-row");

  body.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      const current = getCart().find((i) => i.id === id);
      const qty = current ? current.qty : 0;
      if (action === "inc") setCartQuantity(id, qty + 1);
      if (action === "dec") setCartQuantity(id, qty - 1);
      if (action === "remove") removeFromCart(id);
    });
  });

  if (footer) {
    footer.style.display = "block";
    const subtotalEl = document.getElementById("drawer-subtotal-value");
    if (subtotalEl) subtotalEl.textContent = `$${getCartSubtotal().toFixed(2)}`;
  }
}

function openCartDrawer() {
  document.getElementById("cart-overlay")?.classList.add("open");
  document.getElementById("cart-drawer")?.classList.add("open");
}

function closeCartDrawer() {
  document.getElementById("cart-overlay")?.classList.remove("open");
  document.getElementById("cart-drawer")?.classList.remove("open");
}

function initCartChrome() {
  document.getElementById("cart-btn")?.addEventListener("click", openCartDrawer);
  document.getElementById("cart-overlay")?.addEventListener("click", closeCartDrawer);
  document.getElementById("drawer-close")?.addEventListener("click", closeCartDrawer);
  whenReady(renderCartUI);
}

domReady.then(initCartChrome);

/* ---------- Scroll reveal ---------- */

function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("revealed"));
    return;
  }
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.classList.add("revealed");
          obs.unobserve(el);
          // drop the reveal classes once done so hover/tilt transforms can take over
          setTimeout(() => {
            el.classList.remove("reveal", "revealed");
            el.style.transitionDelay = "";
          }, 1000 + (parseInt(el.style.transitionDelay) || 0));
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );
  els.forEach((el) => obs.observe(el));
}

document.addEventListener("DOMContentLoaded", initReveal);
