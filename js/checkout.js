let selectedDelivery = "standard";
let selectedPayment = "card";

function renderCheckout() {
  const root = document.getElementById("checkout-root");
  if (!root) return;

  const items = getCartWithProducts();

  if (items.length === 0) {
    root.innerHTML = `
      <div class="empty-cart">
        <p class="font-display">Your cart is empty</p>
        <p>Add something from the shop before checking out.</p>
        <a href="shop.html" class="btn btn-primary">Go to shop</a>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div class="checkout-wrap">
      <h1 class="font-display" style="font-size:2.25rem">Checkout</h1>
      <p class="checkout-sub">This is a practice site — no real order is placed and no payment is processed.</p>

      <div class="checkout-grid">
        <div>
          <section class="panel">
            <h2>Shipping address</h2>
            <div class="form-grid">
              <input class="input" placeholder="Full name" />
              <input class="input" placeholder="Email" type="email" />
              <input class="input span-2" placeholder="Street address" />
              <input class="input" placeholder="City" />
              <input class="input" placeholder="ZIP / Postal code" />
              <input class="input span-2" placeholder="Country" />
            </div>
          </section>

          <section class="panel">
            <h2>Delivery method</h2>
            <div class="option-list" id="delivery-options"></div>
          </section>

          <section class="panel">
            <h2>Payment method</h2>
            <div class="payment-grid" id="payment-options"></div>
            <div id="payment-extra"></div>
          </section>
        </div>

        <aside class="panel" style="height: fit-content">
          <div class="panel-head">
            <h2>Order summary</h2>
            <span id="checkout-empty-ctl"></span>
          </div>
          <div class="summary-list" id="summary-list"></div>
          <div class="summary-totals">
            <div class="muted-row">
              <span>Subtotal</span>
              <span id="sum-subtotal"></span>
            </div>
            <div class="muted-row">
              <span>Delivery</span>
              <span id="sum-delivery"></span>
            </div>
            <div class="total-row">
              <span>Total</span>
              <span id="sum-total"></span>
            </div>
          </div>
          <button class="btn btn-dark pay-btn" id="pay-btn"></button>
          <p class="pay-hint">Demo only — this button doesn't process a real payment.</p>
        </aside>
      </div>
    </div>`;

  renderDeliveryOptions();
  renderPaymentOptions();
  renderSummary();
  wireEmptyControl(document.getElementById("checkout-empty-ctl"), ".summary-row", renderCheckout);

  document.getElementById("pay-btn").addEventListener("click", (e) => {
    e.target.classList.remove("shake");
    void e.target.offsetWidth;
    e.target.classList.add("shake");
    showToast("🚧 Demo checkout — payments are disabled, nothing was charged.");
  });
}

function renderDeliveryOptions() {
  const container = document.getElementById("delivery-options");
  container.innerHTML = deliveryOptions
    .map(
      (opt) => `
      <button class="option-card ${opt.id === selectedDelivery ? "selected" : ""}" data-delivery="${opt.id}">
        <span>
          <span class="label">${opt.label}</span>
          <span class="sub">${opt.eta}</span>
        </span>
        <span class="price">${opt.price === 0 ? "Free" : `$${opt.price.toFixed(2)}`}</span>
      </button>`
    )
    .join("");
  container.querySelectorAll("[data-delivery]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedDelivery = btn.getAttribute("data-delivery");
      renderDeliveryOptions();
      renderSummary();
    });
  });
}

function renderPaymentOptions() {
  const container = document.getElementById("payment-options");
  container.innerHTML = paymentOptions
    .map(
      (opt) => `
      <button class="payment-card ${opt.id === selectedPayment ? "selected" : ""}" data-payment="${opt.id}">
        ${opt.label}
      </button>`
    )
    .join("");
  container.querySelectorAll("[data-payment]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedPayment = btn.getAttribute("data-payment");
      renderPaymentOptions();
      renderPaymentExtra();
    });
  });
  renderPaymentExtra();
}

function renderPaymentExtra() {
  const container = document.getElementById("payment-extra");
  if (selectedPayment === "card") {
    container.innerHTML = `
      <div class="card-fields">
        <input class="input" style="grid-column:1/-1" placeholder="Card number" />
        <input class="input" placeholder="MM / YY" />
        <input class="input" placeholder="CVC" />
      </div>`;
  } else {
    const label = paymentOptions.find((p) => p.id === selectedPayment)?.label;
    container.innerHTML = `<p class="payment-note">You'll be redirected to ${label} to complete payment. (Simulated — nothing will actually open.)</p>`;
  }
}

function renderSummary() {
  const items = getCartWithProducts();
  const list = document.getElementById("summary-list");
  list.innerHTML = items
    .map(
      (item) => `
      <div class="summary-row">
        <div class="summary-media" style="background:${item.product.color}22">
          <img src="${esc(item.product.thumb)}" alt="${esc(item.product.name)}" />
        </div>
        <div class="summary-info">
          <p class="summary-name">${esc(item.product.name)}</p>
          <p class="summary-qty">Qty ${item.qty}</p>
        </div>
        <span class="summary-price">$${(item.product.price * item.qty).toFixed(2)}</span>
      </div>`
    )
    .join("");

  const subtotal = getCartSubtotal();
  const deliveryCost = deliveryOptions.find((d) => d.id === selectedDelivery)?.price ?? 0;
  const total = subtotal + deliveryCost;

  document.getElementById("sum-subtotal").textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById("sum-delivery").textContent =
    deliveryCost === 0 ? "Free" : `$${deliveryCost.toFixed(2)}`;
  document.getElementById("sum-total").textContent = `$${total.toFixed(2)}`;
  document.getElementById("pay-btn").textContent = `Pay $${total.toFixed(2)}`;
}

whenReady(renderCheckout);
