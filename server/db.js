import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Utility for secure password hashing with salt
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, combined) {
  if (!combined || !combined.includes(':')) return false;
  const [salt, originalHash] = combined.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

export function generateToken(payload) {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }); // 7 days
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'luma_secret_key_quito_2026')
    .update(data)
    .digest('hex');
  return Buffer.from(data).toString('base64url') + '.' + signature;
}

export function verifyToken(token) {
  try {
    if (!token || !token.includes('.')) return null;
    const [encodedData, signature] = token.split('.');
    const data = Buffer.from(encodedData, 'base64url').toString('utf8');
    const expectedSig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'luma_secret_key_quito_2026')
      .update(data)
      .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return null;
    }
    const parsed = JSON.parse(data);
    if (parsed.exp && parsed.exp < Date.now()) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

// Initial default settings for seasonal covers, announcement, and shipping
const defaultSettings = {
  announcement: {
    city: 'QUITO · MADRID',
    text: '✧ Nueva Cápsula Disponible · Envíos a todo Quito y Valles · Pagos 100% seguros con Payphone',
    tag: 'ENVÍOS GRATIS DESDE $90'
  },
  hero: {
    eyebrow: 'NUEVA CÁPSULA / MADRID → QUITO',
    title: 'Menos dudas.<br>Más <em>tú.</em>',
    subtitle: 'Inspiración madrileña, ritmo quiteño. Prendas esenciales y capas inteligentes pensadas para vestir con calma y combinar con lo que ya tienes.',
    image: 'assets/editorial.png',
    cardTitle: 'El arte de combinar lo simple',
    cardSubtitle: 'Piezas modulares adaptables a los microclimas de Quito'
  },
  shippingRates: {
    'Quito urbano': 3.50,
    'Cumbayá / Tumbaco': 4.50,
    'Los Chillos': 5.00,
    'Nacional (Ecuador)': 6.50
  },
  freeShippingThreshold: 90
};

// Initial default catalog
const defaultCatalog = [
  {
    id: 0,
    name: 'Oficina, a tu manera',
    occasion: 'Oficina',
    pos: '0%',
    image: 'assets/editorial.png',
    note: 'Líneas limpias. Una base que siempre suma.',
    items: [
      { id: 'item-0-1', name: 'Camisa fluida marfil', price: 28, material: '70% viscosa, 30% lino', type: 'top', sizes: ['S', 'M', 'L'] },
      { id: 'item-0-2', name: 'Pantalón recto negro', price: 36, material: '95% poliéster, 5% elastano', type: 'bottom', sizes: ['S', 'M', 'L', 'XL'] },
      { id: 'item-0-3', name: 'Bolso estructurado', price: 24, material: 'Exterior poliuretano, forro algodón', type: 'accessory', sizes: ['Única'] }
    ],
    why: 'El contraste marfil y negro crea una base versátil para el día a día corporativo en Quito.'
  },
  {
    id: 1,
    name: 'De aquí para allá',
    occasion: 'Cotidiano',
    pos: '50%',
    image: 'assets/editorial.png',
    note: 'Capas ligeras para un día con mil planes.',
    items: [
      { id: 'item-1-1', name: 'Blazer arena', price: 42, material: '80% poliéster, 20% viscosa', type: 'layer', sizes: ['S', 'M', 'L'] },
      { id: 'item-1-2', name: 'Camiseta blanca', price: 16, material: '100% algodón peinado', type: 'top', sizes: ['S', 'M', 'L', 'XL'] },
      { id: 'item-1-3', name: 'Pantalón sastre arena', price: 34, material: '80% poliéster, 20% viscosa', type: 'bottom', sizes: ['S', 'M', 'L'] }
    ],
    why: 'Una capa estructurada y una camiseta relajada equilibran el conjunto para mañanas frescas y tardes soleadas.'
  },
  {
    id: 2,
    name: 'Un plan para ti',
    occasion: 'Salida',
    pos: '100%',
    image: 'assets/editorial.png',
    note: 'Texturas cálidas. Una elegancia sin esfuerzo.',
    items: [
      { id: 'item-2-1', name: 'Top de punto cacao', price: 26, material: '60% algodón, 40% acrílico', type: 'top', sizes: ['S', 'M', 'L'] },
      { id: 'item-2-2', name: 'Falda midi negra', price: 32, material: '95% poliéster, 5% elastano', type: 'bottom', sizes: ['S', 'M', 'L'] },
      { id: 'item-2-3', name: 'Bolso pequeño de hombro', price: 22, material: 'Exterior de poliuretano suave', type: 'accessory', sizes: ['Única'] }
    ],
    why: 'El cacao aporta calidez a la base negra. Combina con calzado cómodo o mocasines para un look nocturno en La Floresta.'
  },
  {
    id: 3,
    name: 'Malasaña, sin prisa',
    occasion: 'Cotidiano',
    pos: '50%',
    image: 'assets/malasana.png',
    note: 'Rayas, denim y un paseo sin reloj.',
    items: [
      { id: 'item-3-1', name: 'Camisa de rayas azul', price: 30, material: '100% algodón popelín', type: 'top', sizes: ['S', 'M', 'L', 'XL'] },
      { id: 'item-3-2', name: 'Jean recto azul medio', price: 38, material: '99% algodón, 1% elastano', type: 'bottom', sizes: ['S', 'M', 'L', 'XL'] },
      { id: 'item-3-3', name: 'Bandolera coñac', price: 25, material: 'Poliuretano acabado cuero', type: 'accessory', sizes: ['Única'] }
    ],
    why: 'Inspiración urbana madrileña: camisa relajada, denim recto y calzado plano. Perfecta para caminar por el centro norte de Quito.'
  },
  {
    id: 4,
    name: 'Una tarde en Las Letras',
    occasion: 'Salida',
    pos: '50%',
    image: 'assets/letras.png',
    note: 'Un vestido sencillo. Un acento burdeos.',
    items: [
      { id: 'item-4-1', name: 'Vestido midi negro', price: 44, material: '95% algodón rib, 5% elastano', type: 'dress', sizes: ['S', 'M', 'L'] },
      { id: 'item-4-2', name: 'Cárdigan ligero marfil', price: 29, material: '100% algodón suave', type: 'layer', sizes: ['S', 'M', 'L'] },
      { id: 'item-4-3', name: 'Bolso burdeos estructurado', price: 24, material: 'Poliuretano grabado premium', type: 'accessory', sizes: ['Única'] }
    ],
    why: 'El vestido negro y el bolso burdeos dan carácter inmediato. El cárdigan protege al caer la noche en la sierra.'
  },
  {
    id: 5,
    name: 'Chamberí en capas',
    occasion: 'Oficina',
    pos: '50%',
    image: 'assets/chamberi.png',
    note: 'Sastrería relajada para tu agenda real.',
    items: [
      { id: 'item-5-1', name: 'Blazer ligero azul marino', price: 45, material: '55% lino, 45% viscosa', type: 'layer', sizes: ['S', 'M', 'L'] },
      { id: 'item-5-2', name: 'Camiseta blanca esencial', price: 16, material: '100% algodón pima', type: 'top', sizes: ['S', 'M', 'L', 'XL'] },
      { id: 'item-5-3', name: 'Pantalón recto crudo', price: 35, material: '98% algodón, 2% elastano', type: 'bottom', sizes: ['S', 'M', 'L', 'XL'] },
      { id: 'item-5-4', name: 'Bolso compacto caramelo', price: 26, material: 'Poliuretano texturizado', type: 'accessory', sizes: ['Única'] }
    ],
    why: 'Sastrería sin rigidez: blazer ligero que acompaña mañanas frescas y se retira al mediodía.'
  }
];

class Database {
  constructor() {
    this.data = {
      users: [],
      orders: [],
      catalog: defaultCatalog,
      settings: defaultSettings
    };
    this.load();
    this.seedDefaultUsers();
  }

  load() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {
          users: parsed.users || [],
          orders: parsed.orders || [],
          catalog: parsed.catalog && parsed.catalog.length ? parsed.catalog : defaultCatalog,
          settings: parsed.settings ? { ...defaultSettings, ...parsed.settings } : defaultSettings
        };
      } catch (err) {
        console.error('Error loading DB, initializing new:', err);
        this.save();
      }
    } else {
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving DB:', err);
    }
  }

  seedDefaultUsers() {
    // Admin user
    if (!this.data.users.find(u => u.email === 'admin@luma.ec')) {
      this.data.users.push({
        id: 'usr-admin-1',
        name: 'Administración LUMA',
        email: 'admin@luma.ec',
        phone: '+593 99 123 4567',
        passwordHash: hashPassword('luma2026'),
        role: 'admin',
        createdAt: new Date().toISOString()
      });
    }

    // Demo customer
    if (!this.data.users.find(u => u.email === 'sofia@luma.ec')) {
      this.data.users.push({
        id: 'usr-demo-1',
        name: 'Sofía Montalvo',
        email: 'sofia@luma.ec',
        phone: '0998765432',
        passwordHash: hashPassword('sofia123'),
        role: 'customer',
        address: 'González Suárez y San Ignacio, Edificio Panorama Apt 4B',
        city: 'Quito',
        sector: 'Quito urbano',
        createdAt: new Date().toISOString()
      });
    }
    this.save();
  }

  // User methods
  getUserByEmail(email) {
    if (!email) return null;
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  createUser({ name, email, phone, password, address = '', sector = 'Quito urbano', city = 'Quito' }) {
    if (this.getUserByEmail(email)) {
      throw new Error('El correo electrónico ya está registrado.');
    }
    const newUser = {
      id: 'usr-' + crypto.randomUUID().slice(0, 8),
      name,
      email: email.toLowerCase(),
      phone: phone || '',
      passwordHash: hashPassword(password),
      role: 'customer',
      address,
      sector,
      city,
      createdAt: new Date().toISOString()
    };
    this.data.users.push(newUser);
    this.save();
    const { passwordHash, ...safeUser } = newUser;
    return safeUser;
  }

  updateUserProfile(id, updates) {
    const user = this.getUserById(id);
    if (!user) throw new Error('Usuario no encontrado.');
    if (updates.name) user.name = updates.name;
    if (updates.phone) user.phone = updates.phone;
    if (updates.address !== undefined) user.address = updates.address;
    if (updates.sector) user.sector = updates.sector;
    if (updates.city) user.city = updates.city;
    if (updates.password) user.passwordHash = hashPassword(updates.password);
    this.save();
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // Settings (Covers, Hero, Seasonal text, Shipping costs)
  getSettings() {
    return this.data.settings || defaultSettings;
  }

  updateSettings(updates) {
    this.data.settings = {
      ...this.data.settings,
      ...updates,
      announcement: {
        ...(this.data.settings?.announcement || defaultSettings.announcement),
        ...(updates.announcement || {})
      },
      hero: {
        ...(this.data.settings?.hero || defaultSettings.hero),
        ...(updates.hero || {})
      },
      shippingRates: {
        ...(this.data.settings?.shippingRates || defaultSettings.shippingRates),
        ...(updates.shippingRates || {})
      }
    };
    this.save();
    return this.data.settings;
  }

  // Catalog CRUD
  getCatalog() {
    return this.data.catalog;
  }

  getLookById(id) {
    return this.data.catalog.find(l => l.id === Number(id));
  }

  addLook(lookData) {
    const nextId = this.data.catalog.length > 0 
      ? Math.max(...this.data.catalog.map(l => Number(l.id) || 0)) + 1 
      : 0;

    const newLook = {
      id: nextId,
      name: lookData.name || 'Nuevo Look',
      occasion: lookData.occasion || 'Cotidiano',
      pos: lookData.pos || '50%',
      image: lookData.image || 'assets/editorial.png',
      note: lookData.note || 'Descripción breve del look.',
      items: Array.isArray(lookData.items) ? lookData.items.map((item, idx) => ({
        id: item.id || `item-${nextId}-${idx + 1}`,
        name: item.name || 'Prenda esencial',
        price: Number(item.price) || 20,
        material: item.material || 'Algodón premium',
        type: item.type || 'top',
        sizes: item.sizes && item.sizes.length ? item.sizes : ['S', 'M', 'L']
      })) : [],
      why: lookData.why || 'Combinación versátil para el día a día.'
    };

    this.data.catalog.unshift(newLook);
    this.save();
    return newLook;
  }

  updateLook(id, updates) {
    const numId = Number(id);
    const index = this.data.catalog.findIndex(l => l.id === numId || String(l.id) === String(id));
    if (index === -1) throw new Error('Look no encontrado.');

    const existing = this.data.catalog[index];
    this.data.catalog[index] = {
      ...existing,
      ...updates,
      id: existing.id,
      items: Array.isArray(updates.items) ? updates.items.map((item, idx) => ({
        id: item.id || `item-${existing.id}-${idx + 1}`,
        name: item.name,
        price: Number(item.price) || 0,
        material: item.material || '',
        type: item.type || 'top',
        sizes: item.sizes || ['S', 'M', 'L']
      })) : existing.items
    };
    this.save();
    return this.data.catalog[index];
  }

  deleteLook(id) {
    const numId = Number(id);
    const prevLen = this.data.catalog.length;
    this.data.catalog = this.data.catalog.filter(l => l.id !== numId && String(l.id) !== String(id));
    if (this.data.catalog.length === prevLen) {
      throw new Error('Look no encontrado para eliminar.');
    }
    this.save();
    return true;
  }

  // Orders
  createOrder(orderData) {
    const orderNumber = 'LUMA-' + Math.floor(100000 + Math.random() * 900000);
    const newOrder = {
      id: 'ord-' + crypto.randomUUID().slice(0, 8),
      orderNumber,
      createdAt: new Date().toISOString(),
      status: orderData.status || 'Pagado con Payphone',
      paymentMethod: orderData.paymentMethod || 'Payphone',
      paymentDetails: orderData.paymentDetails || {},
      customer: {
        userId: orderData.userId || null,
        name: orderData.name,
        email: orderData.email,
        phone: orderData.phone,
        address: orderData.address,
        sector: orderData.sector || 'Quito urbano',
        city: orderData.city || 'Quito',
        notes: orderData.notes || ''
      },
      items: orderData.items,
      subtotal: orderData.subtotal,
      shipping: orderData.shipping || 0,
      tax: orderData.tax || 0,
      total: orderData.total
    };
    this.data.orders.unshift(newOrder);
    this.save();
    return newOrder;
  }

  getOrdersByUser(userId) {
    return this.data.orders.filter(o => o.customer.userId === userId);
  }

  getOrderById(idOrNumber) {
    return this.data.orders.find(o => o.id === idOrNumber || o.orderNumber === idOrNumber);
  }

  getAllOrders() {
    return this.data.orders;
  }

  updateOrderStatus(id, status) {
    const order = this.data.orders.find(o => o.id === id || o.orderNumber === id);
    if (!order) throw new Error('Pedido no encontrado');
    order.status = status;
    order.updatedAt = new Date().toISOString();
    this.save();
    return order;
  }
}

export const db = new Database();
