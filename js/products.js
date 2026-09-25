/* Catalog data comes from the Supabase `products` table (see supabase/schema.sql).
   `products` starts empty and is filled by loadProducts(); pages wait for `productsReady`
   (through whenReady() in cart.js) before rendering. */

const deliveryOptions = [
  { id: "standard", label: "Standard", eta: "5-7 business days", price: 0 },
  { id: "express", label: "Express", eta: "2-3 business days", price: 9.99 },
  { id: "priority", label: "Priority", eta: "Next business day", price: 19.99 },
];

const paymentOptions = [
  { id: "card", label: "Credit / Debit Card" },
  { id: "paypal", label: "PayPal" },
  { id: "applepay", label: "Apple Pay" },
];

const CATEGORIES = ["Figurines", "Home", "Desk", "Accessories"];

let products = [];
let productsError = null;
let MAX_CUSTOM_PRODUCTS = 10;

function rowToProduct(r) {
  return {
    id: String(r.id),
    slug: r.slug,
    name: r.name,
    price: Number(r.price),
    category: r.category,
    color: r.color,
    image: r.image,
    thumb: r.thumb,
    blurb: r.blurb,
    description: r.description,
    material: r.material,
    printTimeHours: Number(r.print_time_hours),
    custom: !!r.custom,
  };
}

async function loadProducts() {
  try {
    const { data, error } = await db.from("products").select("*").order("id");
    if (error) throw error;
    products = data.map(rowToProduct);
    productsError = null;
  } catch (e) {
    console.error("Could not load products", e);
    products = [];
    productsError = e;
  }
  return products;
}

async function loadSettings() {
  try {
    const { data, error } = await db.from("settings").select("value").eq("key", "max_custom_products").maybeSingle();
    if (error) throw error;
    if (data && Number(data.value) > 0) MAX_CUSTOM_PRODUCTS = Number(data.value);
  } catch (e) {
    console.error("Could not load settings", e);
  }
}

const productsReady = loadProducts();

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function getProductBySlug(slug) {
  return products.find((p) => p.slug === slug);
}

function getProductById(id) {
  return products.find((p) => p.id === id);
}

function productsErrorHTML() {
  return `<p class="drawer-empty">We couldn't load the products right now. Please check your connection and refresh.</p>`;
}
