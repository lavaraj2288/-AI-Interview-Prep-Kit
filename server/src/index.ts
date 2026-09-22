import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import apiRoutes from './routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (_, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// API Routes
app.use('/api', apiRoutes);

// Database connection and server bootstrap
async function startServer() {
  if (MONGODB_URI) {
    try {
      console.log('[Database] Connecting to MongoDB...');
      await mongoose.connect(MONGODB_URI);
      console.log('[Database] Connected to MongoDB successfully.');
    } catch (err) {
      console.error('[Database] MongoDB connection failed:', err);
      console.warn('[Database] Continuing in offline mode without persistence.');
    }
  } else {
    console.warn('[Database] No MONGODB_URI provided in environment.');
  }

  app.listen(PORT, () => {
    console.log(`[Server] AI Interview Prep Kit backend running on port ${PORT}`);
  });
}

startServer();

export default app;
