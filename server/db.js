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
  // Base64 images can easily exceed default MariaDB/XAMPP packet limits (often 1MB).
  // Try to raise the limit automatically for local/dev; if the DB user lacks permission,
  // the app will continue to run and the admin can set it in my.ini.
  const desiredPacketBytes = Number(process.env.DB_MAX_ALLOWED_PACKET || 64 * 1024 * 1024);
  if (Number.isFinite(desiredPacketBytes) && desiredPacketBytes > 0) {
    try {
      await pool.query(`SET GLOBAL max_allowed_packet = ${Math.floor(desiredPacketBytes)}`);
      await pool.query(`SET SESSION max_allowed_packet = ${Math.floor(desiredPacketBytes)}`);
    } catch (error) {
      console.warn(
        'Warning: Could not set max_allowed_packet automatically. ' +
          'If borrower image uploads fail, increase max_allowed_packet in MariaDB/MySQL config (my.ini).'
      );
    }
  }

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
      profileImage LONGTEXT,
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
      creditScore INT NOT NULL,
      eligibilityStatus VARCHAR(20),
      eligibilityScore INT,
      incomeRatio DECIMAL(6,2),
      debtToIncome DECIMAL(6,2),
      riskTier VARCHAR(20),
      kycStatus VARCHAR(20),
      documentStatus VARCHAR(20),
      recommendation TEXT,
      interestType VARCHAR(20),
      gracePeriodDays INT,
      penaltyRate DECIMAL(6,2),
      penaltyFlat DECIMAL(12,2)
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
      disbursementMethod VARCHAR(50),
      referenceNumber VARCHAR(50),
      receiptNumber VARCHAR(50),
      disbursementMeta LONGTEXT,
      status VARCHAR(20) NOT NULL,
      outstandingBalance DECIMAL(12,2) NOT NULL,
      nextDueDate VARCHAR(20) NOT NULL,
      interestType VARCHAR(20),
      gracePeriodDays INT,
      penaltyRate DECIMAL(6,2),
      penaltyFlat DECIMAL(12,2),
      closureCertificateNumber VARCHAR(50),
      closedDate VARCHAR(20)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS disbursement_receipts (
      id VARCHAR(20) PRIMARY KEY,
      loanId VARCHAR(20) NOT NULL,
      receiptNumber VARCHAR(50) NOT NULL,
      referenceNumber VARCHAR(50),
      disbursementMethod VARCHAR(50),
      meta LONGTEXT,
      createdAt VARCHAR(30) NOT NULL,
      UNIQUE KEY uniq_disbursement_receipts_loanId (loanId),
      UNIQUE KEY uniq_disbursement_receipts_receiptNumber (receiptNumber)
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
    CREATE TABLE IF NOT EXISTS loan_penalties (
      id VARCHAR(20) PRIMARY KEY,
      loanId VARCHAR(20) NOT NULL,
      penaltyDate VARCHAR(20) NOT NULL,
      daysLate INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      createdAt VARCHAR(30) NOT NULL,
      UNIQUE KEY uniq_loan_penalties (loanId, penaltyDate)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS collections (
      id VARCHAR(20) PRIMARY KEY,
      loanId VARCHAR(20) NOT NULL,
      borrowerId VARCHAR(20) NOT NULL,
      borrowerName VARCHAR(200) NOT NULL,
      status VARCHAR(20) NOT NULL,
      reason TEXT,
      daysDelinquent INT,
      createdAt VARCHAR(30) NOT NULL,
      forwardedAt VARCHAR(30),
      UNIQUE KEY uniq_collections_loanId (loanId)
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
      phone VARCHAR(50),
      address VARCHAR(255),
      dateOfBirth VARCHAR(20),
      profileImage LONGTEXT,
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_application_approvals (
      id VARCHAR(20) PRIMARY KEY,
      applicationId VARCHAR(20) NOT NULL,
      approvalStage VARCHAR(20) NOT NULL,
      decision VARCHAR(20) NOT NULL,
      decidedBy VARCHAR(150) NOT NULL,
      decidedById VARCHAR(50),
      notes TEXT,
      decidedAt VARCHAR(30) NOT NULL,
      UNIQUE KEY uniq_loan_application_approvals (applicationId, approvalStage)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(20) PRIMARY KEY,
      borrowerId VARCHAR(20),
      loanId VARCHAR(20),
      actorName VARCHAR(150),
      actorProfileImage LONGTEXT,
      targetRole VARCHAR(30),
      type VARCHAR(30) NOT NULL,
      title VARCHAR(150) NOT NULL,
      message TEXT NOT NULL,
      severity VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL,
      referenceKey VARCHAR(100),
      createdAt VARCHAR(30) NOT NULL,
      UNIQUE KEY uniq_notifications_referenceKey (referenceKey)
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

  try {
    await pool.query('ALTER TABLE notifications ADD COLUMN targetRole VARCHAR(30)');
  } catch {
    // ignore if column exists
  }
  await addColumnIfMissing('notifications', 'actorName VARCHAR(150)');
  await addColumnIfMissing('notifications', 'actorProfileImage LONGTEXT');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_transfers (
      id VARCHAR(20) PRIMARY KEY,
      loanId VARCHAR(20) NOT NULL,
      fromBorrowerId VARCHAR(20) NOT NULL,
      toBorrowerId VARCHAR(20) NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(20) NOT NULL,
      requestedBy VARCHAR(150) NOT NULL,
      approvedBy VARCHAR(150),
      effectiveDate VARCHAR(20),
      createdAt VARCHAR(30) NOT NULL,
      notes TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_restructures (
      id VARCHAR(20) PRIMARY KEY,
      loanId VARCHAR(20) NOT NULL,
      restructureType VARCHAR(20) NOT NULL,
      newTermMonths INT,
      newInterestRate DECIMAL(6,2),
      newMonthlyPayment DECIMAL(12,2),
      reason TEXT NOT NULL,
      status VARCHAR(20) NOT NULL,
      requestedBy VARCHAR(150) NOT NULL,
      approvedBy VARCHAR(150),
      effectiveDate VARCHAR(20),
      createdAt VARCHAR(30) NOT NULL,
      notes TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_closures (
      id VARCHAR(20) PRIMARY KEY,
      loanId VARCHAR(20) NOT NULL,
      borrowerId VARCHAR(20) NOT NULL,
      closedAt VARCHAR(30) NOT NULL,
      closedBy VARCHAR(150) NOT NULL,
      certificateNumber VARCHAR(50) NOT NULL,
      remarks TEXT
    )
  `);

  await addColumnIfMissing('borrowers', 'bankName VARCHAR(150)');
  await addColumnIfMissing('borrowers', 'accountNumber VARCHAR(50)');
  await addColumnIfMissing('borrowers', 'accountType VARCHAR(50)');
  await addColumnIfMissing('borrowers', 'routingNumber VARCHAR(50)');
  await addColumnIfMissing('borrowers', 'facialImage LONGTEXT');
  await addColumnIfMissing('borrowers', 'idImage LONGTEXT');
  await addColumnIfMissing('borrowers', 'profileImage LONGTEXT');
  await addColumnIfMissing('borrowers', 'password VARCHAR(255)');
  await addColumnIfMissing('borrowers', 'passwordUpdatedAt VARCHAR(30)');
  await addColumnIfMissing('users', 'status TINYINT(1) NOT NULL DEFAULT 1');
  await addColumnIfMissing('users', 'archivedAt VARCHAR(30)');
  await addColumnIfMissing('users', 'phone VARCHAR(50)');
  await addColumnIfMissing('users', 'address VARCHAR(255)');
  await addColumnIfMissing('users', 'dateOfBirth VARCHAR(20)');
  await addColumnIfMissing('users', 'profileImage LONGTEXT');

  await addColumnIfMissing('loan_applications', 'eligibilityStatus VARCHAR(20)');
  await addColumnIfMissing('loan_applications', 'eligibilityScore INT');
  await addColumnIfMissing('loan_applications', 'incomeRatio DECIMAL(6,2)');
  await addColumnIfMissing('loan_applications', 'debtToIncome DECIMAL(6,2)');
  await addColumnIfMissing('loan_applications', 'riskTier VARCHAR(20)');
  await addColumnIfMissing('loan_applications', 'kycStatus VARCHAR(20)');
  await addColumnIfMissing('loan_applications', 'documentStatus VARCHAR(20)');
  await addColumnIfMissing('loan_applications', 'recommendation TEXT');
  await addColumnIfMissing('loan_applications', 'interestType VARCHAR(20)');
  await addColumnIfMissing('loan_applications', 'gracePeriodDays INT');
  await addColumnIfMissing('loan_applications', 'penaltyRate DECIMAL(6,2)');
  await addColumnIfMissing('loan_applications', 'penaltyFlat DECIMAL(12,2)');

  await addColumnIfMissing('loans', 'disbursementMethod VARCHAR(50)');
  await addColumnIfMissing('loans', 'referenceNumber VARCHAR(50)');
  await addColumnIfMissing('loans', 'receiptNumber VARCHAR(50)');
  await addColumnIfMissing('loans', 'disbursementMeta LONGTEXT');
  await addColumnIfMissing('loans', 'interestType VARCHAR(20)');
  await addColumnIfMissing('loans', 'gracePeriodDays INT');
  await addColumnIfMissing('loans', 'penaltyRate DECIMAL(6,2)');
  await addColumnIfMissing('loans', 'penaltyFlat DECIMAL(12,2)');
  await addColumnIfMissing('loans', 'closureCertificateNumber VARCHAR(50)');
  await addColumnIfMissing('loans', 'closedDate VARCHAR(20)');

  // Ensure receipt table columns exist if schema evolves.
  await addColumnIfMissing('disbursement_receipts', 'referenceNumber VARCHAR(50)');
  await addColumnIfMissing('disbursement_receipts', 'disbursementMethod VARCHAR(50)');
  await addColumnIfMissing('disbursement_receipts', 'meta LONGTEXT');
  await addColumnIfMissing('disbursement_receipts', 'createdAt VARCHAR(30) NOT NULL');

  // Backfill receipt fields for older loans created before receipts were added.
  // This keeps the UI consistent and makes receipts printable for legacy data.
  try {
    await pool.query(
      `UPDATE loans
       SET
         disbursementMethod = CASE
           WHEN disbursementMethod IS NULL OR disbursementMethod = '' THEN 'cash'
           ELSE disbursementMethod
         END,
         referenceNumber = CASE
           WHEN referenceNumber IS NULL OR referenceNumber = '' THEN CONCAT('REF-', id)
           ELSE referenceNumber
         END,
         receiptNumber = CASE
           WHEN receiptNumber IS NULL OR receiptNumber = '' THEN CONCAT('DR-', id)
           ELSE receiptNumber
         END
       WHERE
         (disbursementMethod IS NULL OR disbursementMethod = ''
          OR referenceNumber IS NULL OR referenceNumber = ''
          OR receiptNumber IS NULL OR receiptNumber = '')
      `
    );
  } catch (error) {
    console.warn('Warning: Could not backfill loan receipt fields automatically.', error?.message || error);
  }

  // Backfill receipt rows for older loans (one receipt per loan).
  try {
    await pool.query(
      `INSERT IGNORE INTO disbursement_receipts (
        id, loanId, receiptNumber, referenceNumber, disbursementMethod, meta, createdAt
      )
      SELECT
        CONCAT('DRC', RIGHT(l.id, 6)) as id,
        l.id as loanId,
        COALESCE(NULLIF(l.receiptNumber, ''), CONCAT('DR-', l.id)) as receiptNumber,
        COALESCE(NULLIF(l.referenceNumber, ''), CONCAT('REF-', l.id)) as referenceNumber,
        COALESCE(NULLIF(l.disbursementMethod, ''), 'cash') as disbursementMethod,
        l.disbursementMeta as meta,
        COALESCE(NULLIF(l.disbursedDate, ''), DATE_FORMAT(NOW(), '%Y-%m-%d')) as createdAt
      FROM loans l
      `
    );
  } catch (error) {
    console.warn('Warning: Could not backfill disbursement receipts automatically.', error?.message || error);
  }

  const roles = ['admin', 'manager', 'loan_officer', 'cashier', 'borrower', 'auditor'];
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
