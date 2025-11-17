// --- Startup trace (optional, helps debug import issues)
console.log("Bootstrapping API server...");

// --- External dependencies
import 'express-async-errors';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cron from 'node-cron';
import { ZodError } from 'zod';

// --- Internal modules (note .ts extensions for ESM + ts-node)
import { config } from './config.js';
import authRouter from './routes/auth.js';
import tradesRouter from './routes/trades.js';
import analyticsRouter from './routes/analytics.js';
import marketRouter from './routes/market.js';
import { recalculateAnalyticsForAllUsers } from './tasks/analytics.js';

// --- Initialize express app
const app = express();

// --- CORS setup
const corsOptions: CorsOptions = {
  origin: config.allowedOrigins,
};
app.use(cors(corsOptions));

// --- Security + JSON middleware
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// --- Logging (skip during tests)
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// --- Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API routes
app.use('/api/auth', authRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/market', marketRouter);

// --- 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Not found' });
});

// --- Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error middleware caught:", err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation error',
      issues: err.issues,
    });
  }

  if (err instanceof Error) {
    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({ message: 'Origin not allowed' });
    }

    const status = 'status' in err ? Number((err as { status?: number }).status) : 500;
    return res.status(status || 500).json({ message: err.message });
  }

  // Fallback for unknown error types
  res.status(500).json({ message: 'Internal server error' });
});

// --- Start server
if (config.nodeEnv !== 'test') {
  cron.schedule('0 2 * * *', async () => {
    try {
      await recalculateAnalyticsForAllUsers();
    } catch (error) {
      console.error('Analytics cron failed', error);
    }
  });
}

app.listen(config.port, () => {
  console.log(`✅ API listening on port ${config.port}`);
});

// --- Export for testing
export default app;
