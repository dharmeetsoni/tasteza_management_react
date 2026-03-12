const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function seed() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const staffHash = await bcrypt.hash('staff123', 10);

  await db.query('DELETE FROM users');
  await db.query(
    'INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)',
    ['Admin User', '9999999999', adminHash, 'admin']
  );
  await db.query(
    'INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)',
    ['Staff Member', '8888888888', staffHash, 'staff']
  );

  console.log('✅ Users seeded successfully!');
  console.log('Admin  → phone: 9999999999 / password: admin123');
  console.log('Staff  → phone: 8888888888 / password: staff123');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });