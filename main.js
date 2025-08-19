
const api = {
  async load(path) {
    try {
      const r = await fetch(path, { cache: 'no-store' });
      if (!r.ok) throw new Error(`Failed to load ${path}`);
      return await r.json();
    } catch (e) {
      console.error(`Error loading ${path}:`, e);
      return null;
    }
  },
  config: null,
  products: null,
  categories: null
};

function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }
function fmtCurrency(v) { return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: (api.config?.locale?.currency || 'EGP') }).format(v); }
function param(name) { return new URLSearchParams(location.search).get(name); }

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { console.error(`Failed to save ${key}`); } }
};

const state = {
  cart: store.get('cart', []),
  favs: store.get('favorites', [])
};

function saveCart() { store.set('cart', state.cart); }
function saveFavs() { store.set('favorites', state.favs); }

function toast(msg) {
  const t = qs('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), api.config?.ui?.toastDurationMs || 2000);
}

async function applyConfig() {
  api.config = await api.load('config.json');
  if (!api.config) {
    console.error('Config not loaded');
    return;
  }
  const th = api.config.theme;
  const root = document.documentElement.style;
  root.setProperty('--color-primary', th.primary);
  root.setProperty('--color-primary-dark', th.primaryDark);
  root.setProperty('--color-primary-light', th.primaryLight);
  root.setProperty('--color-accent', th.accent);
  root.setProperty('--color-bg', th.bg);
  root.setProperty('--color-surface', th.surface);
  root.setProperty('--color-text', th.text);
  root.setProperty('--color-muted', th.mutedText);
  root.setProperty('--color-border', th.border);

  // Update WhatsApp link in contact page
  const whatsappLink = qs('#whatsappLink');
  if (whatsappLink && api.config.whatsappNumber) {
    whatsappLink.href = `https://wa.me/${api.config.whatsappNumber}`;
    whatsappLink.textContent = api.config.whatsappNumber;
  }
}

function buildBanner() {
  const wrap = qs('#heroBanner');
  if (!wrap || !api.config?.home?.banners) {
    if (wrap) wrap.innerHTML = '<div class="error-img" style="width:100%;height:100%;display:grid;place-items:center;color:var(--color-muted)">البانر غير متوفر</div>';
    return;
  }
  const anims = ['anim-fade', 'anim-slideL', 'anim-zoom', 'anim-rotate', 'anim-slideUp'];
  wrap.innerHTML = api.config.home.banners.map((src, i) => `
    <img class="slide ${anims[i % anims.length]}" src="${src}" alt="بانر ${i + 1}" loading="lazy" onerror="this.outerHTML='<div class=&quot;error-img&quot; style=&quot;width:100%;height:100%;display:grid;place-items:center;color:var(--color-muted)&quot;>صورة غير متوفرة</div>'">
  `).join('');
  const slides = qsa('.banner .slide');
  if (!slides.length) return;
  let idx = 0;
  slides[idx].classList.add('active');
  setInterval(() => {
    slides[idx].classList.remove('active');
    idx = (idx + 1) % slides.length;
    slides[idx].classList.add('active');
  }, api.config.ui.bannerIntervalMs || 3000);
}

async function loadData() {
  const [products, categories] = await Promise.all([
    api.load('products.json'),
    api.load('categories.json')
  ]);
  api.products = products || [];
  api.categories = categories || [];
}

function cardHTML(p) {
  return `
    <article class="card" role="article">
      <a href="product.html?id=${p.id}" style="display:block;text-decoration:none;color:inherit" aria-label="عرض تفاصيل ${p.name}">
        <img src="${p.images?.[0] || ''}" alt="${p.name}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px 12px 0 0" loading="lazy" onerror="this.outerHTML='<div class=&quot;error-img&quot; style=&quot;width:100%;aspect-ratio:4/3;display:grid;place-items:center;color:var(--color-muted)&quot;>صورة غير متوفرة</div>'">
        <div style="padding:12px">
          <div style="font-weight:700">${p.name}</div>
          <div style="color:var(--color-muted)">${fmtCurrency(p.price)}</div>
        </div>
      </a>
      <div style="padding:0 12px 12px;display:flex;gap:8px">
        <button class="btn outline" onclick="addToFav(${p.id})" aria-label="إضافة ${p.name} إلى المفضلة">❤ للمفضلة</button>
        <button class="btn" onclick="quickAddToCart(${p.id})" aria-label="إضافة ${p.name} إلى السلة">🛒 أضف للسلة</button>
      </div>
    </article>
  `;
}

let fIndex = 0;
function renderFeatured() {
  const el = qs('#featuredCarousel');
  if (!el || !api.products) {
    if (el) el.innerHTML = '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">لا توجد منتجات مميزة</div>';
    return;
  }
  const featured = api.products.filter(p => p.featured).slice(0, api.config?.ui?.featuredLimit || 10);
  if (!featured.length) {
    el.innerHTML = '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">لا توجد منتجات مميزة الآن</div>';
    return;
  }
  el.innerHTML = featured.map(p => cardHTML(p)).join('');
  function update() { el.scrollTo({ left: fIndex * el.offsetWidth, behavior: 'smooth' }); }
  qs('#prevFeatured')?.addEventListener('click', () => { fIndex = Math.max(0, fIndex - 1); update(); });
  qs('#nextFeatured')?.addEventListener('click', () => { fIndex = Math.min(featured.length - 1, fIndex + 1); update(); });
}

function renderCategories() {
  const grid = qs('#categoriesGrid');
  if (!grid || !api.categories) {
    if (grid) grid.innerHTML = '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">لا توجد أقسام</div>';
    return;
  }
  grid.innerHTML = api.categories.map(c => `
    <a href="products.html?category=${c.id}" class="category-banner" aria-label="عرض منتجات ${c.name}">
      <img src="${c.image}" alt="${c.name}" loading="lazy" onerror="this.outerHTML='<div class=&quot;error-img&quot; style=&quot;width:100%;height:100%;display:grid;place-items:center;color:var(--color-muted)&quot;>صورة غير متوفرة</div>'">
      <div class="overlay"></div>
      <div class="title">${c.name}</div>
    </a>
  `).join('');
}

function renderOccasionsPage() {
  const grid = qs('#occasionsContent');
  if (!grid || !api.products) {
    if (grid) grid.innerHTML = '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">لا توجد منتجات للمناسبات</div>';
    return;
  }
  // Filter products suitable for occasions (assuming products with 'occasion' tag)
  const occasionProducts = api.products.filter(p => p.occasion);
  grid.innerHTML = occasionProducts.length ? occasionProducts.map(p => cardHTML(p)).join('') : '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">لا توجد منتجات للمناسبات الآن</div>';
}

function quickAddToCart(id) {
  const p = api.products.find(x => x.id === id);
  if (!p) return;
  const item = state.cart.find(x => x.id === id);
  if (item) {
    item.qty += 1;
  } else {
    state.cart.push({ id, qty: 1 });
  }
  saveCart();
  toast('تمت الإضافة للسلة');
  renderCart();
}

function addToFav(id) {
  if (!state.favs.includes(id)) {
    state.favs.push(id);
    saveFavs();
    toast('تمت الإضافة للمفضلة');
  }
  renderFavoritesPage();
}

function removeFromFav(id) {
  state.favs = state.favs.filter(x => x !== id);
  saveFavs();
  toast('تم الحذف من المفضلة');
  renderFavoritesPage();
}


function renderCart() {
  const list = qs('#cartList');
  const totalEl = qs('#cartTotal');
  const checkoutBtn = qs('#checkoutBtn');
  if (!list || !api.products) {
    if (list) list.innerHTML = '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">السلة فارغة</div>';
    return;
  }
  const items = state.cart.map(c => {
    const p = api.products.find(x => x.id === c.id);
    if (!p) return '';
    return `
      <div class="row">
        <img src="${p.images?.[0] || ''}" alt="${p.name}" loading="lazy" onerror="this.outerHTML='<div class=&quot;error-img&quot;>صورة غير متوفرة</div>'">
        <div style="flex:1">
          <div style="font-weight:700">${p.name}</div>
          <div style="color:var(--color-muted)">${fmtCurrency(p.price)}</div>
        </div>
        <div class="qty">
          <button onclick="updateCart(${p.id}, -1)" aria-label="تقليل كمية ${p.name}">-</button>
          <input type="number" value="${c.qty}" min="1" onchange="updateCart(${p.id}, this.value)" aria-label="كمية ${p.name}">
          <button onclick="updateCart(${p.id}, 1)" aria-label="زيادة كمية ${p.name}">+</button>
        </div>
        <div class="price">${fmtCurrency(p.price * c.qty)}</div>
        <button class="btn outline danger" onclick="removeFromCart(${p.id})" aria-label="حذف ${p.name} من السلة">❌</button>
      </div>
    `;
  }).filter(Boolean).join('');
  list.innerHTML = items || '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">السلة فارغة</div>';
  const total = state.cart.reduce((sum, c) => {
    const p = api.products.find(x => x.id === c.id);
    return p ? sum + p.price * c.qty : sum;
  }, 0);
  if (totalEl) totalEl.textContent = fmtCurrency(total);
  if (checkoutBtn) checkoutBtn.disabled = !state.cart.length;
}

function updateCart(id, val) {
  if (typeof val === 'string') val = parseInt(val) || 1;
  const item = state.cart.find(x => x.id === id);
  if (!item) return;
  if (typeof val === 'number') item.qty = Math.max(1, item.qty + val);
  else item.qty = Math.max(1, val);
  saveCart();
  renderCart();
}

function removeFromCart(id) {
  state.cart = state.cart.filter(x => x.id !== id);
  saveCart();
  toast('تم الحذف من السلة');
  renderCart();
}

function sendOrderWhatsApp() {
  if (!state.cart.length || !api.products || !api.config?.whatsappNumber) return;
  const items = state.cart.map(c => {
    const p = api.products.find(x => x.id === c.id);
    return p ? `${p.name} (${c.qty})` : '';
  }).filter(Boolean).join('\n');
  const total = state.cart.reduce((sum, c) => {
    const p = api.products.find(x => x.id === c.id);
    return p ? sum + p.price * c.qty : sum;
  }, 0);
  const msg = `طلب جديد:\n${items}\nالإجمالي: ${fmtCurrency(total)}`;
  const url = `https://wa.me/${api.config.whatsappNumber}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

function renderProductsPage() {
  const grid = qs('#productsGrid');
  if (!grid || !api.products) {
    if (grid) grid.innerHTML = '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">لا توجد منتجات</div>';
    return;
  }
  const cat = param('category');
  const filtered = cat ? api.products.filter(p => p.category === cat) : api.products;
  grid.innerHTML = filtered.length ? filtered.map(p => cardHTML(p)).join('') : '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">لا توجد منتجات في هذا القسم</div>';
}

function renderProductDetails() {
  const pid = +(param('id') || 0);
  const el = qs('#productDetails');
  if (!pid || !api.products || !el) {
    if (el) el.innerHTML = '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">المنتج غير موجود</div>';
    return;
  }
  const p = api.products.find(x => x.id === pid);
  if (!p) {
    el.innerHTML = '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">المنتج غير موجود</div>';
    return;
  }
  el.innerHTML = `
    <div class="card" style="padding:12px">
      <img src="${p.images?.[0] || ''}" alt="${p.name}" style="width:100%;border-radius:12px;aspect-ratio:4/3;object-fit:cover" loading="lazy" onerror="this.outerHTML='<div class=&quot;error-img&quot; style=&quot;width:100%;aspect-ratio:4/3;display:grid;place-items:center;color:var(--color-muted)&quot;>صورة غير متوفرة</div>'">
      <h1 style="margin:12px 0 8px;font-size:20px">${p.name}</h1>
      <div style="color:var(--color-muted);margin:0.5rem 0">${p.shortDesc || ''}</div>
      <div style="margin:0.25rem 0 1rem">${p.description || ''}</div>
      <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
        <strong style="font-size:18px">${fmtCurrency(p.price)}</strong>
        <div style="display:flex;gap:8px">
          <button class="btn outline" onclick="addToFav(${p.id})" aria-label="إضافة ${p.name} إلى المفضلة">❤ للمفضلة</button>
          <button class="btn" onclick="quickAddToCart(${p.id})" aria-label="إضافة ${p.name} إلى السلة">🛒 أضف للسلة</button>
        </div>
      </div>
    </div>
    <div class="mobile-cta" style="position:sticky;bottom:0;background:var(--color-surface);padding:12px;display:none;gap:8px;box-shadow:0 -4px 12px rgba(0,0,0,0.08);border-top:1px solid var(--color-border);@media (max-width:768px){display:flex;}">
      <button class="btn" style="flex:1" onclick="quickAddToCart(${p.id})" aria-label="إضافة ${p.name} إلى السلة">🛒 أضف للسلة</button>
      <button class="btn outline" style="flex:1" onclick="addToFav(${p.id})" aria-label="إضافة ${p.name} إلى المفضلة">❤ للمفضلة</button>
    </div>
  `;
}

function renderFavoritesPage() {
  const grid = qs('#favGrid');
  if (!grid || !api.products) {
    if (grid) grid.innerHTML = '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">لا توجد مفضلة</div>';
    return;
  }
  const items = api.products.filter(p => state.favs.includes(p.id));
  grid.innerHTML = items.length ? items.map(p => `
    <article class="card" style="display:flex;gap:10px;align-items:center;padding:10px" role="article">
      <img src="${p.images?.[0] || ''}" alt="${p.name}" style="width:84px;height:84px;object-fit:cover;border-radius:10px" loading="lazy" onerror="this.outerHTML='<div class=&quot;error-img&quot;>صورة غير متوفرة</div>'">
      <div style="flex:1">
        <div style="font-weight:700">${p.name}</div>
        <div style="color:var(--color-muted)">${fmtCurrency(p.price)}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn" onclick="quickAddToCart(${p.id})" aria-label="إضافة ${p.name} إلى السلة">🛒 للسلة</button>
          <button class="btn outline danger" onclick="removeFromFav(${p.id})" aria-label="حذف ${p.name} من المفضلة">❌ حذف</button>
        </div>
      </div>
    </article>
  `).join('') : '<div class="error-img" style="padding:16px;color:var(--color-muted);text-align:center">لا توجد مفضلة</div>';
}

(async function init() {
  await applyConfig();
  await loadData();
  if (qs('#heroBanner')) { buildBanner(); renderFeatured(); renderCategories(); }
  if (qs('#productsGrid')) { renderProductsPage(); }
  if (qs('#productDetails')) { renderProductDetails(); }
  if (qs('#favGrid')) { renderFavoritesPage(); }
  if (qs('#cartList')) { renderCart(); qs('#checkoutBtn')?.addEventListener('click', sendOrderWhatsApp); }
  if (qs('#occasionsContent')) { renderOccasionsPage(); }
})();
