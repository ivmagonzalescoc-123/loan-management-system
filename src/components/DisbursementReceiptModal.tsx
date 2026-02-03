import { X, Printer } from 'lucide-react';
import type { Loan } from '../lib/types';
import {
  buildReceiptDataFromLoan,
  parseDisbursementMeta,
  printDisbursementReceipt
} from '../lib/disbursementReceipt';
import { formatPhp } from '../lib/currency';

interface DisbursementReceiptModalProps {
  loan: Loan;
  onClose: () => void;
}

export function DisbursementReceiptModal({ loan, onClose }: DisbursementReceiptModalProps) {
  const receipt = buildReceiptDataFromLoan(loan);
  const meta = parseDisbursementMeta(loan.disbursementMeta);
  const method = (meta?.disbursementMethod || loan.disbursementMethod || '').toLowerCase();
  const isBankTransfer = method === 'bank_transfer';
  const isCheck = method === 'check';
  const isDigitalWallet = method === 'digital_wallet';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h3 className="text-gray-900">Disbursement Receipt</h3>
            <p className="text-xs text-gray-500 mt-1">Loan ID: {loan.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => printDisbursementReceipt(receipt)}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Receipt No.</div>
                <div className="text-gray-900">{loan.receiptNumber || '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Reference</div>
                <div className="text-gray-900">{loan.referenceNumber || '—'}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Borrower</div>
                <div className="text-gray-900">{loan.borrowerName}</div>
              </div>
              <div>
                <div className="text-gray-500">Loan Type</div>
                <div className="text-gray-900">{loan.loanType}</div>
              </div>
              <div>
                <div className="text-gray-500">Disbursed Date</div>
                <div className="text-gray-900">{loan.disbursedDate}{meta?.disbursementTime ? ` ${meta.disbursementTime}` : ''}</div>
              </div>
              <div>
                <div className="text-gray-500">Disbursed By</div>
                <div className="text-gray-900">{meta?.processingOfficer || loan.disbursedBy}</div>
              </div>
              <div>
                <div className="text-gray-500">Method</div>
                <div className="text-gray-900 capitalize">{(meta?.disbursementMethod || loan.disbursementMethod || '—').replace(/_/g, ' ')}</div>
              </div>
              <div>
                <div className="text-gray-500">Amount Disbursed</div>
                <div className="text-gray-900">{formatPhp(loan.principalAmount)}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Bank</div>
                <div className="text-gray-900">
                  {isBankTransfer ? (meta?.bankName || '—') : '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Account</div>
                <div className="text-gray-900">
                  {isBankTransfer && meta?.accountNumberLast4 ? `***${meta.accountNumberLast4}` : '—'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Check No.</div>
                <div className="text-gray-900">
                  {isCheck ? (meta?.checkNumber || '—') : '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Check Date</div>
                <div className="text-gray-900">
                  {isCheck ? (meta?.checkDate || '—') : '—'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Wallet Provider</div>
                <div className="text-gray-900">
                  {isDigitalWallet ? (meta?.digitalWalletProvider || '—') : '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Wallet ID</div>
                <div className="text-gray-900">
                  {isDigitalWallet ? (meta?.walletId || '—') : '—'}
                </div>
              </div>
            </div>

            {meta?.notes && (
              <div className="mt-4 text-sm">
                <div className="text-gray-500">Notes</div>
                <div className="text-gray-900 whitespace-pre-wrap">{meta.notes}</div>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-4">This receipt is system-generated.</p>
        </div>
      </div>
    </div>
  );
}
