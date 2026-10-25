// Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='StrongPass123' ADMIN_NAME='Your Name' npm run create-admin
// Admins can only be created here (or promoted here), never through the public API.
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import { emailField, passwordField } from '../src/validators/auth.validator.js';

const email = emailField.parse(process.env.ADMIN_EMAIL);
const password = passwordField.parse(process.env.ADMIN_PASSWORD);
const name = process.env.ADMIN_NAME || 'Makaanly Admin';

await connectDB();
const existing = await User.findOne({ email });
if (existing) {
  existing.role = 'admin';
  existing.isActive = true;
  existing.emailVerifiedAt ||= new Date();
  existing.passwordHash = await User.hashPassword(password);

  await existing.save();
  console.log(`Updated admin account and password for ${email}.`);
} else {
  await User.create({ name, email, passwordHash: await User.hashPassword(password), role: 'admin', emailVerifiedAt: new Date() });
  console.log(`Created admin ${email}.`);
}
await disconnectDB();
