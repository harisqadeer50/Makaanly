// One-off: listings created before Phase 5 have no location slugs, so they would not match city/neighborhood filters.
// Safe to run more than once.   node --env-file=.env scripts/backfillLocationSlugs.js
import mongoose from 'mongoose';
import Property from '../src/models/Property.js';
import { slugify } from '../src/utils/slug.js';
import { env } from '../src/config/env.js';

await mongoose.connect(env.MONGODB_URI);
const cursor = Property.find({ $or: [{ 'location.citySlug': { $exists: false } }, { 'location.neighborhoodSlug': { $exists: false } }] }).lean().cursor();
const ops = [];
for await (const p of cursor) {
  ops.push({ updateOne: { filter: { _id: p._id }, update: { $set: { 'location.citySlug': slugify(p.location.city), 'location.neighborhoodSlug': slugify(p.location.neighborhood) } } } });
}
if (ops.length) await Property.bulkWrite(ops);
console.log(`Updated ${ops.length} listing(s).`);
await mongoose.disconnect();
