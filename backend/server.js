const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// Load environment configuration from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

// Ensure critical environment variables have safe production fallbacks
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'stockflow_production_jwt_secret_token_key_2026_xyz';
}

const app = express();

// Security & Parsing Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline assets in local development
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Audit Logging Middleware
const auditLogger = require('./middleware/auditLogger');
app.use(auditLogger);

// Global Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500
});
app.use('/api', limiter);

// Static Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure Database is connected on serverless API requests
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && req.path !== '/api/health') {
    try {
      await connectDB();
    } catch (err) {
      console.error("Database connection middleware notice:", err.message);
    }
  }
  next();
});

// ----------------------------------------------------
// Health & System Diagnostic Endpoints
// ----------------------------------------------------

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'StockFlow API running', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/system/status', (req, res) => {
  const mongoose = require('mongoose');
  res.status(200).json({
    success: true,
    data: {
      dbConnection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      aiConfigured: !!(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY),
      aiProvider: process.env.AI_PROVIDER || 'gemini',
      mlServiceConfigured: !!process.env.PYTHON_ML_URL
    }
  });
});

// ----------------------------------------------------
// Modular API Route Mounting
// ----------------------------------------------------
const createCrudRouter = require('./utils/crudRouter');

// 1. Authentication & Users
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', createCrudRouter(require('./models/User')));

// 2. Inventory & Catalog
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/categories', createCrudRouter(require('./models/Category')));
app.use('/api/warehouses', createCrudRouter(require('./models/Warehouse')));

// 3. Sales, Orders & Billing
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/returns', require('./routes/returnRoutes'));

// 4. Vendors & Customers
app.use('/api/suppliers', createCrudRouter(require('./models/Supplier')));
app.use('/api/customers', createCrudRouter(require('./models/Customer')));
app.use('/api/stores', createCrudRouter(require('./models/Store')));

// 5. Finance, Reporting & Operations
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/finance', require('./routes/financeRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/expenses', createCrudRouter(require('./models/Expense')));
app.use('/api/activity', require('./routes/activityRoutes'));
app.use('/api/suggestions', require('./routes/suggestionRoutes'));

// 6. AI, Machine Learning & OCR Intelligence
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/intelligence', require('./routes/intelligenceRoutes'));
app.use('/api/ocr', require('./routes/ocrRoutes'));

// 7. Manufacturing, Assets & Multi-Location Transfers
app.use('/api/bom', require('./routes/bomRoutes'));
app.use('/api/work-orders', require('./routes/workOrderRoutes'));
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/stock-transfers', require('./routes/stockTransferRoutes'));

// ----------------------------------------------------
// Static Assets & Single Localhost Frontend
// ----------------------------------------------------
app.use('/images', express.static(path.join(__dirname, '../frontend/public/images')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || (process.env.VERCEL || process.env.NETLIFY)) {
    return res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    
    // Non-destructive data check & realistic INR alignment
    console.log('🌱 Verifying persistent database data and realistic INR pricing...');
    const seedData = require('./seed');
    await seedData();
    console.log('✅ Enterprise persistent database ready.');
  } catch (err) {
    console.error("Database startup notice:", err.message);
  }

  if (process.env.NODE_ENV !== 'test' && !(process.env.VERCEL || process.env.NETLIFY)) {
    app.listen(PORT, () => {
      console.log(`StockFlow Server running in ${process.env.NODE_ENV || 'production'} mode on port ${PORT}`);
    });
  }
}

// Only start standalone server listener in local/dedicated server environment
if (!(process.env.VERCEL || process.env.NETLIFY)) {
  startServer();
}

module.exports = app;
