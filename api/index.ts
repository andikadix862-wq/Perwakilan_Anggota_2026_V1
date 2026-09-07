import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeDatabaseAsync } from '../server/db';
import { app } from '../server';

let initialized = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!initialized) {
    await initializeDatabaseAsync();
    initialized = true;
  }
  return app(req, res);
}
