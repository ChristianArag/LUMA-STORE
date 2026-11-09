/**
 * LUMA · ESTILO CON INTENCIÓN (QUITO · MADRID)
 * 100% Functional E-Commerce Application & Payphone Integration
 * Complete Responsive Full-Page Admin, Sectioned Orders, Live Cover Customizer & Local Image Uploads
 */

// Application State
const state = {
  user: null,
  token: localStorage.getItem('luma_token') || null,
  cart: JSON.parse(localStorage.getItem('luma_cart') || '[]'),
  catalog: [],
  activeFilter: 'Todos',
  searchQuery: '',
  config: {
    brand: 'LUMA Quito · Madrid',
    currency: 'USD',
    ivaRate: 0.15,
    freeShippingThreshold: 90,
    shippingRates: {
      'Quito urbano': 3.50,
      'Cumbayá / Tumbaco': 4.50,
      'Los Chillos': 5.00,
      'Nacional (Ecuador)': 6.50
    },
    announcement: {
      city: 'QUITO · MADRID',
      text: '✧ Nueva Cápsula de Temporada Activa · Pagos 100% seguros con Payphone',
      tag: 'ENVÍOS GRATIS DESDE $90'
    },
    hero: {
      eyebrow: 'TEMPORADA 2026 / MADRID → QUITO',
      title: 'Menos dudas.<br>Más <em>tú.</em>',
      subtitle: 'Prendas esenciales y capas inteligentes pensadas para vestir con calma y combinar con lo que ya tienes.',
      image: 'assets/editorial.png',
      cardTitle: 'Colección Inteligente',
      cardSubtitle: 'Piezas modulares adaptables a los microclimas de Quito',
      titleColor: '#191c18',
      subtitleColor: '#6a6f66',
      eyebrowColor: '#495342',
      titleFont: "'Playfair Display', Georgia, serif",
      subtitleFont: "'DM Sans', sans-serif",
      titleSize: '48px'
    }
  },
  selectedShippingZone: 'Quito urbano',
  currentAdminTab: 'catalog',
  currentOrderFilter: 'new', // 'new', 'shipping', 'delivered', 'all'
  ordersViewMode: 'tabs', // 'tabs' or 'kanban'
  orderSearchQuery: '',
  adminOrdersCache: []
};

// Formatting Utilities
const formatMoney = (amount) => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0);
};

// UI Elements
const siteHeader = document.querySelector('#siteHeader');
const siteAnnouncement = document.querySelector('#siteAnnouncement');
const mainContent = document.querySelector('#mainContent');
const siteFooter = document.querySelector('#siteFooter');
const adminFullPageView = document.querySelector('#adminFullPageView');

const siteDialog = document.querySelector('#siteDialog');
const dialogContent = document.querySelector('#dialogContent');
const dialogCloseBtn = document.querySelector('#dialogCloseBtn');
const cartCountBadge = document.querySelector('#cartCount');
const authBtn = document.querySelector('#authBtn');
const userStatusText = document.querySelector('#userStatusText');
const adminNavBtn = document.querySelector('#adminNavBtn');
const logoutHeaderBtn = document.querySelector('#logoutHeaderBtn');
const bagBtn = document.querySelector('#bagBtn');
const productsGrid = document.querySelector('#productsGrid');
const toastBox = document.querySelector('#toastBox');
const openAdminBtn = document.querySelector('#openAdminBtn');
const printReceiptContainer = document.querySelector('#printReceiptContainer');

// Toast Notification
function showToast(message, type = 'normal') {
  if (!toastBox) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'payphone' ? 'toast-payphone' : ''}`;
  toast.innerHTML = `
    <span>${type === 'payphone' ? '💳' : type === 'admin' ? '⚙️' : '✦'}</span>
    <span>${message}</span>
  `;
  toastBox.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Modal Helpers
function openModal(html) {
  dialogContent.innerHTML = html;
  if (!siteDialog.open) {
    siteDialog.showModal();
  }
}

function closeModal() {
  siteDialog.close();
  dialogContent.innerHTML = '';
}

dialogCloseBtn.addEventListener('click', closeModal);
siteDialog.addEventListener('click', (e) => {
  if (e.target === siteDialog) {
    const rect = siteDialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      closeModal();
    }
  }
});

// Sync Cart to LocalStorage and UI
function syncCart() {
  localStorage.setItem('luma_cart', JSON.stringify(state.cart));
  const totalCount = state.cart.reduce((sum, item) => sum + (item.qty || 1), 0);
  if (cartCountBadge) {
    cartCountBadge.textContent = totalCount;
  }
}

// ==========================================
// API CLIENT
// ==========================================
async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
  };

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: { ...headers, ...options.headers }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Ocurrió un error en la solicitud.');
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

// Global Piece Row Removal Handler (Guaranteed to work on all dynamic rows)
window.removePieceRow = function (btn) {
  const row = btn.closest('.admin-piece-input-row');
  if (row) {
    row.style.transition = 'all 0.2s ease';
    row.style.opacity = '0';
    row.style.transform = 'translateX(10px)';
    setTimeout(() => {
      row.remove();
      showToast('Prenda removida del outfit.');
    }, 200);
  }
};

// Image Upload Helper (reads file from user's machine and uploads to backend)
window.handleImageUpload = async function (fileInput, targetInputId, previewImgId) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const base64Data = e.target.result;
    showToast('Subiendo imagen desde tu equipo...', 'admin');

    try {
      const res = await apiCall('/api/admin/upload', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          base64Data
        })
      });

      const targetInput = document.querySelector(targetInputId);
      if (targetInput) targetInput.value = res.url;

      const previewImg = document.querySelector(previewImgId);
      if (previewImg) previewImg.src = res.url;

      showToast('¡Imagen subida y aplicada con éxito!', 'admin');
    } catch (err) {
      showToast('Error al subir la imagen: ' + err.message);
    }
  };
  reader.readAsDataURL(file);
};

// Load Store Configuration (Covers, Hero, Rates)
async function loadConfig() {
  try {
    const res = await apiCall('/api/config');
    state.config = { ...state.config, ...res };
    applyDynamicSettings();
  } catch (err) {
    console.warn('Could not load remote config, using defaults:', err);
  }
}

function applyDynamicSettings() {
  // Announcement
  const annCity = document.querySelector('#announcementCity');
  const annText = document.querySelector('#announcementText');
  const annTag = document.querySelector('#announcementTag');
  if (annCity && state.config.announcement?.city) annCity.textContent = state.config.announcement.city;
  if (annText && state.config.announcement?.text) annText.innerHTML = state.config.announcement.text;
  if (annTag && state.config.announcement?.tag) annTag.textContent = state.config.announcement.tag;

  // Hero
  const heroEyebrow = document.querySelector('#heroEyebrow');
  const heroTitle = document.querySelector('#heroTitle');
  const heroDesc = document.querySelector('#heroDesc');
  const heroImage = document.querySelector('#heroImage');
  const heroCardTitle = document.querySelector('#heroCardTitle');
  const heroCardSubtitle = document.querySelector('#heroCardSubtitle');

  if (heroEyebrow) {
    if (state.config.hero?.eyebrow) heroEyebrow.textContent = state.config.hero.eyebrow;
    if (state.config.hero?.eyebrowColor) heroEyebrow.style.color = state.config.hero.eyebrowColor;
  }
  if (heroTitle) {
    if (state.config.hero?.title) heroTitle.innerHTML = state.config.hero.title;
    if (state.config.hero?.titleColor) heroTitle.style.color = state.config.hero.titleColor;
    if (state.config.hero?.titleFont) heroTitle.style.fontFamily = state.config.hero.titleFont;
    if (state.config.hero?.titleSize) heroTitle.style.fontSize = state.config.hero.titleSize;
  }
  if (heroDesc) {
    if (state.config.hero?.subtitle) heroDesc.textContent = state.config.hero.subtitle;
    if (state.config.hero?.subtitleColor) heroDesc.style.color = state.config.hero.subtitleColor;
    if (state.config.hero?.subtitleFont) heroDesc.style.fontFamily = state.config.hero.subtitleFont;
  }
  if (heroImage && state.config.hero?.image) heroImage.src = state.config.hero.image;
  if (heroCardTitle && state.config.hero?.cardTitle) heroCardTitle.textContent = state.config.hero.cardTitle;
  if (heroCardSubtitle && state.config.hero?.cardSubtitle) heroCardSubtitle.textContent = state.config.hero.cardSubtitle;
}

// Check logged in user on start
async function checkAuth() {
  if (!state.token) {
    updateAuthUI();
    return;
  }
  try {
    const res = await apiCall('/api/auth/me');
    state.user = res.user;
  } catch (err) {
    console.warn('Session expired, clearing token');
    localStorage.removeItem('luma_token');
    state.token = null;
    state.user = null;
  }
  updateAuthUI();
}

function updateAuthUI() {
  if (state.user) {
    const firstName = state.user.name.split(' ')[0];
    userStatusText.textContent = `Hola, ${firstName}`;
    authBtn.title = 'Mi Cuenta y Pedidos';

    // Show explicit Logout Button in Header
    if (logoutHeaderBtn) logoutHeaderBtn.style.display = 'inline-flex';

    // Show Admin Button in Header if admin
    if (state.user.role === 'admin') {
      if (adminNavBtn) adminNavBtn.style.display = 'inline-flex';
    } else {
      if (adminNavBtn) adminNavBtn.style.display = 'none';
    }
  } else {
    userStatusText.textContent = 'Ingresar';
    authBtn.title = 'Iniciar Sesión / Registrarse';
    if (logoutHeaderBtn) logoutHeaderBtn.style.display = 'none';
    if (adminNavBtn) adminNavBtn.style.display = 'none';
  }
}

// Load Catalog
async function loadCatalog() {
  try {
    const res = await apiCall('/api/catalog');
    state.catalog = res.catalog || [];
  } catch (err) {
    console.warn('Could not fetch catalog from API, using fallback catalog');
  }
  renderCatalog();
}

// ==========================================
// CATALOG RENDERING & SEARCH
// ==========================================
function renderCatalog() {
  if (!productsGrid) return;

  const query = state.searchQuery.toLowerCase().trim();
  const filtered = state.catalog.filter((look) => {
    // Filter pill matching
    const matchFilter =
      state.activeFilter === 'Todos' ||
      (state.activeFilter === 'Madrid' && look.id >= 3) ||
      look.occasion === state.activeFilter;

    if (!matchFilter) return false;

    // Search query matching
    if (!query) return true;
    const inName = look.name.toLowerCase().includes(query);
    const inNote = (look.note || '').toLowerCase().includes(query);
    const inItems = (look.items || []).some(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.material && item.material.toLowerCase().includes(query))
    );
    return inName || inNote || inItems;
  });

  if (!filtered.length) {
    productsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
        <p style="font-size: 18px; color: var(--muted); margin-bottom: 15px;">No se encontraron prendas para tu búsqueda.</p>
        <button class="btn btn-outline btn-sm" onclick="clearFilters()">Restablecer filtros</button>
      </div>
    `;
    return;
  }

  productsGrid.innerHTML = filtered
    .map((look) => {
      const fullPrice = (look.items || []).reduce((s, i) => s + (Number(i.price) || 0), 0);
      const isMadrid = look.id >= 3;
      return `
        <article class="product-card" data-look-id="${look.id}">
          <div class="card-media">
            <img class="${look.image && look.image.includes('assets/') ? 'portrait' : ''}" 
                 src="${look.image || 'assets/editorial.png'}" 
                 alt="${look.name}" 
                 loading="lazy">
            <span class="card-tag">${isMadrid ? 'MADRID → QUITO' : 'CÁPSULA'} · ${(look.occasion || 'LOOK').toUpperCase()}</span>
          </div>
          <div class="card-info">
            <div class="card-title-row">
              <h3 class="card-title">${look.name}</h3>
              <span class="card-price">${formatMoney(fullPrice)}</span>
            </div>
            <p class="card-note">${look.note || ''}</p>
            <button class="card-action-btn" onclick="openLookDetail(${look.id})">
              <span>Personalizar ${(look.items || []).length} piezas</span>
              <span>↗</span>
            </button>
          </div>
        </article>
      `;
    })
    .join('');
}

window.clearFilters = function () {
  state.activeFilter = 'Todos';
  state.searchQuery = '';
  const searchInput = document.querySelector('#searchInput');
  if (searchInput) searchInput.value = '';
  document.querySelectorAll('.filter-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.filter === 'Todos');
  });
  renderCatalog();
};

// Filter pills click
document.querySelectorAll('.filter-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    button.classList.add('active');
    state.activeFilter = button.dataset.filter;
    renderCatalog();
  });
});

// Search input
const searchInput = document.querySelector('#searchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderCatalog();
  });
}

// ==========================================
// LOOK DETAIL & CUSTOMIZER MODAL
// ==========================================
window.openLookDetail = function (lookId) {
  const look = state.catalog.find((l) => l.id === Number(lookId));
  if (!look) return;

  const totalLookPrice = (look.items || []).reduce((s, i) => s + (Number(i.price) || 0), 0);

  const html = `
    <div class="detail-layout">
      <div class="detail-gallery">
        <img class="detail-img ${look.image ? 'portrait' : ''}" 
             src="${look.image || 'assets/editorial.png'}" 
             alt="${look.name}">
        <p style="font-size: 11px; color: var(--muted); margin-top: 10px; line-height: 1.5;">
          Fotografía conceptual LUMA. Puedes adquirir todas las prendas del look o desmarcar las piezas que ya tengas en tu armario.
        </p>
      </div>

      <div class="detail-content">
        <span class="eyebrow">${look.id >= 3 ? 'CÁPSULA MADRID → QUITO' : 'COLECCIÓN ESENCIAL'} · ${(look.occasion || '').toUpperCase()}</span>
        <h2 style="font-family: var(--font-serif); font-size: 32px; margin: 8px 0 14px;">${look.name}</h2>
        <p style="font-size: 14px; color: var(--muted); line-height: 1.7; margin-bottom: 20px;">
          ${look.why || ''}
        </p>

        <strong style="display: block; font-size: 13px; letter-spacing: 0.5px; margin-bottom: 10px;">
          SELECCIONA TUS PIEZAS:
        </strong>

        <div class="piece-selector-list" id="pieceList">
          ${(look.items || [])
            .map(
              (item, idx) => `
            <label class="piece-option">
              <input type="checkbox" class="piece-checkbox" data-idx="${idx}" checked>
              <div class="piece-info">
                <div class="piece-head">
                  <span>${item.name}</span>
                  <strong>${formatMoney(item.price)}</strong>
                </div>
                <div class="piece-material">${item.material || 'Tejido premium seleccionado'} · ${item.sizes ? item.sizes.join(', ') : 'Talla única'}</div>
              </div>
            </label>
          `
            )
            .join('')}
        </div>

        <div class="form-group" style="margin: 20px 0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label for="detailSizeSelect" style="margin-bottom:0;">Talla para prendas del look</label>
            <button type="button" class="nav-text-btn" onclick="openSizeGuideModal()" style="font-size:12px; color:var(--olive);">
              📏 Ver tabla de tallas ↗
            </button>
          </div>
          <select id="detailSizeSelect" class="form-control">
            <option value="">Selecciona tu talla habitual</option>
            <option value="S">Talla S (Pequeña)</option>
            <option value="M" selected>Talla M (Mediana)</option>
            <option value="L">Talla L (Grande)</option>
            <option value="XL">Talla XL (Extra grande)</option>
          </select>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: baseline; padding-top: 16px; border-top: 2px solid var(--line); margin-bottom: 18px;">
          <span style="font-size: 14px; font-weight: 600;">Subtotal de piezas seleccionadas:</span>
          <strong id="customLookPrice" style="font-size: 22px; color: var(--ink);">${formatMoney(totalLookPrice)}</strong>
        </div>

        <div id="detailError" style="color: #c53030; font-size: 13px; margin-bottom: 12px;" role="alert"></div>

        <button class="btn btn-primary btn-block" id="addLookToBagBtn">
          Añadir a Mi Bolsa de Compra
        </button>

        <div style="margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11.5px; color: var(--muted); background: var(--paper); padding: 10px 12px; border-radius: 4px; border: 1px solid var(--line-light);">
          <span>🛵 Entrega en Quito: 24 - 48h</span>
          <span>🔄 7 días para cambio de talla</span>
          <span>💳 Tarjetas con Payphone</span>
          <span>🏦 Transferencia / Deuna!</span>
        </div>
      </div>
    </div>
  `;

  openModal(html);

  // Dynamic price calculation
  const checkboxes = dialogContent.querySelectorAll('.piece-checkbox');
  const priceDisplay = dialogContent.querySelector('#customLookPrice');

  function updatePrice() {
    let currentTotal = 0;
    checkboxes.forEach((cb) => {
      if (cb.checked) {
        const idx = Number(cb.dataset.idx);
        currentTotal += (Number(look.items[idx].price) || 0);
      }
    });
    priceDisplay.textContent = formatMoney(currentTotal);
  }

  checkboxes.forEach((cb) => cb.addEventListener('change', updatePrice));

  // Add to Bag action
  const addBtn = dialogContent.querySelector('#addLookToBagBtn');
  addBtn.addEventListener('click', () => {
    const errorBox = dialogContent.querySelector('#detailError');
    errorBox.textContent = '';

    const selectedIndices = [...checkboxes]
      .filter((cb) => cb.checked)
      .map((cb) => Number(cb.dataset.idx));

    if (!selectedIndices.length) {
      errorBox.textContent = 'Por favor selecciona al menos una prenda.';
      return;
    }

    const size = dialogContent.querySelector('#detailSizeSelect').value;
    const hasSizedItems = selectedIndices.some((idx) => look.items[idx].type !== 'accessory');
    if (hasSizedItems && !size) {
      errorBox.textContent = 'Por favor selecciona una talla para las prendas.';
      return;
    }

    // Add selected items to cart
    selectedIndices.forEach((idx) => {
      const item = look.items[idx];
      const itemSize = item.type === 'accessory' ? 'Única' : size;
      const cartKey = `${look.id}-${item.id || idx}-${itemSize}`;

      const existing = state.cart.find((c) => c.key === cartKey);
      if (existing) {
        existing.qty = (existing.qty || 1) + 1;
      } else {
        state.cart.push({
          key: cartKey,
          lookId: look.id,
          lookName: look.name,
          name: item.name,
          price: item.price,
          size: itemSize,
          material: item.material,
          image: look.image || 'assets/editorial.png',
          qty: 1
        });
      }
    });

    syncCart();
    closeModal();
    showToast(`Se añadieron ${selectedIndices.length} piezas a tu bolsa de compra.`);
  });
};

// ==========================================
// CART / BOLSA DE COMPRA MODAL
// ==========================================
function openCartModal() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * (item.qty || 1), 0);
  const freeThreshold = state.config.freeShippingThreshold || 90;
  const freeShipping = subtotal >= freeThreshold;
  const shippingCost = freeShipping ? 0 : state.config.shippingRates[state.selectedShippingZone] || 3.50;
  const ivaAmount = (subtotal * state.config.ivaRate) / (1 + state.config.ivaRate);
  const total = subtotal + shippingCost;

  const html = `
    <div style="max-width: 650px; margin: 0 auto;">
      <span class="eyebrow">TU SELECCIÓN</span>
      <h2 style="font-family: var(--font-serif); font-size: 28px; margin-bottom: 20px;">Mi Bolsa de Compra</h2>

      ${
        state.cart.length === 0
          ? `
        <div style="text-align: center; padding: 50px 20px;">
          <p style="font-size: 16px; color: var(--muted); margin-bottom: 20px;">Tu bolsa está vacía actualmente.</p>
          <button class="btn btn-primary" onclick="closeModal()">Explorar la Colección</button>
        </div>
      `
          : `
        <div style="display: flex; flex-direction: column; gap: 14px; max-height: 320px; overflow-y: auto; padding-right: 8px;">
          ${state.cart
            .map(
              (item, i) => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--paper-pure); border: 1px solid var(--line); border-radius: var(--radius-sm); gap: 14px;">
              <div style="flex-grow: 1;">
                <strong style="display: block; font-size: 14px;">${item.name}</strong>
                <span style="font-size: 12px; color: var(--muted);">${item.lookName} · Talla: ${item.size}</span>
                <div style="font-size: 13px; font-weight: 600; margin-top: 4px;">${formatMoney(item.price)}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <button class="btn-sm" style="border: 1px solid var(--line); width: 28px; height: 28px; padding: 0; display: grid; place-items: center; border-radius: 4px;" onclick="changeCartQty(${i}, -1)">−</button>
                <span style="font-weight: 600; font-size: 14px;">${item.qty}</span>
                <button class="btn-sm" style="border: 1px solid var(--line); width: 28px; height: 28px; padding: 0; display: grid; place-items: center; border-radius: 4px;" onclick="changeCartQty(${i}, 1)">+</button>
                <button style="color: #c53030; font-size: 12px; text-decoration: underline; margin-left: 8px;" onclick="removeCartItem(${i})">Quitar</button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>

        <div style="margin-top: 24px; padding: 18px; background: var(--cream); border-radius: var(--radius-sm); border: 1px solid var(--line);">
          <div class="form-group" style="margin-bottom: 12px;">
            <label for="shippingZoneSelect" style="font-size: 13px; font-weight: 600;">Zona de Entrega en Ecuador</label>
            <select id="shippingZoneSelect" class="form-control" onchange="updateShippingZone(this.value)">
              ${Object.entries(state.config.shippingRates || {})
                .map(
                  ([zone, rate]) => `
                <option value="${zone}" ${state.selectedShippingZone === zone ? 'selected' : ''}>${zone} (${formatMoney(rate)})</option>
              `
                )
                .join('')}
            </select>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
            <span>Subtotal prendas:</span>
            <span>${formatMoney(subtotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
            <span>Envío a domicilio:</span>
            <span>${freeShipping ? `<strong style="color: var(--success);">¡Gratis! (Promoción > $${freeThreshold})</strong>` : formatMoney(shippingCost)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-bottom: 12px;">
            <span>IVA incluido (15% Ecuador):</span>
            <span>${formatMoney(ivaAmount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 19px; font-weight: 700; border-top: 1px solid var(--line); padding-top: 10px;">
            <span>Total a Pagar:</span>
            <span>${formatMoney(total)}</span>
          </div>
        </div>

        <div style="display: flex; gap: 14px; margin-top: 24px;">
          <button class="btn btn-outline" style="flex: 1;" onclick="closeModal()">Seguir Comprando</button>
          <button class="btn btn-payphone" style="flex: 1.3;" onclick="openCheckoutModal()">
            <span>Pagar con Payphone</span>
            <span>🔒</span>
          </button>
        </div>
      `
      }
    </div>
  `;

  openModal(html);
}

window.changeCartQty = function (index, delta) {
  if (!state.cart[index]) return;
  state.cart[index].qty = (state.cart[index].qty || 1) + delta;
  if (state.cart[index].qty <= 0) {
    state.cart.splice(index, 1);
  }
  syncCart();
  openCartModal();
};

window.removeCartItem = function (index) {
  state.cart.splice(index, 1);
  syncCart();
  openCartModal();
};

window.updateShippingZone = function (zone) {
  state.selectedShippingZone = zone;
  openCartModal();
};

bagBtn.addEventListener('click', openCartModal);

// ==========================================
// PAYPHONE CHECKOUT & PAYMENT FLOW
// ==========================================
window.openCheckoutModal = function () {
  if (!state.cart.length) {
    showToast('Tu bolsa está vacía.');
    return;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + item.price * (item.qty || 1), 0);
  const freeThreshold = state.config.freeShippingThreshold || 90;
  const freeShipping = subtotal >= freeThreshold;
  const shippingCost = freeShipping ? 0 : state.config.shippingRates[state.selectedShippingZone] || 3.50;
  const total = subtotal + shippingCost;
  const ivaAmount = (subtotal * state.config.ivaRate) / (1 + state.config.ivaRate);

  // Pre-fill user data if logged in
  const defaultName = state.user ? state.user.name : '';
  const defaultEmail = state.user ? state.user.email : '';
  const defaultPhone = state.user ? state.user.phone : '';
  const defaultAddress = state.user ? state.user.address || '' : '';

  const html = `
    <div style="max-width: 780px; margin: 0 auto;">
      <!-- Payphone Official Banner -->
      <div class="payphone-header-banner">
        <div>
          <span class="payphone-brand">payphone</span>
          <span style="display: block; font-size: 11px; opacity: 0.9;">Pasarela Oficial de Pagos · Ecuador</span>
        </div>
        <div class="payphone-badge-secure">
          🔒 Conexión Cifrada 256-bit
        </div>
      </div>

      <div class="checkout-grid">
        <!-- Form Left Column -->
        <div>
          <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 14px;">1. Datos de Entrega</h3>
          <form id="checkoutForm">
            <div class="form-group">
              <label for="orderName">Nombre y Apellido *</label>
              <input type="text" id="orderName" class="form-control" value="${defaultName}" required placeholder="Ej. Camila Morales">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="orderEmail">Correo Electrónico *</label>
                <input type="email" id="orderEmail" class="form-control" value="${defaultEmail}" required placeholder="camila@ejemplo.com">
              </div>
              <div class="form-group">
                <label for="orderPhone">Celular / WhatsApp *</label>
                <input type="tel" id="orderPhone" class="form-control" value="${defaultPhone}" required placeholder="0991234567">
              </div>
            </div>

            <div class="form-group">
              <label for="orderAddress">Dirección en ${state.selectedShippingZone} *</label>
              <input type="text" id="orderAddress" class="form-control" value="${defaultAddress}" required placeholder="Calle principal, número y calle secundaria">
            </div>

            <div class="form-group">
              <label for="orderNotes">Referencia de entrega (Opcional)</label>
              <input type="text" id="orderNotes" class="form-control" placeholder="Edificio, color de casa, timbre...">
            </div>

            <h3 style="font-size: 16px; font-weight: 700; margin: 24px 0 12px;">2. Pago con Payphone</h3>

            <div style="background: var(--paper-pure); border: 2px solid var(--payphone-orange); border-radius: var(--radius-sm); padding: 18px; margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-size: 13px; font-weight: 700; color: var(--payphone-orange);">Tarjeta de Crédito / Débito</span>
                <span style="font-size: 11px; background: #ffeae3; color: #ff521b; padding: 2px 8px; border-radius: 10px; font-weight: 700;">PAYPHONE</span>
              </div>

              <div class="form-group">
                <label for="cardNum" style="font-size: 12px;">Número de Tarjeta</label>
                <input type="text" id="cardNum" class="form-control" maxlength="19" placeholder="4000 1234 5678 9010" required>
                <span class="test-card-trigger" id="fillTestCardBtn">⚡ Usar tarjeta de prueba Payphone</span>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="cardExp" style="font-size: 12px;">Expiración</label>
                  <input type="text" id="cardExp" class="form-control" maxlength="5" placeholder="MM/AA" required>
                </div>
                <div class="form-group">
                  <label for="cardCvv" style="font-size: 12px;">CVV</label>
                  <input type="text" id="cardCvv" class="form-control" maxlength="4" placeholder="123" required>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label for="cardHolder" style="font-size: 12px;">Nombre en la Tarjeta</label>
                <input type="text" id="cardHolder" class="form-control" placeholder="Como aparece en la tarjeta" required>
              </div>
            </div>

            <button type="submit" class="btn btn-payphone btn-block" id="paySubmitBtn">
              Pagar ${formatMoney(total)} con Payphone 🔒
            </button>
            <div id="checkoutError" style="color: #c53030; font-size: 13px; margin-top: 10px;" role="alert"></div>
          </form>
        </div>

        <!-- Summary Right Column -->
        <div>
          <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 14px;">Resumen del Pedido</h3>
          <div class="order-summary-box">
            <div style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">
              ${state.cart.reduce((s, x) => s + x.qty, 0)} artículos para entrega en <strong>${state.selectedShippingZone}</strong>
            </div>

            <div style="max-height: 180px; overflow-y: auto; margin-bottom: 14px;">
              ${state.cart
                .map(
                  (item) => `
                <div class="order-summary-item">
                  <span>${item.qty}x ${item.name} (${item.size})</span>
                  <strong>${formatMoney(item.price * item.qty)}</strong>
                </div>
              `
                )
                .join('')}
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0;">
              <span>Subtotal:</span>
              <span>${formatMoney(subtotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0;">
              <span>Envío (${state.selectedShippingZone}):</span>
              <span>${freeShipping ? 'Gratis' : formatMoney(shippingCost)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); padding: 4px 0;">
              <span>IVA incluido (15%):</span>
              <span>${formatMoney(ivaAmount)}</span>
            </div>
            <div class="order-total-row">
              <span>Total USD:</span>
              <span style="color: var(--olive);">${formatMoney(total)}</span>
            </div>

            <div style="margin-top: 16px; padding: 12px; background: var(--cream); border-radius: 4px; font-size: 11px; color: var(--muted); line-height: 1.5;">
              ✓ Protección al comprador Payphone.<br>
              ✓ Cambio de talla garantizado por 7 días en Quito.<br>
              ✓ Comprobante digital enviado al correo.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  openModal(html);

  // Auto-format card input
  const cardNumInput = dialogContent.querySelector('#cardNum');
  cardNumInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 16);
    e.target.value = val.replace(/(\d{4})/g, '$1 ').trim();
  });

  const cardExpInput = dialogContent.querySelector('#cardExp');
  cardExpInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 2) {
      e.target.value = val.slice(0, 2) + '/' + val.slice(2);
    } else {
      e.target.value = val;
    }
  });

  // Fast test card auto-fill
  const fillTestBtn = dialogContent.querySelector('#fillTestCardBtn');
  fillTestBtn.addEventListener('click', () => {
    cardNumInput.value = '4000 1234 5678 9010';
    cardExpInput.value = '12/28';
    dialogContent.querySelector('#cardCvv').value = '789';
    dialogContent.querySelector('#cardHolder').value =
      dialogContent.querySelector('#orderName').value || 'SOFIA MONTALVO';
    showToast('Tarjeta de prueba Payphone cargada.', 'payphone');
  });

  // Handle Checkout submission
  const checkoutForm = dialogContent.querySelector('#checkoutForm');
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = dialogContent.querySelector('#checkoutError');
    const submitBtn = dialogContent.querySelector('#paySubmitBtn');
    errorBox.textContent = '';

    const name = dialogContent.querySelector('#orderName').value.trim();
    const email = dialogContent.querySelector('#orderEmail').value.trim();
    const phone = dialogContent.querySelector('#orderPhone').value.trim();
    const address = dialogContent.querySelector('#orderAddress').value.trim();
    const notes = dialogContent.querySelector('#orderNotes').value.trim();

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Procesando pago con Payphone...</span> <span style="display:inline-block; animation:spin 1s infinite linear;">↻</span>`;

    try {
      // 1. Create Payphone transaction
      const payphoneRes = await apiCall('/api/payphone/create-transaction', {
        method: 'POST',
        body: JSON.stringify({
          amount: total,
          email,
          phone,
          cardData: {
            cardNumber: cardNumInput.value,
            holder: dialogContent.querySelector('#cardHolder').value
          }
        })
      });

      // 2. Register complete order in DB
      const orderRes = await apiCall('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone,
          address,
          sector: state.selectedShippingZone,
          city: 'Quito',
          notes,
          items: state.cart,
          subtotal,
          shipping: shippingCost,
          tax: ivaAmount,
          total,
          paymentMethod: 'Payphone Ecuador',
          paymentDetails: payphoneRes
        })
      });

      // 3. Clear cart
      state.cart = [];
      syncCart();

      // 4. Render Success Receipt
      showOrderSuccess(orderRes.order);
      showToast('¡Pago procesado con éxito por Payphone!', 'payphone');
    } catch (err) {
      errorBox.textContent = err.message || 'Error al procesar el pago con Payphone.';
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Pagar ${formatMoney(total)} con Payphone 🔒`;
    }
  });
};

// ==========================================
// ORDER CONFIRMATION & HIGH-FIDELITY RECEIPT PRINTING
// ==========================================
function showOrderSuccess(order) {
  const html = `
    <div style="max-width: 650px; margin: 0 auto; text-align: center;">
      <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--success-bg); color: var(--success); font-size: 32px; display: grid; place-items: center; margin: 0 auto 16px;">
        ✓
      </div>
      <span class="eyebrow">PAGO CONFIRMADO CON PAYPHONE</span>
      <h2 style="font-family: var(--font-serif); font-size: 30px; margin-bottom: 8px;">¡Gracias por tu compra, ${(order.customer.name || '').split(' ')[0]}!</h2>
      <p style="font-size: 14px; color: var(--muted); margin-bottom: 24px;">
        Tu pedido ha sido registrado con éxito. Hemos enviado el comprobante a <strong>${order.customer.email}</strong>.
      </p>

      <!-- Screen Preview of Receipt -->
      <div style="text-align: left; background: var(--paper-pure); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 22px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 12px; margin-bottom: 12px;">
          <div>
            <strong style="font-size: 16px;">LUMA · Quito</strong>
            <p style="font-size: 12px; color: var(--muted);">Estilo con Intención · RUC: 1792837461001</p>
          </div>
          <div style="text-align: right;">
            <strong style="font-size: 15px; color: var(--olive);">${order.orderNumber}</strong>
            <p style="font-size: 11px; color: var(--muted);">${new Date(order.createdAt).toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12px; margin-bottom: 16px;">
          <div>
            <strong>Destinatario:</strong>
            <p>${order.customer.name}</p>
            <p>${order.customer.phone || 'Sin teléfono'}</p>
          </div>
          <div>
            <strong>Dirección de Entrega:</strong>
            <p>${order.customer.address}</p>
            <p>${order.customer.sector}, Ecuador</p>
          </div>
        </div>

        <div style="background: var(--cream); padding: 10px; border-radius: 4px; font-size: 12px; margin-bottom: 16px;">
          <strong>Pasarela:</strong> Payphone Ecuador &nbsp;|&nbsp; 
          <strong>Autorización:</strong> ${order.paymentDetails?.authorizationCode || 'APROBADO'} &nbsp;|&nbsp;
          <strong>Estado:</strong> <span class="status-pill status-paid">${order.status}</span>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 14px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--line); text-align: left;">
              <th style="padding: 6px 0;">Prenda</th>
              <th style="padding: 6px 0;">Talla</th>
              <th style="padding: 6px 0; text-align: center;">Cant.</th>
              <th style="padding: 6px 0; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || [])
              .map(
                (item) => `
              <tr style="border-bottom: 1px solid var(--line-light);">
                <td style="padding: 8px 0;">${item.name}</td>
                <td style="padding: 8px 0;">${item.size}</td>
                <td style="padding: 8px 0; text-align: center;">${item.qty}</td>
                <td style="padding: 8px 0; text-align: right;">${formatMoney(item.price * item.qty)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div style="text-align: right; font-size: 13px; line-height: 1.8;">
          <div>Subtotal: <strong>${formatMoney(order.subtotal)}</strong></div>
          <div>Envío: <strong>${order.shipping === 0 ? 'Gratis' : formatMoney(order.shipping)}</strong></div>
          <div>IVA (15%): <strong>${formatMoney(order.tax || 0)}</strong></div>
          <div style="font-size: 16px; border-top: 2px solid var(--ink); margin-top: 6px; padding-top: 6px;">
            Total Pagado: <strong style="color: var(--olive);">${formatMoney(order.total)}</strong>
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 12px; justify-content: center;">
        <button class="btn btn-primary btn-sm" id="triggerPrintBtn">Imprimir Recibo / Guardar PDF 🖨</button>
        <button class="btn btn-outline btn-sm" onclick="closeModal()">Seguir Explorando</button>
      </div>
    </div>
  `;

  openModal(html);

  const printBtn = dialogContent.querySelector('#triggerPrintBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => printReceiptClean(order));
  }
}

// Clean Full-Page Print to PDF Function (completely avoids dialog overflow/clipping bugs)
window.printReceiptClean = function (order) {
  if (!printReceiptContainer) return;

  const dateFormatted = new Date(order.createdAt).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  printReceiptContainer.innerHTML = `
    <div class="print-invoice">
      <div class="print-header">
        <div class="print-brand">
          LUMA
          <small>ESTILO CON INTENCIÓN · QUITO, ECUADOR</small>
        </div>
        <div class="print-invoice-title">
          <h2>COMPROBANTE DE VENTA DIGITAL</h2>
          <p><strong>N° Pedido:</strong> ${order.orderNumber}</p>
          <p><strong>Fecha:</strong> ${dateFormatted}</p>
        </div>
      </div>

      <div class="print-info-grid">
        <div>
          <strong style="display:block; font-size: 12px; margin-bottom: 4px; color: #111827;">DATOS DEL CLIENTE</strong>
          <p><strong>Nombre:</strong> ${order.customer.name}</p>
          <p><strong>Email:</strong> ${order.customer.email}</p>
          <p><strong>Teléfono:</strong> ${order.customer.phone || 'N/A'}</p>
        </div>
        <div>
          <strong style="display:block; font-size: 12px; margin-bottom: 4px; color: #111827;">ENTREGA Y PAGO</strong>
          <p><strong>Sector:</strong> ${order.customer.sector}</p>
          <p><strong>Dirección:</strong> ${order.customer.address}</p>
          <p><strong>Pasarela:</strong> <span class="print-badge-payphone">PAYPHONE ECUADOR</span> (Aut: ${order.paymentDetails?.authorizationCode || 'APROBADO'})</p>
        </div>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th>Prenda / Ítem</th>
            <th>Talla</th>
            <th style="text-align: center;">Cantidad</th>
            <th style="text-align: right;">Precio Unit.</th>
            <th style="text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${(order.items || [])
            .map(
              (item) => `
            <tr>
              <td><strong>${item.name}</strong><br><small style="color:#6b7280;">${item.lookName || 'Cápsula LUMA'}</small></td>
              <td>${item.size}</td>
              <td style="text-align: center;">${item.qty}</td>
              <td style="text-align: right;">${formatMoney(item.price)}</td>
              <td style="text-align: right;"><strong>${formatMoney(item.price * item.qty)}</strong></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="print-summary-box">
        <div class="print-summary-row">
          <span>Subtotal Prendas:</span>
          <strong>${formatMoney(order.subtotal)}</strong>
        </div>
        <div class="print-summary-row">
          <span>Envío a Domicilio (${order.customer.sector}):</span>
          <strong>${order.shipping === 0 ? 'Gratis' : formatMoney(order.shipping)}</strong>
        </div>
        <div class="print-summary-row">
          <span>IVA 15% (Ecuador):</span>
          <span>${formatMoney(order.tax || 0)}</span>
        </div>
        <div class="print-summary-row print-summary-total">
          <span>TOTAL PAGADO (USD):</span>
          <span>${formatMoney(order.total)}</span>
        </div>
      </div>

      <div style="clear: both;"></div>

      <div class="print-footer-note">
        <p><strong>LUMA Store Ecuador</strong> · RUC: 1792837461001 · Contacto: hola@luma.ec · WhatsApp: +593 99 876 5432</p>
        <p>Transacción procesada y respaldada por Payphone Ecuador. Este documento certifica el pago electrónico y reserva de inventario.</p>
        <p>Garantía de cambio de talla válida dentro de los primeros 7 días posteriores a la entrega en Quito.</p>
      </div>
    </div>
  `;

  // Trigger browser native print dialogue
  window.print();

  // Clean print container after dialog closes
  setTimeout(() => {
    printReceiptContainer.innerHTML = '';
  }, 1000);
};

// ==========================================
// AUTHENTICATION MODAL (LOGIN & REGISTRO)
// ==========================================
function openAuthModal() {
  if (state.user) {
    if (state.user.role === 'admin') {
      openAdminDashboard();
    } else {
      openUserProfileModal();
    }
    return;
  }

  const html = `
    <div class="auth-box">
      <div class="modal-tabs">
        <button class="modal-tab-btn active" id="tabLoginBtn" onclick="switchAuthTab('login')">Iniciar Sesión</button>
        <button class="modal-tab-btn" id="tabRegisterBtn" onclick="switchAuthTab('register')">Crear Cuenta</button>
      </div>

      <!-- Quick Test Login Shortcuts -->
      <div class="quick-test-box">
        <p>⚡ Inicio Rápido de Prueba (1 Clic):</p>
        <div class="quick-test-btns">
          <button class="btn btn-outline btn-sm" onclick="quickLogin('sofia@luma.ec', 'sofia123')">Cliente: Sofía</button>
          <button class="btn btn-outline btn-sm" style="border-color: var(--olive); color: var(--olive); font-weight:700;" onclick="quickLogin('admin@luma.ec', 'luma2026')">👑 Admin: Tienda</button>
        </div>
      </div>

      <!-- Login View -->
      <div id="loginView">
        <form id="loginForm">
          <div class="form-group">
            <label for="loginEmail">Correo Electrónico</label>
            <input type="email" id="loginEmail" class="form-control" required placeholder="tu@correo.com">
          </div>
          <div class="form-group">
            <label for="loginPassword">Contraseña</label>
            <input type="password" id="loginPassword" class="form-control" required placeholder="••••••••">
          </div>
          <button type="submit" class="btn btn-primary btn-block" style="margin-top: 20px;">Ingresar a LUMA</button>
          <div id="loginError" style="color: #c53030; font-size: 13px; margin-top: 12px;" role="alert"></div>
        </form>
      </div>

      <!-- Register View -->
      <div id="registerView" style="display: none;">
        <form id="registerForm">
          <div class="form-group">
            <label for="regName">Nombre Completo *</label>
            <input type="text" id="regName" class="form-control" required placeholder="Ej. Valentina Carrera">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="regEmail">Correo Electrónico *</label>
              <input type="email" id="regEmail" class="form-control" required placeholder="valentina@luma.ec">
            </div>
            <div class="form-group">
              <label for="regPhone">WhatsApp / Celular</label>
              <input type="tel" id="regPhone" class="form-control" placeholder="0998765432">
            </div>
          </div>
          <div class="form-group">
            <label for="regPassword">Contraseña * (mínimo 6 caracteres)</label>
            <input type="password" id="regPassword" class="form-control" required minlength="6" placeholder="••••••••">
          </div>
          <div class="form-group">
            <label for="regAddress">Dirección habitual en Quito</label>
            <input type="text" id="regAddress" class="form-control" placeholder="Sector, calle principal y número">
          </div>
          <button type="submit" class="btn btn-primary btn-block" style="margin-top: 20px;">Crear Mi Cuenta</button>
          <div id="regError" style="color: #c53030; font-size: 13px; margin-top: 12px;" role="alert"></div>
        </form>
      </div>
    </div>
  `;

  openModal(html);

  // Setup Form Handlers
  const loginForm = dialogContent.querySelector('#loginForm');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = dialogContent.querySelector('#loginError');
    errorBox.textContent = '';
    const email = dialogContent.querySelector('#loginEmail').value;
    const password = dialogContent.querySelector('#loginPassword').value;

    try {
      const res = await apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('luma_token', res.token);
      updateAuthUI();
      closeModal();

      if (res.user.role === 'admin') {
        showToast('¡Bienvenido, Administrador!', 'admin');
        setTimeout(() => openAdminDashboard('catalog'), 300);
      } else {
        showToast(`¡Bienvenida, ${res.user.name.split(' ')[0]}!`);
      }
    } catch (err) {
      errorBox.textContent = err.message || 'Error al iniciar sesión.';
    }
  });

  const registerForm = dialogContent.querySelector('#registerForm');
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = dialogContent.querySelector('#regError');
    errorBox.textContent = '';
    const name = dialogContent.querySelector('#regName').value;
    const email = dialogContent.querySelector('#regEmail').value;
    const phone = dialogContent.querySelector('#regPhone').value;
    const password = dialogContent.querySelector('#regPassword').value;
    const address = dialogContent.querySelector('#regAddress').value;

    try {
      const res = await apiCall('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, password, address, city: 'Quito' })
      });
      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('luma_token', res.token);
      updateAuthUI();
      closeModal();
      showToast('¡Tu cuenta ha sido creada exitosamente!');
    } catch (err) {
      errorBox.textContent = err.message || 'Error al registrar la cuenta.';
    }
  });
}

window.switchAuthTab = function (tab) {
  const loginView = dialogContent.querySelector('#loginView');
  const registerView = dialogContent.querySelector('#registerView');
  const tabLoginBtn = dialogContent.querySelector('#tabLoginBtn');
  const tabRegisterBtn = dialogContent.querySelector('#tabRegisterBtn');

  if (tab === 'login') {
    loginView.style.display = 'block';
    registerView.style.display = 'none';
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
  } else {
    loginView.style.display = 'none';
    registerView.style.display = 'block';
    tabLoginBtn.classList.remove('active');
    tabRegisterBtn.classList.add('active');
  }
};

window.quickLogin = async function (email, password) {
  try {
    const res = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    state.token = res.token;
    state.user = res.user;
    localStorage.setItem('luma_token', res.token);
    updateAuthUI();
    closeModal();

    if (res.user.role === 'admin') {
      showToast('¡Sesión iniciada como Administrador!', 'admin');
      setTimeout(() => openAdminDashboard('catalog'), 300);
    } else {
      showToast(`Sesión iniciada como ${res.user.name}`);
    }
  } catch (err) {
    showToast(err.message);
  }
};

// ==========================================
// USER PROFILE & ORDER HISTORY MODAL
// ==========================================
async function openUserProfileModal() {
  if (!state.user) return;

  let orders = [];
  try {
    const res = await apiCall('/api/orders');
    orders = res.orders || [];
  } catch (err) {
    console.warn('Could not load orders:', err);
  }

  const html = `
    <div style="max-width: 720px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 20px;">
        <div>
          <span class="eyebrow">MI CUENTA</span>
          <h2 style="font-family: var(--font-serif); font-size: 28px;">Hola, ${state.user.name}</h2>
          <p style="font-size: 13px; color: var(--muted);">${state.user.email} · Rol: ${state.user.role === 'admin' ? 'Administrador' : 'Cliente'}</p>
        </div>
        <div style="display: flex; gap: 8px;">
          ${state.user.role === 'admin' ? '<button class="btn btn-payphone btn-sm" onclick="openAdminDashboard()">⚙️ Panel Admin</button>' : ''}
          <button class="btn btn-outline btn-sm logout-header-btn" onclick="logoutUser()">Cerrar Sesión ⎋</button>
        </div>
      </div>

      <div class="modal-tabs">
        <button class="modal-tab-btn active" id="tabOrdersBtn" onclick="switchProfileTab('orders')">Mis Pedidos (${orders.length})</button>
        <button class="modal-tab-btn" id="tabDataBtn" onclick="switchProfileTab('data')">Datos de Envío</button>
      </div>

      <!-- Orders View -->
      <div id="profileOrdersView">
        ${
          orders.length === 0
            ? `
          <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
            <p>Aún no has realizado pedidos con esta cuenta.</p>
            <button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="closeModal()">Explorar Cápsula</button>
          </div>
        `
            : `
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${orders
              .map(
                (o) => `
              <div style="background: var(--paper-pure); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
                  <div>
                    <strong style="font-size: 15px;">${o.orderNumber}</strong>
                    <span style="font-size: 12px; color: var(--muted); margin-left: 8px;">${new Date(o.createdAt).toLocaleDateString('es-EC')}</span>
                  </div>
                  <span class="status-pill status-paid">${o.status}</span>
                </div>
                <div style="font-size: 13px; color: var(--muted); margin-bottom: 12px;">
                  ${(o.items || []).map((i) => `${i.qty}x ${i.name} (${i.size})`).join(' · ')}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--line-light); padding-top: 10px;">
                  <span style="font-size: 12px; color: var(--muted);">Pago: Payphone (${o.paymentDetails?.authorizationCode || 'Aprobado'})</span>
                  <div>
                    <strong style="font-size: 16px; margin-right: 12px;">${formatMoney(o.total)}</strong>
                    <button class="btn btn-outline btn-sm" onclick='showOrderSuccess(${JSON.stringify(o)})'>Ver Comprobante</button>
                  </div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        `
        }
      </div>

      <!-- Profile Data View -->
      <div id="profileDataView" style="display: none;">
        <form id="profileForm">
          <div class="form-group">
            <label for="profName">Nombre Completo</label>
            <input type="text" id="profName" class="form-control" value="${state.user.name || ''}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="profPhone">Teléfono / WhatsApp</label>
              <input type="tel" id="profPhone" class="form-control" value="${state.user.phone || ''}">
            </div>
            <div class="form-group">
              <label for="profSector">Sector habitual de entrega</label>
              <select id="profSector" class="form-control">
                ${Object.keys(state.config.shippingRates || {})
                  .map(
                    (zone) => `
                  <option value="${zone}" ${state.user.sector === zone ? 'selected' : ''}>${zone}</option>
                `
                  )
                  .join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="profAddress">Dirección Completa</label>
            <input type="text" id="profAddress" class="form-control" value="${state.user.address || ''}" placeholder="Calle principal, número, sector">
          </div>
          <button type="submit" class="btn btn-primary btn-block">Guardar Cambios</button>
        </form>
      </div>
    </div>
  `;

  openModal(html);

  const profileForm = dialogContent.querySelector('#profileForm');
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = dialogContent.querySelector('#profName').value;
    const phone = dialogContent.querySelector('#profPhone').value;
    const sector = dialogContent.querySelector('#profSector').value;
    const address = dialogContent.querySelector('#profAddress').value;

    try {
      const res = await apiCall('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, phone, sector, address })
      });
      state.user = res.user;
      updateAuthUI();
      showToast('Perfil actualizado correctamente.');
    } catch (err) {
      showToast(err.message);
    }
  });
}

window.switchProfileTab = function (tab) {
  const ordersView = dialogContent.querySelector('#profileOrdersView');
  const dataView = dialogContent.querySelector('#profileDataView');
  const tabOrdersBtn = dialogContent.querySelector('#tabOrdersBtn');
  const tabDataBtn = dialogContent.querySelector('#tabDataBtn');

  if (tab === 'orders') {
    ordersView.style.display = 'block';
    dataView.style.display = 'none';
    tabOrdersBtn.classList.add('active');
    tabDataBtn.classList.remove('active');
  } else {
    ordersView.style.display = 'none';
    dataView.style.display = 'block';
    tabOrdersBtn.classList.remove('active');
    tabDataBtn.classList.add('active');
  }
};

// Explicit Logout function (works everywhere)
window.logoutUser = function () {
  localStorage.removeItem('luma_token');
  state.token = null;
  state.user = null;
  updateAuthUI();
  closeModal();
  exitAdminView();
  showToast('Has cerrado sesión correctamente.');
};

authBtn.addEventListener('click', openAuthModal);

// ==========================================
// FULL-PAGE DEDICATED ADMIN MANAGEMENT DASHBOARD
// (RESPONSIVE · PESTAÑA COMPLETA · ORDENADO)
// ==========================================
window.openAdminDashboard = async function (activeTab = 'catalog') {
  if (!state.user || state.user.role !== 'admin') {
    showToast('Acceso restringido a administradores.');
    openAuthModal();
    return;
  }

  closeModal();
  state.currentAdminTab = activeTab;

  // Load orders
  try {
    const res = await apiCall('/api/admin/orders');
    state.adminOrdersCache = res.orders || [];
  } catch (err) {
    console.warn('Could not load orders for admin:', err);
    state.adminOrdersCache = [];
  }

  // Hide Storefront and Show Full-Page Admin
  if (siteAnnouncement) siteAnnouncement.style.display = 'none';
  if (siteHeader) siteHeader.style.display = 'none';
  if (mainContent) mainContent.style.display = 'none';
  if (siteFooter) siteFooter.style.display = 'none';
  if (adminFullPageView) adminFullPageView.style.display = 'flex';

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Render Full Admin Page
  renderAdminPage();
};

window.exitAdminView = function () {
  if (adminFullPageView) adminFullPageView.style.display = 'none';
  if (siteAnnouncement) siteAnnouncement.style.display = 'block';
  if (siteHeader) siteHeader.style.display = 'block';
  if (mainContent) mainContent.style.display = 'block';
  if (siteFooter) siteFooter.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadCatalog();
  applyDynamicSettings();
};

function renderAdminPage() {
  if (!adminFullPageView) return;

  adminFullPageView.innerHTML = `
    <!-- Top Sticky Admin Header Bar -->
    <header class="admin-top-bar">
      <div class="admin-brand-group">
        <a class="brand-logo" href="javascript:exitAdminView()">
          <span class="logo-text">LUMA</span>
          <span class="logo-sub">ADMINISTRACIÓN CENTRAL</span>
        </a>
        <span class="admin-pill-tag">PANEL DE CONTROL</span>
      </div>

      <!-- Navigation Tabs -->
      <nav class="admin-nav-tabs" aria-label="Secciones de administración">
        <button class="admin-nav-tab-btn ${state.currentAdminTab === 'catalog' ? 'active' : ''}" onclick="switchAdminSection('catalog')">
          👗 Catálogo & Outfits (${state.catalog.length})
        </button>
        <button class="admin-nav-tab-btn ${state.currentAdminTab === 'cover' ? 'active' : ''}" onclick="switchAdminSection('cover')">
          🎨 Portadas & Temporadas
        </button>
        <button class="admin-nav-tab-btn ${state.currentAdminTab === 'shipping' ? 'active' : ''}" onclick="switchAdminSection('shipping')">
          🚚 Tarifas de Envíos
        </button>
        <button class="admin-nav-tab-btn ${state.currentAdminTab === 'orders' ? 'active' : ''}" onclick="switchAdminSection('orders')">
          📦 Pedidos Payphone (${state.adminOrdersCache.length})
        </button>
      </nav>

      <!-- Right Header Actions -->
      <div style="display: flex; align-items: center; gap: 10px;">
        <button class="btn btn-primary btn-sm" onclick="exitAdminView()">
          👁️ Ver Tienda Pública
        </button>
        <button class="btn btn-outline btn-sm logout-header-btn" onclick="logoutUser()" title="Cerrar sesión de administrador">
          Cerrar Sesión ⎋
        </button>
      </div>
    </header>

    <!-- Main Admin Container (Full Width & Spacious) -->
    <main class="admin-main-container">

      <!-- 2-Column KPI Strip (Cleaned per user instruction) -->
      <div class="admin-stats-grid-2col">
        <div class="admin-stat-card">
          <span class="admin-stat-label">Outfits en Catálogo</span>
          <span class="admin-stat-value">${state.catalog.length} looks</span>
        </div>
        <div class="admin-stat-card">
          <span class="admin-stat-label">Total de Pedidos Registrados</span>
          <span class="admin-stat-value" style="color: var(--olive);">${state.adminOrdersCache.length} compras</span>
        </div>
      </div>

      <!-- DYNAMIC SECTION CONTAINER -->
      <div id="adminSectionContent">
        <!-- Rendered by switchAdminSection -->
      </div>
    </main>
  `;

  renderAdminSectionContent();
}

window.switchAdminSection = function (sectionKey) {
  state.currentAdminTab = sectionKey;
  document.querySelectorAll('.admin-nav-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(
      sectionKey === 'catalog' ? 'catálogo' :
      sectionKey === 'cover' ? 'portadas' :
      sectionKey === 'shipping' ? 'tarifas' : 'pedidos'
    ));
  });
  renderAdminSectionContent();
};

function renderAdminSectionContent() {
  const container = document.querySelector('#adminSectionContent');
  if (!container) return;

  // ==========================================
  // TAB 1: CATÁLOGO Y OUTFITS
  // ==========================================
  if (state.currentAdminTab === 'catalog') {
    container.innerHTML = `
      <div class="admin-page-header">
        <div>
          <span class="eyebrow" style="color: var(--olive);">GESTIÓN DE PRODUCTOS</span>
          <h2 style="font-family: var(--font-serif); font-size: 32px; margin: 4px 0;">Colección de Outfits y Prendas</h2>
          <p style="color: var(--muted); font-size: 14px;">Configura looks completos, edita precios, sube fotos desde tu computador y administra piezas.</p>
        </div>
        <button class="btn btn-primary" onclick="openFullOutfitEditor(null)">+ Crear Nuevo Look / Outfit</button>
      </div>

      <!-- Container for Outfit Editor if active -->
      <div id="outfitEditorSlot" style="margin-bottom: 30px;"></div>

      <!-- Outfits Grid -->
      <div class="admin-outfits-grid">
        ${state.catalog
          .map((look) => {
            const totalPrice = (look.items || []).reduce((s, i) => s + (Number(i.price) || 0), 0);
            return `
            <div class="admin-outfit-card">
              <div class="admin-card-img-wrap">
                <img class="${look.image && look.image.includes('assets/') ? 'portrait' : ''}" src="${look.image || 'assets/editorial.png'}" alt="${look.name}">
                <span class="card-tag" style="position: absolute; top: 12px; left: 12px; font-size: 10px; font-weight: 700;">${(look.occasion || '').toUpperCase()}</span>
              </div>
              <div class="admin-card-body">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <h3 style="font-family: var(--font-serif); font-size: 20px; font-weight: 600;">${look.name}</h3>
                  <strong style="font-size: 16px; color: var(--ink);">${formatMoney(totalPrice)}</strong>
                </div>
                <p style="font-size: 13px; color: var(--muted); margin: 6px 0 10px;">${look.note || ''}</p>
                
                <div class="admin-card-pieces">
                  <strong>Prendas incluidas (${(look.items || []).length}):</strong><br>
                  ${(look.items || []).map((i) => `• ${i.name} (${formatMoney(i.price)})`).join('<br>')}
                </div>

                <div class="admin-card-actions">
                  <button class="btn btn-outline btn-sm" style="flex: 1;" onclick='openFullOutfitEditor(${JSON.stringify(look).replace(/'/g, "&apos;")})'>✏️ Editar</button>
                  <button class="btn btn-outline btn-sm" style="color: #c53030;" onclick="deleteOutfit(${look.id})">🗑️ Eliminar</button>
                </div>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;
    return;
  }

  // ==========================================
  // TAB 2: PORTADAS Y TEMPORADAS (CON TIPOGRAFÍA, COLOR, TAMAÑO Y SUBIDA DE FOTO)
  // ==========================================
  if (state.currentAdminTab === 'cover') {
    container.innerHTML = `
      <div class="admin-page-header">
        <div>
          <span class="eyebrow" style="color: var(--olive);">DISEÑO Y TEMPORADAS</span>
          <h2 style="font-family: var(--font-serif); font-size: 32px; margin: 4px 0;">Portadas, Banners y Tipografía</h2>
          <p style="color: var(--muted); font-size: 14px;">Personaliza tipografías, colores de texto y sube fotos desde tu equipo con vista previa en tiempo real.</p>
        </div>
        <button class="btn btn-primary" onclick="saveCoverSettingsFull()">Guardar Todos los Cambios 💾</button>
      </div>

      <div class="admin-cover-grid">
        <!-- Left Column: Settings Form -->
        <div>
          <!-- Announcement Box Settings -->
          <div class="admin-panel-card">
            <h3 style="font-size: 17px; margin-bottom: 14px; border-bottom: 1px solid var(--line-light); padding-bottom: 8px;">
              1. Franja Superior de Anuncios
            </h3>
            <div class="form-row">
              <div class="form-group">
                <label for="fullAnnCity">Ciudad / Localización</label>
                <input type="text" id="fullAnnCity" class="form-control" value="${state.config.announcement?.city || 'QUITO · MADRID'}">
              </div>
              <div class="form-group">
                <label for="fullAnnTag">Etiqueta Derecha</label>
                <input type="text" id="fullAnnTag" class="form-control" value="${state.config.announcement?.tag || 'ENVÍOS GRATIS DESDE $90'}">
              </div>
            </div>
            <div class="form-group">
              <label for="fullAnnText">Texto del Anuncio</label>
              <input type="text" id="fullAnnText" class="form-control" value="${state.config.announcement?.text || ''}">
            </div>
          </div>

          <!-- Hero Section Settings with Font & Color Customizer -->
          <div class="admin-panel-card">
            <h3 style="font-size: 17px; margin-bottom: 14px; border-bottom: 1px solid var(--line-light); padding-bottom: 8px;">
              2. Sección Principal de Portada (Hero)
            </h3>

            <!-- Font and Size Customizers -->
            <div class="form-row">
              <div class="form-group">
                <label for="fullHeroTitleFont">Tipo de Letra del Título</label>
                <select id="fullHeroTitleFont" class="form-control">
                  <option value="'Playfair Display', Georgia, serif" ${state.config.hero?.titleFont?.includes('Playfair') ? 'selected' : ''}>Playfair Display (Editorial Clásico)</option>
                  <option value="'DM Sans', sans-serif" ${state.config.hero?.titleFont?.includes('DM Sans') ? 'selected' : ''}>DM Sans (Moderno Minimalista)</option>
                  <option value="'Cormorant Garamond', Georgia, serif" ${state.config.hero?.titleFont?.includes('Cormorant') ? 'selected' : ''}>Cormorant Garamond (Alta Costura)</option>
                  <option value="'Inter', sans-serif" ${state.config.hero?.titleFont?.includes('Inter') ? 'selected' : ''}>Inter (Contemporáneo Urbano)</option>
                  <option value="'Cinzel', Georgia, serif" ${state.config.hero?.titleFont?.includes('Cinzel') ? 'selected' : ''}>Cinzel (Elegancia Solemne)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="fullHeroTitleSize">Tamaño del Título</label>
                <select id="fullHeroTitleSize" class="form-control">
                  <option value="36px" ${state.config.hero?.titleSize === '36px' ? 'selected' : ''}>Normal (36px)</option>
                  <option value="44px" ${!state.config.hero?.titleSize || state.config.hero?.titleSize === '44px' || state.config.hero?.titleSize === '48px' ? 'selected' : ''}>Grande (44px)</option>
                  <option value="56px" ${state.config.hero?.titleSize === '56px' ? 'selected' : ''}>Extra Grande (56px)</option>
                </select>
              </div>
            </div>

            <!-- Title & Subtitle Colors with Presets -->
            <div class="form-row">
              <div class="form-group">
                <label for="fullHeroTitleColor">Color de Letra del Título</label>
                <div class="color-picker-row">
                  <input type="color" id="fullHeroTitleColor" class="color-input-bubble" value="${state.config.hero?.titleColor || '#191c18'}">
                  <span id="titleColorCode" style="font-size: 13px; font-family: monospace; font-weight: 600;">${state.config.hero?.titleColor || '#191c18'}</span>
                </div>
                <div class="color-preset-chips">
                  <button type="button" class="color-chip-btn" style="background:#191c18;" title="Negro Tinta" onclick="setCoverColor('#fullHeroTitleColor', '#titleColorCode', '#prevHeroTitle', 'color', '#191c18')"></button>
                  <button type="button" class="color-chip-btn" style="background:#495342;" title="Verde Oliva LUMA" onclick="setCoverColor('#fullHeroTitleColor', '#titleColorCode', '#prevHeroTitle', 'color', '#495342')"></button>
                  <button type="button" class="color-chip-btn" style="background:#9c4126;" title="Terracota Andino" onclick="setCoverColor('#fullHeroTitleColor', '#titleColorCode', '#prevHeroTitle', 'color', '#9c4126')"></button>
                  <button type="button" class="color-chip-btn" style="background:#bfa15f;" title="Dorado Cápsula" onclick="setCoverColor('#fullHeroTitleColor', '#titleColorCode', '#prevHeroTitle', 'color', '#bfa15f')"></button>
                  <button type="button" class="color-chip-btn" style="background:#203a43;" title="Azul Profundo" onclick="setCoverColor('#fullHeroTitleColor', '#titleColorCode', '#prevHeroTitle', 'color', '#203a43')"></button>
                </div>
              </div>

              <div class="form-group">
                <label for="fullHeroSubtitleColor">Color del Subtítulo</label>
                <div class="color-picker-row">
                  <input type="color" id="fullHeroSubtitleColor" class="color-input-bubble" value="${state.config.hero?.subtitleColor || '#6a6f66'}">
                  <span id="subColorCode" style="font-size: 13px; font-family: monospace; font-weight: 600;">${state.config.hero?.subtitleColor || '#6a6f66'}</span>
                </div>
                <div class="color-preset-chips">
                  <button type="button" class="color-chip-btn" style="background:#6a6f66;" title="Gris Seda" onclick="setCoverColor('#fullHeroSubtitleColor', '#subColorCode', '#prevHeroDesc', 'color', '#6a6f66')"></button>
                  <button type="button" class="color-chip-btn" style="background:#191c18;" title="Negro Tinta" onclick="setCoverColor('#fullHeroSubtitleColor', '#subColorCode', '#prevHeroDesc', 'color', '#191c18')"></button>
                  <button type="button" class="color-chip-btn" style="background:#495342;" title="Verde Oliva" onclick="setCoverColor('#fullHeroSubtitleColor', '#subColorCode', '#prevHeroDesc', 'color', '#495342')"></button>
                  <button type="button" class="color-chip-btn" style="background:#8c7b6d;" title="Tierra Suave" onclick="setCoverColor('#fullHeroSubtitleColor', '#subColorCode', '#prevHeroDesc', 'color', '#8c7b6d')"></button>
                </div>
              </div>
            </div>

            <!-- Subtitle Font and Eyebrow -->
            <div class="form-row">
              <div class="form-group">
                <label for="fullHeroSubFont">Tipografía del Subtítulo</label>
                <select id="fullHeroSubFont" class="form-control">
                  <option value="'DM Sans', sans-serif" ${state.config.hero?.subtitleFont?.includes('DM Sans') ? 'selected' : ''}>DM Sans (Moderno y Legible)</option>
                  <option value="'Inter', sans-serif" ${state.config.hero?.subtitleFont?.includes('Inter') ? 'selected' : ''}>Inter (Neutral Contemporáneo)</option>
                  <option value="'Cormorant Garamond', Georgia, serif" ${state.config.hero?.subtitleFont?.includes('Cormorant') ? 'selected' : ''}>Cormorant Garamond (Elegante)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="fullHeroEyebrowColor">Color de la Etiqueta (Eyebrow)</label>
                <div class="color-picker-row">
                  <input type="color" id="fullHeroEyebrowColor" class="color-input-bubble" value="${state.config.hero?.eyebrowColor || '#495342'}">
                  <span id="eyebrowColorCode" style="font-size: 13px; font-family: monospace; font-weight: 600;">${state.config.hero?.eyebrowColor || '#495342'}</span>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label for="fullHeroEyebrow">Cápsula / Temporada Activa</label>
              <input type="text" id="fullHeroEyebrow" class="form-control" value="${state.config.hero?.eyebrow || 'TEMPORADA 2026 / MADRID → QUITO'}">
            </div>

            <!-- Image URL + File Upload directly from machine -->
            <div class="form-group">
              <label for="fullHeroImage">Imagen de Portada (Ruta o Subir desde tu Equipo)</label>
              <input type="text" id="fullHeroImage" class="form-control" value="${state.config.hero?.image || 'assets/editorial.png'}">
              
              <div class="upload-group" style="margin-top: 8px;">
                <label class="file-upload-label" style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; padding: 9px 16px; background: #f3f0e8; border: 1px dashed var(--olive); border-radius: 4px; font-size: 13px; font-weight: 600;">
                  📁 Subir foto desde mi computador
                  <input type="file" id="heroFileInput" class="file-upload-input" accept="image/*" onchange="handleImageUpload(this, '#fullHeroImage', '#prevHeroImg')">
                </label>
                <small style="color: var(--muted); font-size: 12px; display: block; margin-top: 4px;">Formatos: PNG, JPG, WEBP. Se sube de inmediato a tu tienda.</small>
              </div>
            </div>

            <div class="form-group">
              <label for="fullHeroTitle">Título Principal (Soporta &lt;br&gt; y &lt;em&gt;)</label>
              <input type="text" id="fullHeroTitle" class="form-control" value="${state.config.hero?.title || 'Menos dudas.<br>Más <em>tú.</em>'}">
            </div>

            <div class="form-group">
              <label for="fullHeroSubtitle">Descripción / Subtítulo</label>
              <textarea id="fullHeroSubtitle" class="form-control" rows="3">${state.config.hero?.subtitle || ''}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="fullHeroCardTitle">Título Tarjeta Flotante</label>
                <input type="text" id="fullHeroCardTitle" class="form-control" value="${state.config.hero?.cardTitle || 'Colección Inteligente'}">
              </div>
              <div class="form-group">
                <label for="fullHeroCardSubtitle">Subtítulo Tarjeta Flotante</label>
                <input type="text" id="fullHeroCardSubtitle" class="form-control" value="${state.config.hero?.cardSubtitle || 'Piezas modulares para Quito'}">
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: REAL-TIME LIVE VISUAL PREVIEW CARD -->
        <div>
          <div class="admin-preview-sticky">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
              <strong style="font-size: 13px; color: var(--olive); text-transform: uppercase; letter-spacing: 1px;">
                ✦ Vista Previa en Tiempo Real
              </strong>
              <small style="font-size: 11px; color: var(--muted);">Actualiza en vivo mientras editas</small>
            </div>

            <div style="background: var(--paper-pure); border: 2px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; box-shadow: var(--shadow-md);">
              <!-- Mini Announcement Preview -->
              <div id="prevAnnBar" style="background: var(--olive); color: #fff; padding: 9px 14px; font-size: 11px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <span id="prevAnnCity" style="font-weight: 700;">${state.config.announcement?.city || 'QUITO · MADRID'}</span>
                <span id="prevAnnTag" style="letter-spacing: 0.5px;">${state.config.announcement?.tag || 'ENVÍOS GRATIS'}</span>
              </div>

              <!-- Mini Hero Preview -->
              <div style="padding: 24px;">
                <span id="prevHeroEyebrow" style="font-size: 11px; font-weight: 700; color: ${state.config.hero?.eyebrowColor || '#495342'}; letter-spacing: 1px; display: block; margin-bottom: 6px;">
                  ${state.config.hero?.eyebrow || 'TEMPORADA 2026'}
                </span>
                <h2 id="prevHeroTitle" style="font-size: ${state.config.hero?.titleSize || '32px'}; margin: 8px 0; line-height: 1.15; font-family: ${state.config.hero?.titleFont || "'Playfair Display', Georgia, serif"}; color: ${state.config.hero?.titleColor || '#191c18'};">
                  ${state.config.hero?.title || 'Menos dudas. Más tú.'}
                </h2>
                <p id="prevHeroDesc" style="font-size: 13px; font-family: ${state.config.hero?.subtitleFont || "'DM Sans', sans-serif"}; color: ${state.config.hero?.subtitleColor || '#6a6f66'}; margin-bottom: 18px; line-height: 1.6;">
                  ${state.config.hero?.subtitle || ''}
                </p>
                <div style="position: relative; height: 260px; background: #e2dbce; border-radius: 4px; overflow: hidden;">
                  <img id="prevHeroImg" src="${state.config.hero?.image || 'assets/editorial.png'}" style="width:100%; height:100%; object-fit:cover;">
                  <div style="position: absolute; bottom: 10px; left: 10px; right: 10px; background: rgba(255,255,255,0.95); padding: 10px; border-radius: 4px; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <strong id="prevCardTitle" style="display:block; color: var(--ink);">${state.config.hero?.cardTitle || ''}</strong>
                    <span id="prevCardSubtitle" style="color: var(--muted);">${state.config.hero?.cardSubtitle || ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Real-Time Event Listeners
    const bindLive = (inputId, targetId, prop = 'textContent', isHTML = false) => {
      const input = document.querySelector(inputId);
      const target = document.querySelector(targetId);
      if (input && target) {
        input.addEventListener('input', () => {
          if (isHTML) target.innerHTML = input.value;
          else target[prop] = input.value;
        });
      }
    };

    bindLive('#fullAnnCity', '#prevAnnCity');
    bindLive('#fullAnnTag', '#prevAnnTag');
    bindLive('#fullHeroEyebrow', '#prevHeroEyebrow');
    bindLive('#fullHeroTitle', '#prevHeroTitle', 'innerHTML', true);
    bindLive('#fullHeroSubtitle', '#prevHeroDesc');
    bindLive('#fullHeroCardTitle', '#prevCardTitle');
    bindLive('#fullHeroCardSubtitle', '#prevCardSubtitle');

    // Title Font family live update
    const fontSelect = document.querySelector('#fullHeroTitleFont');
    const heroTitlePrev = document.querySelector('#prevHeroTitle');
    if (fontSelect && heroTitlePrev) {
      fontSelect.addEventListener('change', () => {
        heroTitlePrev.style.fontFamily = fontSelect.value;
      });
    }

    // Title Font Size live update
    const sizeSelect = document.querySelector('#fullHeroTitleSize');
    if (sizeSelect && heroTitlePrev) {
      sizeSelect.addEventListener('change', () => {
        heroTitlePrev.style.fontSize = sizeSelect.value;
      });
    }

    // Subtitle Font family live update
    const subFontSelect = document.querySelector('#fullHeroSubFont');
    const heroDescPrev = document.querySelector('#prevHeroDesc');
    if (subFontSelect && heroDescPrev) {
      subFontSelect.addEventListener('change', () => {
        heroDescPrev.style.fontFamily = subFontSelect.value;
      });
    }

    // Title color live update
    const titleColorInput = document.querySelector('#fullHeroTitleColor');
    const titleColorCode = document.querySelector('#titleColorCode');
    if (titleColorInput && heroTitlePrev) {
      titleColorInput.addEventListener('input', () => {
        heroTitlePrev.style.color = titleColorInput.value;
        if (titleColorCode) titleColorCode.textContent = titleColorInput.value;
      });
    }

    // Subtitle color live update
    const subColorInput = document.querySelector('#fullHeroSubtitleColor');
    const subColorCode = document.querySelector('#subColorCode');
    if (subColorInput && heroDescPrev) {
      subColorInput.addEventListener('input', () => {
        heroDescPrev.style.color = subColorInput.value;
        if (subColorCode) subColorCode.textContent = subColorInput.value;
      });
    }

    // Eyebrow color live update
    const eyebrowColorInput = document.querySelector('#fullHeroEyebrowColor');
    const prevHeroEyebrow = document.querySelector('#prevHeroEyebrow');
    const eyebrowColorCode = document.querySelector('#eyebrowColorCode');
    if (eyebrowColorInput && prevHeroEyebrow) {
      eyebrowColorInput.addEventListener('input', () => {
        prevHeroEyebrow.style.color = eyebrowColorInput.value;
        if (eyebrowColorCode) eyebrowColorCode.textContent = eyebrowColorInput.value;
      });
    }

    // Image URL live update
    const heroImgInput = document.querySelector('#fullHeroImage');
    const heroImgPrev = document.querySelector('#prevHeroImg');
    if (heroImgInput && heroImgPrev) {
      heroImgInput.addEventListener('input', () => {
        heroImgPrev.src = heroImgInput.value;
      });
    }
    return;
  }

  // ==========================================
  // TAB 3: TARIFAS DE ENVÍOS
  // ==========================================
  if (state.currentAdminTab === 'shipping') {
    container.innerHTML = `
      <div class="admin-page-header">
        <div>
          <span class="eyebrow" style="color: var(--olive);">LOGÍSTICA Y DESPACHOS</span>
          <h2 style="font-family: var(--font-serif); font-size: 32px; margin: 4px 0;">Tarifas de Entrega en Ecuador</h2>
          <p style="color: var(--muted); font-size: 14px;">Define los valores de envío cobrados en checkout y el límite para transporte gratuito.</p>
        </div>
        <button class="btn btn-primary" onclick="saveShippingRatesFull()">Guardar Tarifas 💾</button>
      </div>

      <div class="admin-panel-card" style="max-width: 850px;">
        <h3 style="font-size: 18px; margin-bottom: 20px;">Costos por Sector de Destino (USD)</h3>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div class="form-group">
            <label for="rateQuitoFull">📍 Quito Urbano ($ USD)</label>
            <input type="number" step="0.25" id="rateQuitoFull" class="form-control" value="${state.config.shippingRates['Quito urbano'] || 3.5}">
          </div>

          <div class="form-group">
            <label for="rateCumbayaFull">📍 Cumbayá / Tumbaco ($ USD)</label>
            <input type="number" step="0.25" id="rateCumbayaFull" class="form-control" value="${state.config.shippingRates['Cumbayá / Tumbaco'] || 4.5}">
          </div>

          <div class="form-group">
            <label for="rateChillosFull">📍 Valle de Los Chillos ($ USD)</label>
            <input type="number" step="0.25" id="rateChillosFull" class="form-control" value="${state.config.shippingRates['Los Chillos'] || 5.0}">
          </div>

          <div class="form-group">
            <label for="rateNacionalFull">📍 Otras Provincias - Servientrega ($ USD)</label>
            <input type="number" step="0.25" id="rateNacionalFull" class="form-control" value="${state.config.shippingRates['Nacional (Ecuador)'] || 6.5}">
          </div>
        </div>

        <div class="form-group" style="margin-top: 10px; padding-top: 18px; border-top: 1px solid var(--line-light);">
          <label for="rateFreeThresholdFull">🎉 Monto Mínimo de Pedido para Envío Gratis ($ USD)</label>
          <input type="number" step="5" id="rateFreeThresholdFull" class="form-control" value="${state.config.freeShippingThreshold || 90}" style="max-width: 300px;">
          <small style="font-size: 12px; color: var(--muted); display: block; margin-top: 4px;">
            Si el cliente compra un monto igual o superior a este valor, el costo de envío pasa a ser $0 automáticamente.
          </small>
        </div>
      </div>
    `;
    return;
  }

  // ==========================================
  // TAB 4: PEDIDOS PAYPHONE ORGANIZADOS POR SECCIONES
  // (NUEVOS PEDIDOS, EN CAMINO, ENTREGADOS, TODOS)
  // ==========================================
  if (state.currentAdminTab === 'orders') {
    let ordersList = state.adminOrdersCache || [];

    // Optional text search filter
    if (state.orderSearchQuery) {
      const q = state.orderSearchQuery.toLowerCase();
      ordersList = ordersList.filter((o) => {
        return (
          (o.orderNumber || '').toLowerCase().includes(q) ||
          (o.customer?.name || '').toLowerCase().includes(q) ||
          (o.customer?.phone || '').toLowerCase().includes(q) ||
          (o.customer?.sector || '').toLowerCase().includes(q) ||
          (o.customer?.email || '').toLowerCase().includes(q)
        );
      });
    }

    // Filter counts based on all orders (pre-search or current)
    const allCache = state.adminOrdersCache || [];
    const newOrders = allCache.filter((o) => (o.status || '').toLowerCase().includes('preparación') || (o.status || '').toLowerCase().includes('confirmado'));
    const shippingOrders = allCache.filter((o) => (o.status || '').toLowerCase().includes('camino'));
    const deliveredOrders = allCache.filter((o) => (o.status || '').toLowerCase().includes('entregado'));

    // Filtered lists for Kanban or single section view
    const sectionNew = ordersList.filter((o) => (o.status || '').toLowerCase().includes('preparación') || (o.status || '').toLowerCase().includes('confirmado'));
    const sectionShipping = ordersList.filter((o) => (o.status || '').toLowerCase().includes('camino'));
    const sectionDelivered = ordersList.filter((o) => (o.status || '').toLowerCase().includes('entregado'));

    let currentSectionOrders = ordersList;
    if (state.currentOrderFilter === 'new') currentSectionOrders = sectionNew;
    else if (state.currentOrderFilter === 'shipping') currentSectionOrders = sectionShipping;
    else if (state.currentOrderFilter === 'delivered') currentSectionOrders = sectionDelivered;

    container.innerHTML = `
      <div class="admin-page-header">
        <div>
          <span class="eyebrow" style="color: var(--olive);">LOGÍSTICA & PAGOS PAYPHONE</span>
          <h2 style="font-family: var(--font-serif); font-size: 32px; margin: 4px 0;">Gestión de Pedidos por Sección</h2>
          <p style="color: var(--muted); font-size: 14px;">Flujo de despacho dividido en 3 etapas: <strong>1. Nuevos Pedidos</strong> ➔ <strong>2. En Camino</strong> ➔ <strong>3. Entregados</strong>.</p>
        </div>

        <!-- View Mode Switcher -->
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div class="view-mode-toggle">
            <button type="button" class="view-mode-btn ${state.ordersViewMode !== 'kanban' ? 'active' : ''}" onclick="setOrdersViewMode('tabs')">
              📋 Vista Tabla
            </button>
            <button type="button" class="view-mode-btn ${state.ordersViewMode === 'kanban' ? 'active' : ''}" onclick="setOrdersViewMode('kanban')">
              🗂️ Vista Tablero (3 Secciones)
            </button>
          </div>
        </div>
      </div>

      <!-- Search & Quick Navigation Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">
        <!-- Subtab Filter Bar for Orders -->
        <div class="orders-filter-bar" style="margin-bottom: 0;">
          <button class="order-filter-pill ${state.currentOrderFilter === 'new' ? 'active' : ''}" onclick="filterOrdersSection('new')">
            ⏳ 1. Nuevos Pedidos (Por Preparar)
            <span class="pill-count" style="background:#fef3c7; color:#92400e;">${newOrders.length}</span>
          </button>

          <button class="order-filter-pill ${state.currentOrderFilter === 'shipping' ? 'active' : ''}" onclick="filterOrdersSection('shipping')">
            🛵 2. En Camino con Motorizado
            <span class="pill-count" style="background:#dbeafe; color:#1e40af;">${shippingOrders.length}</span>
          </button>

          <button class="order-filter-pill ${state.currentOrderFilter === 'delivered' ? 'active' : ''}" onclick="filterOrdersSection('delivered')">
            ✅ 3. Entregados con Éxito
            <span class="pill-count" style="background:#dcfce7; color:#166534;">${deliveredOrders.length}</span>
          </button>

          <button class="order-filter-pill ${state.currentOrderFilter === 'all' ? 'active' : ''}" onclick="filterOrdersSection('all')">
            📋 Todos los Pedidos
            <span class="pill-count">${allCache.length}</span>
          </button>
        </div>

        <!-- Search Input -->
        <div style="flex-grow: 1; max-width: 320px; min-width: 220px;">
          <input type="text" class="form-control" style="font-size: 13px;" placeholder="🔍 Buscar por cliente, sector o N° orden..." value="${state.orderSearchQuery || ''}" oninput="searchOrdersAdmin(this.value)">
        </div>
      </div>

      ${
        state.ordersViewMode === 'kanban'
          ? `
        <!-- ============================================== -->
        <!-- TABLERO VISUAL KANBAN (3 COLUMNAS EN PARALELO) -->
        <!-- ============================================== -->
        <div class="orders-kanban-board">
          <!-- Columna 1: Nuevos Pedidos -->
          <div class="kanban-col">
            <div class="kanban-col-header col-new">
              <span>⏳ 1. Nuevos Pedidos (Por Preparar)</span>
              <span class="badge-mini" style="background:#fef3c7; color:#92400e;">${sectionNew.length}</span>
            </div>
            <div class="kanban-col-body">
              ${
                sectionNew.length === 0
                  ? `<p style="text-align: center; color: var(--muted); font-size: 12px; margin: 30px 0;">No hay nuevos pedidos pendientes de empaque.</p>`
                  : sectionNew
                      .map(
                        (o) => `
                    <div class="kanban-order-card">
                      <div style="display:flex; justify-content:space-between; align-items:baseline;">
                        <strong style="color:var(--olive); font-size:14px;">${o.orderNumber}</strong>
                        <strong style="font-size:15px; color:var(--ink);">${formatMoney(o.total)}</strong>
                      </div>
                      <div style="font-size:12px; color:var(--muted);">
                        <span>📅 ${new Date(o.createdAt).toLocaleDateString('es-EC')}</span> · 
                        <span>📍 ${o.customer.sector}</span>
                      </div>
                      <div style="font-size:13px; font-weight:600;">${o.customer.name}</div>
                      <div style="font-size:11px; color:#4b5563; background:#f9fafb; padding:6px; border-radius:4px; line-height:1.4;">
                        ${(o.items || []).map((i) => `• ${i.qty}x ${i.name} (${i.size})`).join('<br>')}
                      </div>
                      <div style="display:flex; gap:6px; margin-top:4px;">
                        <button class="btn btn-primary btn-sm" style="flex:1; font-size:11px; padding:6px 8px;" onclick="updateOrderStatus('${o.id}', 'En camino con motorizado')">
                          🛵 Despachar Pedido ➔
                        </button>
                        ${
                          o.customer.phone
                            ? `<a href="https://wa.me/${o.customer.phone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(o.customer.name)},%20te%20saludamos%20de%20LUMA%20Quito.%20Tu%20pedido%20${o.orderNumber}%20se%20est%C3%A1%20preparando." target="_blank" class="btn btn-outline btn-sm" style="padding:4px 8px; font-size:11px; border-color:#22c55e; color:#15803d;" title="Escribir por WhatsApp">💬</a>`
                            : ''
                        }
                        <button class="btn btn-outline btn-sm" style="padding:4px 8px; font-size:11px;" onclick='printReceiptClean(${JSON.stringify(o).replace(/'/g, "&apos;")})' title="Imprimir PDF">🖨</button>
                      </div>
                    </div>
                  `
                      )
                      .join('')
              }
            </div>
          </div>

          <!-- Columna 2: En Camino con Motorizado -->
          <div class="kanban-col">
            <div class="kanban-col-header col-shipping">
              <span>🛵 2. En Camino con Motorizado</span>
              <span class="badge-mini" style="background:#dbeafe; color:#1e40af;">${sectionShipping.length}</span>
            </div>
            <div class="kanban-col-body">
              ${
                sectionShipping.length === 0
                  ? `<p style="text-align: center; color: var(--muted); font-size: 12px; margin: 30px 0;">No hay pedidos actualmente en ruta.</p>`
                  : sectionShipping
                      .map(
                        (o) => `
                    <div class="kanban-order-card">
                      <div style="display:flex; justify-content:space-between; align-items:baseline;">
                        <strong style="color:#2563eb; font-size:14px;">${o.orderNumber}</strong>
                        <strong style="font-size:15px; color:var(--ink);">${formatMoney(o.total)}</strong>
                      </div>
                      <div style="font-size:12px; color:var(--muted);">
                        <span>📍 ${o.customer.sector}</span> · 
                        <span>Dirección: ${o.customer.address}</span>
                      </div>
                      <div style="font-size:13px; font-weight:600;">${o.customer.name} (${o.customer.phone || 'S/T'})</div>
                      <div style="font-size:11px; color:#4b5563; background:#f9fafb; padding:6px; border-radius:4px; line-height:1.4;">
                        ${(o.items || []).map((i) => `• ${i.qty}x ${i.name} (${i.size})`).join('<br>')}
                      </div>
                      <div style="display:flex; gap:6px; margin-top:4px;">
                        <button class="btn btn-sm" style="flex:1; background:#16a34a; color:#fff; font-size:11px; padding:6px 8px; border:none; border-radius:4px; cursor:pointer;" onclick="updateOrderStatus('${o.id}', 'Entregado con éxito')">
                          ✅ Marcar Entregado ✓
                        </button>
                        ${
                          o.customer.phone
                            ? `<a href="https://wa.me/${o.customer.phone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(o.customer.name)},%20tu%20pedido%20LUMA%20${o.orderNumber}%20va%20en%20camino%20con%20el%20motorizado%20a%20tu%20direcci%C3%B3n." target="_blank" class="btn btn-outline btn-sm" style="padding:4px 8px; font-size:11px; border-color:#22c55e; color:#15803d;" title="Avisar por WhatsApp">💬</a>`
                            : ''
                        }
                        <button class="btn btn-outline btn-sm" style="padding:4px 8px; font-size:11px;" onclick='printReceiptClean(${JSON.stringify(o).replace(/'/g, "&apos;")})' title="Imprimir PDF">🖨</button>
                      </div>
                    </div>
                  `
                      )
                      .join('')
              }
            </div>
          </div>

          <!-- Columna 3: Entregados con Éxito -->
          <div class="kanban-col">
            <div class="kanban-col-header col-delivered">
              <span>✅ 3. Entregados con Éxito</span>
              <span class="badge-mini" style="background:#dcfce7; color:#166534;">${sectionDelivered.length}</span>
            </div>
            <div class="kanban-col-body">
              ${
                sectionDelivered.length === 0
                  ? `<p style="text-align: center; color: var(--muted); font-size: 12px; margin: 30px 0;">No hay pedidos entregados en este filtro.</p>`
                  : sectionDelivered
                      .map(
                        (o) => `
                    <div class="kanban-order-card" style="opacity:0.92;">
                      <div style="display:flex; justify-content:space-between; align-items:baseline;">
                        <strong style="color:#15803d; font-size:14px;">${o.orderNumber}</strong>
                        <strong style="font-size:15px; color:var(--ink);">${formatMoney(o.total)}</strong>
                      </div>
                      <div style="font-size:12px; color:var(--muted);">
                        <span>✅ Entregado satisfactoriamente</span> · 
                        <span>📍 ${o.customer.sector}</span>
                      </div>
                      <div style="font-size:13px; font-weight:600;">${o.customer.name}</div>
                      <div style="font-size:11px; color:#4b5563; background:#f9fafb; padding:6px; border-radius:4px; line-height:1.4;">
                        ${(o.items || []).map((i) => `• ${i.qty}x ${i.name} (${i.size})`).join('<br>')}
                      </div>
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                        <span class="badge-mini" style="background:#dcfce7; color:#166534; font-weight:700;">VENTA CERRADA</span>
                        <button class="btn btn-outline btn-sm" style="font-size:11px; padding:4px 10px;" onclick='printReceiptClean(${JSON.stringify(o).replace(/'/g, "&apos;")})'>
                          Imprimir Recibo PDF 🖨
                        </button>
                      </div>
                    </div>
                  `
                      )
                      .join('')
              }
            </div>
          </div>
        </div>
      `
          : `
        <!-- ============================================== -->
        <!-- TABLA DETALLADA POR SECCIÓN SELECCIONADA      -->
        <!-- ============================================== -->
        <div class="admin-panel-card">
          ${
            currentSectionOrders.length === 0
              ? `<div style="text-align: center; padding: 40px; color: var(--muted);">
                  <span style="font-size: 36px; display: block; margin-bottom: 8px;">📦</span>
                  No se encontraron pedidos en la sección <strong>${
                    state.currentOrderFilter === 'new' ? 'Nuevos Pedidos' :
                    state.currentOrderFilter === 'shipping' ? 'En Camino con Motorizado' :
                    state.currentOrderFilter === 'delivered' ? 'Entregados con Éxito' : 'General'
                  }</strong>.
                </div>`
              : `
            <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
              <table class="orders-table" style="font-size: 13px; width: 100%; min-width: 820px;">
                <thead>
                  <tr>
                    <th>N° Pedido</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Sector / Dirección</th>
                    <th>Prendas</th>
                    <th>Total USD</th>
                    <th>Estado de Despacho</th>
                    <th>Acción Inmediata</th>
                  </tr>
                </thead>
                <tbody>
                  ${currentSectionOrders
                    .map((o) => {
                      const isNew = (o.status || '').toLowerCase().includes('preparación') || (o.status || '').toLowerCase().includes('confirmado');
                      const isShipping = (o.status || '').toLowerCase().includes('camino');
                      const isDelivered = (o.status || '').toLowerCase().includes('entregado');

                      return `
                    <tr>
                      <td>
                        <strong style="color: var(--olive); font-size: 14px;">${o.orderNumber}</strong><br>
                        <small style="color: var(--muted);">Aut: ${o.paymentDetails?.authorizationCode || 'Aprobado'}</small>
                      </td>
                      <td>${new Date(o.createdAt).toLocaleDateString('es-EC')}</td>
                      <td>
                        <strong>${o.customer.name}</strong><br>
                        <small style="color:var(--muted);">${o.customer.phone || o.customer.email}</small>
                        ${
                          o.customer.phone
                            ? `<br><a href="https://wa.me/${o.customer.phone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(o.customer.name)},%20te%20saludamos%20de%20LUMA%20Quito." target="_blank" style="font-size:11px; color:#15803d; text-decoration:underline;">💬 Notificar por WhatsApp</a>`
                            : ''
                        }
                      </td>
                      <td>
                        <strong>${o.customer.sector}</strong><br>
                        <small style="color:var(--muted);">${o.customer.address}</small>
                      </td>
                      <td><small>${(o.items || []).map((i) => `${i.qty}x ${i.name} (${i.size})`).join('<br>')}</small></td>
                      <td><strong style="font-size: 15px;">${formatMoney(o.total)}</strong></td>
                      <td>
                        <select class="form-control" style="padding: 6px 10px; font-size: 12px; font-weight:600; min-width: 150px;" onchange="updateOrderStatus('${o.id}', this.value)">
                          <option value="Confirmado - En preparación" ${isNew ? 'selected' : ''}>⏳ En preparación</option>
                          <option value="En camino con motorizado" ${isShipping ? 'selected' : ''}>🛵 En camino</option>
                          <option value="Entregado con éxito" ${isDelivered ? 'selected' : ''}>✅ Entregado</option>
                        </select>
                      </td>
                      <td>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                          ${
                            isNew
                              ? `<button class="btn btn-sm" style="background:#2563eb; color:#fff; font-size:11px; padding:5px 8px; border:none; border-radius:4px; cursor:pointer;" onclick="updateOrderStatus('${o.id}', 'En camino con motorizado')">🛵 Despachar ➔</button>`
                              : isShipping
                              ? `<button class="btn btn-sm" style="background:#16a34a; color:#fff; font-size:11px; padding:5px 8px; border:none; border-radius:4px; cursor:pointer;" onclick="updateOrderStatus('${o.id}', 'Entregado con éxito')">✅ Marcar Entregado</button>`
                              : `<span class="badge-mini" style="background:#dcfce7; color:#15803d; text-align:center; font-weight:700;">✓ Entregado</span>`
                          }
                          <button class="btn btn-outline btn-sm" style="font-size:11px; padding:4px 8px;" onclick='printReceiptClean(${JSON.stringify(o).replace(/'/g, "&apos;")})'>
                            Imprimir PDF 🖨
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </div>
      `
      }
    `;
    return;
  }
}

// Order Section Filter Switcher
window.filterOrdersSection = function (sectionKey) {
  state.currentOrderFilter = sectionKey;
  renderAdminSectionContent();
};

window.setOrdersViewMode = function (mode) {
  state.ordersViewMode = mode;
  renderAdminSectionContent();
};

window.searchOrdersAdmin = function (query) {
  state.orderSearchQuery = query;
  renderAdminSectionContent();
};

// Full Outfit Editor inside Admin View
window.openFullOutfitEditor = function (look) {
  const slot = document.querySelector('#outfitEditorSlot');
  if (!slot) return;

  const isEditing = !!look;
  const currentItems = look && Array.isArray(look.items) ? [...look.items] : [
    { name: 'Prenda principal', price: 30, material: '100% Algodón', type: 'top', sizes: ['S', 'M', 'L'] }
  ];

  slot.innerHTML = `
    <div class="admin-panel-card" style="border: 2px solid var(--olive); background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--line); padding-bottom: 14px;">
        <div>
          <span class="eyebrow" style="color: var(--olive);">${isEditing ? 'EDITAR OUTFIT' : 'NUEVO OUTFIT'}</span>
          <h3 style="font-family: var(--font-serif); font-size: 24px; margin: 4px 0 0;">
            ${isEditing ? `Modificar: ${look.name}` : 'Crear Nueva Propuesta de Estilo'}
          </h3>
        </div>
        <button class="btn btn-outline btn-sm" onclick="closeFullOutfitEditor()">Cancelar ✕</button>
      </div>

      <form id="fullOutfitForm">
        <div class="form-row">
          <div class="form-group">
            <label for="editOutfitName">Nombre del Outfit *</label>
            <input type="text" id="editOutfitName" class="form-control" value="${look?.name || ''}" required placeholder="Ej. Tarde en Guápulo">
          </div>
          <div class="form-group">
            <label for="editOutfitOccasion">Ocasión de Estilo *</label>
            <select id="editOutfitOccasion" class="form-control">
              <option value="Oficina" ${look?.occasion === 'Oficina' ? 'selected' : ''}>Oficina</option>
              <option value="Cotidiano" ${look?.occasion === 'Cotidiano' || !look ? 'selected' : ''}>Cotidiano</option>
              <option value="Salida" ${look?.occasion === 'Salida' ? 'selected' : ''}>Salida</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="editOutfitImage">Imagen Conceptual (Ruta o Subida) *</label>
            <input type="text" id="editOutfitImage" class="form-control" value="${look?.image || 'assets/editorial.png'}" required>
            
            <div class="upload-group">
              <label class="file-upload-label">
                📁 Subir foto desde mi equipo
                <input type="file" id="outfitFileInput" class="file-upload-input" accept="image/*" onchange="handleImageUpload(this, '#editOutfitImage', '#outfitPreviewImg')">
              </label>
            </div>
          </div>
          <div class="form-group">
            <label for="editOutfitNote">Frase corta descriptiva *</label>
            <input type="text" id="editOutfitNote" class="form-control" value="${look?.note || ''}" placeholder="Ej. Rayas, denim y un paseo sin reloj." required>
          </div>
        </div>

        <!-- Mini Preview of Outfit Image -->
        <div style="margin-bottom: 14px;">
          <img id="outfitPreviewImg" src="${look?.image || 'assets/editorial.png'}" style="height: 100px; width: 140px; object-fit: cover; border-radius: 4px; border: 1px solid var(--line);">
        </div>

        <div class="form-group">
          <label for="editOutfitWhy">Consejo de Estilo & Clima</label>
          <textarea id="editOutfitWhy" class="form-control" rows="2" placeholder="Por qué funciona esta combinación en Quito...">${look?.why || ''}</textarea>
        </div>

        <!-- Items/Pieces Manager with working Delete and Add buttons -->
        <div class="admin-items-editor">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong style="font-size: 14px;">Prendas que componen este Outfit</strong>
            <button type="button" class="btn btn-outline btn-sm" onclick="addPieceRowFull()">+ Agregar Otra Prenda</button>
          </div>

          <div class="admin-piece-headers">
            <span>Nombre de prenda</span>
            <span>Precio ($)</span>
            <span>Material / Composición</span>
            <span>Categoría</span>
            <span></span>
          </div>

          <div id="fullPieceRowsContainer">
            ${currentItems
              .map(
                (item, idx) => `
              <div class="admin-piece-input-row" data-idx="${idx}">
                <input type="text" class="form-control p-name" value="${item.name || ''}" placeholder="Ej. Camisa blanca" required>
                <input type="number" step="1" class="form-control p-price" value="${item.price || 20}" required>
                <input type="text" class="form-control p-mat" value="${item.material || ''}" placeholder="100% Algodón">
                <select class="form-control p-type">
                  <option value="top" ${item.type === 'top' ? 'selected' : ''}>Top / Camisa</option>
                  <option value="bottom" ${item.type === 'bottom' ? 'selected' : ''}>Pantalón / Falda</option>
                  <option value="layer" ${item.type === 'layer' ? 'selected' : ''}>Blazer / Abrigo</option>
                  <option value="dress" ${item.type === 'dress' ? 'selected' : ''}>Vestido</option>
                  <option value="accessory" ${item.type === 'accessory' ? 'selected' : ''}>Accesorio / Bolso</option>
                </select>
                <button type="button" class="remove-piece-btn" title="Eliminar esta prenda" aria-label="Eliminar esta prenda" onclick="removePieceRow(this)">✕</button>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div style="display: flex; gap: 12px; margin-top: 20px;">
          <button type="button" class="btn btn-outline" onclick="closeFullOutfitEditor()">Cancelar</button>
          <button type="submit" class="btn btn-primary" style="flex: 1;">Guardar Outfit 💾</button>
        </div>
      </form>
    </div>
  `;

  // Delegate click for guaranteed removal on all mobile & desktop browsers
  const rowsContainer = slot.querySelector('#fullPieceRowsContainer');
  if (rowsContainer) {
    rowsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.remove-piece-btn');
      if (btn) {
        e.preventDefault();
        window.removePieceRow(btn);
      }
    });
  }

  slot.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const form = slot.querySelector('#fullOutfitForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = slot.querySelector('#editOutfitName').value.trim();
    const occasion = slot.querySelector('#editOutfitOccasion').value;
    const image = slot.querySelector('#editOutfitImage').value.trim();
    const note = slot.querySelector('#editOutfitNote').value.trim();
    const why = slot.querySelector('#editOutfitWhy').value.trim();

    // Extract pieces
    const rows = slot.querySelectorAll('.admin-piece-input-row');
    const items = [];
    rows.forEach((row) => {
      const pName = row.querySelector('.p-name').value.trim();
      const pPrice = Number(row.querySelector('.p-price').value);
      const pMat = row.querySelector('.p-mat').value.trim();
      const pType = row.querySelector('.p-type').value;

      if (pName) {
        items.push({
          name: pName,
          price: pPrice,
          material: pMat,
          type: pType,
          sizes: pType === 'accessory' ? ['Única'] : ['S', 'M', 'L', 'XL']
        });
      }
    });

    if (!items.length) {
      showToast('Por favor agrega al menos una prenda al outfit.');
      return;
    }

    try {
      if (isEditing) {
        await apiCall(`/api/admin/looks/${look.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, occasion, image, note, why, items })
        });
        showToast('Outfit actualizado exitosamente.', 'admin');
      } else {
        await apiCall('/api/admin/looks', {
          method: 'POST',
          body: JSON.stringify({ name, occasion, image, note, why, items })
        });
        showToast('¡Nuevo outfit creado!', 'admin');
      }

      await loadCatalog();
      closeFullOutfitEditor();
      renderAdminSectionContent();
    } catch (err) {
      showToast(err.message);
    }
  });
};

window.closeFullOutfitEditor = function () {
  const slot = document.querySelector('#outfitEditorSlot');
  if (slot) slot.innerHTML = '';
};

window.addPieceRowFull = function () {
  const container = document.querySelector('#fullPieceRowsContainer');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'admin-piece-input-row';
  div.innerHTML = `
    <input type="text" class="form-control p-name" placeholder="Nueva prenda" required>
    <input type="number" step="1" class="form-control p-price" value="25" required>
    <input type="text" class="form-control p-mat" placeholder="Material">
    <select class="form-control p-type">
      <option value="top">Top / Camisa</option>
      <option value="bottom">Pantalón / Falda</option>
      <option value="layer">Blazer / Abrigo</option>
      <option value="dress">Vestido</option>
      <option value="accessory">Accesorio / Bolso</option>
    </select>
    <button type="button" class="remove-piece-btn" title="Eliminar esta prenda" aria-label="Eliminar esta prenda" onclick="removePieceRow(this)">✕</button>
  `;
  container.appendChild(div);
};

window.deleteOutfit = async function (id) {
  if (!confirm('¿Estás seguro de que deseas eliminar este outfit del catálogo?')) return;
  try {
    await apiCall(`/api/admin/looks/${id}`, { method: 'DELETE' });
    showToast('Outfit eliminado del catálogo.', 'admin');
    await loadCatalog();
    renderAdminSectionContent();
  } catch (err) {
    showToast(err.message);
  }
};

window.setCoverColor = function (inputId, codeId, previewTarget, previewProp, color) {
  const input = document.querySelector(inputId);
  const code = document.querySelector(codeId);
  const target = document.querySelector(previewTarget);
  if (input) input.value = color;
  if (code) code.textContent = color;
  if (target) target.style[previewProp] = color;
};

window.saveCoverSettingsFull = async function () {
  const announcement = {
    city: document.querySelector('#fullAnnCity').value,
    tag: document.querySelector('#fullAnnTag').value,
    text: document.querySelector('#fullAnnText').value
  };

  const hero = {
    eyebrow: document.querySelector('#fullHeroEyebrow').value,
    eyebrowColor: document.querySelector('#fullHeroEyebrowColor')?.value || '#495342',
    image: document.querySelector('#fullHeroImage').value,
    title: document.querySelector('#fullHeroTitle').value,
    subtitle: document.querySelector('#fullHeroSubtitle').value,
    cardTitle: document.querySelector('#fullHeroCardTitle').value,
    cardSubtitle: document.querySelector('#fullHeroCardSubtitle').value,
    titleColor: document.querySelector('#fullHeroTitleColor').value,
    subtitleColor: document.querySelector('#fullHeroSubtitleColor').value,
    titleFont: document.querySelector('#fullHeroTitleFont').value,
    subtitleFont: document.querySelector('#fullHeroSubFont')?.value || "'DM Sans', sans-serif",
    titleSize: document.querySelector('#fullHeroTitleSize')?.value || '44px'
  };

  try {
    await apiCall('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify({ announcement, hero })
    });
    state.config.announcement = announcement;
    state.config.hero = hero;
    applyDynamicSettings();
    showToast('¡Portadas, tipografía y temporadas actualizadas correctamente!', 'admin');
  } catch (err) {
    showToast(err.message);
  }
};

window.saveShippingRatesFull = async function () {
  const shippingRates = {
    'Quito urbano': Number(document.querySelector('#rateQuitoFull').value),
    'Cumbayá / Tumbaco': Number(document.querySelector('#rateCumbayaFull').value),
    'Los Chillos': Number(document.querySelector('#rateChillosFull').value),
    'Nacional (Ecuador)': Number(document.querySelector('#rateNacionalFull').value)
  };
  const freeShippingThreshold = Number(document.querySelector('#rateFreeThresholdFull').value);

  try {
    await apiCall('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify({ shippingRates, freeShippingThreshold })
    });
    state.config.shippingRates = shippingRates;
    state.config.freeShippingThreshold = freeShippingThreshold;
    showToast('¡Tarifas de envío actualizadas exitosamente!', 'admin');
  } catch (err) {
    showToast(err.message);
  }
};

window.updateOrderStatus = async function (orderId, newStatus) {
  try {
    await apiCall(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });

    // Update in local cache
    const order = state.adminOrdersCache.find((o) => o.id === orderId);
    if (order) order.status = newStatus;

    showToast(`Estado actualizado: ${newStatus}`, 'admin');
    renderAdminSectionContent();
  } catch (err) {
    showToast(err.message);
  }
};

if (openAdminBtn) {
  openAdminBtn.addEventListener('click', () => openAdminDashboard('catalog'));
}

if (adminNavBtn) {
  adminNavBtn.addEventListener('click', () => openAdminDashboard('catalog'));
}

// ==========================================
// LUMA ESTUDIO (AI STYLIST)
// ==========================================
const stylistForm = document.querySelector('#stylistForm');
const budgetRange = document.querySelector('#budgetRange');
const budgetLabel = document.querySelector('#budgetLabel');
const studioResults = document.querySelector('#studioResults');

if (budgetRange && budgetLabel) {
  budgetRange.addEventListener('input', (e) => {
    budgetLabel.textContent = formatMoney(Number(e.target.value));
  });
}

if (stylistForm) {
  let studioIteration = 0;
  stylistForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const occasion = document.querySelector('#occasionSelect').value;
    const budget = Number(budgetRange.value);
    const climate = document.querySelector('#climateSelect').value;
    const mood = document.querySelector('#moodSelect').value;
    const owned = document.querySelector('#ownedPieceSelect').value;

    const matchingLooks = state.catalog.filter((l) => l.occasion === occasion);
    if (!matchingLooks.length) return;

    const selectedLook = matchingLooks[studioIteration++ % matchingLooks.length];
    const missingItems = (selectedLook.items || []).filter((item) => item.type !== owned);
    const missingPrice = missingItems.reduce((s, i) => s + (Number(i.price) || 0), 0);

    const weatherAdvice = {
      quito: 'Para Quito: Lleva la prenda exterior abierta por la mañana y lista para abrigarte si corre viento o cae lluvia vespertina.',
      valle: 'Para Valles (Cumbayá/Tumbaco): Las fibras naturales permiten frescura al mediodía; el cárdigan/blazer se guarda en el bolso hasta el regreso.',
      costa: 'Para Costa: Tejidos holgados y fluidos de alta transpirabilidad sin sobrecapas pesadas.'
    }[climate];

    const aiPrompt = `Fotografía editorial de moda de cuerpo completo, estética urbana madrileña adaptada al clima de Quito (${climate}). Ocasión: ${occasion}. Preferencia visual: ${mood}. Prendas protagonistas: ${(selectedLook.items || []).map((i) => i.name).join(', ')}. Iluminación natural de la sierra, texturas realistas de lino y algodón, fondo arquitectónico minimalista contemporáneo. Sin tipografías ni marcas.`;

    studioResults.innerHTML = `
      <div class="result-card">
        <span class="eyebrow">PROPUESTA LUMA ESTUDIO ✧</span>
        <h3 style="font-family: var(--font-serif); font-size: 24px; margin: 8px 0;">${selectedLook.name}</h3>
        <img class="result-thumb ${selectedLook.image ? 'portrait' : ''}" src="${selectedLook.image || 'assets/editorial.png'}" alt="${selectedLook.name}">
        
        <p style="font-size: 14px; margin-bottom: 10px;">
          <strong>Prendas recomendadas para comprar:</strong><br>
          ${missingItems.map((i) => `✦ ${i.name} (${formatMoney(i.price)})`).join('<br>')}
        </p>

        <p style="font-size: 13px; color: var(--muted); margin-bottom: 10px;">
          <strong>Inversión estimada:</strong> ${formatMoney(missingPrice)} 
          ${missingPrice <= budget ? '<span style="color: var(--success); font-weight:600;">(Dentro de tu presupuesto)</span>' : '<span style="color:#c53030;">(Ligeramente sobre presupuesto)</span>'}
        </p>

        <div style="background: var(--cream); padding: 12px; border-radius: 4px; font-size: 12px; line-height: 1.6; margin-bottom: 14px;">
          <strong>Consejo para el clima:</strong> ${weatherAdvice}
        </div>

        <details style="margin-bottom: 16px;">
          <summary style="font-size: 12px; font-weight: 600; cursor: pointer; color: var(--olive);">
            Ver instrucción de Imagen para IA Generativa
          </summary>
          <div class="prompt-box" id="aiPromptText">${aiPrompt}</div>
          <button type="button" class="btn btn-outline btn-sm" id="copyPromptBtn">Copiar Prompt para IA 📋</button>
        </details>

        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn btn-primary btn-sm" style="flex: 1;" onclick="openLookDetail(${selectedLook.id})">
            Ver Piezas y Comprar
          </button>
        </div>
      </div>
    `;

    // Copy Prompt functionality
    const copyBtn = studioResults.querySelector('#copyPromptBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(aiPrompt);
          showToast('Prompt editorial copiado al portapapeles.');
        } catch {
          showToast('Selecciona y copia el texto del cuadro.');
        }
      });
    }

    studioResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  syncCart();
  checkAuth();
  loadConfig();
  loadCatalog();
});
