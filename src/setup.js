import { getMigrations } from 'better-auth/db/migration';
import { auth } from './auth.js';

export async function setupDatabase() {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}