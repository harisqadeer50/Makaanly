// Creates or updates every database index, and the default property types. Run once after deploying, and after upgrades.
// Several protections rely on unique indexes (one open inquiry, one open report, one pending verification, no duplicate favorite).
//   node --env-file=.env scripts/syncIndexes.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { ensureCategories } from '../src/services/category.service.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/models');
await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const { default: model } = await import(pathToFileURL(path.join(dir, file)).href);
  const dropped = await model.syncIndexes();
  console.log(`${model.modelName.padEnd(20)} indexes in sync${dropped.length ? ` (removed: ${dropped.join(', ')})` : ''}`);
}
await ensureCategories();
console.log('Default property types ready.');
await mongoose.disconnect();
