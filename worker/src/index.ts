import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { searchAuthor } from './handlers/searchAuthor';
import { calculateIqm } from './handlers/calculateIqm';

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  OPENALEX_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware - allow requests from any origin for MVP
// In production, restrict to specific domains
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// Health check
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'IQM API',
    version: '1.0.0'
  });
});

// API Routes
app.get('/api/search-author', searchAuthor);
app.get('/api/calculate-iqm', calculateIqm);

// Error handling
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error', message: err.message }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

export default app;
