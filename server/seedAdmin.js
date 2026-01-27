const { pool, init } = require('./db');

const seedAdmin = async () => {
  await init();

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lms.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'Admin User';

  const [existingRows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail]);
  if (Array.isArray(existingRows) && existingRows.length) {
    console.log('Admin user already exists.');
    return;
  }

  const adminId = `US${Date.now().toString().slice(-6)}`;
  const createdAt = new Date().toISOString();

  await pool.query(
    'INSERT INTO users (id, name, email, password, createdAt, status) VALUES (?, ?, ?, ?, ?, ?)',
    [adminId, adminName, adminEmail, adminPassword, createdAt, 1]
  );

  const [roleRows] = await pool.query('SELECT id FROM roles WHERE name = ? LIMIT 1', ['admin']);
  const adminRoleId = Array.isArray(roleRows) ? roleRows[0]?.id : null;
  if (adminRoleId) {
    await pool.query('INSERT IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)', [adminId, adminRoleId]);
  }

  console.log(`Admin user created: ${adminEmail}`);
};

seedAdmin()
  .catch((error) => {
    console.error('Failed to seed admin user:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end();
  });
