import logoUrl from '../../logo.png';

const NOTICE_VERSION = import.meta.env.VITE_PRIVACY_NOTICE_VERSION || 'v1-2026-02-05';
const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || 'Loan Management System';
const COMPANY_ADDRESS = import.meta.env.VITE_COMPANY_ADDRESS || 'Address: ________________________________';
const COMPANY_CONTACT = import.meta.env.VITE_COMPANY_CONTACT || 'Contact: ________________________________';
const COMPANY_EMAIL = import.meta.env.VITE_COMPANY_EMAIL || '';
const COMPANY_WEBSITE = import.meta.env.VITE_COMPANY_WEBSITE || '';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function printBorrowerRegistrationForm(options?: {
  organizationName?: string;
  organizationAddress?: string;
  organizationContact?: string;
  organizationEmail?: string;
  organizationWebsite?: string;
  organizationLogoUrl?: string;
  noticeVersion?: string;
}) {
  const organizationName = options?.organizationName || COMPANY_NAME;
  const organizationAddress = options?.organizationAddress || COMPANY_ADDRESS;
  const organizationContact = options?.organizationContact || COMPANY_CONTACT;
  const organizationEmail = options?.organizationEmail || COMPANY_EMAIL;
  const organizationWebsite = options?.organizationWebsite || COMPANY_WEBSITE;
  const organizationLogoUrl = options?.organizationLogoUrl || logoUrl;
  const noticeVersion = options?.noticeVersion || NOTICE_VERSION;

  const today = new Date();
  const printedAt = today.toLocaleString();

  const title = `${organizationName} — Borrower Registration Form`;

  const headerRight = [
    organizationAddress,
    organizationContact,
    organizationEmail ? `Email: ${organizationEmail}` : '',
    organizationWebsite ? `Website: ${organizationWebsite}` : ''
  ].filter(Boolean);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
    .muted { color: #6b7280; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .brand { display: flex; align-items: flex-start; gap: 12px; }
    .logo { width: 54px; height: 54px; object-fit: contain; }
    h1 { font-size: 18px; margin: 0; }
    h2 { font-size: 13px; margin: 18px 0 8px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    .meta { font-size: 11px; text-align: right; }
    .meta div { margin-bottom: 2px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px 14px; }
    .field { font-size: 11px; }
    .label { display: block; margin-bottom: 4px; font-weight: 600; }
    .line { border: 1px solid #9ca3af; height: 26px; border-radius: 4px; }
    .line.tall { height: 42px; }
    .line.xl { height: 64px; }
    .note { font-size: 10.5px; line-height: 1.35; }
    .checkbox-row { display: flex; align-items: center; gap: 8px; }
    .checkbox { width: 14px; height: 14px; border: 1px solid #9ca3af; border-radius: 2px; }
    .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; }
    .sign { height: 34px; border-bottom: 1px solid #111827; }
    .sign-label { font-size: 10px; margin-top: 4px; }
    .spacer { height: 6px; }
    .small { font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img class="logo" alt="Company logo" src="${escapeHtml(organizationLogoUrl)}" />
      <div>
        <h1>${escapeHtml(title)}</h1>
        <div class="muted small">${escapeHtml(organizationName)}</div>
        ${headerRight.length ? `<div class="small" style="margin-top: 4px;">${headerRight.map(line => `<div>${escapeHtml(line)}</div>`).join('')}</div>` : ''}
        <div class="muted small" style="margin-top: 4px;">For capstone/demo use. Not a credit bureau integration.</div>
      </div>
    </div>
    <div class="meta">
      <div><span class="muted">Printed:</span> ${escapeHtml(printedAt)}</div>
      <div><span class="muted">Privacy Notice:</span> ${escapeHtml(noticeVersion)}</div>
    </div>
  </div>

  <h2>A. Personal Information</h2>
  <div class="grid">
    <div class="field"><span class="label">First Name</span><div class="line"></div></div>
    <div class="field"><span class="label">Last Name</span><div class="line"></div></div>
    <div class="field"><span class="label">Middle Name</span><div class="line"></div></div>
    <div class="field"><span class="label">Date of Birth</span><div class="line"></div></div>
    <div class="field"><span class="label">Email Address</span><div class="line"></div></div>
    <div class="field"><span class="label">Phone Number</span><div class="line"></div></div>
    <div class="field"><span class="label">Alternate Phone (optional)</span><div class="line"></div></div>
    <div class="field"><span class="label">Nationality</span><div class="line"></div></div>
  </div>
  <div class="spacer"></div>
  <div class="grid">
    <div class="field" style="grid-column: 1 / -1;"><span class="label">Home Address</span><div class="line tall"></div></div>
  </div>

  <h2>B. Identification</h2>
  <div class="grid">
    <div class="field"><span class="label">ID Type (e.g., National ID, Driver's License)</span><div class="line"></div></div>
    <div class="field"><span class="label">ID Number</span><div class="line"></div></div>
  </div>
  <div class="spacer"></div>
  <div class="grid">
    <div class="field" style="grid-column: 1 / -1;">
      <div class="checkbox-row"><div class="checkbox"></div><div class="note">Borrower provided a photocopy / image of ID (if applicable)</div></div>
      <div class="checkbox-row" style="margin-top: 6px;"><div class="checkbox"></div><div class="note">Borrower provided a photo/selfie (if applicable)</div></div>
    </div>
  </div>

  <h2>C. Employment & Income</h2>
  <div class="grid">
    <div class="field"><span class="label">Employment Status</span><div class="line"></div></div>
    <div class="field"><span class="label">Employer Name</span><div class="line"></div></div>
    <div class="field"><span class="label">Job Title</span><div class="line"></div></div>
    <div class="field"><span class="label">Employment Duration</span><div class="line"></div></div>
    <div class="field"><span class="label">Monthly Income (₱)</span><div class="line"></div></div>
    <div class="field"><span class="label">Other Income (source/amount)</span><div class="line"></div></div>
  </div>

  <h2>D. Financial Information</h2>
  <div class="grid">
    <div class="field"><span class="label">Monthly Expenses (₱)</span><div class="line"></div></div>
    <div class="field"><span class="label">Existing Debts (summary)</span><div class="line"></div></div>
  </div>

  <h2>E. Bank / Disbursement Details (if applicable)</h2>
  <div class="grid">
    <div class="field"><span class="label">Bank Name</span><div class="line"></div></div>
    <div class="field"><span class="label">Account Number</span><div class="line"></div></div>
    <div class="field"><span class="label">Account Type</span><div class="line"></div></div>
    <div class="field"><span class="label">Routing Number</span><div class="line"></div></div>
  </div>

  <h2>F. References & Emergency Contact</h2>
  <div class="grid">
    <div class="field"><span class="label">Reference 1 (Name / Phone / Relationship)</span><div class="line"></div></div>
    <div class="field"><span class="label">Reference 2 (Name / Phone / Relationship)</span><div class="line"></div></div>
    <div class="field" style="grid-column: 1 / -1;"><span class="label">Emergency Contact (Name / Phone / Relationship)</span><div class="line"></div></div>
  </div>

  <h2>G. Consent & Declaration</h2>
  <div class="note">
    I voluntarily provide the information in this registration form for loan processing and internal risk evaluation within the ${escapeHtml(organizationName)} capstone system.
    I confirm that the information is true and complete to the best of my knowledge. I understand that this project uses internal scoring and does not connect to a credit bureau.
    I acknowledge the Privacy Notice (version ${escapeHtml(noticeVersion)}) and consent to the collection, use, storage, and processing of my personal data for the stated purposes.
  </div>
  <div class="spacer"></div>

  <div class="sign-grid">
    <div>
      <div class="sign"></div>
      <div class="sign-label">Borrower Signature</div>
    </div>
    <div>
      <div class="sign"></div>
      <div class="sign-label">Date</div>
    </div>
    <div>
      <div class="sign"></div>
      <div class="sign-label">Printed Name</div>
    </div>
    <div>
      <div class="sign"></div>
      <div class="sign-label">Witness / Loan Officer (Name & Signature)</div>
    </div>
  </div>

  <div class="spacer"></div>
  <div class="small muted">Internal Use: Received by ____________________  Date/Time ____________________  Borrower ID (assigned) ____________________</div>

  <script>
    window.addEventListener('load', () => {
      try { window.print(); } catch {}
    });
  </script>
</body>
</html>`;

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');
  frame.srcdoc = html;

  const cleanup = () => {
    try {
      frame.remove();
    } catch {
      // ignore
    }
  };

  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      window.setTimeout(cleanup, 1000);
    }
  };

  document.body.appendChild(frame);
}
