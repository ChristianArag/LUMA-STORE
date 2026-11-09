import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { db, verifyPassword, generateToken, verifyToken } from './db.js';
import { createPayphoneTransaction, confirmPayphoneTransaction, calculateTaxes } from './payphone.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());
// Set 25MB limit to support image uploads as base64
app.use(express.json({ limit: '25mb' }));

// Serve static frontend files from 'dist' directory
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Auth Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Se requiere iniciar sesión.' });
  }
  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sesión expirada o token inválido.' });
  }
  req.user = db.getUserById(payload.id);
  if (!req.user) {
    return res.status(401).json({ error: 'Usuario no encontrado.' });
  }
  next();
}

// Admin Middleware
function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    }
  });
}

function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (payload) {
      req.user = db.getUserById(payload.id);
    }
  }
  next();
}

// ==========================================
// API ROUTES
// ==========================================

// Config & Info (Returns live covers, announcement, shipping rates and payphone status)
app.get('/api/config', (req, res) => {
  const settings = db.getSettings();
  res.json({
    brand: 'LUMA Quito · Madrid',
    currency: 'USD',
    ivaRate: 0.15,
    payphoneMode: process.env.PAYPHONE_TOKEN ? 'live' : 'sandbox',
    ...settings
  });
});

// AUTH: Register
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, phone, password, address, sector, city } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const newUser = db.createUser({ name, email, phone, password, address, sector, city });
    const token = generateToken({ id: newUser.id, email: newUser.email, role: newUser.role });

    res.status(201).json({
      message: 'Cuenta creada exitosamente',
      user: newUser,
      token
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// AUTH: Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña requeridos.' });
    }

    const user = db.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Credenciales inválidas. Revisa correo y contraseña.' });
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    const { passwordHash, ...safeUser } = user;

    res.json({
      message: 'Bienvenida a LUMA',
      user: safeUser,
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AUTH: Get current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const { passwordHash, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// AUTH: Update Profile
app.put('/api/auth/profile', authMiddleware, (req, res) => {
  try {
    const updated = db.updateUserProfile(req.user.id, req.body);
    res.json({ message: 'Perfil actualizado con éxito', user: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// CATALOG
app.get('/api/catalog', (req, res) => {
  res.json({ catalog: db.getCatalog() });
});

app.get('/api/catalog/:id', (req, res) => {
  const look = db.getLookById(req.params.id);
  if (!look) return res.status(404).json({ error: 'Look no encontrado' });
  res.json({ look });
});

// PAYPHONE: Prepare / Process transaction
app.post('/api/payphone/create-transaction', optionalAuthMiddleware, async (req, res) => {
  try {
    const { amount, email, phone, cardData, clientTransactionId } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Monto de transacción inválido' });
    }

    const customerEmail = email || req.user?.email || 'cliente@luma.ec';
    const customerPhone = phone || req.user?.phone || '0998765432';

    const result = await createPayphoneTransaction({
      amount: Number(amount),
      clientTransactionId,
      email: customerEmail,
      phone: customerPhone,
      cardData
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PAYPHONE: Confirm
app.post('/api/payphone/confirm', async (req, res) => {
  try {
    const { id, clientTxId } = req.body;
    const result = await confirmPayphoneTransaction({ id, clientTxId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ORDERS: Create order after payment
app.post('/api/orders', optionalAuthMiddleware, (req, res) => {
  try {
    const {
      items,
      subtotal,
      shipping,
      tax,
      total,
      name,
      email,
      phone,
      address,
      sector,
      city,
      notes,
      paymentMethod,
      paymentDetails
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'No hay productos en el pedido' });
    }
    if (!name || !email || !address) {
      return res.status(400).json({ error: 'Nombre, email y dirección de entrega son requeridos' });
    }

    const order = db.createOrder({
      userId: req.user ? req.user.id : null,
      name,
      email,
      phone: phone || '',
      address,
      sector: sector || 'Quito urbano',
      city: city || 'Quito',
      notes: notes || '',
      items,
      subtotal: Number(subtotal),
      shipping: Number(shipping || 0),
      tax: Number(tax || 0),
      total: Number(total),
      paymentMethod: paymentMethod || 'Payphone Ecuador',
      paymentDetails: paymentDetails || {},
      status: 'Confirmado - En preparación'
    });

    res.status(201).json({
      message: '¡Pedido registrado con éxito!',
      order
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ORDERS: List orders for current user
app.get('/api/orders', authMiddleware, (req, res) => {
  const orders = db.getOrdersByUser(req.user.id);
  res.json({ orders });
});

// ORDERS: Single order lookup
app.get('/api/orders/:id', (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Pedido no encontrado' });
  }
  res.json({ order });
});

// ==========================================
// ADMIN MANAGEMENT ROUTES
// ==========================================

// ADMIN: Upload Image File (supports local file uploads from computer)
app.post('/api/admin/upload', adminMiddleware, (req, res) => {
  try {
    const { filename, base64Data } = req.body;
    if (!filename || !base64Data) {
      return res.status(400).json({ error: 'Faltan datos de la imagen.' });
    }

    const uploadsDir = path.join(distPath, 'assets', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(filename) || '.png';
    const cleanName = 'up_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + ext;
    const filePath = path.join(uploadsDir, cleanName);

    const dataString = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(dataString, 'base64');
    fs.writeFileSync(filePath, buffer);

    res.json({
      url: `assets/uploads/${cleanName}`,
      message: 'Imagen subida exitosamente'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: Update store configuration (hero, covers, announcement, shipping rates)
app.put('/api/admin/config', adminMiddleware, (req, res) => {
  try {
    const updatedSettings = db.updateSettings(req.body);
    res.json({
      message: 'Configuración de tienda y portadas actualizada exitosamente.',
      settings: updatedSettings
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: Add new look / outfit
app.post('/api/admin/looks', adminMiddleware, (req, res) => {
  try {
    const newLook = db.addLook(req.body);
    res.status(201).json({
      message: 'Outfit creado exitosamente.',
      look: newLook
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: Update look / outfit
app.put('/api/admin/looks/:id', adminMiddleware, (req, res) => {
  try {
    const updated = db.updateLook(req.params.id, req.body);
    res.json({
      message: 'Outfit actualizado exitosamente.',
      look: updated
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: Delete look / outfit
app.delete('/api/admin/looks/:id', adminMiddleware, (req, res) => {
  try {
    db.deleteLook(req.params.id);
    res.json({ message: 'Outfit eliminado del catálogo.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: Get all orders
app.get('/api/admin/orders', adminMiddleware, (req, res) => {
  res.json({ orders: db.getAllOrders() });
});

// ADMIN: Update order status
app.patch('/api/admin/orders/:id/status', adminMiddleware, (req, res) => {
  try {
    const { status } = req.body;
    const updated = db.updateOrderStatus(req.params.id, status);
    res.json({ message: 'Estado actualizado', order: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fallback to index.html for SPA-like navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`LUMA Store server running on port http://localhost:${PORT}`);
});
