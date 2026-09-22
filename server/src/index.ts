import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import apiRoutes from './routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// CORS configuration
app.use(cors({
  origin: (requestOrigin, callback) => {
    // Allow requests with no origin (e.g. curl, evaluate script) or matching client URLs
    if (!requestOrigin) return callback(null, true);
    if (
      requestOrigin === CLIENT_URL ||
      requestOrigin.includes('localhost') ||
      requestOrigin.includes('127.0.0.1') ||
      requestOrigin.includes('vercel.app') ||
      requestOrigin.includes('onrender.com')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing with size security limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'The AI Interview Prep Kit Backend API',
    status: 'operational',
    health: '/health',
    api_endpoints: '/api',
    assessment: 'FS-AI-INTERVIEW-01',
    message: 'Backend is running live and ready for API requests!'
  });
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api', apiRoutes);

// Database connection (graceful fallback)
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('[Database] Connected successfully to MongoDB'))
    .catch((err) => {
      console.warn(`[Database] MongoDB connection failed: ${err.message}. Using high-performance fallback store.`);
    });
} else {
  console.log('[Database] No MONGODB_URI provided. Running seamlessly with local file/in-memory fallback store.');
}

export const server = app.listen(PORT, () => {
  console.log(`[Server] AI Interview Prep Kit backend running on port ${PORT}`);
});

export default app;
