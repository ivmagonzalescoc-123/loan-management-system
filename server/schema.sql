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
);

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
);

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
  nextDueDate VARCHAR(20) NOT NULL
);

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
);

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
);

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
);

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

INSERT IGNORE INTO roles (name) VALUES ('admin');
INSERT IGNORE INTO roles (name) VALUES ('loan_officer');
INSERT IGNORE INTO roles (name) VALUES ('cashier');
INSERT IGNORE INTO roles (name) VALUES ('borrower');
INSERT IGNORE INTO roles (name) VALUES ('auditor');

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  createdAt VARCHAR(30) NOT NULL,
  status TINYINT(1) NOT NULL DEFAULT 1,
  archivedAt VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS user_roles (
  userId VARCHAR(20) NOT NULL,
  roleId INT NOT NULL,
  PRIMARY KEY (userId, roleId)
);

CREATE TABLE IF NOT EXISTS login_logs (
  id VARCHAR(20) PRIMARY KEY,
  userId VARCHAR(20),
  email VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL,
  ipAddress VARCHAR(50) NOT NULL,
  userAgent VARCHAR(255),
  createdAt VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS authorization_codes (
  id VARCHAR(20) PRIMARY KEY,
  applicationId VARCHAR(20) NOT NULL,
  code VARCHAR(20) NOT NULL,
  createdBy VARCHAR(20) NOT NULL,
  createdRole VARCHAR(50) NOT NULL,
  createdAt VARCHAR(30) NOT NULL,
  expiresAt VARCHAR(30) NOT NULL,
  usedAt VARCHAR(30)
);
