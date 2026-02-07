import { useEffect, useState } from 'react';
import { globalLoading, type GlobalLoadingState } from '../lib/globalLoading';

function DotSpinner({ animating }: { animating: boolean }) {
  const dotCount = 12;
  const radiusPx = 28;

  return (
    <div
      className={`glms-dot-spinner ${animating ? 'is-animating' : ''}`}
      aria-hidden="true"
    >
      {Array.from({ length: dotCount }).map((_, i) => {
        const angle = (360 / dotCount) * i;
        return (
          <span
            key={i}
            className="glms-dot-spinner__dot bg-green-600"
            style={{
              transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${radiusPx}px)`,
              animationDelay: `${i * 0.08}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export function GlobalLoadingOverlay() {
  const [state, setState] = useState<GlobalLoadingState>(() => globalLoading.getState());
  const [showLoadingUi, setShowLoadingUi] = useState(false);

  useEffect(() => {
    return globalLoading.subscribe(setState);
  }, []);

  useEffect(() => {
    if (state.pendingCount <= 0) {
      setShowLoadingUi(false);
      return;
    }

    const t = window.setTimeout(() => setShowLoadingUi(true), 200);
    return () => window.clearTimeout(t);
  }, [state.pendingCount]);

  const shouldShowLoading = state.pendingCount > 0 && showLoadingUi;
  const shouldShowFlash = state.pendingCount === 0 && !!state.flash;

  if (!shouldShowLoading && !shouldShowFlash) return null;

  const flash = state.flash;
  const title = shouldShowFlash
    ? (flash?.type === 'success' ? flash.title : flash?.title)
    : state.label;
  const subtitle = shouldShowFlash
    ? (flash?.message || (flash?.type === 'success' ? 'Completed successfully.' : 'Please try again.'))
    : "Please wait, don’t close this page.";
  const accent = shouldShowFlash
    ? (flash?.type === 'success' ? 'border-green-200' : 'border-red-200')
    : 'border-green-200';
  const spinnerAccent = shouldShowFlash
    ? (flash?.type === 'success' ? 'border-green-200 border-t-green-700' : 'border-red-200 border-t-red-600')
    : 'border-green-200 border-t-green-700';

  const titleClassName = shouldShowFlash
    ? (flash?.type === 'success'
        ? 'text-2xl font-extrabold text-green-700'
        : 'text-2xl font-extrabold text-red-600')
    : 'text-xl font-bold text-black';

  const showSubtitle = shouldShowFlash
    ? !!flash?.message
    : true;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center px-4">
      <div className={`w-[500px] h-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border ${accent} bg-white shadow-xl`}>
        <div className="h-full p-8 flex flex-col items-center justify-center text-center gap-6">
          {shouldShowLoading ? (
            <DotSpinner animating />
          ) : (
            <div className={`h-16 w-16 rounded-full border-[6px] ${spinnerAccent}`} aria-hidden="true" />
          )}
          <div className="min-w-0">
            <div className={titleClassName}>{title}</div>
            {showSubtitle && (
              <div className="mt-1 text-base font-semibold text-black">{subtitle}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
