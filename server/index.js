require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool, init } = require('./db');

const app = express();
app.use(cors());
const bodyLimit = process.env.JSON_BODY_LIMIT || '10mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const KYC_UPLOADS_DIR = path.join(UPLOADS_DIR, 'kyc');
try {
  fs.mkdirSync(KYC_UPLOADS_DIR, { recursive: true });
} catch {
  // ignore
}
app.use('/uploads', express.static(UPLOADS_DIR));

const PORT = process.env.API_PORT || 5174;
const PRIVACY_NOTICE_VERSION = process.env.PRIVACY_NOTICE_VERSION || 'v1-2026-02-05';

const COMPANY_NAME = process.env.COMPANY_NAME || process.env.APP_NAME || 'Loan Management System';

const generateId = (prefix) => `${prefix}${Date.now().toString().slice(-6)}`;

const maskEmail = (email) => {
  const value = String(email || '').trim();
  const atIndex = value.indexOf('@');
  if (atIndex <= 0) return value ? '***' : '';
  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  const maskedLocal = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}***`;
  const domainParts = domain.split('.');
  const domainName = domainParts[0] || '';
  const domainTld = domainParts.slice(1).join('.') || '';
  const maskedDomainName = domainName.length <= 2 ? `${domainName[0] || '*'}*` : `${domainName.slice(0, 2)}***`;
  const maskedDomain = domainTld ? `${maskedDomainName}.${domainTld}` : maskedDomainName;
  return `${maskedLocal}@${maskedDomain}`;
};


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

const toMoney = (value) => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
};

const normalizeNameForMatch = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getNameTokens = (value) => normalizeNameForMatch(value).split(' ').filter(Boolean);

const pickLongestToken = (tokens) => {
  let best = '';
  for (const t of tokens) {
    if (t.length > best.length) best = t;
  }
  return best;
};

const doesIdNameMatchBorrower = ({ borrowerFirstName, borrowerLastName, idFullName }) => {
  const idNorm = normalizeNameForMatch(idFullName);
  if (!idNorm) return false;

  const firstTokens = getNameTokens(borrowerFirstName);
  const lastTokens = getNameTokens(borrowerLastName);

  const firstMain = firstTokens[0] || '';
  if (!firstMain || firstMain.length < 2) return false;
  if (!idNorm.includes(firstMain)) return false;

  const lastMain = pickLongestToken(lastTokens.filter(t => t.length >= 3));
  if (lastMain && !idNorm.includes(lastMain)) return false;

  return true;
};

const getBorrowerCreditLimit = async (borrowerId) => {
  const borrowerRows = await runQuery(
    'SELECT id, monthlyIncome, monthlyExpenses, kycStatus FROM borrowers WHERE id = ? LIMIT 1',
    [borrowerId]
  );
  const borrower = borrowerRows[0];
  if (!borrower) return null;

  const monthlyIncome = toMoney(borrower.monthlyIncome);
  const monthlyExpenses = toMoney(borrower.monthlyExpenses);
  const disposable = Math.max(0, monthlyIncome - monthlyExpenses);

  const completedRows = await runQuery(
    'SELECT COUNT(*) as count FROM loans WHERE borrowerId = ? AND status = "completed"',
    [borrowerId]
  );
  const completedCount = Number(completedRows[0]?.count || 0);

  const outstandingRows = await runQuery(
    'SELECT SUM(outstandingBalance) as totalOutstanding FROM loans WHERE borrowerId = ? AND status IN ("active", "defaulted")',
    [borrowerId]
  );
  const totalOutstanding = toMoney(outstandingRows[0]?.totalOutstanding || 0);

  const baseIncomeMultiplier = Number(process.env.CREDIT_BASE_INCOME_MULTIPLIER || 1.0);
  const stepMultiplier = Number(process.env.CREDIT_STEP_MULTIPLIER || 0.25);
  const maxIncomeMultiplier = Number(process.env.CREDIT_MAX_INCOME_MULTIPLIER || 2.0);
  const disposableMultiplier = Number(process.env.CREDIT_DISPOSABLE_MULTIPLIER || 6.0);

  const tier = Math.max(0, completedCount); // increments after each fully paid loan
  const incomeMultiplier = clamp(baseIncomeMultiplier + tier * stepMultiplier, baseIncomeMultiplier, maxIncomeMultiplier);

  const capByIncome = Math.max(0, monthlyIncome * incomeMultiplier);
  const capByDisposable = Math.max(0, disposable * disposableMultiplier);
  const maxCredit = toMoney(Math.min(capByIncome, capByDisposable));

  const availableCredit = toMoney(Math.max(0, maxCredit - totalOutstanding));
  return {
    borrowerId,
    kycStatus: borrower.kycStatus || 'pending',
    monthlyIncome,
    monthlyExpenses,
    completedLoans: completedCount,
    incomeMultiplier: toMoney(incomeMultiplier),
    capByIncome: toMoney(capByIncome),
    capByDisposable: toMoney(capByDisposable),
    maxCredit,
    totalOutstanding,
    availableCredit
  };
};

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
  if (borrower.kycStatus) return borrower.kycStatus;
  const hasImages = Boolean(borrower.facialImage && borrower.idImage);
  return hasImages ? 'verified' : 'pending';
};

const computeEligibility = async (payload) => {
  const borrowerRows = await runQuery(
    'SELECT id, monthlyIncome, creditScore, facialImage, idImage, kycStatus FROM borrowers WHERE id = ? LIMIT 1',
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

const runDelinquencyProcessing = async () => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const loans = await runQuery(
    'SELECT id, borrowerId, borrowerName, outstandingBalance, nextDueDate, status, gracePeriodDays, penaltyRate, penaltyFlat FROM loans WHERE status = "active"'
  );
  if (!loans.length) return;

  const lastPayments = await runQuery(
    'SELECT loanId, MAX(paymentDate) as lastPaymentDate FROM payments GROUP BY loanId'
  );
  const lastPaymentMap = new Map(lastPayments.map((row) => [row.loanId, row.lastPaymentDate]));

  for (const loan of loans) {
    if (!loan.nextDueDate) continue;
    const { daysLate } = calculateLateFee(
      todayStr,
      loan.nextDueDate,
      loan.gracePeriodDays || 0,
      loan.penaltyRate || 0,
      loan.penaltyFlat || 0,
      loan.outstandingBalance || 0
    );
    if (daysLate <= 0) continue;

    const penaltyDate = todayStr;
    const existingPenalty = await runQuery(
      'SELECT COUNT(*) as count FROM loan_penalties WHERE loanId = ?',
      [loan.id]
    );
    const penaltyCount = Number(existingPenalty[0]?.count || 0);

    const rate = Number(loan.penaltyRate || 0) / 100;
    const flat = Number(loan.penaltyFlat || 0);
    const base = Number(loan.outstandingBalance || 0);
    let penaltyAmount = 0;
    if (rate > 0 && base > 0) {
      penaltyAmount += base * rate;
    }
    if (penaltyCount === 0 && flat > 0) {
      penaltyAmount += flat;
    }
    penaltyAmount = Number(penaltyAmount.toFixed(2));

    if (penaltyAmount > 0) {
      const insertPenalty = await runExecute(
        `INSERT IGNORE INTO loan_penalties (id, loanId, penaltyDate, daysLate, amount, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)` ,
        [generateId('PN'), loan.id, penaltyDate, daysLate, penaltyAmount, new Date().toISOString()]
      );

      if (insertPenalty?.affectedRows) {
        await runExecute(
          'UPDATE loans SET outstandingBalance = outstandingBalance + ? WHERE id = ?',
          [penaltyAmount, loan.id]
        );
      }
    }

    const lastPaymentDate = lastPaymentMap.get(loan.id) || null;
    const delinquencyThresholds = [60, 90, 180];
    for (const threshold of delinquencyThresholds) {
      if (daysLate < threshold) continue;
      const referenceKey = `loan-${loan.id}-delinquent-${threshold}`;
      const severity = threshold >= 180 ? 'critical' : 'warning';
      const message = threshold === 60
        ? 'Your account is considered severely delinquent after missing two billing cycles.'
        : threshold === 90
        ? 'Collections activity intensifies after three missed billing cycles.'
        : 'Your account is being forwarded to collections due to extended delinquency.';

      await createNotification({
        borrowerId: loan.borrowerId,
        loanId: loan.id,
        targetRole: 'borrower',
        type: 'payment_overdue',
        title: `${threshold} Days Delinquent`,
        message,
        severity,
        referenceKey: `${referenceKey}-borrower`
      });

      await createNotification({
        targetRole: 'manager',
        loanId: loan.id,
        type: 'payment_overdue',
        title: `${threshold} Days Delinquent`,
        message: `${loan.borrowerName} is ${threshold} days delinquent.`,
        severity,
        referenceKey: `${referenceKey}-manager`
      });

      await createNotification({
        targetRole: 'admin',
        loanId: loan.id,
        type: 'payment_overdue',
        title: `${threshold} Days Delinquent`,
        message: `${loan.borrowerName} is ${threshold} days delinquent.`,
        severity,
        referenceKey: `${referenceKey}-admin`
      });
    }

    if (daysLate >= 180) {
      await runExecute(
        `INSERT IGNORE INTO collections (id, loanId, borrowerId, borrowerName, status, reason, daysDelinquent, createdAt, forwardedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          generateId('CL'),
          loan.id,
          loan.borrowerId,
          loan.borrowerName,
          'pending',
          '180+ days delinquent without payment',
          daysLate,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );

      await runExecute('UPDATE loans SET status = ? WHERE id = ?', ['defaulted', loan.id]);

      await logAudit({
        action: 'COLLECTIONS_FORWARDED',
        entity: 'LOAN',
        entityId: loan.id,
        details: `Loan forwarded to collections after ${daysLate} days delinquent. Last payment: ${lastPaymentDate || 'none'}.`
      });
    }
  }
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

const OTP_POLICY = {
  codeLength: 6,
  ttlMinutes: Number(process.env.PASSWORD_RESET_OTP_TTL_MINUTES || 10),
  maxAttempts: Number(process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS || 5),
  maxPerHour: Number(process.env.PASSWORD_RESET_OTP_MAX_PER_HOUR || 3),
  resetTokenTtlMinutes: Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 15)
};

const getOtpDeliveryMode = () => {
  const value = String(process.env.PASSWORD_RESET_OTP_DELIVERY || 'email').trim().toLowerCase();
  return value === 'inline' ? 'inline' : 'email';
};

const isValidEmail = (value) => {
  const email = String(value || '').trim().toLowerCase();
  if (!email || email.length > 150) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const generateOtpCode = () => {
  const code = crypto.randomInt(0, 10 ** OTP_POLICY.codeLength)
    .toString()
    .padStart(OTP_POLICY.codeLength, '0');
  return code;
};

const sha256Hex = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const findAccountByEmail = async (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  const userRows = await runQuery('SELECT id, email, name FROM users WHERE email = ? LIMIT 1', [normalized]);
  if (userRows[0]) {
    return { accountType: 'user', id: userRows[0].id, email: userRows[0].email, displayName: userRows[0].name || 'User' };
  }
  const borrowerRows = await runQuery(
    'SELECT id, email, firstName, lastName FROM borrowers WHERE email = ? LIMIT 1',
    [normalized]
  );
  if (borrowerRows[0]) {
    const b = borrowerRows[0];
    return {
      accountType: 'borrower',
      id: b.id,
      email: b.email,
      displayName: `${b.firstName || ''} ${b.lastName || ''}`.trim() || 'Borrower'
    };
  }
  return null;
};

const sanitizeBorrowerRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  const { password, passwordUpdatedAt, ...safe } = row;
  return safe;
};

const refreshEligibilityForBorrowerApplications = async (borrowerId) => {
  if (!borrowerId) return { updated: 0 };
  const applications = await runQuery(
    `SELECT id, requestedAmount, collateralValue
     FROM loan_applications
     WHERE borrowerId = ?
       AND status IN ("pending", "under_review")`,
    [borrowerId]
  );

  let updated = 0;
  for (const application of applications) {
    const eligibility = await computeEligibility({
      borrowerId,
      requestedAmount: application.requestedAmount,
      collateralValue: application.collateralValue
    });
    if (!eligibility) continue;

    const result = await runExecute(
      `UPDATE loan_applications
       SET eligibilityStatus = ?,
           eligibilityScore = ?,
           incomeRatio = ?,
           debtToIncome = ?,
           riskTier = ?,
           kycStatus = ?,
           documentStatus = ?,
           recommendation = ?
       WHERE id = ?`,
      [
        eligibility.eligibilityStatus || 'pending',
        eligibility.eligibilityScore || null,
        eligibility.incomeRatio || null,
        eligibility.debtToIncome || null,
        eligibility.riskTier || null,
        eligibility.kycStatus || 'pending',
        eligibility.documentStatus || 'missing',
        eligibility.recommendation || null,
        application.id
      ]
    );
    updated += Number(result?.affectedRows || 0);
  }

  return { updated };
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

const createNotification = async ({
  borrowerId = null,
  loanId = null,
  actorName = null,
  actorProfileImage = null,
  targetRole = null,
  type,
  title,
  message,
  severity = 'info',
  status = 'unread',
  referenceKey = null
}) => {
  try {
    const id = generateId('NT');
    const createdAt = new Date().toISOString();
    const ref = referenceKey || id;
    await runExecute(
      `INSERT IGNORE INTO notifications (
        id, borrowerId, loanId, actorName, actorProfileImage, targetRole, type, title, message, severity, status, referenceKey, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        borrowerId,
        loanId,
        actorName,
        actorProfileImage,
        targetRole,
        type,
        title,
        message,
        severity,
        status,
        ref,
        createdAt
      ]
    );
  } catch {
    // swallow notification errors
  }
};

const getUserProfileByName = async (name) => {
  if (!name) return null;
  try {
    const rows = await runQuery(
      'SELECT name, profileImage FROM users WHERE name = ? LIMIT 1',
      [name]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/login', async (req, res) => {
  try {
    const { password } = req.body || {};
    const email = String((req.body || {}).email || '').trim().toLowerCase();
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

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).send('Please enter a valid email address.');
    }

    const deliveryMode = getOtpDeliveryMode();
    if (deliveryMode !== 'inline') {
      return res.status(400).send('Email delivery is disabled. Set PASSWORD_RESET_OTP_DELIVERY=inline.');
    }

    const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
    const nowIso = new Date().toISOString();
    const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    try {
      const recentRows = await runQuery(
        'SELECT COUNT(*) as count FROM password_reset_requests WHERE email = ? AND createdAt >= ?',
        [email, oneHourAgoIso]
      );
      const recentCount = Number(recentRows[0]?.count || 0);
      if (recentCount >= OTP_POLICY.maxPerHour) {
        return res.json({ ok: true, emailMasked: maskEmail(email) });
      }
    } catch {
      // if table not available (misconfigured DB), fall through to generic ok
    }

    const account = await findAccountByEmail(email);
    if (!account) {
      // avoid account enumeration
      return res.json({ ok: true, emailMasked: maskEmail(email) });
    }

    const code = generateOtpCode();
    const otpHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_POLICY.ttlMinutes * 60 * 1000).toISOString();
    const requestId = generateId('PR');

    await runExecute(
      `INSERT INTO password_reset_requests (
        id, email, accountType, accountId, otpHash, attempts, createdAt, expiresAt, usedAt,
        ipAddress, resetTokenHash, resetTokenExpiresAt, resetTokenUsedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        requestId,
        email,
        account.accountType,
        account.id,
        otpHash,
        0,
        nowIso,
        expiresAt,
        null,
        ipAddress,
        null,
        null,
        null
      ]
    );

    return res.json({ ok: true, emailMasked: maskEmail(email), otp: code, delivery: 'inline' });
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const otp = String((req.body || {}).otp || '').trim();
    if (!isValidEmail(email) || !otp || otp.length > 20) {
      return res.status(400).send('Invalid request.');
    }

    const nowIso = new Date().toISOString();
    const rows = await runQuery(
      `SELECT id, otpHash, attempts, expiresAt, usedAt, accountType, accountId
       FROM password_reset_requests
       WHERE email = ? AND usedAt IS NULL
       ORDER BY createdAt DESC
       LIMIT 1`,
      [email]
    );
    const request = rows[0];
    if (!request || !request.expiresAt || String(request.expiresAt) < nowIso) {
      return res.status(400).send('Invalid or expired code.');
    }

    const attempts = Number(request.attempts || 0);
    if (attempts >= OTP_POLICY.maxAttempts) {
      return res.status(400).send('Invalid or expired code.');
    }

    const ok = await bcrypt.compare(otp, request.otpHash);
    if (!ok) {
      const nextAttempts = attempts + 1;
      await runExecute(
        'UPDATE password_reset_requests SET attempts = ? WHERE id = ?',
        [nextAttempts, request.id]
      );
      return res.status(400).send('Invalid or expired code.');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = sha256Hex(resetToken);
    const resetTokenExpiresAt = new Date(Date.now() + OTP_POLICY.resetTokenTtlMinutes * 60 * 1000).toISOString();
    const usedAt = nowIso;

    await runExecute(
      `UPDATE password_reset_requests
       SET usedAt = ?, resetTokenHash = ?, resetTokenExpiresAt = ?, resetTokenUsedAt = NULL
       WHERE id = ?`,
      [usedAt, resetTokenHash, resetTokenExpiresAt, request.id]
    );

    return res.json({
      ok: true,
      emailMasked: maskEmail(email),
      resetToken,
      resetTokenExpiresAt
    });
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const resetToken = String((req.body || {}).resetToken || '').trim();
    const newPassword = String((req.body || {}).newPassword || '');
    if (!isValidEmail(email) || !resetToken || resetToken.length < 20) {
      return res.status(400).send('Invalid request.');
    }

    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) {
      return res.status(400).send(policyError);
    }

    const nowIso = new Date().toISOString();
    const tokenHash = sha256Hex(resetToken);
    const rows = await runQuery(
      `SELECT id, accountType, accountId, resetTokenHash, resetTokenExpiresAt, resetTokenUsedAt
       FROM password_reset_requests
       WHERE email = ?
       ORDER BY createdAt DESC
       LIMIT 5`,
      [email]
    );

    const match = rows.find(r =>
      r &&
      String(r.resetTokenHash || '') === tokenHash &&
      r.resetTokenUsedAt == null &&
      r.resetTokenExpiresAt &&
      String(r.resetTokenExpiresAt) >= nowIso
    );

    if (!match) {
      return res.status(400).send('Invalid or expired reset token.');
    }

    const hashedPassword = await hashPassword(newPassword);
    if (match.accountType === 'user') {
      await runExecute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, match.accountId]);
      await logAudit({
        userId: match.accountId,
        userName: email,
        action: 'USER_PASSWORD_RESET',
        entity: 'USER',
        entityId: match.accountId,
        details: `Password reset via OTP for ${email}.`
      });
    } else {
      await runExecute(
        'UPDATE borrowers SET password = ?, passwordUpdatedAt = ? WHERE id = ?',
        [hashedPassword, new Date().toISOString(), match.accountId]
      );
      await logAudit({
        userId: match.accountId,
        userName: email,
        action: 'BORROWER_PASSWORD_RESET',
        entity: 'BORROWER',
        entityId: match.accountId,
        details: `Password reset via OTP for ${email}.`
      });
    }

    await runExecute(
      'UPDATE password_reset_requests SET resetTokenUsedAt = ? WHERE id = ?',
      [nowIso, match.id]
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.post('/api/borrowers/register', async (req, res) => {
  try {
    const payload = req.body || {};
    const firstName = String(payload.firstName || '').trim();
    const lastName = String(payload.lastName || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const phone = String(payload.phone || '').trim();
    const password = String(payload.password || '');

    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).send('firstName, lastName, email, phone, and password are required.');
    }
    if (payload?.consentGiven !== true) {
      return res.status(400).send('Borrower consent is required (consentGiven: true).');
    }

    const passwordError = validatePasswordPolicy(password);
    if (passwordError) {
      return res.status(400).send(passwordError);
    }

    const existingUser = await runQuery('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existingUser.length) {
      return res.status(409).send('Email is already registered.');
    }
    const existingBorrower = await runQuery('SELECT id FROM borrowers WHERE email = ? LIMIT 1', [email]);
    if (existingBorrower.length) {
      return res.status(409).send('Email is already registered.');
    }

    const id = generateId('BR');
    const registrationDate = new Date().toISOString().split('T')[0];
    const creditScore = 650;
    const status = 'active';
    const hashedPassword = await hashPassword(password);
    const consentAt = new Date().toISOString();
    const consentPurpose = String(
      payload.consentPurpose || 'Loan processing, internal credit scoring, and account management'
    ).slice(0, 255);
    const consentNoticeVersion = String(payload.consentNoticeVersion || PRIVACY_NOTICE_VERSION).slice(0, 50);

    await runExecute(
      `INSERT INTO borrowers (
        id, firstName, lastName, email, phone, dateOfBirth, address, employment,
        monthlyIncome, monthlyExpenses, facialImage, idImage, profileImage,
        password, passwordUpdatedAt, consentGiven, consentAt, consentPurpose, consentNoticeVersion,
        kycStatus, creditScore, status, registrationDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        firstName,
        lastName,
        email,
        phone,
        '',
        '',
        '',
        0,
        0,
        null,
        null,
        null,
        hashedPassword,
        new Date().toISOString(),
        1,
        consentAt,
        consentPurpose,
        consentNoticeVersion,
        'pending',
        creditScore,
        status,
        registrationDate
      ]
    );

    await logAudit({
      userId: id,
      userName: `${firstName} ${lastName}`,
      action: 'BORROWER_SELF_REGISTERED',
      entity: 'BORROWER',
      entityId: id,
      details: `Borrower self-registration completed for ${email}.`
    });

    return res.json({
      id,
      name: `${firstName} ${lastName}`,
      email,
      phone,
      role: 'borrower'
    });
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('dup') || String(error?.message || '').toLowerCase().includes('unique')) {
      return res.status(409).send('Email is already registered.');
    }
    return res.status(500).send(error.message);
  }
});

const allowedKycReviewerRoles = new Set(['admin', 'manager', 'loan_officer']);

const kycStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const borrowerId = String(req.params?.id || 'unknown');
    const dir = path.join(KYC_UPLOADS_DIR, borrowerId);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 10) || '.jpg';
    const base = file.fieldname === 'selfie' ? 'selfie' : file.fieldname === 'id' ? 'id' : 'file';
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});

const kycUpload = multer({
  storage: kycStorage,
  limits: { fileSize: Number(process.env.KYC_MAX_FILE_BYTES || 5 * 1024 * 1024) },
  fileFilter: (req, file, cb) => {
    const ok = (file.mimetype || '').startsWith('image/');
    cb(ok ? null : new Error('Only image uploads are allowed.'), ok);
  }
});

app.get('/api/borrowers/:id/credit-limit', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = await getBorrowerCreditLimit(id);
    if (!limit) return res.status(404).send('Borrower not found.');
    res.json(limit);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/borrowers/:id/kyc', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await runQuery(
      'SELECT id, kycStatus, kycSubmittedAt, kycReviewedAt, kycReviewedBy, kycReviewedRole, kycRejectionReason, monthlyIncome, monthlyExpenses, facialImage, idImage FROM borrowers WHERE id = ? LIMIT 1',
      [id]
    );
    const borrower = rows[0];
    if (!borrower) return res.status(404).send('Borrower not found.');
    res.json({
      borrowerId: borrower.id,
      kycStatus: borrower.kycStatus || 'pending',
      kycSubmittedAt: borrower.kycSubmittedAt || null,
      kycReviewedAt: borrower.kycReviewedAt || null,
      kycReviewedBy: borrower.kycReviewedBy || null,
      kycReviewedRole: borrower.kycReviewedRole || null,
      kycRejectionReason: borrower.kycRejectionReason || null,
      monthlyIncome: Number(borrower.monthlyIncome || 0),
      monthlyExpenses: Number(borrower.monthlyExpenses || 0),
      selfieUrl: borrower.facialImage || null,
      idUrl: borrower.idImage || null
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/borrowers/:id/kyc', kycUpload.fields([
  { name: 'selfie', maxCount: 1 },
  { name: 'id', maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    const borrowerRows = await runQuery('SELECT id, email, firstName, lastName FROM borrowers WHERE id = ? LIMIT 1', [id]);
    const borrower = borrowerRows[0];
    if (!borrower) return res.status(404).send('Borrower not found.');

    const firstName = String(req.body?.firstName || borrower.firstName || '').trim();
    const middleName = String(req.body?.middleName || '').trim();
    const lastName = String(req.body?.lastName || borrower.lastName || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const alternatePhone = String(req.body?.alternatePhone || '').trim();
    const dateOfBirth = String(req.body?.dateOfBirth || '').trim();
    const gender = String(req.body?.gender || '').trim();
    const maritalStatus = String(req.body?.maritalStatus || '').trim();
    const nationality = String(req.body?.nationality || '').trim();

    const idFullName = String(req.body?.idFullName || '').trim();
    const idType = String(req.body?.idType || '').trim();
    const idNumber = String(req.body?.idNumber || '').trim();

    const addressLine1 = String(req.body?.addressLine1 || '').trim();
    const city = String(req.body?.city || '').trim();
    const state = String(req.body?.state || '').trim();
    const zipCode = String(req.body?.zipCode || '').trim();
    const country = String(req.body?.country || '').trim();
    const residenceType = String(req.body?.residenceType || '').trim();
    const yearsAtResidenceRaw = String(req.body?.yearsAtResidence || '').trim();
    const yearsAtResidence = yearsAtResidenceRaw === '' ? null : Number.parseInt(yearsAtResidenceRaw, 10);

    const employmentStatus = String(req.body?.employmentStatus || '').trim();
    const employerName = String(req.body?.employerName || '').trim();
    const jobTitle = String(req.body?.jobTitle || '').trim();
    const industryType = String(req.body?.industryType || '').trim();
    const employmentDuration = String(req.body?.employmentDuration || '').trim();
    const workAddress = String(req.body?.workAddress || '').trim();
    const workPhone = String(req.body?.workPhone || '').trim();

    const monthlyIncome = toMoney(req.body?.monthlyIncome);
    const monthlyExpenses = toMoney(req.body?.monthlyExpenses);
    const otherIncomeSource = String(req.body?.otherIncomeSource || '').trim();
    const otherIncomeAmountRaw = String(req.body?.otherIncomeAmount || '').trim();
    const otherIncomeAmount = otherIncomeAmountRaw === '' ? null : toMoney(otherIncomeAmountRaw);
    const existingDebtsRaw = String(req.body?.existingDebts || '').trim();
    const existingDebts = existingDebtsRaw === '' ? null : toMoney(existingDebtsRaw);

    const bankName = String(req.body?.bankName || '').trim();
    const accountNumber = String(req.body?.accountNumber || '').trim();
    const accountType = String(req.body?.accountType || '').trim();
    const routingNumber = String(req.body?.routingNumber || '').trim();

    const reference1Name = String(req.body?.reference1Name || '').trim();
    const reference1Phone = String(req.body?.reference1Phone || '').trim();
    const reference1Relationship = String(req.body?.reference1Relationship || '').trim();
    const reference2Name = String(req.body?.reference2Name || '').trim();
    const reference2Phone = String(req.body?.reference2Phone || '').trim();
    const reference2Relationship = String(req.body?.reference2Relationship || '').trim();
    const emergencyContactName = String(req.body?.emergencyContactName || '').trim();
    const emergencyContactPhone = String(req.body?.emergencyContactPhone || '').trim();
    const emergencyContactRelationship = String(req.body?.emergencyContactRelationship || '').trim();

    if (!firstName || !lastName) {
      return res.status(400).send('firstName and lastName are required.');
    }
    if (!phone) {
      return res.status(400).send('phone is required.');
    }
    if (!dateOfBirth) {
      return res.status(400).send('dateOfBirth is required.');
    }
    if (!gender || !maritalStatus || !nationality) {
      return res.status(400).send('gender, maritalStatus, and nationality are required.');
    }
    if (!idFullName || !idType || !idNumber) {
      return res.status(400).send('idFullName, idType, and idNumber are required.');
    }
    if (!doesIdNameMatchBorrower({ borrowerFirstName: firstName, borrowerLastName: lastName, idFullName })) {
      return res.status(400).send('ID name does not match your registered first/last name. Please update your name or enter the exact full name as shown on your ID.');
    }

    if (!addressLine1 || !city || !state || !zipCode || !country) {
      return res.status(400).send('addressLine1, city, state, zipCode, and country are required.');
    }
    if (!residenceType) {
      return res.status(400).send('residenceType is required.');
    }
    if (yearsAtResidence === null || !Number.isFinite(yearsAtResidence) || yearsAtResidence < 0) {
      return res.status(400).send('yearsAtResidence is required and must be >= 0.');
    }

    if (!employmentStatus) {
      return res.status(400).send('employmentStatus is required.');
    }
    const noEmployerNeeded = new Set(['unemployed', 'student', 'retired', 'homemaker']);
    if (!noEmployerNeeded.has(employmentStatus)) {
      if (!employerName || !jobTitle || !employmentDuration) {
        return res.status(400).send('employerName, jobTitle, and employmentDuration are required for the selected employment status.');
      }
    }

    if (!monthlyIncome || monthlyIncome <= 0) {
      return res.status(400).send('monthlyIncome is required and must be > 0.');
    }
    if (monthlyExpenses < 0) {
      return res.status(400).send('monthlyExpenses must be >= 0.');
    }
    if (!bankName || !accountNumber || !accountType) {
      return res.status(400).send('bankName, accountNumber, and accountType are required.');
    }
    if (!reference1Name || !reference1Phone || !reference1Relationship) {
      return res.status(400).send('Reference 1 (name, phone, relationship) is required.');
    }
    if (!reference2Name || !reference2Phone || !reference2Relationship) {
      return res.status(400).send('Reference 2 (name, phone, relationship) is required.');
    }
    if (!emergencyContactName || !emergencyContactPhone || !emergencyContactRelationship) {
      return res.status(400).send('Emergency contact (name, phone, relationship) is required.');
    }

    const selfieFile = req.files?.selfie?.[0];
    const idFile = req.files?.id?.[0];
    if (!selfieFile || !idFile) {
      return res.status(400).send('Both selfie and id images are required.');
    }

    const selfieUrl = `/uploads/kyc/${id}/${path.basename(selfieFile.path)}`;
    const idUrl = `/uploads/kyc/${id}/${path.basename(idFile.path)}`;
    const submittedAt = new Date().toISOString();

    const address = [addressLine1, city, state, zipCode, country].filter(Boolean).join(', ');
    const employment = [jobTitle, employerName, employmentStatus].filter(Boolean).join(' - ');

    await runExecute(
      `UPDATE borrowers
       SET firstName = ?,
           middleName = ?,
           lastName = ?,
           phone = ?,
           alternatePhone = ?,
           dateOfBirth = ?,
           gender = ?,
           maritalStatus = ?,
           nationality = ?,
           idFullName = ?,
           idType = ?,
           idNumber = ?,
           address = ?,
           addressLine1 = ?,
           city = ?,
           state = ?,
           zipCode = ?,
           country = ?,
           residenceType = ?,
           yearsAtResidence = ?,
           employment = ?,
           employmentStatus = ?,
           employerName = ?,
           jobTitle = ?,
           industryType = ?,
           employmentDuration = ?,
           workAddress = ?,
           workPhone = ?,
           monthlyIncome = ?,
           otherIncomeSource = ?,
           otherIncomeAmount = ?,
           monthlyExpenses = ?,
           existingDebts = ?,
           bankName = ?,
           accountNumber = ?,
           accountType = ?,
           routingNumber = ?,
           reference1Name = ?,
           reference1Phone = ?,
           reference1Relationship = ?,
           reference2Name = ?,
           reference2Phone = ?,
           reference2Relationship = ?,
           emergencyContactName = ?,
           emergencyContactPhone = ?,
           emergencyContactRelationship = ?,
           facialImage = ?,
           idImage = ?,
           kycStatus = 'submitted',
           kycSubmittedAt = ?,
           kycReviewedAt = NULL,
           kycReviewedBy = NULL,
           kycReviewedRole = NULL,
           kycRejectionReason = NULL
       WHERE id = ?` ,
      [
        firstName,
        middleName || null,
        lastName,
        phone,
        alternatePhone || null,
        dateOfBirth,
        gender,
        maritalStatus,
        nationality,
        idFullName,
        idType,
        idNumber,
        address,
        addressLine1,
        city,
        state,
        zipCode,
        country,
        residenceType,
        yearsAtResidence,
        employment || 'Not provided',
        employmentStatus,
        employerName || null,
        jobTitle || null,
        industryType || null,
        employmentDuration || null,
        workAddress || null,
        workPhone || null,
        monthlyIncome,
        otherIncomeSource || null,
        otherIncomeAmount,
        monthlyExpenses,
        existingDebts,
        bankName,
        accountNumber,
        accountType,
        routingNumber || null,
        reference1Name,
        reference1Phone,
        reference1Relationship,
        reference2Name,
        reference2Phone,
        reference2Relationship,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship,
        selfieUrl,
        idUrl,
        submittedAt,
        id
      ]
    );

    await logAudit({
      userId: id,
      userName: id,
      action: 'KYC_SUBMITTED',
      entity: 'BORROWER',
      entityId: id,
      details: 'Borrower KYC submitted.'
    });

    // Notify admin, manager, and loan officers about the new KYC submission
    try {
      const borrowerName = `${firstName} ${lastName}`.trim();
      await createNotification({
        borrowerId: id,
        targetRole: 'admin',
        type: 'kyc_submitted',
        title: 'KYC submitted',
        message: `${borrowerName} submitted KYC and requires review.`,
        severity: 'info',
        referenceKey: `kyc-${id}-admin`
      });

      await createNotification({
        borrowerId: id,
        targetRole: 'manager',
        type: 'kyc_submitted',
        title: 'KYC submitted',
        message: `${borrowerName} submitted KYC and requires review.`,
        severity: 'info',
        referenceKey: `kyc-${id}-manager`
      });

      await createNotification({
        borrowerId: id,
        targetRole: 'loan_officer',
        type: 'kyc_submitted',
        title: 'KYC submitted',
        message: `${borrowerName} submitted KYC and requires review.`,
        severity: 'info',
        referenceKey: `kyc-${id}-loan_officer`
      });
    } catch (e) {
      // swallow notification errors so KYC submission isn't blocked
    }

    res.json({ ok: true, borrowerId: id, kycStatus: 'submitted' });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/borrowers/:id/kyc/review', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const decision = String(payload.decision || '').toLowerCase();
    const reviewedBy = String(payload.reviewedBy || '').trim();
    const reviewedRole = String(payload.reviewedRole || '').trim();
    const reason = String(payload.reason || '').trim();

    if (!reviewedBy || !reviewedRole) {
      return res.status(400).send('reviewedBy and reviewedRole are required.');
    }
    if (!allowedKycReviewerRoles.has(reviewedRole)) {
      return res.status(403).send('Only admin, manager, or loan_officer can review KYC.');
    }
    if (decision !== 'verified' && decision !== 'rejected') {
      return res.status(400).send('decision must be "verified" or "rejected".');
    }
    if (decision === 'rejected' && !reason) {
      return res.status(400).send('reason is required when rejecting KYC.');
    }

    const reviewedAt = new Date().toISOString();
    await runExecute(
      `UPDATE borrowers
       SET kycStatus = ?,
           kycReviewedAt = ?,
           kycReviewedBy = ?,
           kycReviewedRole = ?,
           kycRejectionReason = ?
       WHERE id = ?` ,
      [decision, reviewedAt, reviewedBy, reviewedRole, decision === 'rejected' ? reason : null, id]
    );

    await logAudit({
      userId: reviewedBy,
      userName: reviewedBy,
      action: decision === 'verified' ? 'KYC_VERIFIED' : 'KYC_REJECTED',
      entity: 'BORROWER',
      entityId: id,
      details: decision === 'verified' ? 'Borrower KYC verified.' : `Borrower KYC rejected: ${reason}`
    });

    res.json({ ok: true, borrowerId: id, kycStatus: decision });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/borrowers', async (req, res) => {
  try {
    const rows = await runQuery('SELECT * FROM borrowers ORDER BY registrationDate DESC');
    res.json(rows.map(sanitizeBorrowerRow));
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
    res.json(sanitizeBorrowerRow(borrower));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/borrowers/:id/consent', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await runQuery(
      'SELECT id, consentGiven, consentAt, consentPurpose, consentNoticeVersion FROM borrowers WHERE id = ? LIMIT 1',
      [id]
    );
    const borrower = rows[0];
    if (!borrower) {
      return res.status(404).send('Borrower not found.');
    }
    res.json({
      borrowerId: borrower.id,
      consentGiven: Boolean(borrower.consentGiven),
      consentAt: borrower.consentAt || null,
      consentPurpose: borrower.consentPurpose || null,
      consentNoticeVersion: borrower.consentNoticeVersion || null
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/borrowers/:id/consent', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    const consentGiven = payload.consentGiven === true;
    if (!consentGiven) {
      return res.status(400).send('consentGiven must be true to record consent.');
    }

    const consentAt = new Date().toISOString();
    const consentPurpose = String(
      payload.consentPurpose || 'Loan processing, internal credit scoring, and account management'
    ).slice(0, 255);
    const consentNoticeVersion = String(payload.consentNoticeVersion || PRIVACY_NOTICE_VERSION).slice(0, 50);

    const existing = await runQuery('SELECT id FROM borrowers WHERE id = ? LIMIT 1', [id]);
    if (!existing[0]) {
      return res.status(404).send('Borrower not found.');
    }

    await runExecute(
      `UPDATE borrowers
       SET consentGiven = 1,
           consentAt = ?,
           consentPurpose = ?,
           consentNoticeVersion = ?
       WHERE id = ?`,
      [consentAt, consentPurpose, consentNoticeVersion, id]
    );

    await logAudit({
      action: 'BORROWER_CONSENT_RECORDED',
      entity: 'BORROWER',
      entityId: id,
      details: `Borrower consent recorded. Notice: ${consentNoticeVersion}. Purpose: ${consentPurpose}.`
    });

    res.json({ ok: true, borrowerId: id, consentAt, consentNoticeVersion });
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

    try {
      await refreshEligibilityForBorrowerApplications(id);
    } catch {
      // non-blocking
    }

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
    if (payload?.consentGiven !== true) {
      return res.status(400).send('Borrower consent is required (consentGiven: true).');
    }
    const id = payload.id || generateId('BR');
    const registrationDate = payload.registrationDate || new Date().toISOString().split('T')[0];
    const creditScore = payload.creditScore || 650;
    const status = payload.status || 'active';
    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);
    const consentAt = new Date().toISOString();
    const consentPurpose = String(
      payload.consentPurpose || 'Loan processing, internal credit scoring, and account management'
    ).slice(0, 255);
    const consentNoticeVersion = String(payload.consentNoticeVersion || PRIVACY_NOTICE_VERSION).slice(0, 50);

    const email = String(payload.email || '').trim().toLowerCase();
    const existingUser = await runQuery('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existingUser.length) {
      return res.status(409).send('Email is already registered.');
    }
    const existingBorrower = await runQuery('SELECT id FROM borrowers WHERE email = ? LIMIT 1', [email]);
    if (existingBorrower.length) {
      return res.status(409).send('Email is already registered.');
    }

    await runExecute(
      `INSERT INTO borrowers (
        id, firstName, lastName, email, phone, dateOfBirth, address, employment,
        monthlyIncome, monthlyExpenses, bankName, accountNumber, accountType, routingNumber, facialImage, idImage, profileImage,
        password, passwordUpdatedAt, consentGiven, consentAt, consentPurpose, consentNoticeVersion,
        kycStatus,
        creditScore, status, registrationDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        payload.firstName,
        payload.lastName,
        email,
        payload.phone,
        payload.dateOfBirth,
        payload.address,
        payload.employment,
        payload.monthlyIncome,
        payload.monthlyExpenses || 0,
        payload.bankName || null,
        payload.accountNumber || null,
        payload.accountType || null,
        payload.routingNumber || null,
        payload.facialImage || null,
        payload.idImage || null,
        payload.profileImage || null,
        hashedPassword,
        new Date().toISOString(),
        1,
        consentAt,
        consentPurpose,
        consentNoticeVersion,
        payload.kycStatus || 'pending',
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
    if (String(error?.message || '').toLowerCase().includes('dup') || String(error?.message || '').toLowerCase().includes('unique')) {
      return res.status(409).send('Email is already registered.');
    }
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
           monthlyExpenses = COALESCE(?, monthlyExpenses),
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
        payload.monthlyExpenses || null,
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
    const rows = await runQuery(
      `SELECT la.*, b.creditScore AS currentCreditScore
       FROM loan_applications la
       LEFT JOIN borrowers b ON la.borrowerId = b.id
       ORDER BY la.applicationDate DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/loan-applications', async (req, res) => {
  try {
    const payload = req.body;

    if (payload?.consentAcknowledged !== true) {
      return res.status(400).send('Consent acknowledgment is required (consentAcknowledged: true).');
    }

     if (!payload?.borrowerId || !payload?.borrowerName || !payload?.loanType) {
      return res.status(400).send('borrowerId, borrowerName, and loanType are required.');
    }
    if (payload.requestedAmount === undefined || payload.requestedAmount === null) {
      return res.status(400).send('requestedAmount is required.');
    }

    const requestedAmount = Number(payload.requestedAmount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).send('requestedAmount must be a valid number greater than 0.');
    }

    const borrowerRows = await runQuery(
      'SELECT id, creditScore, consentGiven, kycStatus, monthlyIncome, monthlyExpenses FROM borrowers WHERE id = ? LIMIT 1',
      [payload.borrowerId]
    );
    const borrower = borrowerRows[0];
    if (!borrower) {
      return res.status(400).send('Borrower not found.');
    }

    if (!borrower.consentGiven) {
      return res.status(400).send('Borrower consent is required before creating a loan application.');
    }

    if ((borrower.kycStatus || 'pending') !== 'verified') {
      return res.status(400).send('KYC verification is required before applying for a loan.');
    }

    const limit = await getBorrowerCreditLimit(payload.borrowerId);
    if (!limit) {
      return res.status(400).send('Borrower not found.');
    }
    if (!limit.monthlyIncome || limit.monthlyIncome <= 0) {
      return res.status(400).send('Borrower monthly income must be provided as part of KYC.');
    }
    if (requestedAmount > Number(limit.availableCredit || 0)) {
      return res.status(400).send(
        `Requested amount exceeds available credit. Available credit: ${limit.availableCredit}`
      );
    }

    const resolvedCreditScore = Number(payload.creditScore ?? borrower.creditScore ?? 0);
    if (!Number.isFinite(resolvedCreditScore) || resolvedCreditScore <= 0) {
      return res.status(400).send('creditScore is required and must be a valid number.');
    }

    const id = payload.id || generateId('LA');
    const applicationDate = payload.applicationDate || new Date().toISOString().split('T')[0];
    const status = payload.status || 'pending';
    const eligibility = await computeEligibility({
      ...payload,
      requestedAmount,
      creditScore: resolvedCreditScore
    });

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
      requestedAmount,
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
      resolvedCreditScore,
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

    await createNotification({
      borrowerId: payload.borrowerId,
      targetRole: 'borrower',
      type: 'approval_pending',
      title: 'Application submitted',
      message: `Your ${payload.loanType} loan application has been submitted for review.`,
      severity: 'info',
      referenceKey: `app-${id}-borrower-submitted`
    });

    await createNotification({
      targetRole: 'loan_officer',
      type: 'approval_requested',
      title: 'New loan application',
      message: `${payload.borrowerName} submitted a ${payload.loanType} loan application.`,
      severity: 'info',
      referenceKey: `app-${id}-loan-officer-review`
    });

    await createNotification({
      targetRole: 'manager',
      type: 'approval_requested',
      title: 'New loan application',
      message: `${payload.borrowerName} submitted a ${payload.loanType} loan application.`,
      severity: 'info',
      referenceKey: `app-${id}-manager-review`
    });

    await createNotification({
      targetRole: 'admin',
      type: 'approval_requested',
      title: 'New loan application',
      message: `${payload.borrowerName} submitted a ${payload.loanType} loan application.`,
      severity: 'info',
      referenceKey: `app-${id}-admin-review`
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

    const applicationRows = await runQuery(
      'SELECT borrowerId, borrowerName, loanType FROM loan_applications WHERE id = ? LIMIT 1',
      [id]
    );
    const application = applicationRows[0];

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

      if (application?.borrowerId) {
        if (payload.status === 'approved') {
          await createNotification({
            borrowerId: application.borrowerId,
            targetRole: 'borrower',
            type: 'loan_approved',
            title: 'Loan approved',
            message: `Your ${application.loanType} loan application has been approved.`,
            severity: 'info',
            referenceKey: `app-${id}-borrower-approved`
          });

          await createNotification({
            targetRole: 'loan_officer',
            type: 'approval_completed',
            title: 'Loan approved',
            message: `${application.borrowerName} was approved for ${application.loanType}.`,
            severity: 'info',
            referenceKey: `app-${id}-loanofficer-approved`
          });

          await createNotification({
            targetRole: 'manager',
            type: 'approval_completed',
            title: 'Loan approved',
            message: `${application.borrowerName} was approved for ${application.loanType}.`,
            severity: 'info',
            referenceKey: `app-${id}-manager-approved`
          });

          await createNotification({
            targetRole: 'cashier',
            type: 'approval_completed',
            title: 'Loan approved for disbursement',
            message: `${application.borrowerName} is ready for disbursement processing.`,
            severity: 'info',
            referenceKey: `app-${id}-cashier-disburse-ready`
          });

          await createNotification({
            targetRole: 'admin',
            type: 'approval_completed',
            title: 'Loan approved',
            message: `${application.borrowerName} was approved for ${application.loanType}.`,
            severity: 'info',
            referenceKey: `app-${id}-admin-approved`
          });
        }

        if (payload.status === 'rejected') {
          await createNotification({
            borrowerId: application.borrowerId,
            targetRole: 'borrower',
            type: 'loan_rejected',
            title: 'Loan application rejected',
            message: `Your ${application.loanType} loan application was not approved.`,
            severity: 'warning',
            referenceKey: `app-${id}-borrower-rejected`
          });
        }
      }
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

    const applicationRows = await runQuery(
      'SELECT borrowerId, borrowerName, loanType, requestedAmount FROM loan_applications WHERE id = ? LIMIT 1',
      [applicationId]
    );
    const application = applicationRows[0];

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

    const actorProfile = await getUserProfileByName(payload.decidedBy);

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

    if (application) {
      if (decision === 'approved' && approvalStage === 'loan_officer') {
        await createNotification({
          actorName: payload.decidedBy || null,
          actorProfileImage: actorProfile?.profileImage || null,
          targetRole: 'manager',
          type: 'approval_requested',
          title: 'Manager approval required',
          message: `${application.borrowerName} (${application.loanType}) is ready for manager review.`,
          severity: 'info',
          referenceKey: `app-${applicationId}-manager-approval`
        });
      }

      if (decision === 'approved' && approvalStage === 'manager' && status === 'approved') {
        await createNotification({
          actorName: payload.decidedBy || null,
          actorProfileImage: actorProfile?.profileImage || null,
          targetRole: 'cashier',
          type: 'approval_completed',
          title: 'Ready for disbursement',
          message: `Loan for ${application.borrowerName} is approved and ready for disbursement.`,
          severity: 'info',
          referenceKey: `app-${applicationId}-cashier-disbursement`
        });

        await createNotification({
          actorName: payload.decidedBy || null,
          actorProfileImage: actorProfile?.profileImage || null,
          targetRole: 'loan_officer',
          type: 'approval_completed',
          title: 'Loan approved',
          message: `${application.borrowerName} was approved for ${application.loanType}.`,
          severity: 'info',
          referenceKey: `app-${applicationId}-loanofficer-approved`
        });

        await createNotification({
          actorName: payload.decidedBy || null,
          actorProfileImage: actorProfile?.profileImage || null,
          targetRole: 'manager',
          type: 'approval_completed',
          title: 'Loan approved',
          message: `${application.borrowerName} was approved for ${application.loanType}.`,
          severity: 'info',
          referenceKey: `app-${applicationId}-manager-approved`
        });

        await createNotification({
          actorName: payload.decidedBy || null,
          actorProfileImage: actorProfile?.profileImage || null,
          borrowerId: application.borrowerId,
          targetRole: 'borrower',
          type: 'loan_approved',
          title: 'Loan approved',
          message: `Your ${application.loanType} loan application has been approved.`,
          severity: 'info',
          referenceKey: `app-${applicationId}-borrower-approved`
        });

        await createNotification({
          actorName: payload.decidedBy || null,
          actorProfileImage: actorProfile?.profileImage || null,
          targetRole: 'admin',
          type: 'approval_completed',
          title: 'Loan approved',
          message: `${application.borrowerName} was approved for ${application.loanType}.`,
          severity: 'info',
          referenceKey: `app-${applicationId}-admin-approved`
        });
      }

      if (decision === 'rejected') {
        await createNotification({
          actorName: payload.decidedBy || null,
          actorProfileImage: actorProfile?.profileImage || null,
          borrowerId: application.borrowerId,
          targetRole: 'borrower',
          type: 'loan_rejected',
          title: 'Loan application rejected',
          message: `Your ${application.loanType} loan application was not approved.`,
          severity: 'warning',
          referenceKey: `app-${applicationId}-borrower-rejected`
        });

        await createNotification({
          actorName: payload.decidedBy || null,
          actorProfileImage: actorProfile?.profileImage || null,
          targetRole: 'admin',
          type: 'loan_rejected',
          title: 'Loan application rejected',
          message: `${application.borrowerName} was rejected for ${application.loanType}.`,
          severity: 'warning',
          referenceKey: `app-${applicationId}-admin-rejected`
        });
      }
    }

    res.json({ id: approvalId, status });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/notifications', async (req, res) => {
  try {
    await runDelinquencyProcessing();
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
            id, borrowerId, loanId, targetRole, type, title, message, severity, status, referenceKey, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
          [
            id,
            loan.borrowerId,
            loan.id,
            'borrower',
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
            id, borrowerId, loanId, targetRole, type, title, message, severity, status, referenceKey, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
          [
            id,
            loan.borrowerId,
            loan.id,
            'borrower',
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

app.post('/api/alerts/remind', async (req, res) => {
  try {
    const { borrowerId, loanId, monthsDue } = req.body || {};
    if (!borrowerId || !loanId) {
      return res.status(400).send('Missing borrowerId or loanId.');
    }

    const loanRows = await runQuery(
      'SELECT id, borrowerId, borrowerName, nextDueDate FROM loans WHERE id = ? LIMIT 1',
      [loanId]
    );
    const loan = loanRows[0];
    if (!loan) {
      return res.status(404).send('Loan not found.');
    }

    const dueLabel = monthsDue ? `${monthsDue} month(s)` : 'several months';
    await createNotification({
      borrowerId: loan.borrowerId,
      loanId: loan.id,
      targetRole: 'borrower',
      type: 'payment_due',
      title: 'Payment reminder',
      message: `Your loan payment is overdue by ${dueLabel}. Please settle your balance.`,
      severity: 'warning',
      referenceKey: `manual-reminder-${loan.id}-${monthsDue || 'na'}-${Date.now()}`
    });

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

    const disburserProfile = await getUserProfileByName(payload.disbursedBy);

    await createNotification({
      borrowerId: payload.borrowerId,
      loanId: id,
      actorName: payload.disbursedBy || null,
      actorProfileImage: disburserProfile?.profileImage || null,
      targetRole: 'borrower',
      type: 'loan_disbursed',
      title: 'Loan disbursed',
      message: `Your loan has been disbursed. Amount: ${payload.principalAmount}.`,
      severity: 'info',
      referenceKey: `loan-${id}-disbursed`
    });

    await createNotification({
      targetRole: 'cashier',
      loanId: id,
      actorName: payload.disbursedBy || null,
      actorProfileImage: disburserProfile?.profileImage || null,
      type: 'loan_disbursed',
      title: 'Loan disbursed',
      message: `Loan for ${payload.borrowerName} was disbursed.`,
      severity: 'info',
      referenceKey: `loan-${id}-cashier-disbursed`
    });

    await createNotification({
      targetRole: 'loan_officer',
      loanId: id,
      actorName: payload.disbursedBy || null,
      actorProfileImage: disburserProfile?.profileImage || null,
      type: 'loan_disbursed',
      title: 'Loan disbursed',
      message: `Loan for ${payload.borrowerName} was disbursed.`,
      severity: 'info',
      referenceKey: `loan-${id}-loanofficer-disbursed`
    });

    await createNotification({
      targetRole: 'manager',
      loanId: id,
      actorName: payload.disbursedBy || null,
      actorProfileImage: disburserProfile?.profileImage || null,
      type: 'loan_disbursed',
      title: 'Loan disbursed',
      message: `Loan for ${payload.borrowerName} was disbursed.`,
      severity: 'info',
      referenceKey: `loan-${id}-manager-disbursed`
    });

    await createNotification({
      targetRole: 'admin',
      loanId: id,
      actorName: payload.disbursedBy || null,
      actorProfileImage: disburserProfile?.profileImage || null,
      type: 'loan_disbursed',
      title: 'Loan disbursed',
      message: `Loan for ${payload.borrowerName} was disbursed.`,
      severity: 'info',
      referenceKey: `loan-${id}-admin-disbursed`
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

    await createNotification({
      borrowerId: loan.borrowerId,
      loanId: loan.id,
      targetRole: 'borrower',
      type: 'payment_received',
      title: status === 'late' ? 'Late payment received' : 'Payment received',
      message: `Payment of ${payload.amount} was recorded${status === 'late' ? ' (late)' : ''} for ${loan.borrowerName}.`,
      severity: status === 'late' ? 'warning' : 'info',
      referenceKey: `payment-${id}-received`
    });

    await createNotification({
      targetRole: 'manager',
      loanId: loan.id,
      type: 'payment_received',
      title: 'Payment received',
      message: `${loan.borrowerName} made a payment of ${payload.amount}.`,
      severity: status === 'late' ? 'warning' : 'info',
      referenceKey: `payment-${id}-manager`
    });

    await createNotification({
      targetRole: 'cashier',
      loanId: loan.id,
      type: 'payment_received',
      title: 'Payment received',
      message: `${loan.borrowerName} made a payment of ${payload.amount}.`,
      severity: status === 'late' ? 'warning' : 'info',
      referenceKey: `payment-${id}-cashier`
    });

    await createNotification({
      targetRole: 'admin',
      loanId: loan.id,
      type: 'payment_received',
      title: 'Payment received',
      message: `${loan.borrowerName} made a payment of ${payload.amount}.`,
      severity: status === 'late' ? 'warning' : 'info',
      referenceKey: `payment-${id}-admin`
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
        ['inactive', 0, certificateNumber, closedAt.split('T')[0], payload.loanId]
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

app.get('/api/system-logs', async (req, res) => {
  try {
    const rows = await runQuery(
      `SELECT
         l.id,
         l.userId,
         l.email,
         l.status,
         l.ipAddress,
         l.userAgent,
         l.createdAt,
         COALESCE(u.name, CONCAT(b.firstName, ' ', b.lastName), l.email) AS name,
         CASE
           WHEN b.id IS NOT NULL THEN 'borrower'
           WHEN roles.role IS NOT NULL THEN roles.role
           ELSE 'unknown'
         END AS role
       FROM login_logs l
       LEFT JOIN users u ON l.userId = u.id
       LEFT JOIN (
         SELECT ur.userId, MIN(r.name) AS role
         FROM user_roles ur
         JOIN roles r ON r.id = ur.roleId
         GROUP BY ur.userId
       ) roles ON roles.userId = u.id
       LEFT JOIN borrowers b ON l.userId = b.id
       ORDER BY l.createdAt DESC`
    );
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


const startServer = async () => {
  await init();
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to initialize database schema:', error);
  process.exit(1);
});
