const express = require('express');
const cors = require('cors');
const { pool, init } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

init().catch((error) => {
  console.error('Failed to initialize database schema:', error);
  process.exit(1);
});

const PORT = process.env.API_PORT || 5174;

const generateId = (prefix) => `${prefix}${Date.now().toString().slice(-6)}`;

const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateAuthCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const computeBorrowerScore = async (borrowerId) => {
  const borrowerRows = await runQuery(
    'SELECT id, registrationDate, monthlyIncome FROM borrowers WHERE id = ? LIMIT 1',
    [borrowerId]
  );
  const borrower = borrowerRows[0];
  if (!borrower) return null;

  const loanRows = await runQuery('SELECT principalAmount, outstandingBalance FROM loans WHERE borrowerId = ?', [borrowerId]);
  const paymentRows = await runQuery(
    `SELECT p.status
     FROM payments p
     INNER JOIN loans l ON p.loanId = l.id
     WHERE l.borrowerId = ?`,
    [borrowerId]
  );

  const totalPrincipal = loanRows.reduce((sum, l) => sum + Number(l.principalAmount || 0), 0);
  const totalOutstanding = loanRows.reduce((sum, l) => sum + Number(l.outstandingBalance || 0), 0);

  const paidCount = paymentRows.filter(p => p.status === 'paid').length;
  const lateCount = paymentRows.filter(p => p.status === 'late').length;
  const totalPayments = paidCount + lateCount;
  const onTimeRatio = totalPayments === 0 ? 0.7 : paidCount / totalPayments;
  const paymentHistoryScore = clamp(onTimeRatio * 100, 0, 100);

  const utilization = totalPrincipal === 0 ? 0.3 : totalOutstanding / totalPrincipal;
  const utilizationScore = clamp((1 - utilization) * 100, 0, 100);

  const regDate = borrower.registrationDate ? new Date(borrower.registrationDate) : new Date();
  const monthsActive = Math.max(0, (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const creditAgeScore = clamp((monthsActive / 120) * 100, 0, 100);

  const annualIncome = Number(borrower.monthlyIncome || 0) * 12;
  const debtToIncome = annualIncome === 0 ? 1 : totalOutstanding / annualIncome;
  const totalDebtScore = clamp(100 - debtToIncome * 50, 0, 100);

  const inquiriesScore = 80;

  const weighted =
    paymentHistoryScore * 0.35 +
    utilizationScore * 0.30 +
    creditAgeScore * 0.15 +
    totalDebtScore * 0.10 +
    inquiriesScore * 0.10;

  const score = clamp(Math.round(300 + weighted * 5.5), 300, 850);

  return {
    score,
    factors: {
      paymentHistory: Math.round(paymentHistoryScore),
      creditUtilization: Math.round(utilizationScore),
      creditAge: Math.round(creditAgeScore),
      totalDebt: Math.round(totalDebtScore),
      recentInquiries: Math.round(inquiriesScore)
    }
  };
};

const runQuery = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

const runExecute = async (sql, params = []) => {
  const [result] = await pool.execute(sql, params);
  return result;
};

const logAudit = async ({ userId, userName, action, entity, entityId, details, ipAddress }) => {
  try {
    const id = generateId('AL');
    const timestamp = new Date().toISOString();
    await runExecute(
      `INSERT INTO audit_logs (id, userId, userName, action, entity, entityId, details, timestamp, ipAddress)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        userId || 'system',
        userName || 'System',
        action,
        entity,
        entityId,
        details,
        timestamp,
        ipAddress || 'unknown'
      ]
    );
  } catch {
    // swallow audit errors
  }
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).send('Email and password are required.');
    }

    const rows = await runQuery(
      `SELECT u.id, u.name, u.email, u.password, r.name as role
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.userId
       LEFT JOIN roles r ON ur.roleId = r.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );

    const user = rows[0];
    const loginId = generateId('LG');
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const createdAt = new Date().toISOString();

    if (user && user.password === password) {
      await runExecute(
        `INSERT INTO login_logs (id, userId, email, status, ipAddress, userAgent, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)` ,
        [loginId, user.id, user.email, 'success', ipAddress.toString(), userAgent, createdAt]
      );

      await logAudit({
        userId: user.id,
        userName: user.name,
        action: 'LOGIN_SUCCESS',
        entity: 'USER',
        entityId: user.id,
        details: `User login success for ${user.email}.`,
        ipAddress: ipAddress.toString()
      });

      return res.json({ id: user.id, name: user.name, email: user.email, role: user.role || 'borrower' });
    }

    const borrowerRows = await runQuery(
      `SELECT id, firstName, lastName, email, password
       FROM borrowers
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const borrower = borrowerRows[0];
    if (borrower && borrower.password === password) {
      await runExecute(
        `INSERT INTO login_logs (id, userId, email, status, ipAddress, userAgent, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)` ,
        [loginId, borrower.id, borrower.email, 'success', ipAddress.toString(), userAgent, createdAt]
      );

      await logAudit({
        userId: borrower.id,
        userName: `${borrower.firstName} ${borrower.lastName}`,
        action: 'LOGIN_SUCCESS',
        entity: 'BORROWER',
        entityId: borrower.id,
        details: `Borrower login success for ${borrower.email}.`,
        ipAddress: ipAddress.toString()
      });

      return res.json({
        id: borrower.id,
        name: `${borrower.firstName} ${borrower.lastName}`,
        email: borrower.email,
        role: 'borrower'
      });
    }

    await runExecute(
      `INSERT INTO login_logs (id, userId, email, status, ipAddress, userAgent, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [loginId, user?.id || borrower?.id || null, email, 'failed', ipAddress.toString(), userAgent, createdAt]
    );

    await logAudit({
      userId: user?.id || borrower?.id || 'unknown',
      userName: user?.name || (borrower ? `${borrower.firstName} ${borrower.lastName}` : 'Unknown'),
      action: 'LOGIN_FAILED',
      entity: 'AUTH',
      entityId: email,
      details: `Login failed for ${email}.`,
      ipAddress: ipAddress.toString()
    });
    return res.status(401).send('Invalid credentials.');
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/borrowers', async (req, res) => {
  try {
    const rows = await runQuery('SELECT * FROM borrowers ORDER BY registrationDate DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/borrowers/:id/credit-score', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await computeBorrowerScore(id);
    if (!result) {
      return res.status(404).send('Borrower not found.');
    }

    await runExecute('UPDATE borrowers SET creditScore = ? WHERE id = ?', [result.score, id]);
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/borrowers/:id/loans', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await runQuery('SELECT * FROM loans WHERE borrowerId = ? ORDER BY disbursedDate DESC', [id]);
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/borrowers/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await runQuery(
      `SELECT p.*
       FROM payments p
       INNER JOIN loans l ON p.loanId = l.id
       WHERE l.borrowerId = ?
       ORDER BY p.paymentDate DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/borrowers', async (req, res) => {
  try {
    const payload = req.body;
    const id = payload.id || generateId('BR');
    const registrationDate = payload.registrationDate || new Date().toISOString().split('T')[0];
    const creditScore = payload.creditScore || 650;
    const status = payload.status || 'active';
    const tempPassword = generateTempPassword();

    await runExecute(
      `INSERT INTO borrowers (
        id, firstName, lastName, email, phone, dateOfBirth, address, employment,
        monthlyIncome, bankName, accountNumber, accountType, routingNumber,
        password, passwordUpdatedAt, creditScore, status, registrationDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        payload.firstName,
        payload.lastName,
        payload.email,
        payload.phone,
        payload.dateOfBirth,
        payload.address,
        payload.employment,
        payload.monthlyIncome,
        payload.bankName || null,
        payload.accountNumber || null,
        payload.accountType || null,
        payload.routingNumber || null,
        tempPassword,
        new Date().toISOString(),
        creditScore,
        status,
        registrationDate
      ]
    );

    await logAudit({
      action: 'BORROWER_CREATED',
      entity: 'BORROWER',
      entityId: id,
      details: `Borrower ${payload.firstName} ${payload.lastName} created.`
    });

    res.json({ id, tempPassword });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.patch('/api/borrowers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    await runExecute(
      `UPDATE borrowers
       SET firstName = COALESCE(?, firstName),
           lastName = COALESCE(?, lastName),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           address = COALESCE(?, address),
           employment = COALESCE(?, employment),
           monthlyIncome = COALESCE(?, monthlyIncome),
           bankName = COALESCE(?, bankName),
           accountNumber = COALESCE(?, accountNumber),
           accountType = COALESCE(?, accountType),
           routingNumber = COALESCE(?, routingNumber),
           status = COALESCE(?, status)
       WHERE id = ?` ,
      [
        payload.firstName || null,
        payload.lastName || null,
        payload.email || null,
        payload.phone || null,
        payload.address || null,
        payload.employment || null,
        payload.monthlyIncome || null,
        payload.bankName || null,
        payload.accountNumber || null,
        payload.accountType || null,
        payload.routingNumber || null,
        payload.status || null,
        id
      ]
    );

    await logAudit({
      action: 'BORROWER_UPDATED',
      entity: 'BORROWER',
      entityId: id,
      details: `Borrower ${id} updated.`
    });

    res.json({ id });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/loan-applications', async (req, res) => {
  try {
    const rows = await runQuery('SELECT * FROM loan_applications ORDER BY applicationDate DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/loan-applications', async (req, res) => {
  try {
    const payload = req.body;
    const id = payload.id || generateId('LA');
    const applicationDate = payload.applicationDate || new Date().toISOString().split('T')[0];
    const status = payload.status || 'pending';

    await runExecute(
      `INSERT INTO loan_applications (
        id, borrowerId, borrowerName, loanType, requestedAmount, purpose,
        collateralType, collateralValue, guarantorName, guarantorPhone, status,
        applicationDate, reviewedBy, reviewDate, approvedAmount, interestRate,
        termMonths, creditScore
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        payload.borrowerId,
        payload.borrowerName,
        payload.loanType,
        payload.requestedAmount,
        payload.purpose,
        payload.collateralType || null,
        payload.collateralValue || null,
        payload.guarantorName || null,
        payload.guarantorPhone || null,
        status,
        applicationDate,
        payload.reviewedBy || null,
        payload.reviewDate || null,
        payload.approvedAmount || null,
        payload.interestRate || null,
        payload.termMonths || null,
        payload.creditScore
      ]
    );

    await logAudit({
      action: 'APPLICATION_CREATED',
      entity: 'LOAN_APPLICATION',
      entityId: id,
      details: `Loan application created for ${payload.borrowerName}.`
    });

    res.json({ id });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.patch('/api/loan-applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    await runExecute(
      `UPDATE loan_applications
       SET status = COALESCE(?, status),
           approvedAmount = COALESCE(?, approvedAmount),
           interestRate = COALESCE(?, interestRate),
           termMonths = COALESCE(?, termMonths),
           reviewedBy = COALESCE(?, reviewedBy),
           reviewDate = COALESCE(?, reviewDate)
       WHERE id = ?` ,
      [
        payload.status || null,
        payload.approvedAmount || null,
        payload.interestRate || null,
        payload.termMonths || null,
        payload.reviewedBy || null,
        payload.reviewDate || null,
        id
      ]
    );

    if (payload.status) {
      await logAudit({
        action: payload.status === 'approved' ? 'APPLICATION_APPROVED' :
          payload.status === 'rejected' ? 'APPLICATION_REJECTED' : 'APPLICATION_UPDATED',
        entity: 'LOAN_APPLICATION',
        entityId: id,
        details: `Application ${id} status changed to ${payload.status}.`
      });
    }

    res.json({ id });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/loans', async (req, res) => {
  try {
    const rows = await runQuery('SELECT * FROM loans ORDER BY disbursedDate DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/loans', async (req, res) => {
  try {
    const payload = req.body;
    const id = payload.id || generateId('LN');
    const status = payload.status || 'active';

    await runExecute(
      `INSERT INTO loans (
        id, applicationId, borrowerId, borrowerName, loanType, principalAmount,
        interestRate, termMonths, monthlyPayment, totalAmount, disbursedDate,
        disbursedBy, status, outstandingBalance, nextDueDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        payload.applicationId,
        payload.borrowerId,
        payload.borrowerName,
        payload.loanType,
        payload.principalAmount,
        payload.interestRate,
        payload.termMonths,
        payload.monthlyPayment,
        payload.totalAmount,
        payload.disbursedDate,
        payload.disbursedBy,
        status,
        payload.outstandingBalance,
        payload.nextDueDate
      ]
    );

    await runExecute(
      'UPDATE loan_applications SET status = ? WHERE id = ?',
      ['disbursed', payload.applicationId]
    );

    await logAudit({
      action: 'DISBURSED',
      entity: 'LOAN',
      entityId: id,
      userName: payload.disbursedBy,
      details: `Loan disbursed to ${payload.borrowerName} for ${payload.principalAmount}.`
    });

    const scoreResult = await computeBorrowerScore(payload.borrowerId);
    if (scoreResult) {
      await runExecute('UPDATE borrowers SET creditScore = ? WHERE id = ?', [scoreResult.score, payload.borrowerId]);
    }

    res.json({ id });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/payments', async (req, res) => {
  try {
    const rows = await runQuery('SELECT * FROM payments ORDER BY paymentDate DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const payload = req.body;
    const id = payload.id || generateId('PM');
    const receiptNumber = payload.receiptNumber || `RC-${Date.now().toString().slice(-6)}`;

    await runExecute(
      `INSERT INTO payments (
        id, loanId, borrowerName, amount, paymentDate, dueDate, status, lateFee,
        receivedBy, receiptNumber
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        payload.loanId,
        payload.borrowerName,
        payload.amount,
        payload.paymentDate,
        payload.dueDate,
        payload.status,
        payload.lateFee || null,
        payload.receivedBy,
        receiptNumber
      ]
    );

    await logAudit({
      action: 'PAYMENT_RECEIVED',
      entity: 'PAYMENT',
      entityId: id,
      userName: payload.receivedBy,
      details: `Payment received from ${payload.borrowerName} for ${payload.amount}.`
    });

    const loanRows = await runQuery('SELECT borrowerId FROM loans WHERE id = ? LIMIT 1', [payload.loanId]);
    const borrowerId = loanRows[0]?.borrowerId;
    if (borrowerId) {
      const scoreResult = await computeBorrowerScore(borrowerId);
      if (scoreResult) {
        await runExecute('UPDATE borrowers SET creditScore = ? WHERE id = ?', [scoreResult.score, borrowerId]);
      }
    }

    res.json({ id });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const rows = await runQuery('SELECT * FROM audit_logs ORDER BY timestamp DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const rows = await runQuery(
      `SELECT u.id, u.name, u.email, u.createdAt, u.status, u.archivedAt, COALESCE(r.name, 'borrower') as role
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.userId
       LEFT JOIN roles r ON ur.roleId = r.id
       ORDER BY u.createdAt DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const payload = req.body;
    const id = payload.id || generateId('US');
    const createdAt = new Date().toISOString();
    const status = payload.status || 'active';

    await runExecute(
      `INSERT INTO users (id, name, email, password, createdAt, status, archivedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        payload.name,
        payload.email,
        payload.password,
        createdAt,
        status,
        payload.archivedAt || null
      ]
    );

    const roleName = payload.role || 'borrower';
    const roleRows = await runQuery('SELECT id FROM roles WHERE name = ?', [roleName]);
    const roleId = roleRows[0]?.id;
    if (roleId) {
      await runExecute('INSERT IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)', [id, roleId]);
    }

    await logAudit({
      action: 'USER_CREATED',
      entity: 'USER',
      entityId: id,
      details: `User ${payload.email} created with role ${roleName}.`
    });

    res.json({ id });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    await runExecute(
      `UPDATE users
       SET name = COALESCE(?, name),
           email = COALESCE(?, email),
           password = COALESCE(?, password),
           status = COALESCE(?, status),
           archivedAt = COALESCE(?, archivedAt)
       WHERE id = ?` ,
      [
        payload.name || null,
        payload.email || null,
        payload.password || null,
        payload.status || null,
        payload.archivedAt !== undefined ? payload.archivedAt : null,
        id
      ]
    );

    if (payload.role) {
      const roleRows = await runQuery('SELECT id FROM roles WHERE name = ?', [payload.role]);
      const roleId = roleRows[0]?.id;
      if (roleId) {
        await runExecute('DELETE FROM user_roles WHERE userId = ?', [id]);
        await runExecute('INSERT IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)', [id, roleId]);
      }
    }

    await logAudit({
      action: payload.status === 'archived' ? 'USER_ARCHIVED' : 'USER_UPDATED',
      entity: 'USER',
      entityId: id,
      details: `User ${id} updated.`
    });

    res.json({ id });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/users/reset-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).send('Email is required.');
    }

    const rows = await runQuery('SELECT id FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) {
      return res.status(404).send('User not found.');
    }

    const tempPassword = generateTempPassword();
    await runExecute('UPDATE users SET password = ? WHERE id = ?', [tempPassword, user.id]);
    res.json({ tempPassword });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/users/borrower-login', async (req, res) => {
  try {
    const { borrowerId, email, name } = req.body || {};
    if (!email || !name) {
      return res.status(400).send('Borrower name and email are required.');
    }

    const rows = await runQuery('SELECT id FROM users WHERE email = ?', [email]);
    const tempPassword = generateTempPassword();

    if (rows.length) {
      await runExecute('UPDATE users SET password = ? WHERE id = ?', [tempPassword, rows[0].id]);
      return res.json({ tempPassword, created: false });
    }

    const userId = generateId('US');
    const createdAt = new Date().toISOString();
    await runExecute(
      'INSERT INTO users (id, name, email, password, createdAt, status, archivedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, name, email, tempPassword, createdAt, 'active', null]
    );

    const roleRows = await runQuery('SELECT id FROM roles WHERE name = ?', ['borrower']);
    const roleId = roleRows[0]?.id;
    if (roleId) {
      await runExecute('INSERT IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)', [userId, roleId]);
    }

    res.json({ tempPassword, created: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/borrowers/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).send('Email and password are required.');
    }

    const rows = await runQuery(
      `SELECT id, firstName, lastName, email, password
       FROM borrowers
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const borrower = rows[0];
    if (!borrower || borrower.password !== password) {
      return res.status(401).send('Invalid credentials.');
    }

    res.json({
      id: borrower.id,
      name: `${borrower.firstName} ${borrower.lastName}`,
      email: borrower.email,
      role: 'borrower'
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/borrowers/change-password', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body || {};
    if (!email || !currentPassword || !newPassword) {
      return res.status(400).send('Email, current password, and new password are required.');
    }

    const rows = await runQuery('SELECT id, password FROM borrowers WHERE email = ? LIMIT 1', [email]);
    const borrower = rows[0];
    if (!borrower || borrower.password !== currentPassword) {
      return res.status(401).send('Invalid credentials.');
    }

    await runExecute(
      'UPDATE borrowers SET password = ?, passwordUpdatedAt = ? WHERE id = ?',
      [newPassword, new Date().toISOString(), borrower.id]
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/borrowers/reset-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).send('Email is required.');
    }

    const rows = await runQuery('SELECT id FROM borrowers WHERE email = ? LIMIT 1', [email]);
    const borrower = rows[0];
    if (!borrower) {
      return res.status(404).send('Borrower not found.');
    }

    const tempPassword = generateTempPassword();
    await runExecute(
      'UPDATE borrowers SET password = ?, passwordUpdatedAt = ? WHERE id = ?',
      [tempPassword, new Date().toISOString(), borrower.id]
    );

    res.json({ tempPassword });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/authorization-codes', async (req, res) => {
  try {
    const { applicationId, createdBy, createdRole } = req.body || {};
    if (!applicationId || !createdBy || !createdRole) {
      return res.status(400).send('applicationId, createdBy, and createdRole are required.');
    }

    const id = generateId('AC');
    const code = generateAuthCode();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await runExecute(
      `INSERT INTO authorization_codes (
        id, applicationId, code, createdBy, createdRole, createdAt, expiresAt, usedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
      [id, applicationId, code, createdBy, createdRole, createdAt, expiresAt, null]
    );

    await logAudit({
      userId: createdBy,
      userName: createdRole,
      action: 'AUTH_CODE_CREATED',
      entity: 'AUTH_CODE',
      entityId: id,
      details: `Authorization code created for application ${applicationId}.`
    });

    res.json({ code, expiresAt });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/authorization-codes/consume', async (req, res) => {
  try {
    const { applicationId, code } = req.body || {};
    if (!applicationId || !code) {
      return res.status(400).send('applicationId and code are required.');
    }

    const rows = await runQuery(
      `SELECT id, expiresAt, usedAt
       FROM authorization_codes
       WHERE applicationId = ? AND code = ?
       ORDER BY createdAt DESC
       LIMIT 1`,
      [applicationId, code]
    );

    const record = rows[0];
    if (!record) {
      return res.status(404).send('Authorization code not found.');
    }

    if (record.usedAt) {
      return res.status(400).send('Authorization code already used.');
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      return res.status(400).send('Authorization code expired.');
    }

    await runExecute('UPDATE authorization_codes SET usedAt = ? WHERE id = ?', [new Date().toISOString(), record.id]);
    await logAudit({
      action: 'AUTH_CODE_CONSUMED',
      entity: 'AUTH_CODE',
      entityId: record.id,
      details: `Authorization code used for application ${applicationId}.`
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
