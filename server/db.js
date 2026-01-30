const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lms',
  connectionLimit: 10
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS borrowers (
      id VARCHAR(20) PRIMARY KEY,
      firstName VARCHAR(100) NOT NULL,
      lastName VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      dateOfBirth VARCHAR(20) NOT NULL,
      address VARCHAR(255) NOT NULL,
      employment VARCHAR(255) NOT NULL,
      monthlyIncome DECIMAL(12,2) NOT NULL,
      bankName VARCHAR(150),
      accountNumber VARCHAR(50),
      accountType VARCHAR(50),
      routingNumber VARCHAR(50),
      facialImage LONGTEXT,
      idImage LONGTEXT,
      password VARCHAR(255),
      passwordUpdatedAt VARCHAR(30),
      creditScore INT NOT NULL,
      status VARCHAR(20) NOT NULL,
      registrationDate VARCHAR(20) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_applications (
      id VARCHAR(20) PRIMARY KEY,
      borrowerId VARCHAR(20) NOT NULL,
      borrowerName VARCHAR(200) NOT NULL,
      loanType VARCHAR(50) NOT NULL,
      requestedAmount DECIMAL(12,2) NOT NULL,
      purpose TEXT NOT NULL,
      collateralType VARCHAR(100),
      collateralValue DECIMAL(12,2),
      guarantorName VARCHAR(200),
      guarantorPhone VARCHAR(50),
      status VARCHAR(20) NOT NULL,
      applicationDate VARCHAR(20) NOT NULL,
      reviewedBy VARCHAR(100),
      reviewDate VARCHAR(20),
      approvedAmount DECIMAL(12,2),
      interestRate DECIMAL(6,2),
      termMonths INT,
      creditScore INT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS loans (
      id VARCHAR(20) PRIMARY KEY,
      applicationId VARCHAR(20) NOT NULL,
      borrowerId VARCHAR(20) NOT NULL,
      borrowerName VARCHAR(200) NOT NULL,
      loanType VARCHAR(50) NOT NULL,
      principalAmount DECIMAL(12,2) NOT NULL,
      interestRate DECIMAL(6,2) NOT NULL,
      termMonths INT NOT NULL,
      monthlyPayment DECIMAL(12,2) NOT NULL,
      totalAmount DECIMAL(12,2) NOT NULL,
      disbursedDate VARCHAR(20) NOT NULL,
      disbursedBy VARCHAR(100) NOT NULL,
      status VARCHAR(20) NOT NULL,
      outstandingBalance DECIMAL(12,2) NOT NULL,
      nextDueDate VARCHAR(20) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(20) PRIMARY KEY,
      loanId VARCHAR(20) NOT NULL,
      borrowerName VARCHAR(200) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      paymentDate VARCHAR(20) NOT NULL,
      dueDate VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL,
      lateFee DECIMAL(12,2),
      receivedBy VARCHAR(100) NOT NULL,
      receiptNumber VARCHAR(50) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(20) PRIMARY KEY,
      userId VARCHAR(50) NOT NULL,
      userName VARCHAR(200) NOT NULL,
      action VARCHAR(50) NOT NULL,
      entity VARCHAR(50) NOT NULL,
      entityId VARCHAR(50) NOT NULL,
      details TEXT NOT NULL,
      timestamp VARCHAR(30) NOT NULL,
      ipAddress VARCHAR(50) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(20) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      createdAt VARCHAR(30) NOT NULL,
      status TINYINT(1) NOT NULL DEFAULT 1,
      archivedAt VARCHAR(30)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      userId VARCHAR(20) NOT NULL,
      roleId INT NOT NULL,
      PRIMARY KEY (userId, roleId)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id VARCHAR(20) PRIMARY KEY,
      userId VARCHAR(20),
      email VARCHAR(150) NOT NULL,
      status VARCHAR(20) NOT NULL,
      ipAddress VARCHAR(50) NOT NULL,
      userAgent VARCHAR(255),
      createdAt VARCHAR(30) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS authorization_codes (
      id VARCHAR(20) PRIMARY KEY,
      applicationId VARCHAR(20) NOT NULL,
      code VARCHAR(20) NOT NULL,
      createdBy VARCHAR(20) NOT NULL,
      createdRole VARCHAR(50) NOT NULL,
      createdAt VARCHAR(30) NOT NULL,
      expiresAt VARCHAR(30) NOT NULL,
      usedAt VARCHAR(30)
    )
  `);

  const addColumnIfMissing = async (table, columnDef) => {
    try {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    } catch (error) {
      const message = error?.message || '';
      if (!message.includes('Duplicate column')) {
        throw error;
      }
    }
  };

  await addColumnIfMissing('borrowers', 'bankName VARCHAR(150)');
  await addColumnIfMissing('borrowers', 'accountNumber VARCHAR(50)');
  await addColumnIfMissing('borrowers', 'accountType VARCHAR(50)');
  await addColumnIfMissing('borrowers', 'routingNumber VARCHAR(50)');
  await addColumnIfMissing('borrowers', 'facialImage LONGTEXT');
  await addColumnIfMissing('borrowers', 'idImage LONGTEXT');
  await addColumnIfMissing('borrowers', 'password VARCHAR(255)');
  await addColumnIfMissing('borrowers', 'passwordUpdatedAt VARCHAR(30)');
  await addColumnIfMissing('users', 'status TINYINT(1) NOT NULL DEFAULT 1');
  await addColumnIfMissing('users', 'archivedAt VARCHAR(30)');

  const roles = ['admin', 'loan_officer', 'cashier', 'borrower', 'auditor'];
  for (const role of roles) {
    await pool.query('INSERT IGNORE INTO roles (name) VALUES (?)', [role]);
  }

  const [adminRoleRows] = await pool.query('SELECT id FROM roles WHERE name = ? LIMIT 1', ['admin']);
  const adminRoleId = Array.isArray(adminRoleRows) ? adminRoleRows[0]?.id : null;

  const [userRows] = await pool.query('SELECT COUNT(*) as count FROM users');
  const userCount = Array.isArray(userRows) ? userRows[0]?.count : 0;
  if (!userCount) {
    const adminId = `US${Date.now().toString().slice(-6)}`;
    const createdAt = new Date().toISOString();

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@lms.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@1234';
    const passwordOk = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(adminPassword);
    if (!passwordOk) {
      throw new Error(
        'Default admin password must be at least 8 characters and include upper, lower, number, and special character. Set ADMIN_PASSWORD in .env.'
      );
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      'INSERT INTO users (id, name, email, password, createdAt) VALUES (?, ?, ?, ?, ?)',
      [adminId, 'Admin User', adminEmail, hashedPassword, createdAt]
    );

    if (adminRoleId) {
      await pool.query('INSERT IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)', [adminId, adminRoleId]);
    }
    return;
  }

  // If there are users but none has the admin role yet, promote the oldest user.
  if (adminRoleId) {
    const [adminAssignedRows] = await pool.query(
      'SELECT COUNT(*) as count FROM user_roles WHERE roleId = ?',
      [adminRoleId]
    );
    const adminAssigned = Array.isArray(adminAssignedRows) ? adminAssignedRows[0]?.count : 0;
    if (!adminAssigned) {
      const [firstUserRows] = await pool.query(
        'SELECT id FROM users ORDER BY createdAt ASC LIMIT 1'
      );
      const firstUserId = Array.isArray(firstUserRows) ? firstUserRows[0]?.id : null;
      if (firstUserId) {
        await pool.query('INSERT IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)', [firstUserId, adminRoleId]);
        await pool.query('UPDATE users SET status = 1 WHERE id = ?', [firstUserId]);
      }
    }
  }
}

module.exports = { pool, init };
