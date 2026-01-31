require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool, init } = require('./db');

const app = express();
app.use(cors());
const bodyLimit = process.env.JSON_BODY_LIMIT || '10mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

init().catch((error) => {
  console.error('Failed to initialize database schema:', error);
  process.exit(1);
});

const PORT = process.env.API_PORT || 5174;

const generateId = (prefix) => `${prefix}${Date.now().toString().slice(-6)}`;

const PASSWORD_POLICY = {
  minLength: 8,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSpecial: true
};

const validatePasswordPolicy = (password) => {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < PASSWORD_POLICY.minLength) {
    return `Password must be at least ${PASSWORD_POLICY.minLength} characters.`;
  }
  if (PASSWORD_POLICY.requireUpper && !/[A-Z]/.test(password)) {
    return 'Password must include at least 1 uppercase letter.';
  }
  if (PASSWORD_POLICY.requireLower && !/[a-z]/.test(password)) {
    return 'Password must include at least 1 lowercase letter.';
  }
  if (PASSWORD_POLICY.requireNumber && !/\d/.test(password)) {
    return 'Password must include at least 1 number.';
  }
  if (PASSWORD_POLICY.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least 1 special character.';
  }
  return null;
};

const isBcryptHash = (value) => {
  if (typeof value !== 'string') return false;
  return /^\$2[aby]\$\d{2}\$/.test(value);
};

const hashPassword = async (password) => {
  const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
  const safeRounds = Number.isFinite(rounds) ? Math.max(8, Math.min(14, rounds)) : 10;
  return bcrypt.hash(password, safeRounds);
};

const verifyPassword = async (password, stored) => {
  if (!stored) return false;
  if (isBcryptHash(stored)) {
    return bcrypt.compare(password, stored);
  }
  return stored === password;
};

const generateStrongPassword = (length = 12) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%&*?_';

  const pick = (chars) => chars.charAt(Math.floor(Math.random() * chars.length));

  const targetLen = Math.max(PASSWORD_POLICY.minLength, length);
  const chars = [pick(upper), pick(lower), pick(numbers), pick(special)];
  const all = upper + lower + numbers + special;

  while (chars.length < targetLen) chars.push(pick(all));

  // Fisher–Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
};

const generateTempPassword = () => generateStrongPassword(12);

const generateAuthCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const addDays = (dateStr, days) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) return dateStr;
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const addMonths = (dateStr, months) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) return dateStr;
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
};

const calculateLoanTotals = (principal, rate, months, interestType = 'compound') => {
  const safePrincipal = Number(principal || 0);
  const safeRate = Number(rate || 0);
  const safeMonths = Math.max(1, Number(months || 1));
  if (!safePrincipal || !Number.isFinite(safePrincipal)) {
    return { monthlyPayment: 0, totalAmount: 0 };
  }

  if (interestType === 'simple') {
    const totalAmount = safePrincipal * (1 + (safeRate / 100) * (safeMonths / 12));
    return { monthlyPayment: totalAmount / safeMonths, totalAmount };
  }

  const monthlyRate = safeRate / 100 / 12;
  if (!monthlyRate) {
    return { monthlyPayment: safePrincipal / safeMonths, totalAmount: safePrincipal };
  }
  const factor = Math.pow(1 + monthlyRate, safeMonths);
  const monthlyPayment = (safePrincipal * monthlyRate * factor) / (factor - 1);
  return { monthlyPayment, totalAmount: monthlyPayment * safeMonths };
};

const getBorrowerKycStatus = (borrower) => {
  if (!borrower) return 'pending';
  const hasImages = Boolean(borrower.facialImage && borrower.idImage);
  return hasImages ? 'verified' : 'pending';
};

const computeEligibility = async (payload) => {
  const borrowerRows = await runQuery(
    'SELECT id, monthlyIncome, creditScore, facialImage, idImage FROM borrowers WHERE id = ? LIMIT 1',
    [payload.borrowerId]
  );
  const borrower = borrowerRows[0];
  if (!borrower) return null;

  const loanRows = await runQuery(
    'SELECT outstandingBalance, status FROM loans WHERE borrowerId = ? AND status IN ("active", "defaulted")',
    [payload.borrowerId]
  );

  const requestedAmount = Number(payload.requestedAmount || 0);
  const monthlyIncome = Number(borrower.monthlyIncome || 0);
  const annualIncome = monthlyIncome * 12;
  const totalOutstanding = loanRows.reduce((sum, l) => sum + Number(l.outstandingBalance || 0), 0);
  const incomeRatio = annualIncome > 0 ? requestedAmount / annualIncome : 1;
  const debtToIncome = annualIncome > 0 ? totalOutstanding / annualIncome : 1;

  const creditScore = Number(payload.creditScore || borrower.creditScore || 0);
  const normalizedCredit = clamp((creditScore - 300) / 550, 0, 1);
  const incomeScore = clamp(1 - incomeRatio, 0, 1);
  const dtiScore = clamp(1 - debtToIncome, 0, 1);
  const collateralScore = payload.collateralValue ? clamp(Number(payload.collateralValue || 0) / requestedAmount, 0, 1) : 0.2;

  const rawScore = (normalizedCredit * 0.5 + incomeScore * 0.2 + dtiScore * 0.2 + collateralScore * 0.1) * 100;
  const eligibilityScore = Math.round(clamp(rawScore, 0, 100));

  let riskTier = 'high';
  if (eligibilityScore >= 75 && debtToIncome <= 0.5) riskTier = 'low';
  else if (eligibilityScore >= 55) riskTier = 'medium';

  let eligibilityStatus = 'manual_review';
  if (creditScore >= 650 && debtToIncome <= 0.5) eligibilityStatus = 'eligible';
  if (creditScore < 580 || debtToIncome > 0.7) eligibilityStatus = 'ineligible';

  const kycStatus = getBorrowerKycStatus(borrower);
  const documentStatus = kycStatus === 'verified' ? 'complete' : 'missing';

  const recommendation = eligibilityStatus === 'eligible'
    ? 'Eligible based on credit score and income ratio. Proceed with standard underwriting.'
    : eligibilityStatus === 'ineligible'
    ? 'Ineligible due to risk indicators. Consider rejection or require strong collateral.'
    : 'Requires manual review for risk assessment.';

  return {
    eligibilityStatus,
    eligibilityScore,
    incomeRatio: Number(incomeRatio.toFixed(2)),
    debtToIncome: Number(debtToIncome.toFixed(2)),
    riskTier,
    kycStatus,
    documentStatus,
    recommendation
  };
};

const calculateLateFee = (paymentDate, dueDate, gracePeriodDays, penaltyRate, penaltyFlat, amount) => {
  const paidDate = paymentDate ? new Date(paymentDate) : new Date();
  const due = dueDate ? new Date(dueDate) : new Date();
  if (Number.isNaN(paidDate.getTime()) || Number.isNaN(due.getTime())) return { lateFee: 0, daysLate: 0 };

  const grace = Number(gracePeriodDays || 0);
  const effectiveDue = new Date(due);
  effectiveDue.setDate(effectiveDue.getDate() + grace);
  const daysLate = Math.max(0, Math.ceil((paidDate - effectiveDue) / (1000 * 60 * 60 * 24)));
  if (!daysLate) return { lateFee: 0, daysLate: 0 };

  const rate = Number(penaltyRate || 0) / 100;
  const flat = Number(penaltyFlat || 0);
  const base = Number(amount || 0);
  const lateFee = Math.max(0, base * rate * daysLate + flat);
  return { lateFee: Number(lateFee.toFixed(2)), daysLate };
};

const computeBorrowerScore = async (borrowerId) => {
  const borrowerRows = await runQuery(
    'SELECT id, registrationDate, monthlyIncome FROM borrowers WHERE id = ? LIMIT 1',
    [borrowerId]
  );
  const borrower = borrowerRows[0];
  if (!borrower) return null;

  const loanRows = await runQuery(
    'SELECT principalAmount, outstandingBalance, status, disbursedDate FROM loans WHERE borrowerId = ?',
    [borrowerId]
  );
  const paymentRows = await runQuery(
    `SELECT p.amount, p.paymentDate, p.dueDate, p.status
     FROM payments p
     INNER JOIN loans l ON p.loanId = l.id
     WHERE l.borrowerId = ?`,
    [borrowerId]
  );
  const applicationRows = await runQuery(
    'SELECT applicationDate FROM loan_applications WHERE borrowerId = ?',
    [borrowerId]
  );

  const totalPrincipal = loanRows.reduce((sum, l) => sum + Number(l.principalAmount || 0), 0);
  const totalOutstanding = loanRows.reduce((sum, l) => sum + Number(l.outstandingBalance || 0), 0);

  const parsedPayments = paymentRows.map(p => {
    const paymentDate = p.paymentDate ? new Date(p.paymentDate) : null;
    const dueDate = p.dueDate ? new Date(p.dueDate) : null;
    const daysLate = paymentDate && dueDate
      ? Math.floor((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    return { ...p, daysLate };
  });

  const totalPayments = parsedPayments.length;
  const onTimePayments = parsedPayments.filter(p => p.daysLate <= 0 || p.status === 'paid').length;
  const latePayments = parsedPayments.filter(p => p.daysLate > 0 || p.status === 'late').length;
  const avgLateDays = latePayments === 0
    ? 0
    : parsedPayments.filter(p => p.daysLate > 0).reduce((sum, p) => sum + p.daysLate, 0) / latePayments;

  const onTimeRatio = totalPayments === 0 ? 0.6 : onTimePayments / totalPayments;
  const lateSeverityPenalty = clamp(avgLateDays * 0.5, 0, 30);
  const defaultedCount = loanRows.filter(l => ['defaulted', 'written_off'].includes(l.status)).length;
  const defaultPenalty = clamp(defaultedCount * 20, 0, 40);
  const paymentHistoryScore = clamp(onTimeRatio * 100 - lateSeverityPenalty - defaultPenalty, 0, 100);

  const utilization = totalPrincipal === 0 ? 0 : totalOutstanding / totalPrincipal;
  const utilizationScore = clamp(100 - utilization * 100, 0, 100);

  const regDate = borrower.registrationDate ? new Date(borrower.registrationDate) : new Date();
  const monthsActive = Math.max(0, (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const creditAgeScore = clamp((monthsActive / 120) * 100, 0, 100);

  const annualIncome = Number(borrower.monthlyIncome || 0) * 12;
  const debtToIncome = annualIncome === 0 ? 1 : totalOutstanding / annualIncome;
  const totalDebtScore = clamp(100 - debtToIncome * 80, 0, 100);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentInquiries = applicationRows.filter(a => {
    const date = a.applicationDate ? new Date(a.applicationDate) : null;
    return date && date >= sixMonthsAgo;
  }).length;
  const inquiriesScore = clamp(100 - recentInquiries * 10, 0, 100);

  const weighted =
    paymentHistoryScore * 0.35 +
    utilizationScore * 0.30 +
    creditAgeScore * 0.15 +
    totalDebtScore * 0.15 +
    inquiriesScore * 0.05;

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
      `SELECT u.id, u.name, u.email, u.phone, u.address, u.dateOfBirth, u.profileImage, u.password, r.name as role
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

    if (user && await verifyPassword(password, user.password)) {
      if (!isBcryptHash(user.password)) {
        const hashed = await hashPassword(password);
        await runExecute('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
      }
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

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        dateOfBirth: user.dateOfBirth || '',
        profileImage: user.profileImage || '',
        role: user.role || 'borrower'
      });
    }

    const borrowerRows = await runQuery(
      `SELECT id, firstName, lastName, email, password, profileImage
       FROM borrowers
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const borrower = borrowerRows[0];
    if (borrower && await verifyPassword(password, borrower.password)) {
      if (!isBcryptHash(borrower.password)) {
        const hashed = await hashPassword(password);
        await runExecute(
          'UPDATE borrowers SET password = ?, passwordUpdatedAt = ? WHERE id = ?',
          [hashed, new Date().toISOString(), borrower.id]
        );
      }
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
        profileImage: borrower.profileImage || '',
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

app.get('/api/borrowers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await runQuery('SELECT * FROM borrowers WHERE id = ? LIMIT 1', [id]);
    const borrower = rows[0];
    if (!borrower) {
      return res.status(404).send('Borrower not found.');
    }
    res.json(borrower);
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
    const rows = await runQuery(
      `SELECT
         l.*,
         COALESCE(r.disbursementMethod, l.disbursementMethod) AS disbursementMethod,
         COALESCE(r.referenceNumber, l.referenceNumber) AS referenceNumber,
         COALESCE(r.receiptNumber, l.receiptNumber) AS receiptNumber,
         COALESCE(r.meta, l.disbursementMeta) AS disbursementMeta
       FROM loans l
       LEFT JOIN disbursement_receipts r ON r.loanId = l.id
       WHERE l.borrowerId = ?
       ORDER BY l.disbursedDate DESC`,
      [id]
    );
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
    const hashedPassword = await hashPassword(tempPassword);

    await runExecute(
      `INSERT INTO borrowers (
        id, firstName, lastName, email, phone, dateOfBirth, address, employment,
        monthlyIncome, bankName, accountNumber, accountType, routingNumber, facialImage, idImage, profileImage,
        password, passwordUpdatedAt, creditScore, status, registrationDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
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
        payload.facialImage || null,
        payload.idImage || null,
        payload.profileImage || null,
        hashedPassword,
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
    const hasProfileImage = payload.profileImage !== undefined;
    const profileImageValue = payload.profileImage ?? null;

    await runExecute(
      `UPDATE borrowers
       SET firstName = COALESCE(?, firstName),
           lastName = COALESCE(?, lastName),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           dateOfBirth = COALESCE(?, dateOfBirth),
           address = COALESCE(?, address),
           employment = COALESCE(?, employment),
           monthlyIncome = COALESCE(?, monthlyIncome),
           bankName = COALESCE(?, bankName),
           accountNumber = COALESCE(?, accountNumber),
           accountType = COALESCE(?, accountType),
           routingNumber = COALESCE(?, routingNumber),
           facialImage = COALESCE(?, facialImage),
           idImage = COALESCE(?, idImage),
           profileImage = CASE WHEN ? THEN ? ELSE profileImage END,
           status = COALESCE(?, status)
       WHERE id = ?` ,
      [
        payload.firstName || null,
        payload.lastName || null,
        payload.email || null,
        payload.phone || null,
        payload.dateOfBirth || null,
        payload.address || null,
        payload.employment || null,
        payload.monthlyIncome || null,
        payload.bankName || null,
        payload.accountNumber || null,
        payload.accountType || null,
        payload.routingNumber || null,
        payload.facialImage || null,
        payload.idImage || null,
        hasProfileImage,
        profileImageValue,
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
    const eligibility = await computeEligibility(payload);

    const columns = [
      'id',
      'borrowerId',
      'borrowerName',
      'loanType',
      'requestedAmount',
      'purpose',
      'collateralType',
      'collateralValue',
      'guarantorName',
      'guarantorPhone',
      'status',
      'applicationDate',
      'reviewedBy',
      'reviewDate',
      'approvedAmount',
      'interestRate',
      'termMonths',
      'creditScore',
      'eligibilityStatus',
      'eligibilityScore',
      'incomeRatio',
      'debtToIncome',
      'riskTier',
      'kycStatus',
      'documentStatus',
      'recommendation',
      'interestType',
      'gracePeriodDays',
      'penaltyRate',
      'penaltyFlat'
    ];

    const values = [
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
      payload.creditScore,
      eligibility?.eligibilityStatus || 'pending',
      eligibility?.eligibilityScore || null,
      eligibility?.incomeRatio || null,
      eligibility?.debtToIncome || null,
      eligibility?.riskTier || null,
      eligibility?.kycStatus || 'pending',
      eligibility?.documentStatus || 'missing',
      eligibility?.recommendation || null,
      payload.interestType || 'compound',
      payload.gracePeriodDays || 5,
      payload.penaltyRate || 0.5,
      payload.penaltyFlat || 0
    ];

    if (columns.length !== values.length) {
      return res.status(500).send(`Loan application insert mismatch: ${columns.length} columns vs ${values.length} values.`);
    }

    const placeholders = values.map(() => '?').join(', ');

    await runExecute(
      `INSERT INTO loan_applications (${columns.join(', ')}) VALUES (${placeholders})` ,
      values
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
           reviewDate = COALESCE(?, reviewDate),
           interestType = COALESCE(?, interestType),
           gracePeriodDays = COALESCE(?, gracePeriodDays),
           penaltyRate = COALESCE(?, penaltyRate),
           penaltyFlat = COALESCE(?, penaltyFlat),
           recommendation = COALESCE(?, recommendation)
       WHERE id = ?` ,
      [
        payload.status || null,
        payload.approvedAmount || null,
        payload.interestRate || null,
        payload.termMonths || null,
        payload.reviewedBy || null,
        payload.reviewDate || null,
        payload.interestType || null,
        payload.gracePeriodDays || null,
        payload.penaltyRate || null,
        payload.penaltyFlat || null,
        payload.recommendation || null,
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

app.get('/api/loan-approvals', async (req, res) => {
  try {
    const { applicationId } = req.query || {};
    const rows = applicationId
      ? await runQuery('SELECT * FROM loan_application_approvals WHERE applicationId = ? ORDER BY decidedAt DESC', [applicationId])
      : await runQuery('SELECT * FROM loan_application_approvals ORDER BY decidedAt DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/loan-applications/:id/approvals', async (req, res) => {
  try {
    const { id: applicationId } = req.params;
    const payload = req.body || {};
    const approvalStage = payload.approvalStage;
    const decision = payload.decision;
    if (!approvalStage || !decision) {
      return res.status(400).send('approvalStage and decision are required.');
    }

    const approvalId = payload.id || generateId('AP');
    const decidedAt = new Date().toISOString();

    await runExecute(
      `INSERT INTO loan_application_approvals (
        id, applicationId, approvalStage, decision, decidedBy, decidedById, notes, decidedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        decision = VALUES(decision),
        decidedBy = VALUES(decidedBy),
        decidedById = VALUES(decidedById),
        notes = VALUES(notes),
        decidedAt = VALUES(decidedAt)` ,
      [
        approvalId,
        applicationId,
        approvalStage,
        decision,
        payload.decidedBy || 'System',
        payload.decidedById || null,
        payload.notes || null,
        decidedAt
      ]
    );

    const approvals = await runQuery(
      'SELECT approvalStage, decision FROM loan_application_approvals WHERE applicationId = ?',
      [applicationId]
    );

    const requiredStages = ['loan_officer', 'manager'];
    const decisionMap = approvals.reduce((acc, row) => {
      acc[row.approvalStage] = row.decision;
      return acc;
    }, {});

    let status = 'under_review';
    if (approvals.some(a => a.decision === 'rejected')) {
      status = 'rejected';
    } else if (requiredStages.every(stage => decisionMap[stage] === 'approved')) {
      status = 'approved';
    }

    await runExecute(
      'UPDATE loan_applications SET status = ?, reviewedBy = ?, reviewDate = ? WHERE id = ?',
      [status, payload.decidedBy || null, new Date().toISOString().split('T')[0], applicationId]
    );

    await logAudit({
      action: decision === 'approved' ? 'APPLICATION_STAGE_APPROVED' : 'APPLICATION_STAGE_REJECTED',
      entity: 'LOAN_APPLICATION',
      entityId: applicationId,
      details: `Approval stage ${approvalStage} marked as ${decision}.`
    });

    res.json({ id: approvalId, status });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/notifications', async (req, res) => {
  try {
    const loans = await runQuery('SELECT id, borrowerId, borrowerName, nextDueDate, gracePeriodDays, status FROM loans WHERE status = "active"');
    const today = new Date();

    for (const loan of loans) {
      if (!loan.nextDueDate) continue;
      const dueDate = new Date(loan.nextDueDate);
      if (Number.isNaN(dueDate.getTime())) continue;

      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue <= 7 && daysUntilDue >= 0) {
        const referenceKey = `due-${loan.id}-${loan.nextDueDate}`;
        const id = generateId('NT');
        await runExecute(
          `INSERT IGNORE INTO notifications (
            id, borrowerId, loanId, type, title, message, severity, status, referenceKey, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
          [
            id,
            loan.borrowerId,
            loan.id,
            'payment_due',
            'Upcoming payment due',
            `Payment due in ${daysUntilDue} day(s) for ${loan.borrowerName}.`,
            daysUntilDue <= 3 ? 'warning' : 'info',
            'unread',
            referenceKey,
            new Date().toISOString()
          ]
        );
      }

      const { daysLate } = calculateLateFee(new Date().toISOString(), loan.nextDueDate, loan.gracePeriodDays || 0, 0, 0, 0);
      if (daysLate > 0) {
        const referenceKey = `overdue-${loan.id}-${loan.nextDueDate}`;
        const id = generateId('NT');
        await runExecute(
          `INSERT IGNORE INTO notifications (
            id, borrowerId, loanId, type, title, message, severity, status, referenceKey, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
          [
            id,
            loan.borrowerId,
            loan.id,
            'payment_overdue',
            'Payment overdue',
            `Payment is overdue by ${daysLate} day(s) for ${loan.borrowerName}.`,
            'critical',
            'unread',
            referenceKey,
            new Date().toISOString()
          ]
        );
      }
    }

    const rows = await runQuery('SELECT * FROM notifications ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await runExecute('UPDATE notifications SET status = "read" WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/loans', async (req, res) => {
  try {
    const rows = await runQuery(
      `SELECT
         l.*,
         COALESCE(r.disbursementMethod, l.disbursementMethod) AS disbursementMethod,
         COALESCE(r.referenceNumber, l.referenceNumber) AS referenceNumber,
         COALESCE(r.receiptNumber, l.receiptNumber) AS receiptNumber,
         COALESCE(r.meta, l.disbursementMeta) AS disbursementMeta
       FROM loans l
       LEFT JOIN disbursement_receipts r ON r.loanId = l.id
       ORDER BY l.disbursedDate DESC`
    );
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
    const interestType = payload.interestType || 'compound';
    const gracePeriodDays = Number.isFinite(Number(payload.gracePeriodDays)) ? Number(payload.gracePeriodDays) : 5;
    const penaltyRate = Number.isFinite(Number(payload.penaltyRate)) ? Number(payload.penaltyRate) : 0.5;
    const penaltyFlat = Number.isFinite(Number(payload.penaltyFlat)) ? Number(payload.penaltyFlat) : 0;
    const totals = calculateLoanTotals(payload.principalAmount, payload.interestRate, payload.termMonths, interestType);
    const monthlyPayment = payload.monthlyPayment ?? totals.monthlyPayment;
    const totalAmount = payload.totalAmount ?? totals.totalAmount;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `INSERT INTO loans (
          id, applicationId, borrowerId, borrowerName, loanType, principalAmount,
          interestRate, termMonths, monthlyPayment, totalAmount, disbursedDate,
          disbursedBy, disbursementMethod, referenceNumber, receiptNumber, disbursementMeta,
          status, outstandingBalance, nextDueDate, interestType, gracePeriodDays, penaltyRate, penaltyFlat
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          id,
          payload.applicationId,
          payload.borrowerId,
          payload.borrowerName,
          payload.loanType,
          payload.principalAmount,
          payload.interestRate,
          payload.termMonths,
          monthlyPayment,
          totalAmount,
          payload.disbursedDate,
          payload.disbursedBy,
          payload.disbursementMethod || null,
          payload.referenceNumber || null,
          payload.receiptNumber || null,
          payload.disbursementMeta || null,
          status,
          payload.outstandingBalance ?? totalAmount,
          payload.nextDueDate,
          interestType,
          gracePeriodDays,
          penaltyRate,
          penaltyFlat
        ]
      );

      // Store receipt in its own table (source of truth).
      const receiptId = generateId('DRC');
      const receiptNumber = payload.receiptNumber || `DR-${Date.now().toString().slice(-6)}`;
      const referenceNumber = payload.referenceNumber || null;

      await connection.execute(
        `INSERT INTO disbursement_receipts (
          id, loanId, receiptNumber, referenceNumber, disbursementMethod, meta, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          receiptNumber = VALUES(receiptNumber),
          referenceNumber = VALUES(referenceNumber),
          disbursementMethod = VALUES(disbursementMethod),
          meta = VALUES(meta)` ,
        [
          receiptId,
          id,
          receiptNumber,
          referenceNumber,
          payload.disbursementMethod || null,
          payload.disbursementMeta || null,
          new Date().toISOString()
        ]
      );

      await connection.execute(
        'UPDATE loan_applications SET status = ? WHERE id = ?',
        ['disbursed', payload.applicationId]
      );

      await connection.commit();
    } catch (err) {
      try {
        await connection.rollback();
      } catch {
        // ignore
      }
      throw err;
    } finally {
      connection.release();
    }

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

    const loanRows = await runQuery(
      'SELECT id, borrowerId, borrowerName, outstandingBalance, nextDueDate, status, gracePeriodDays, penaltyRate, penaltyFlat FROM loans WHERE id = ? LIMIT 1',
      [payload.loanId]
    );
    const loan = loanRows[0];
    if (!loan) {
      return res.status(400).send('Loan not found.');
    }

    const dueDate = payload.dueDate || loan.nextDueDate;
    const { lateFee, daysLate } = calculateLateFee(
      payload.paymentDate,
      dueDate,
      loan.gracePeriodDays,
      loan.penaltyRate,
      loan.penaltyFlat,
      payload.amount
    );
    const status = payload.status || (daysLate > 0 ? 'late' : 'paid');

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `INSERT INTO payments (
          id, loanId, borrowerName, amount, paymentDate, dueDate, status, lateFee,
          receivedBy, receiptNumber
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          id,
          payload.loanId,
          payload.borrowerName || loan.borrowerName,
          payload.amount,
          payload.paymentDate,
          dueDate,
          status,
          lateFee || null,
          payload.receivedBy,
          receiptNumber
        ]
      );

      const paidAmount = Number(payload.amount || 0);
      const currentOutstanding = Number(loan.outstandingBalance || 0);
      const newOutstanding = Math.max(0, currentOutstanding - paidAmount);
      const newStatus = newOutstanding === 0 ? 'completed' : loan.status;
      const nextDueDate = newOutstanding === 0 ? loan.nextDueDate : addMonths(dueDate, 1);

      await connection.execute(
        'UPDATE loans SET outstandingBalance = ?, status = ?, nextDueDate = ? WHERE id = ?',
        [newOutstanding, newStatus, nextDueDate, loan.id]
      );

      await connection.commit();
    } catch (err) {
      try {
        await connection.rollback();
      } catch {
        // ignore
      }
      throw err;
    } finally {
      connection.release();
    }

    await logAudit({
      action: 'PAYMENT_RECEIVED',
      entity: 'PAYMENT',
      entityId: id,
      userName: payload.receivedBy,
      details: `Payment received from ${payload.borrowerName} for ${payload.amount}.`
    });

    const borrowerId = loan.borrowerId;
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

app.get('/api/loan-transfers', async (req, res) => {
  try {
    const rows = await runQuery('SELECT * FROM loan_transfers ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/loan-transfers', async (req, res) => {
  try {
    const payload = req.body || {};
    const id = payload.id || generateId('LT');
    const createdAt = new Date().toISOString();
    const status = payload.status || 'pending';

    await runExecute(
      `INSERT INTO loan_transfers (
        id, loanId, fromBorrowerId, toBorrowerId, reason, status,
        requestedBy, approvedBy, effectiveDate, createdAt, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        payload.loanId,
        payload.fromBorrowerId,
        payload.toBorrowerId,
        payload.reason,
        status,
        payload.requestedBy,
        payload.approvedBy || null,
        payload.effectiveDate || null,
        createdAt,
        payload.notes || null
      ]
    );

    if (status === 'approved') {
      const borrowerRows = await runQuery('SELECT firstName, lastName FROM borrowers WHERE id = ? LIMIT 1', [payload.toBorrowerId]);
      const borrowerName = borrowerRows[0] ? `${borrowerRows[0].firstName} ${borrowerRows[0].lastName}` : null;
      await runExecute('UPDATE loans SET borrowerId = ?, borrowerName = ? WHERE id = ?', [payload.toBorrowerId, borrowerName, payload.loanId]);
    }

    await logAudit({
      action: 'LOAN_TRANSFER',
      entity: 'LOAN',
      entityId: payload.loanId,
      details: `Loan transfer ${status} from ${payload.fromBorrowerId} to ${payload.toBorrowerId}.`
    });

    res.json({ id });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/loan-restructures', async (req, res) => {
  try {
    const rows = await runQuery('SELECT * FROM loan_restructures ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/loan-restructures', async (req, res) => {
  try {
    const payload = req.body || {};
    const id = payload.id || generateId('LR');
    const createdAt = new Date().toISOString();
    const status = payload.status || 'pending';

    await runExecute(
      `INSERT INTO loan_restructures (
        id, loanId, restructureType, newTermMonths, newInterestRate, newMonthlyPayment,
        reason, status, requestedBy, approvedBy, effectiveDate, createdAt, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        payload.loanId,
        payload.restructureType,
        payload.newTermMonths || null,
        payload.newInterestRate || null,
        payload.newMonthlyPayment || null,
        payload.reason,
        status,
        payload.requestedBy,
        payload.approvedBy || null,
        payload.effectiveDate || null,
        createdAt,
        payload.notes || null
      ]
    );

    if (status === 'approved') {
      await runExecute(
        `UPDATE loans
         SET termMonths = COALESCE(?, termMonths),
             interestRate = COALESCE(?, interestRate),
             monthlyPayment = COALESCE(?, monthlyPayment)
         WHERE id = ?` ,
        [
          payload.newTermMonths || null,
          payload.newInterestRate || null,
          payload.newMonthlyPayment || null,
          payload.loanId
        ]
      );
    }

    await logAudit({
      action: 'LOAN_RESTRUCTURE',
      entity: 'LOAN',
      entityId: payload.loanId,
      details: `${payload.restructureType || 'restructure'} request ${status} for loan ${payload.loanId}.`
    });

    res.json({ id });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/loan-closures', async (req, res) => {
  try {
    const rows = await runQuery('SELECT * FROM loan_closures ORDER BY closedAt DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/loan-closures', async (req, res) => {
  try {
    const payload = req.body || {};
    const id = payload.id || generateId('LC');
    const closedAt = new Date().toISOString();
    const certificateNumber = `CC-${Date.now().toString().slice(-8)}`;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `INSERT INTO loan_closures (
          id, loanId, borrowerId, closedAt, closedBy, certificateNumber, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?)` ,
        [
          id,
          payload.loanId,
          payload.borrowerId,
          closedAt,
          payload.closedBy,
          certificateNumber,
          payload.remarks || null
        ]
      );

      await connection.execute(
        'UPDATE loans SET status = ?, outstandingBalance = ?, closureCertificateNumber = ?, closedDate = ? WHERE id = ?',
        ['completed', 0, certificateNumber, closedAt.split('T')[0], payload.loanId]
      );

      await connection.commit();
    } catch (err) {
      try {
        await connection.rollback();
      } catch {
        // ignore
      }
      throw err;
    } finally {
      connection.release();
    }

    await logAudit({
      action: 'LOAN_CLOSED',
      entity: 'LOAN',
      entityId: payload.loanId,
      details: `Loan closed with certificate ${certificateNumber}.`
    });

    res.json({ id, certificateNumber });
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
      `SELECT u.id, u.name, u.email, u.phone, u.address, u.dateOfBirth, u.profileImage, u.createdAt, u.status, u.archivedAt, COALESCE(r.name, 'borrower') as role
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

    const policyError = validatePasswordPolicy(payload.password);
    if (policyError) {
      return res.status(400).send(policyError);
    }
    const hashedPassword = await hashPassword(payload.password);

    await runExecute(
      `INSERT INTO users (id, name, email, phone, address, dateOfBirth, profileImage, password, createdAt, status, archivedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        payload.name,
        payload.email,
        payload.phone || null,
        payload.address || null,
        payload.dateOfBirth || null,
        payload.profileImage || null,
        hashedPassword,
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

    const hasArchivedAt = payload.archivedAt !== undefined;
    const hasProfileImage = payload.profileImage !== undefined;
    const profileImageValue = payload.profileImage ?? null;

    let passwordValue = null;
    if (typeof payload.password === 'string' && payload.password.length > 0) {
      const policyError = validatePasswordPolicy(payload.password);
      if (policyError) {
        return res.status(400).send(policyError);
      }
      passwordValue = await hashPassword(payload.password);
    }

    await runExecute(
      `UPDATE users
       SET name = COALESCE(?, name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           address = COALESCE(?, address),
           dateOfBirth = COALESCE(?, dateOfBirth),
           profileImage = CASE WHEN ? THEN ? ELSE profileImage END,
           password = COALESCE(?, password),
           status = COALESCE(?, status),
           archivedAt = CASE WHEN ? THEN ? ELSE archivedAt END
       WHERE id = ?` ,
      [
        payload.name || null,
        payload.email || null,
        payload.phone || null,
        payload.address || null,
        payload.dateOfBirth || null,
        hasProfileImage,
        profileImageValue,
        passwordValue,
        payload.status || null,
        hasArchivedAt,
        hasArchivedAt ? payload.archivedAt : null,
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
    const hashedPassword = await hashPassword(tempPassword);
    await runExecute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
    res.json({ tempPassword });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/users/change-password', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body || {};
    if (!email || !currentPassword || !newPassword) {
      return res.status(400).send('Email, current password, and new password are required.');
    }

    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) {
      return res.status(400).send(policyError);
    }

    const rows = await runQuery('SELECT id, password FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];
    if (!user || !(await verifyPassword(currentPassword, user.password))) {
      return res.status(401).send('Invalid credentials.');
    }

    const hashedPassword = await hashPassword(newPassword);
    await runExecute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);

    await logAudit({
      action: 'USER_PASSWORD_CHANGED',
      entity: 'USER',
      entityId: user.id,
      details: `User ${user.id} changed password.`
    });

    res.json({ ok: true });
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
    const hashedPassword = await hashPassword(tempPassword);

    if (rows.length) {
      await runExecute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, rows[0].id]);
      return res.json({ tempPassword, created: false });
    }

    const userId = generateId('US');
    const createdAt = new Date().toISOString();
    await runExecute(
      'INSERT INTO users (id, name, email, password, createdAt, status, archivedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, name, email, hashedPassword, createdAt, 'active', null]
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
    if (!borrower || !(await verifyPassword(password, borrower.password))) {
      return res.status(401).send('Invalid credentials.');
    }

    if (!isBcryptHash(borrower.password)) {
      const hashed = await hashPassword(password);
      await runExecute(
        'UPDATE borrowers SET password = ?, passwordUpdatedAt = ? WHERE id = ?',
        [hashed, new Date().toISOString(), borrower.id]
      );
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

    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) {
      return res.status(400).send(policyError);
    }

    const rows = await runQuery('SELECT id, password FROM borrowers WHERE email = ? LIMIT 1', [email]);
    const borrower = rows[0];
    if (!borrower || !(await verifyPassword(currentPassword, borrower.password))) {
      return res.status(401).send('Invalid credentials.');
    }

    const hashedPassword = await hashPassword(newPassword);
    await runExecute(
      'UPDATE borrowers SET password = ?, passwordUpdatedAt = ? WHERE id = ?',
      [hashedPassword, new Date().toISOString(), borrower.id]
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
    const hashedPassword = await hashPassword(tempPassword);
    await runExecute(
      'UPDATE borrowers SET password = ?, passwordUpdatedAt = ? WHERE id = ?',
      [hashedPassword, new Date().toISOString(), borrower.id]
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
