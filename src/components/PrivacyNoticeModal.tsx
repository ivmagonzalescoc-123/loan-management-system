import { X, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface PrivacyNoticeModalProps {
  open: boolean;
  onClose: () => void;
  noticeVersion?: string;
  requireScrollToBottom?: boolean;
  onAcknowledge?: () => void;
  acknowledgeLabel?: string;
}

export function PrivacyNoticeModal({
  open,
  onClose,
  noticeVersion = 'v1-2026-02-05',
  requireScrollToBottom = false,
  onAcknowledge,
  acknowledgeLabel = 'I have read and understand'
}: PrivacyNoticeModalProps) {
  if (!open) return null;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    setAtBottom(false);
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 8;
      const reached = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
      setAtBottom(reached);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [open]);

  const showAcknowledge = Boolean(onAcknowledge);
  const canAcknowledge = useMemo(() => {
    if (!showAcknowledge) return false;
    if (!requireScrollToBottom) return true;
    return atBottom;
  }, [atBottom, requireScrollToBottom, showAcknowledge]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div
        className="bg-white rounded-xl w-full max-h-[90vh]"
        style={{ maxWidth: '42rem', display: 'flex', flexDirection: 'column' }}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-gray-900">Privacy Notice</h3>
              <p className="text-sm text-gray-600 mt-1">Notice version: {noticeVersion}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div ref={scrollRef} className="p-6 space-y-4 text-sm text-gray-700 overflow-y-auto">
          <p>
            This Project "Loan Management System (GLMS)" collects borrower information to support loan processing and internal
            risk evaluation. This is not a credit bureau integration.
          </p>

          <div className="space-y-2">
            <h4 className="text-gray-900">What we collect</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Identity and contact details (name, email, phone, address, date of birth)</li>
              <li>Employment and income details (employment, monthly income)</li>
              <li>KYC images (facial image and ID image) if uploaded</li>
              <li>Loan application details (requested amount, purpose, collateral, guarantor)</li>
              <li>Operational records (approvals, disbursement receipts, payments, audit logs)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-gray-900">How we use it</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Process and review loan applications</li>
              <li>Compute an internal eligibility/risk assessment and an internal credit score</li>
              <li>Generate reports, receipts, and notifications</li>
              <li>Maintain audit trails for accountability</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-gray-900">Data handling (simple baseline)</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Only authorized project users should access borrower records</li>
              <li>Passwords are stored as hashes; they are not exposed in API responses</li>
              <li>Keep this dataset limited to demo/test borrowers.</li>
            </ul>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex items-center justify-between gap-3">
          {requireScrollToBottom && showAcknowledge && (
            <div className="text-xs text-gray-500">Scroll to the bottom to enable acknowledgment.</div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            {showAcknowledge && (
              <button
                onClick={() => onAcknowledge?.()}
                disabled={!canAcknowledge}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {acknowledgeLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
