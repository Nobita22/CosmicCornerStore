/* ============================================================
   CosmicCorner - Combined Shop Script
   - Products loaded from products.json (separate data file)
   - Theme behaviour from index.html (CosmicCorner shop)
   - Sections & WhatsApp flow from index2.html (PRINTPLAY)
   ============================================================ */

// ==================== CONFIG ====================
const WHATSAPP_NUMBER = "918341481888";   // WhatsApp number for orders
const BRAND = "CosmicCorner";

// ==================== STATE ====================
let products = [];
let cart = {};
let filteredProducts = [];
let detailQty = 1;
let currentDetailProductId = null;
let showCustomization = {};
let currentHeroSlide = 0;
let heroInterval;
let currentCategory = 'all';
let currentFilter = 'all';
let currentSearchTerm = '';

// ==================== LOAD PRODUCTS (products.json) ====================
async function loadProducts() {
  try {
    const response = await fetch('products.json');
    if (!response.ok) throw new Error('Could not load products');
    products = await response.json();
    filteredProducts = [...products];
    createStars();
    initHeroCarousel();
    renderProducts();
    updateHeroStats();
    initReveal();
  } catch (error) {
    document.getElementById('products').innerHTML =
      '<div class="load-error">Unable to load products. Please run the site using a local server (e.g. VS Code Live Server).</div>';
  }
}

function updateHeroStats() {
  const productCountEl = document.getElementById('statProducts');
  const categoryCountEl = document.getElementById('statCategories');
  if (productCountEl) productCountEl.textContent = products.length;
  if (categoryCountEl) {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    categoryCountEl.textContent = cats.size;
  }
}

// ==================== STARFIELD BACKGROUND ====================
function createStars() {
  const bg = document.getElementById('starsBg');

  for (let i = 0; i < 100; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.animationDuration = (Math.random() * 2 + 1) + 's';
    star.style.animationDelay = Math.random() * 2 + 's';
    bg.appendChild(star);
  }

  setInterval(() => {
    const shootingStar = document.createElement('div');
    shootingStar.className = 'shooting-star';
    shootingStar.style.left = Math.random() * 80 + '%';
    shootingStar.style.top = Math.random() * 40 + '%';
    shootingStar.style.animationDuration = (Math.random() * 2 + 1) + 's';
    bg.appendChild(shootingStar);
    setTimeout(() => shootingStar.remove(), 3000);
  }, 2500);
}

// ==================== HERO CAROUSEL ====================
function initHeroCarousel() {
  const carousel = document.getElementById('heroCarousel');
  const dots = document.getElementById('heroDots');
  const featured = products.slice(0, 5);

  carousel.innerHTML = featured.map((p, idx) => `
    <div class="hero-slide ${idx === 0 ? 'active' : ''}" onclick="openProductDetail(${p.id})" style="z-index: ${5 - idx}">
      <div class="hero-featured-badge">✨ Featured</div>
      <div class="hero-slide-emoji">${p.emoji}</div>
      <div class="hero-slide-name">${p.name}</div>
      <div class="hero-slide-price">₹${p.price}</div>
      <div class="view-hint">Tap to view →</div>
    </div>
  `).join('');

  dots.innerHTML = featured.map((_, idx) => `
    <div class="hero-dot ${idx === 0 ? 'active' : ''}" onclick="goToSlide(${idx})"></div>
  `).join('');

  startHeroAutoPlay();
}

function showSlide(n) {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot');

  if (n >= slides.length) currentHeroSlide = 0;
  if (n < 0) currentHeroSlide = slides.length - 1;

  slides.forEach((slide, idx) => {
    slide.classList.remove('active');
    slide.style.zIndex = 5 - idx;
  });
  dots.forEach(dot => dot.classList.remove('active'));

  if (slides.length > 0) {
    slides[currentHeroSlide].classList.add('active');
    slides[currentHeroSlide].style.zIndex = 10;
    dots[currentHeroSlide].classList.add('active');
  }
}

function nextSlide() {
  currentHeroSlide++;
  showSlide(currentHeroSlide);
  resetAutoPlay();
}

function prevSlide() {
  currentHeroSlide--;
  showSlide(currentHeroSlide);
  resetAutoPlay();
}

function goToSlide(n) {
  currentHeroSlide = n;
  showSlide(currentHeroSlide);
  resetAutoPlay();
}

function startHeroAutoPlay() {
  heroInterval = setInterval(() => nextSlide(), 5000);
}

function resetAutoPlay() {
  clearInterval(heroInterval);
  startHeroAutoPlay();
}

// ==================== PRODUCT GRID ====================
function productImages(p) {
  if (Array.isArray(p.images) && p.images.length) return p.images;
  if (p.image) return [p.image];
  return [];
}

function productVisual(p) {
  const imgs = productImages(p);
  if (imgs.length) {
    return `<img src="${imgs[0]}" alt="${p.name}" onerror="this.outerHTML='${p.emoji}'">`;
  }
  return p.emoji;
}

function renderProducts() {
  const grid = document.getElementById('products');
  const emptyState = document.getElementById('emptyState');

  if (filteredProducts.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  grid.innerHTML = filteredProducts.map(p => `
    <div class="product-card reveal" onclick="openProductDetail(${p.id})">
      <div class="product-image">${productVisual(p)}</div>
      <div class="product-info">
        <small>${p.category}</small>
        <h3>${p.name}</h3>
        <p>₹${p.price}</p>
        <div class="stock-badge ${p.stock ? 'stock-in' : 'stock-out'}">
          ${p.stock ? '✓ In Stock' : '✗ Out of Stock'}
        </div>
        <button class="add-btn" onclick="event.stopPropagation(); addToCart(${p.id}, 1);" ${p.stock ? '' : 'disabled'}>
          ${p.stock ? 'Add to Cart +' : 'Out of Stock'}
        </button>
      </div>
    </div>
  `).join('');

  initReveal();
  initTilt();
}

// ==================== FILTERS ====================
function applyFilters() {
  const term = currentSearchTerm.toLowerCase();

  filteredProducts = products.filter(p => {
    const matchesCategory = currentCategory === 'all' || p.category === currentCategory;
    const matchesSearch = !term ||
      p.name.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term) ||
      (p.tags || []).some(t => t.toLowerCase().includes(term));

    if (!matchesCategory || !matchesSearch) return false;
    if (currentFilter === 'in-stock') return p.stock;
    if (currentFilter === 'premium') return (p.tags || []).includes('Premium');
    return true;
  });

  if (currentFilter === 'price-low') {
    filteredProducts.sort((a, b) => a.price - b.price);
  } else if (currentFilter === 'price-high') {
    filteredProducts.sort((a, b) => b.price - a.price);
  }

  renderProducts();
}

function setCategory(category, btn) {
  currentCategory = category;
  document.querySelectorAll('#categoryGrid button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  applyFilters();
  document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('#filterRow .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  applyFilters();
}

// ==================== PRODUCT DETAIL ====================
let currentDetailImages = [];

function setDetailImage(index, thumb) {
  const imgs = currentDetailImages;
  if (!imgs[index]) return;
  document.getElementById('detailMainImage').src = imgs[index];
  document.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('active'));
  if (thumb) thumb.classList.add('active');
}

function openProductDetail(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  currentDetailProductId = id;
  detailQty = 1;
  showCustomization[id] = false;

  document.getElementById('detailTitle').textContent = product.name;
  document.getElementById('detailEmoji').textContent = product.emoji;
  document.getElementById('detailName').textContent = product.name;
  document.getElementById('detailCategory').textContent = product.category;
  document.getElementById('detailPrice').textContent = '₹' + product.price;
  document.getElementById('detailDescription').textContent = product.description;
  document.getElementById('detailQtyDisplay').textContent = '1';

  // image gallery or emoji fallback
  const imgs = productImages(product);
  const emojiEl = document.getElementById('detailEmoji');
  const galleryEl = document.getElementById('detailGallery');
  if (imgs.length) {
    currentDetailImages = imgs;
    emojiEl.style.display = 'none';
    galleryEl.style.display = 'block';
    document.getElementById('detailMainImage').src = imgs[0];
    document.getElementById('detailMainImage').alt = product.name;
    document.getElementById('detailThumbs').innerHTML = imgs.map((src, i) =>
      `<img class="detail-thumb ${i === 0 ? 'active' : ''}" src="${src}" alt="view ${i + 1}" onclick="setDetailImage(${i}, this)">`
    ).join('');
  } else {
    currentDetailImages = [];
    emojiEl.style.display = 'block';
    galleryEl.style.display = 'none';
  }

  const stockBadge = document.getElementById('detailStockBadge');
  if (product.stock) {
    stockBadge.textContent = 'In Stock';
    stockBadge.className = 'detail-stock-badge stock-in';
  } else {
    stockBadge.textContent = 'Out of Stock';
    stockBadge.className = 'detail-stock-badge stock-out';
  }

  document.getElementById('detailTags').innerHTML =
    product.tags.map(tag => `<span class="tag">#${tag}</span>`).join('');

  document.getElementById('detailAddBtn').style.display = product.stock ? 'block' : 'none';
  document.getElementById('detailActions').style.display = product.stock ? 'flex' : 'none';
  document.getElementById('customizeBtn').style.display = (product.stock && product.customizable) ? 'block' : 'none';
  document.getElementById('requestBtn').style.display = !product.stock ? 'block' : 'none';
  document.getElementById('customizationSection').style.display = 'none';

  document.getElementById('productDetailModal').classList.add('active');
}

function closeProductDetail() {
  document.getElementById('productDetailModal').classList.remove('active');
}

// ==================== CART ====================
function addToCart(id, qty = 1) {
  const product = products.find(p => p.id === id);
  if (!product || !product.stock) return;

  if (!cart[id]) {
    cart[id] = { name: product.name, price: product.price, qty: 0 };
  }
  cart[id].qty += qty;
  updateCart();
  showToast(`${product.emoji} Added "${product.name}" to cart`);
  bounceCart();
}

function removeFromCart(id) {
  delete cart[id];
  updateCart();
}

function updateQty(id, change) {
  if (cart[id]) {
    cart[id].qty += change;
    if (cart[id].qty <= 0) {
      removeFromCart(id);
    } else {
      updateCart();
    }
  }
}

function updateCart() {
  const cartItems = document.getElementById('cartItems');
  const cartSummary = document.getElementById('cartSummary');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const cartBadge = document.getElementById('cartBadge');
  const cartCount = document.getElementById('cart-count');

  const items = Object.entries(cart);

  if (items.length === 0) {
    cartItems.innerHTML = '<div class="cart-empty">Cart is empty</div>';
    cartSummary.style.display = 'none';
    checkoutBtn.disabled = true;
    cartBadge.style.display = 'none';
    if (cartCount) cartCount.textContent = '0';
    return;
  }

  let totalQty = 0;
  let totalPrice = 0;

  cartItems.innerHTML = items.map(([id, item]) => {
    const itemTotal = item.price * item.qty;
    totalQty += item.qty;
    totalPrice += itemTotal;

    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div>${item.name}</div>
          <div style="font-size: 12px; opacity: 0.7;">₹${item.price} each</div>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="updateQty(${id}, -1)">−</button>
          <span style="min-width: 30px; text-align: center;">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty(${id}, 1)">+</button>
          <span style="margin-left: 15px; font-weight: bold;">₹${itemTotal}</span>
        </div>
        <button class="remove-btn" onclick="removeFromCart(${id})">Remove</button>
      </div>
    `;
  }).join('');

  document.getElementById('totalItems').textContent = totalQty;
  document.getElementById('totalPrice').textContent = '₹' + totalPrice;
  cartSummary.style.display = 'block';
  checkoutBtn.disabled = false;

  cartBadge.textContent = totalQty;
  cartBadge.style.display = 'block';
  if (cartCount) cartCount.textContent = totalQty;
}

function toggleCart() {
  document.getElementById('cartModal').classList.toggle('active');
}

// ==================== WHATSAPP FLOWS ====================
function checkout() {
  if (Object.keys(cart).length === 0) {
    alert('Your cart is empty!');
    return;
  }
  document.getElementById('cartModal').classList.remove('active');
  document.getElementById('checkoutModal').classList.add('active');
}

document.getElementById('checkoutForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const fullName = document.getElementById('fullName').value;
  const phone = document.getElementById('phone').value;
  const email = document.getElementById('email').value;
  const address = document.getElementById('address').value;
  const city = document.getElementById('city').value;
  const postalCode = document.getElementById('postalCode').value;

  let orderText = `*${BRAND} Order*\n\n`;
  orderText += `*Customer Details:*\n`;
  orderText += `Name: ${fullName}\n`;
  orderText += `Phone: ${phone}\n`;
  orderText += `Email: ${email}\n`;
  orderText += `Address: ${address}, ${city} - ${postalCode}\n\n`;
  orderText += `*Order Details:*\n`;

  let totalPrice = 0;
  Object.values(cart).forEach(item => {
    const itemTotal = item.price * item.qty;
    orderText += `${item.name} x${item.qty} = ₹${itemTotal}\n`;
    totalPrice += itemTotal;
  });

  orderText += `\n*Total: ₹${totalPrice}*`;

  const encodedMessage = encodeURIComponent(orderText);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`, '_blank');

  cart = {};
  updateCart();
  document.getElementById('checkoutModal').classList.remove('active');
  document.getElementById('checkoutForm').reset();
});

document.getElementById('requestForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const product = products.find(p => p.id === currentDetailProductId);
  const name = document.getElementById('requestName').value;
  const phone = document.getElementById('requestPhone').value;
  const email = document.getElementById('requestEmail').value;
  const details = document.getElementById('requestDetails').value;

  let message = `*Product Request - ${BRAND}*\n\n`;
  message += `Product: ${product ? product.name + ' ' + product.emoji : 'Unknown'}\n`;
  message += `Status: Currently Out of Stock\n\n`;
  message += `*Customer Details:*\n`;
  message += `Name: ${name}\n`;
  message += `Phone: ${phone}\n`;
  message += `Email: ${email}\n\n`;
  message += `*Request Details:*\n`;
  message += `${details || 'No additional details'}\n\n`;
  message += `Please notify me when this item is back in stock!`;

  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`, '_blank');

  document.getElementById('requestModal').classList.remove('active');
  document.getElementById('requestForm').reset();
});

// ==================== MODAL HELPERS ====================
function handleBackAction() {
  if (document.getElementById('productDetailModal').classList.contains('active')) {
    closeProductDetail();
    return true;
  } else if (document.getElementById('cartModal').classList.contains('active')) {
    document.getElementById('cartModal').classList.remove('active');
    return true;
  } else if (document.getElementById('checkoutModal').classList.contains('active')) {
    document.getElementById('checkoutModal').classList.remove('active');
    return true;
  } else if (document.getElementById('requestModal').classList.contains('active')) {
    document.getElementById('requestModal').classList.remove('active');
    return true;
  }
  return false;
}

// ==================== EVENT LISTENERS ====================
const cartHeaderBtn = document.getElementById('cartBtn');
if (cartHeaderBtn) cartHeaderBtn.addEventListener('click', toggleCart);
document.getElementById('floatingCartBtn').addEventListener('click', toggleCart);
document.getElementById('closeCartBtn').addEventListener('click', () => {
  document.getElementById('cartModal').classList.remove('active');
});
document.getElementById('checkoutBtn').addEventListener('click', checkout);
document.getElementById('cancelBtn').addEventListener('click', () => {
  document.getElementById('checkoutModal').classList.remove('active');
});

document.getElementById('detailBackBtn').addEventListener('click', closeProductDetail);

document.getElementById('detailQtyPlus').addEventListener('click', () => {
  detailQty++;
  document.getElementById('detailQtyDisplay').textContent = detailQty;
});

document.getElementById('detailQtyMinus').addEventListener('click', () => {
  if (detailQty > 1) {
    detailQty--;
    document.getElementById('detailQtyDisplay').textContent = detailQty;
  }
});

document.getElementById('detailAddBtn').addEventListener('click', () => {
  if (currentDetailProductId) {
    addToCart(currentDetailProductId, detailQty);
    closeProductDetail();
  }
});

document.getElementById('customizeBtn').addEventListener('click', () => {
  showCustomization[currentDetailProductId] = !showCustomization[currentDetailProductId];
  document.getElementById('customizationSection').style.display =
    showCustomization[currentDetailProductId] ? 'block' : 'none';
  document.getElementById('customizeBtn').textContent =
    showCustomization[currentDetailProductId] ? '✕ Hide Customization' : '✨ Customize This Item';
});

document.getElementById('requestBtn').addEventListener('click', () => {
  const product = products.find(p => p.id === currentDetailProductId);
  document.getElementById('requestProductName').value = product.name + ' - ' + product.emoji;
  document.getElementById('productDetailModal').classList.remove('active');
  document.getElementById('requestModal').classList.add('active');
});

document.getElementById('closeRequestBtn').addEventListener('click', () => {
  document.getElementById('requestModal').classList.remove('active');
});

// Search
document.getElementById('search').addEventListener('input', (e) => {
  currentSearchTerm = e.target.value;
  applyFilters();
});

// Category buttons
document.querySelectorAll('#categoryGrid button').forEach(btn => {
  btn.addEventListener('click', () => setCategory(btn.dataset.category, btn));
});

// Filter buttons
document.querySelectorAll('#filterRow .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter, btn));
});

// Hero carousel controls
document.getElementById('nextBtn').addEventListener('click', nextSlide);
document.getElementById('prevBtn').addEventListener('click', prevSlide);

// Escape key closes topmost modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    handleBackAction();
  }
});

// Android swipe-back gesture
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;

  const diffX = touchEndX - touchStartX;
  const diffY = Math.abs(touchEndY - touchStartY);

  // Right swipe from the left edge of the screen
  if (diffX > 50 && diffY < 100 && touchStartX < 50) {
    handleBackAction();
  }
}, { passive: true });

// ==================== UI EXTRAS ====================
// toast notification
function showToast(message, emoji = '✅') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="toast-emoji">${emoji}</span><span>${message}</span>`;
  // force reflow so repeated toasts re-animate
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// bounce on the cart buttons after adding
function bounceCart() {
  const btn = document.getElementById('floatingCartBtn');
  const headerBtn = document.getElementById('cartBtn');
  if (btn) {
    btn.classList.remove('bounce');
    void btn.offsetWidth;
    btn.classList.add('bounce');
  }
  if (headerBtn) {
    headerBtn.classList.remove('bounce');
    void headerBtn.offsetWidth;
    headerBtn.classList.add('bounce');
  }
  setTimeout(() => {
    if (btn) btn.classList.remove('bounce');
    if (headerBtn) headerBtn.classList.remove('bounce');
  }, 450);
}

// scroll-reveal animation
function initReveal() {
  const els = document.querySelectorAll('.reveal:not(.visible)');
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
  els.forEach(el => io.observe(el));
}

// subtle 3D tilt on product cards (desktop mouse only)
function initTilt() {
  if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return;
  document.querySelectorAll('.product-card').forEach(card => {
    if (card.dataset.tiltReady) return;
    card.dataset.tiltReady = '1';
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform =
        `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-5px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// ==================== INITIALIZE ====================
loadProducts();
