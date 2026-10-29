import express from 'express';
import type { Request } from 'express';
import apiRouter from './routes';

function splitUrl(raw: string) {
  const queryIndex = raw.indexOf('?');
  if (queryIndex < 0) {
    return { pathname: raw || '/', search: '' };
  }
  return {
    pathname: raw.slice(0, queryIndex) || '/',
    search: raw.slice(queryIndex),
  };
}

function searchWithoutCatchAll(search: string) {
  if (!search) return '';
  const params = new URLSearchParams(search.slice(1));
  params.delete('path');
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

/**
 * Vercel’s catch-all may hand Express either the original `/api/...` URL
 * or only the segments after `/api`. Route matching expects `/api/v1/...`.
 */
function normalizeApiUrl(req: Request) {
  const { pathname: rawPath, search } = splitUrl(req.url || '/');
  const pathname = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  if (pathname === '/api' || pathname.startsWith('/api/')) return;

  const cleanSearch = searchWithoutCatchAll(search);

  if (pathname === '/health') {
    req.url = `/api/health${cleanSearch}`;
    return;
  }

  if (pathname === '/v1' || pathname.startsWith('/v1/')) {
    req.url = `/api${pathname}${cleanSearch}`;
    return;
  }

  const queryPath = req.query?.path;
  const segments = Array.isArray(queryPath)
    ? queryPath.map(String)
    : typeof queryPath === 'string' && queryPath
      ? [queryPath]
      : null;

  if (segments && pathname === '/') {
    req.url = `/api/${segments.join('/')}${cleanSearch}`;
  }
}

export function createApiApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    normalizeApiUrl(req);
    next();
  });
  app.use('/api/v1', apiRouter);
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      platform: 'Ethiopian Language Interpretation Platform',
      version: '1.0.0-draft',
      time: new Date().toISOString(),
    });
  });
  return app;
}
