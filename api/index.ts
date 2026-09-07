import { VercelRequest, VercelResponse } from '@vercel/node';

// Use dynamic import for ESM compatibility ("type":"module" in package.json)
let _app: any;
let _initDb: any;

async function getHandlers() {
  if (!_app) {
    const mod = await import('../dist/server.cjs');
    _app = mod.app;
    _initDb = mod.initializeDatabaseAsync;
  }
  return { app: _app, initializeDatabaseAsync: _initDb };
}

let initialized = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { app, initializeDatabaseAsync } = await getHandlers();
  if (!initialized) {
    if (typeof initializeDatabaseAsync === 'function') {
      await initializeDatabaseAsync();
    }
    initialized = true;
  }
  return app(req, res);
}
