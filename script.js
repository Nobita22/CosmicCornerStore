/* ============================================================
   CosmicCorner — storefront
   Modules: boot/maintenance · stars · hero · catalogue ·
            cart · checkout → worker · order tracking · request
   ============================================================ */

"use strict";

const ORDER_ENDPOINT = "https://cosmiccorner.sksameer-vsh.workers.dev";
const PRODUCTS_URL = "products.json";
const ORDERS_URL = "orders.json";
const SETTINGS_URL = "settings.json";

const ORDER_STATUS_FLOW = ["pending", "confirmed", "packed", "shipped", "delivered"];

const state = {
  products: [],
  filtered: [],
  cart: {},
  category: "all",
  filter: "all",
  search: "",
  detailId: null,
  detailQty: 1,
  detailImages: [],
  heroIndex: 0,
  heroTimer: null,
  lastOrderId: "",
};

/* ---------------- tiny helpers ---------------- */
const $ = (id) => document.getElementById(id);
const rupees = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

function toast(message, emoji = "✅") {
  const el = $("toast");
  if (!el) return;
  el.innerHTML = `<span>${emoji}</span><span>${message}</span>`;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

function showError(id, message) {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
}

/* ---------------- 1. boot: maintenance gate ---------------- */
async function boot() {
  let settings = { maintenance: false, message: "" };
  try {
    const res = await fetch(`${SETTINGS_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) settings = await res.json();
  } catch (_) {
    /* no settings.json → assume live */
  }

  $("bootLoader").hidden = true;

  if (settings && settings.maintenance) {
    $("maintenanceMessage").textContent =
      settings.message || "The shop is temporarily under maintenance. Please check back soon.";
    $("maintenanceScreen").hidden = false;
    initStars();
    return;
  }

  $("app").hidden = false;
  initStars();
  initHeroControls();
  initDrawer();
  initModalButtons();
  initFilters();
  await loadProducts();
}

/* ---------------- 2. stars ---------------- */
function initStars() {
  const bg = $("starsBg");
  if (!bg) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 70; i++) {
    const star = document.createElement("i");
    const size = Math.random() < 0.75 ? 1.5 : 2.5;
    star.className = "star";
    star.style.cssText =
      `left:${Math.random() * 100}%;top:${Math.random() * 100}%;` +
      `width:${size}px;height:${size}px;animation-duration:${(Math.random() * 2 + 1.4).toFixed(2)}s;` +
      `animation-delay:-${(Math.random() * 3).toFixed(2)}s;`;
    frag.appendChild(star);
  }
  bg.appendChild(frag);
}

/* ---------------- 3. products ---------------- */
async function loadProducts() {
  try {
    const res = await fetch(`${PRODUCTS_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("products.json " + res.status);
    const data = await res.json();
    state.products = Array.isArray(data) ? data : [];
    state.filtered = [...state.products];

    renderCategories();
    renderProducts();
    renderHero();
    updateStats();
  } catch (err) {
    $("products").innerHTML =
      `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Could not load products</h3>
       <p>Please refresh in a moment.</p></div>`;
  }
}

function updateStats() {
  $("statProducts").textContent = state.products.length;
  const cats = new Set(state.products.map((p) => p.category).filter(Boolean));
  $("statCategories").textContent = cats.size;
}

function renderCategories() {
  const known = new Set(
    Array.from(document.querySelectorAll("#categoryGrid [data-category]")).map((b) => b.dataset.category)
  );
  const grid = $("categoryGrid");
  const extra = [...new Set(state.products.map((p) => p.category).filter(Boolean))]
    .filter((c) => !known.has(c));
  extra.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "category-chip";
    btn.dataset.category = cat;
    btn.innerHTML = `<span>🏷️</span>${cat}`;
    grid.appendChild(btn);
  });
}

function productImages(p) {
  if (Array.isArray(p.images) && p.images.length) return p.images;
  if (p.image) return [p.image];
  return [];
}

function cardMedia(p) {
  const imgs = productImages(p);
  if (imgs.length) {
    return `<img src="${imgs[0]}" alt="${escapeAttr(p.name)}" loading="lazy"
      onerror="this.remove()">`;
  }
  return p.emoji || "✨";
}

const escapeAttr = (s) => String(s == null ? "" : s).replace(/"/g, "&quot;");

function renderProducts() {
  const grid = $("products");
  const empty = $("emptyState");

  if (!state.filtered.length) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = state.filtered
    .map((p) => {
      const qty = state.cart[p.id] ? state.cart[p.id].qty : 0;
      return `
      <article class="product-card" data-id="${p.id}" tabindex="0" role="button"
               aria-label="${escapeAttr(p.name)}">
        <div class="card-media">${cardMedia(p)}</div>
        <span class="card-category">${escapeAttr(p.category || "")}</span>
        <h3 class="card-name">${escapeAttr(p.name)}</h3>
        <p class="card-price">${rupees(p.price)}</p>
        <span class="card-stock ${p.stock ? "in" : "out"}">${p.stock ? "● In stock" : "● Out of stock"}</span>
        <button type="button" class="card-add" data-add="${p.id}" ${p.stock ? "" : "disabled"}>
          ${p.stock ? "Add to cart" : "Unavailable"}
        </button>
        <div class="card-stepper" data-stepper="${p.id}" ${qty ? "" : "hidden"}>
          <button type="button" data-qty="${p.id}" data-step="-1" aria-label="Decrease">−</button>
          <span data-count="${p.id}">${qty || 1}</span>
          <button type="button" data-qty="${p.id}" data-step="1" aria-label="Increase">+</button>
        </div>
      </article>`;
    })
    .join("");

  syncCardControls();
  observeCards();
}

/* quantity / add-button state, without re-rendering the grid */
function syncCardControls() {
  document.querySelectorAll(".product-card").forEach((card) => {
    const id = Number(card.dataset.id);
    const qty = state.cart[id] ? state.cart[id].qty : 0;
    const addBtn = card.querySelector("[data-add]");
    const stepper = card.querySelector("[data-stepper]");
    const count = card.querySelector("[data-count]");

    if (addBtn) addBtn.hidden = qty > 0;
    if (stepper) stepper.hidden = qty === 0;
    if (count) count.textContent = qty || 1;
    card.classList.toggle("in-cart", qty > 0);
  });
}

function observeCards() {
  const cards = document.querySelectorAll(".product-card:not(.visible)");
  if (!("IntersectionObserver" in window)) {
    cards.forEach((c) => c.classList.add("visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -20px 0px" });
  cards.forEach((c) => io.observe(c));
}

/* ---------------- 4. filters ---------------- */
function applyFilters() {
  const term = state.search.trim().toLowerCase();
  let list = state.products.filter((p) => {
    if (state.category !== "all" && p.category !== state.category) return false;
    if (state.filter === "in-stock" && !p.stock) return false;
    if (state.filter === "premium" && !(p.tags || []).includes("Premium")) return false;
    if (!term) return true;
    return (
      String(p.name).toLowerCase().includes(term) ||
      String(p.category || "").toLowerCase().includes(term) ||
      (p.tags || []).some((t) => String(t).toLowerCase().includes(term))
    );
  });

  if (state.filter === "price-low") list = [...list].sort((a, b) => a.price - b.price);
  if (state.filter === "price-high") list = [...list].sort((a, b) => b.price - a.price);

  state.filtered = list;
  renderProducts();
}

function initFilters() {
  $("searchInput").addEventListener("input", (e) => {
    state.search = e.target.value;
    applyFilters();
  });

  $("categoryGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-category]");
    if (!btn) return;
    state.category = btn.dataset.category;
    document.querySelectorAll("#categoryGrid .category-chip").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    applyFilters();
  });

  $("filterRow").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    state.filter = btn.dataset.filter;
    document.querySelectorAll("#filterRow .filter-chip").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    applyFilters();
  });

  $("clearFiltersBtn").addEventListener("click", () => {
    state.search = "";
    state.category = "all";
    state.filter = "all";
    $("searchInput").value = "";
    document.querySelectorAll("#categoryGrid .category-chip").forEach((b, i) =>
      b.classList.toggle("active", i === 0)
    );
    document.querySelectorAll("#filterRow .filter-chip").forEach((b, i) =>
      b.classList.toggle("active", i === 0)
    );
    applyFilters();
  });

  /* one delegated listener for add + stepper */
  $("products").addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      e.stopPropagation();
      addToCart(Number(add.dataset.add), 1);
      return;
    }
    const qtyBtn = e.target.closest("[data-qty]");
    if (qtyBtn) {
      e.stopPropagation();
      changeQty(Number(qtyBtn.dataset.qty), Number(qtyBtn.dataset.step));
      return;
    }
    const card = e.target.closest(".product-card");
    if (card) openDetail(Number(card.dataset.id));
  });

  $("products").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".product-card");
    if (!card) return;
    e.preventDefault();
    openDetail(Number(card.dataset.id));
  });
}

/* ---------------- 5. hero carousel ---------------- */
function renderHero() {
  const featured = state.products.slice(0, 5);
  const carousel = $("heroCarousel");
  const dots = $("heroDots");
  if (!featured.length) return;

  carousel.innerHTML = featured
    .map(
      (p, i) => `
      <div class="carousel-slide ${i === 0 ? "active" : ""}" data-hero="${p.id}">
        <span class="carousel-badge">Featured</span>
        <div class="carousel-emoji">${p.emoji || "✨"}</div>
        <div class="carousel-name">${escapeAttr(p.name)}</div>
        <div class="carousel-price">${rupees(p.price)}</div>
      </div>`
    )
    .join("");

  dots.innerHTML = featured
    .map((_, i) => `<button type="button" class="carousel-dot ${i === 0 ? "active" : ""}" data-dot="${i}" aria-label="Slide ${i + 1}"></button>`)
    .join("");

  carousel.addEventListener("click", (e) => {
    const slide = e.target.closest("[data-hero]");
    if (slide) openDetail(Number(slide.dataset.hero));
  });
  dots.addEventListener("click", (e) => {
    const dot = e.target.closest("[data-dot]");
    if (dot) goHero(Number(dot.dataset.dot));
  });

  state.heroIndex = 0;
  startHeroTimer();
}

function initHeroControls() {
  $("prevBtn").addEventListener("click", () => goHero(state.heroIndex - 1));
  $("nextBtn").addEventListener("click", () => goHero(state.heroIndex + 1));
}

function goHero(index) {
  const slides = document.querySelectorAll(".carousel-slide");
  const dots = document.querySelectorAll(".carousel-dot");
  if (!slides.length) return;

  state.heroIndex = (index + slides.length) % slides.length;
  slides.forEach((s, i) => s.classList.toggle("active", i === state.heroIndex));
  dots.forEach((d, i) => d.classList.toggle("active", i === state.heroIndex));
  startHeroTimer();
}

function startHeroTimer() {
  clearInterval(state.heroTimer);
  const slides = document.querySelectorAll(".carousel-slide");
  if (slides.length < 2) return;
  state.heroTimer = setInterval(() => goHero(state.heroIndex + 1), 5200);
}

/* ---------------- 6. cart ---------------- */
function addToCart(id, qty = 1, note = "") {
  const product = state.products.find((p) => p.id === id);
  if (!product || !product.stock) return;

  if (!state.cart[id]) state.cart[id] = { name: product.name, price: product.price, qty: 0, note: "" };
  state.cart[id].qty += qty;
  if (note) state.cart[id].note = note;
  afterCartChange();
  toast(`Added “${product.name}”`, "🛒");
}

function changeQty(id, step) {
  const line = state.cart[id];
  if (!line) return;
  line.qty += step;
  if (line.qty <= 0) delete state.cart[id];
  afterCartChange();
}

function removeLine(id) {
  delete state.cart[id];
  afterCartChange();
}

function afterCartChange() {
  renderCart();
  syncCardControls();
  const count = Object.values(state.cart).reduce((n, l) => n + l.qty, 0);
  const badge = $("cartBadge");
  const headerCount = $("cartCount");
  if (badge) {
    badge.textContent = count;
    badge.hidden = count === 0;
  }
  if (headerCount) {
    headerCount.textContent = count;
    headerCount.classList.toggle("zero", count === 0);
  }
  [$("floatingCartBtn"), $("cartBtn")].forEach((b) => {
    if (!b) return;
    b.classList.remove("bounce");
    void b.offsetWidth;
    b.classList.add("bounce");
  });
}

function renderCart() {
  const box = $("cartItems");
  const lines = Object.entries(state.cart);

  if (!lines.length) {
    box.innerHTML = `<div class="cart-empty"><span>🛒</span>Your cart is empty</div>`;
    $("cartSummary").hidden = true;
    $("checkoutBtn").disabled = true;
    return;
  }

  let items = 0;
  let total = 0;
  box.innerHTML = lines
    .map(([id, line]) => {
      const sum = line.price * line.qty;
      items += line.qty;
      total += sum;
      return `
      <div class="cart-item">
        <div>
          <div class="cart-item-name">${escapeAttr(line.name)}</div>
          <div class="cart-item-meta">${rupees(line.price)} each</div>
          <button type="button" class="cart-remove" data-remove="${id}">Remove</button>
        </div>
        <div class="cart-item-right">
          <div class="cart-qty">
            <button type="button" data-cart-qty="${id}" data-step="-1" aria-label="Decrease">−</button>
            <span>${line.qty}</span>
            <button type="button" data-cart-qty="${id}" data-step="1" aria-label="Increase">+</button>
          </div>
          <span class="cart-item-total">${rupees(sum)}</span>
        </div>
      </div>`;
    })
    .join("");

  $("totalItems").textContent = items;
  $("totalPrice").textContent = rupees(total);
  $("cartSummary").hidden = false;
  $("checkoutBtn").disabled = false;
}

/* ---------------- 7. product detail ---------------- */
function openDetail(id) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;

  state.detailId = id;
  state.detailQty = 1;
  state.detailImages = productImages(p);

  $("detailName").textContent = p.name;
  $("detailEmoji").textContent = p.emoji || "✨";
  $("detailCategory").textContent = p.category || "";
  $("detailPrice").textContent = rupees(p.price);
  $("detailDescription").textContent = p.description || "";
  $("detailQtyDisplay").textContent = "1";

  const badge = $("detailStockBadge");
  badge.textContent = p.stock ? "In stock" : "Out of stock";
  badge.className = "status-badge " + (p.stock ? "status-in" : "status-out");

  $("detailTags").innerHTML = (p.tags || [])
    .map((t) => `<span class="tag">#${escapeAttr(t)}</span>`)
    .join("");

  if (state.detailImages.length) {
    $("detailEmoji").hidden = true;
    $("detailGallery").hidden = false;
    $("detailMainImage").src = state.detailImages[0];
    $("detailMainImage").alt = p.name;
    $("detailThumbs").innerHTML = state.detailImages
      .map(
        (src, i) =>
          `<img class="detail-thumb ${i === 0 ? "active" : ""}" src="${src}" alt="View ${i + 1}" data-thumb="${i}">`
      )
      .join("");
  } else {
    $("detailEmoji").hidden = false;
    $("detailGallery").hidden = true;
  }

  $("detailActions").hidden = !p.stock;
  $("customizeBtn").hidden = !(p.stock && p.customizable);
  $("requestBtn").hidden = !!p.stock;
  $("customizationSection").hidden = true;
  $("detailThumbs").onclick = (e) => {
    const thumb = e.target.closest("[data-thumb]");
    if (!thumb) return;
    const i = Number(thumb.dataset.thumb);
    $("detailMainImage").src = state.detailImages[i];
    document.querySelectorAll(".detail-thumb").forEach((t) => t.classList.toggle("active", t === thumb));
  };

  openModal("productDetailModal");
}

function initModalButtons() {
  /* detail */
  $("detailBackBtn").addEventListener("click", () => closeModal("productDetailModal"));
  $("detailCloseBtn").addEventListener("click", () => closeModal("productDetailModal"));
  $("detailQtyMinus").addEventListener("click", () => {
    state.detailQty = Math.max(1, state.detailQty - 1);
    $("detailQtyDisplay").textContent = state.detailQty;
  });
  $("detailQtyPlus").addEventListener("click", () => {
    state.detailQty = Math.min(20, state.detailQty + 1);
    $("detailQtyDisplay").textContent = state.detailQty;
  });
  $("detailAddBtn").addEventListener("click", () => {
    const block = $("customizationSection");
    let note = "";
    if (block && !block.hidden) {
      const parts = [];
      const type = $("designType") ? $("designType").value : "same";
      if (type !== "same") parts.push(type === "custom-qr" ? "QR code" : "custom design");
      const link = $("designLink") ? $("designLink").value.trim() : "";
      if (link) parts.push("ref: " + link.slice(0, 40));
      const colour = $("customColor") ? $("customColor").value.trim() : "";
      if (colour) parts.push("colour: " + colour);
      const extra = $("specialInstructions") ? $("specialInstructions").value.trim() : "";
      if (extra) parts.push(extra.slice(0, 60));
      note = parts.join(", ");
    }
    addToCart(state.detailId, state.detailQty, note);
    closeModal("productDetailModal");
  });
  $("customizeBtn").addEventListener("click", () => {
    const block = $("customizationSection");
    block.hidden = !block.hidden;
    $("customizeBtn").textContent = block.hidden ? "✨ Customise this item" : "✕ Hide customisation";
  });
  $("requestBtn").addEventListener("click", () => {
    const p = state.products.find((x) => x.id === state.detailId);
    $("requestProductName").value = p ? `${p.name} ${p.emoji || ""}`.trim() : "";
    closeModal("productDetailModal");
    openModal("requestModal");
  });

  /* cart */
  $("cartBtn").addEventListener("click", () => openModal("cartModal"));
  $("floatingCartBtn").addEventListener("click", () => openModal("cartModal"));
  $("closeCartBtn").addEventListener("click", () => closeModal("cartModal"));
  $("continueShoppingBtn").addEventListener("click", () => closeModal("cartModal"));
  $("cartItems").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove]");
    if (rm) return removeLine(Number(rm.dataset.remove));
    const q = e.target.closest("[data-cart-qty]");
    if (q) changeQty(Number(q.dataset.cartQty), Number(q.dataset.step));
  });
  $("checkoutBtn").addEventListener("click", () => {
    if (!Object.keys(state.cart).length) return;
    closeModal("cartModal");
    resetCheckout();
    openModal("checkoutModal");
  });

  /* checkout */
  $("cancelBtn").addEventListener("click", () => {
    closeModal("checkoutModal");
    resetCheckout();
  });
  $("checkoutCloseBtn").addEventListener("click", () => {
    closeModal("checkoutModal");
    resetCheckout();
  });
  $("successCloseBtn").addEventListener("click", () => {
    closeModal("checkoutModal");
    resetCheckout();
  });
  $("checkoutForm").addEventListener("submit", placeOrder);

  /* tracking */
  document.querySelectorAll("[data-open-track]").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openTrack();
    })
  );
  $("trackBtn").addEventListener("click", openTrack);
  $("maintenanceTrackBtn").addEventListener("click", openTrack);
  $("closeTrackBtn").addEventListener("click", () => closeModal("trackModal"));
  $("trackForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const value = $("trackInput").value.trim();
    if (!value) return showError("trackError", "Enter your order ID.");
    showError("trackError", "");
    trackOrder(value);
  });
  $("trackNowBtn").addEventListener("click", () => {
    const id = state.lastOrderId;
    closeModal("checkoutModal");
    resetCheckout();
    openTrack(id);
  });

  /* request */
  $("cancelRequestBtn").addEventListener("click", () => closeModal("requestModal"));
  $("closeRequestBtn").addEventListener("click", () => closeModal("requestModal"));
  $("requestForm").addEventListener("submit", sendRequest);

  /* backdrop + escape */
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
        if (modal.id === "checkoutModal") resetCheckout();
      }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const open = document.querySelector(".modal:not([hidden])");
      if (open) {
        closeModal(open.id);
        if (open.id === "checkoutModal") resetCheckout();
      }
    }
  });
}

function openModal(id) {
  const el = $(id);
  if (!el) return;
  el.hidden = false;
  document.body.style.overflow = "hidden";
  const focusable = el.querySelector("input,button,select,textarea");
  if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 60);
}

function closeModal(id) {
  const el = $(id);
  if (!el) return;
  el.hidden = true;
  if (!document.querySelector(".modal:not([hidden])")) document.body.style.overflow = "";
}

/* ---------------- 8. checkout ---------------- */
function generateOrderId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const stamp = String(d.getFullYear()).slice(-2) + p(d.getMonth() + 1) + p(d.getDate());
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X");
  return `CC-${stamp}-${rand}`;
}

function collectCustomer() {
  const customer = {
    name: $("fullName").value.trim(),
    phone: $("phone").value.trim(),
    email: $("email").value.trim(),
    address: [
      $("address").value.trim(),
      $("city").value.trim(),
      $("postalCode").value.trim(),
    ]
      .filter(Boolean)
      .join(", "),
  };

  const required = [
    ["fullName", customer.name],
    ["phone", customer.phone],
    ["email", customer.email],
    ["address", $("address").value.trim()],
    ["city", $("city").value.trim()],
    ["postalCode", $("postalCode").value.trim()],
  ];

  for (const [field, value] of required) {
    const input = $(field);
    const valid = value.length >= (field === "postalCode" ? 4 : 2);
    input.classList.toggle("invalid", !valid);
    if (!valid) {
      showError("checkoutError", "Please fill in all required fields correctly.");
      input.focus({ preventScroll: true });
      return null;
    }
  }
  showError("checkoutError", "");
  return customer;
}

async function placeOrder(e) {
  e.preventDefault();
  const customer = collectCustomer();
  if (!customer) return;

  const items = Object.entries(state.cart).map(([id, line]) => ({
    id: Number(id),
    name: (line.note ? `${line.name} [${line.note}]` : line.name).slice(0, 95),
    quantity: line.qty,
    price: line.price,
  }));
  if (!items.length) {
    showError("checkoutError", "Your cart is empty.");
    return;
  }

  const localId = generateOrderId();
  const button = $("placeOrderBtn");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Placing order... please wait";

  $("copyOrderBtn").hidden = true;
  showError("checkoutError", "");

  // A stalled connection must never leave the button spinning forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(ORDER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: localId, customer, items, total: totalOf(items) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.error || `Order service responded ${res.status}`);
    }

    const data = await res.json().catch(() => ({}));
    // The worker is the source of truth: it may issue its own order ID.
    // Using the returned ID keeps Track Order in sync with orders.json.
    const orderId = data.order_id || localId;

    state.lastOrderId = orderId;
    state.cart = {};
    afterCartChange();
    $("checkoutForm").reset();
    $("checkoutForm").hidden = true;
    $("orderIdBox").textContent = orderId;
    $("orderSuccess").hidden = false;
    toast("Order placed - " + orderId, "📨");
  } catch (err) {
    const timedOut = err.name === "AbortError";
    showError(
      "checkoutError",
      timedOut
        ? "The order service took too long to respond. Your cart is still saved - try again, or copy your order details below."
        : `Could not place the order (${err.message}). Your cart is still saved.` +
            (location.hostname !== "www.cosmiccorner.in"
              ? " Note: orders only go through on https://www.cosmiccorner.in."
              : "")
    );
    offerOrderCopy(localId, customer, items);
  } finally {
    clearTimeout(timer);
    button.disabled = false;
    button.textContent = original;
  }
}

/* If an order cannot be sent, let the customer keep a copy of it. */
function offerOrderCopy(orderId, customer, items) {
  const btn = $("copyOrderBtn");
  if (!btn) return;

  const lines = [
    `CosmicCorner order ${orderId}`,
    `Name: ${customer.name}`,
    `Phone: ${customer.phone}`,
    `Email: ${customer.email}`,
    `Address: ${customer.address}`,
    "",
    ...items.map((i) => `${i.name} x ${i.quantity} = \u20B9${i.price * i.quantity}`),
    "",
    `Total: \u20B9${totalOf(items)}`,
  ];

  btn.hidden = false;
  btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast("Order details copied - send them to us", "📋");
    } catch (_) {
      showError("checkoutError", lines.join(" \u00B7 "));
    }
  };
}

function resetCheckout() {
  $("orderSuccess").hidden = true;
  $("checkoutForm").hidden = false;
  showError("checkoutError", "");
}

const totalOf = (items) => items.reduce((sum, i) => sum + i.price * i.quantity, 0);

/* ---------------- 9. tracking ---------------- */
function openTrack(prefill) {
  showError("trackError", "");
  $("trackResult").hidden = true;
  $("trackResult").innerHTML = "";
  $("trackInput").value = prefill || "";
  openModal("trackModal");
  if (prefill) trackOrder(prefill);
}

async function trackOrder(rawId) {
  const result = $("trackResult");
  const button = $("trackSubmitBtn");

  result.hidden = false;
  result.innerHTML = `<div class="track-loading">🔎 Looking up your order…</div>`;
  button.disabled = true;

  try {
    const res = await fetch(`${ORDERS_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("orders.json " + res.status);
    const orders = await res.json();
    const list = Array.isArray(orders) ? orders : [];

    const wanted = String(rawId).toLowerCase().replace(/\s+/g, "");
    const order = list.find(
      (o) => String(o.order_id || "").toLowerCase().replace(/\s+/g, "") === wanted
    );
    renderTrack(order, rawId);
  } catch (_) {
    result.innerHTML = `<div class="track-miss"><div class="track-miss-icon">⚠️</div>
      <p>Could not load order records. Please try again in a moment.</p></div>`;
  } finally {
    button.disabled = false;
  }
}

function renderTrack(order, query) {
  const box = $("trackResult");
  box.hidden = false;

  if (!order) {
    box.innerHTML = `
      <div class="track-miss">
        <div class="track-miss-icon">🔍</div>
        <p>No order found for <strong>${escapeAttr(query)}</strong>.</p>
        <p class="hint">Check the ID from your confirmation — it looks like
          <code>CC-261113-7F3K</code>. New orders can take a minute to appear.</p>
      </div>`;
    return;
  }

  const status = String(order.status || "pending").toLowerCase();
  const isCancelled = status === "cancelled";
  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);

  const timeline = ORDER_STATUS_FLOW.map((step, i) => {
    const done = !isCancelled && currentIndex >= i;
    return `<div class="timeline-step ${done ? "done" : ""}">
        <span class="timeline-dot"></span>
        <span class="timeline-label">${step}</span>
      </div>`;
  }).join("");

  box.innerHTML = `
    <div class="track-card">
      <div class="track-head">
        <div>
          <div class="track-id">${escapeAttr(order.order_id)}</div>
          <div class="track-date">Placed ${formatDate(order.placed_at)}</div>
        </div>
        <span class="status-badge status-${status}">${status}</span>
      </div>

      ${isCancelled
        ? `<p class="track-note">This order was cancelled. Contact us if that looks wrong.</p>`
        : `<div class="timeline">${timeline}</div>`}

      <div class="track-rows">
        ${order.item_count ? `<div class="track-row"><span>Items</span><span>${order.item_count}</span></div>` : ""}
        ${order.total ? `<div class="track-row"><span>Total</span><span>${rupees(order.total)}</span></div>` : ""}
        ${order.updated_at ? `<div class="track-row"><span>Last update</span><span>${formatDate(order.updated_at)}</span></div>` : ""}
      </div>
    </div>`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/* ---------------- 10. product request ---------------- */
async function sendRequest(e) {
  e.preventDefault();
  const name = $("requestName").value.trim();
  const phone = $("requestPhone").value.trim();
  const email = $("requestEmail").value.trim();
  const details = $("requestDetails").value.trim();

  if (!name || !phone || !email) {
    showError("requestError", "Name, phone and email are required.");
    return;
  }

  const button = e.target.querySelector('button[type="submit"]');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Sending…";

  try {
    const res = await fetch(ORDER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: generateOrderId(),
        customer: { name, phone, email, address: details || "Product request (out of stock)" },
        items: [{
          id: state.detailId,
          name: "REQUEST: " + ($("requestProductName").value || "product"),
          quantity: 1,
          price: 0,
        }],
        type: "request",
      }),
    });
    if (!res.ok) throw new Error("service responded " + res.status);

    $("requestForm").reset();
    closeModal("requestModal");
    toast("Request sent — we'll let you know!", "🔔");
  } catch (err) {
    showError("requestError", "Could not send the request (" + err.message + ").");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

/* ---------------- 11. mobile drawer ---------------- */
function initDrawer() {
  const drawer = $("mobileMenu");
  const backdrop = $("drawerBackdrop");

  const open = () => {
    drawer.hidden = false;
    backdrop.hidden = false;
    $("menuBtn").setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    drawer.hidden = true;
    backdrop.hidden = true;
    $("menuBtn").setAttribute("aria-expanded", "false");
    if (!document.querySelector(".modal:not([hidden])")) document.body.style.overflow = "";
  };

  $("menuBtn").addEventListener("click", open);
  $("menuCloseBtn").addEventListener("click", close);
  backdrop.addEventListener("click", close);
  drawer.querySelectorAll("[data-close-drawer]").forEach((a) => a.addEventListener("click", close));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drawer.hidden) close();
  });
}

/* ---------------- start ---------------- */
boot();