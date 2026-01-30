import { formatPhp } from './currency';
import type { Loan } from './types';

import logoUrl from '../../logo.png';

export interface DisbursementReceiptMeta {
  disbursementTime?: string;
  disbursementMethod?: string;
  bankName?: string;
  accountHolderName?: string;
  accountNumberLast4?: string;
  checkNumber?: string;
  checkDate?: string;
  digitalWalletProvider?: string;
  walletId?: string;
  processingOfficer?: string;
  notes?: string;
}

export interface DisbursementReceiptData {
  loanId: string;
  applicationId: string;
  borrowerName: string;
  loanType: string;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  totalAmount: number;
  disbursedDate: string;
  disbursedBy: string;
  receiptNumber?: string | null;
  referenceNumber?: string | null;
  meta?: DisbursementReceiptMeta;
}

export const parseDisbursementMeta = (value: string | null | undefined): DisbursementReceiptMeta | undefined => {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed as DisbursementReceiptMeta;
  } catch {
    // ignore
  }
  return undefined;
};

export const buildReceiptDataFromLoan = (loan: Loan): DisbursementReceiptData => {
  const meta = parseDisbursementMeta(loan.disbursementMeta);
  return {
    loanId: loan.id,
    applicationId: loan.applicationId,
    borrowerName: loan.borrowerName,
    loanType: loan.loanType,
    principalAmount: Number(loan.principalAmount || 0),
    interestRate: Number(loan.interestRate || 0),
    termMonths: Number(loan.termMonths || 0),
    monthlyPayment: Number(loan.monthlyPayment || 0),
    totalAmount: Number(loan.totalAmount || 0),
    disbursedDate: loan.disbursedDate,
    disbursedBy: loan.disbursedBy,
    receiptNumber: loan.receiptNumber ?? undefined,
    referenceNumber: loan.referenceNumber ?? undefined,
    meta
  };
};

const escapeHtml = (value: unknown) => {
  const text = String(value ?? '');
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatPercent = (value: number) => `${Number(value || 0).toFixed(2)}%`;

export const buildDisbursementReceiptHtml = (
  data: DisbursementReceiptData,
  options?: { baseHref?: string }
) => {
  const meta = data.meta || {};
  const now = new Date();
  const printedAt = now.toLocaleString();

  const methodLabel = (meta.disbursementMethod || '').replace(/_/g, ' ').toUpperCase();
  const amount = formatPhp(data.principalAmount);

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Receipt No.', value: escapeHtml(data.receiptNumber || '-') },
    { label: 'Reference', value: escapeHtml(data.referenceNumber || '-') },
    { label: 'Loan ID', value: escapeHtml(data.loanId) },
    { label: 'Application ID', value: escapeHtml(data.applicationId) },
    { label: 'Borrower', value: escapeHtml(data.borrowerName) },
    { label: 'Loan Type', value: escapeHtml(data.loanType) },
    { label: 'Disbursement Date', value: escapeHtml(data.disbursedDate) + (meta.disbursementTime ? ` ${escapeHtml(meta.disbursementTime)}` : '') },
    { label: 'Disbursed By', value: escapeHtml(meta.processingOfficer || data.disbursedBy) },
    { label: 'Method', value: escapeHtml(methodLabel || '-') },
    { label: 'Amount Disbursed', value: escapeHtml(amount) },
    { label: 'Interest Rate', value: escapeHtml(formatPercent(data.interestRate)) },
    { label: 'Term', value: escapeHtml(`${data.termMonths} months`) },
    { label: 'Monthly Payment', value: escapeHtml(formatPhp(data.monthlyPayment)) },
    { label: 'Total Payable', value: escapeHtml(formatPhp(data.totalAmount)) }
  ];

  if (meta.bankName || meta.accountNumberLast4) {
    rows.push({ label: 'Bank', value: escapeHtml(meta.bankName || '-') });
    rows.push({ label: 'Account', value: escapeHtml(meta.accountNumberLast4 ? `***${meta.accountNumberLast4}` : '-') });
  }

  if (meta.checkNumber) rows.push({ label: 'Check No.', value: escapeHtml(meta.checkNumber) });
  if (meta.checkDate) rows.push({ label: 'Check Date', value: escapeHtml(meta.checkDate) });

  if (meta.digitalWalletProvider || meta.walletId) {
    rows.push({ label: 'Wallet Provider', value: escapeHtml(meta.digitalWalletProvider || '-') });
    rows.push({ label: 'Wallet ID', value: escapeHtml(meta.walletId || '-') });
  }

  if (meta.notes) rows.push({ label: 'Notes', value: escapeHtml(meta.notes) });

  const rowsHtml = rows
    .map(
      (r) => `
        <div class="row">
          <div class="label">${r.label}</div>
          <div class="value">${r.value}</div>
        </div>`
    )
    .join('');

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${options?.baseHref ? `<base href="${escapeHtml(options.baseHref)}" />` : ''}
  <title>Disbursement Receipt</title>
  <style>
    :root { --border: #e5e7eb; --muted: #6b7280; --text: #111827; }
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: var(--text); margin: 0; padding: 24px; background: #f9fafb; }
    .paper { max-width: 720px; margin: 0 auto; background: white; border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
    .header { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 1px dashed var(--border); }
    .logo { width: 40px; height: 40px; object-fit: contain; }
    .title { font-size: 18px; font-weight: 700; margin: 0; }
    .subtitle { font-size: 12px; color: var(--muted); margin: 0; }
    .rows { margin-top: 16px; }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .row:last-child { border-bottom: none; }
    .label { font-size: 12px; color: var(--muted); }
    .value { font-size: 14px; font-weight: 600; text-align: right; }
    .footer { margin-top: 14px; font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; gap: 12px; }

    @media print {
      body { background: white; padding: 0; }
      .paper { border: none; border-radius: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="paper">
    <div class="header">
      <img class="logo" src="${logoUrl}" alt="Logo" />
      <div>
        <p class="title">Loan Management System</p>
        <p class="subtitle">Disbursement Receipt</p>
      </div>
    </div>

    <div class="rows">
      ${rowsHtml}
    </div>

    <div class="footer">
      <div>Printed: ${escapeHtml(printedAt)}</div>
      <div>This receipt is system-generated.</div>
    </div>
  </div>
</body>
</html>`;
};

export const printDisbursementReceipt = (data: DisbursementReceiptData) => {
  const html = buildDisbursementReceiptHtml(data, { baseHref: window.location.origin });

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.setAttribute('aria-hidden', 'true');

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      // ignore
    }
  };

  iframe.onload = () => {
    try {
      const win = iframe.contentWindow;
      if (!win) return;
      win.focus();
      win.print();
    } finally {
      // Give the print dialog a moment before removing.
      window.setTimeout(cleanup, 1000);
    }
  };

  document.body.appendChild(iframe);
  iframe.srcdoc = html;
};
