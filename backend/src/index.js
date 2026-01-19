import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initializeDatabase } from './db/index.js';
import { devAuth, authenticateRequest } from './middleware/auth.js';

// Use real auth in production, dev auth in development
const authMiddleware = process.env.NODE_ENV === 'production' ? authenticateRequest : devAuth;
import metricsRouter from './api/metrics.js';
import authRouter from './api/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://claudometer.ai',
      'https://www.claudometer.ai',
      'http://localhost:3000',
    ];
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public)
app.use('/auth', authRouter);

// Protected API routes
app.use('/api/metrics', authMiddleware, metricsRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    // Initialize database
    if (process.env.DATABASE_URL) {
      await initializeDatabase();
    } else {
      console.warn('DATABASE_URL not set - running without database');
    }

    app.listen(PORT, () => {
      console.log(`Claude Tracker API running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
