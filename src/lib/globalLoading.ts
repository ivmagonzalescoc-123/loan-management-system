export type GlobalLoadingFlash = {
  type: 'success' | 'error';
  title: string;
  message?: string;
};

export type GlobalLoadingState = {
  pendingCount: number;
  label: string;
  flash: GlobalLoadingFlash | null;
};

type LoadingListener = (state: GlobalLoadingState) => void;

let pendingCount = 0;
let label: string | null = null;
let flash: GlobalLoadingFlash | null = null;
let flashTimeout: number | null = null;
let flashDelayTimeout: number | null = null;
let firstPendingAt: number | null = null;

const listeners = new Set<LoadingListener>();

function getState(): GlobalLoadingState {
  const effectiveLabel = pendingCount > 1
    ? 'Processing requests…'
    : (label || 'Processing…');

  return {
    pendingCount,
    label: effectiveLabel,
    flash,
  };
}

function emit() {
  const state = getState();
  for (const listener of listeners) {
    listener(state);
  }
}

function setFlash(next: GlobalLoadingFlash | null) {
  if (flashDelayTimeout) {
    window.clearTimeout(flashDelayTimeout);
    flashDelayTimeout = null;
  }

  // If a request finished too quickly, delay the flash slightly so the loading
  // state is visible before showing success/error.
  if (next && firstPendingAt) {
    const elapsed = Date.now() - firstPendingAt;
    const minLoadingMs = 650;
    if (elapsed < minLoadingMs) {
      flashDelayTimeout = window.setTimeout(() => {
        flashDelayTimeout = null;
        setFlash(next);
      }, minLoadingMs - elapsed);
      return;
    }
  }

  flash = next;
  if (flashTimeout) {
    window.clearTimeout(flashTimeout);
    flashTimeout = null;
  }
  emit();

  if (next) {
    flashTimeout = window.setTimeout(() => {
      flash = null;
      flashTimeout = null;
      emit();
    }, 3000);
  }
}

export const globalLoading = {
  inc(meta?: { label?: string }) {
    pendingCount += 1;
    if (pendingCount === 1) {
      label = meta?.label || null;
      firstPendingAt = Date.now();
    }
    emit();
  },
  dec() {
    pendingCount = Math.max(0, pendingCount - 1);
    if (pendingCount === 0) {
      label = null;
      firstPendingAt = null;
    }
    emit();
  },
  flashSuccess(title: string, message?: string) {
    setFlash({ type: 'success', title, message });
  },
  flashError(title: string, message?: string) {
    setFlash({ type: 'error', title, message });
  },
  getState,
  subscribe(listener: LoadingListener) {
    listeners.add(listener);
    listener(getState());
    return () => {
      listeners.delete(listener);
    };
  },
};
