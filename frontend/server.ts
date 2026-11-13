import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(__filename);
// tsx runs from frontend/; cPanel Passenger runs the bundled app.js from the repo root.
const frontendRoot =
  path.basename(moduleDir) === 'frontend' ? moduleDir : path.join(moduleDir, 'frontend');
dotenv.config({ path: path.resolve(frontendRoot, '../.env') });

const { createApiApp } = await import('./server/app');
const { connectPortalDatabase } = await import('./server/postgresStore');

const passengerGlobal = (globalThis as typeof globalThis & {
  PhusionPassenger?: { configure: (options: { autoInstall: boolean }) => void };
}).PhusionPassenger;
const isPassenger = typeof passengerGlobal !== 'undefined';
if (isPassenger) {
  passengerGlobal.configure({ autoInstall: false });
}

async function startServer() {
  await connectPortalDatabase();
  const app = createApiApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';
  const djangoBase = (process.env.DJANGO_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

  // Proxy organization / interpreter Django routes. On cPanel set DJANGO_API_URL
  // to the Python app URL (e.g. https://api.yourdomain.com).
  app.use('/django-api', async (req, res) => {
    const target = `${djangoBase}${req.originalUrl.replace(/^\/django-api/, '')}`;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const accountId = req.header('x-account-id');
      if (accountId) headers['X-Account-Id'] = accountId;
      const response = await fetch(target, {
        method: req.method,
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body ?? {}),
      });
      const text = await response.text();
      res.status(response.status).type('application/json').send(text);
    } catch {
      res.status(502).json({
        error: `The ORZO Django API is not reachable at ${djangoBase}.`,
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: frontendRoot,
      configFile: path.resolve(frontendRoot, 'vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(frontendRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/django-api')) {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const onListen = () => {
    const where = isPassenger ? 'Phusion Passenger' : `http://localhost:${PORT}`;
    console.log(`Ethiopian Interpretation Platform running on ${where}`);
  };

  const server = isPassenger
    ? app.listen('passenger', onListen)
    : app.listen(PORT, '0.0.0.0', onListen);

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${PORT} is already in use. Stop the process using it or run with another port, for example:`,
      );
      console.error('$env:PORT=3001; npm run dev');
    } else {
      console.error('Failed to start the HTTP server:', error);
    }
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
