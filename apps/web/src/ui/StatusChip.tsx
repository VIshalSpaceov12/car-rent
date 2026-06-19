const MAP: Record<string, string> = {
  // booking statuses
  confirmed: 'var(--color-success)',
  completed: 'var(--color-success)',
  'vehicle-prepared': 'var(--color-info)',
  returned: 'var(--color-info)',
  'picked-up': 'var(--color-primary)',
  rejected: 'var(--color-danger)',
  cancelled: 'var(--color-danger)',
  reserved: 'var(--color-textSubtle)',
  // payment statuses
  paid: 'var(--color-success)',
  pending: 'var(--color-textSubtle)',
  failed: 'var(--color-danger)',
  refunded: 'var(--color-info)',
};

export function StatusChip({ status, label }: { status: string; label: string }) {
  const c = MAP[status] ?? 'var(--color-textSubtle)';
  return (
    <span
      className="inline-flex items-center gap-cr-xs rounded-cr-pill px-cr-sm py-cr-xs text-xs font-semibold"
      style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}
    >
      {label}
    </span>
  );
}
