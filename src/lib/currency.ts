export function formatPhp(amount: unknown, options?: { maximumFractionDigits?: number }) {
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  const safe = Number.isFinite(numeric) ? numeric : 0;

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: options?.maximumFractionDigits ?? 2
  }).format(safe);
}
