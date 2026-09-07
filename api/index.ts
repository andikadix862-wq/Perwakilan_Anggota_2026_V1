import { VercelRequest, VercelResponse } from '@vercel/node';

// Import from pre-built CJS bundle (produced by `npm run build`)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app, initializeDatabaseAsync } = require('../dist/server.cjs');

let initialized = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!initialized) {
    await initializeDatabaseAsync();
    initialized = true;
  }
  return app(req, res);
}
