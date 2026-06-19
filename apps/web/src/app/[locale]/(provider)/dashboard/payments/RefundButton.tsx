'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/ui/Button';

interface RefundButtonProps {
  label: string;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel: string;
  errorLabels: Record<string, string>;
  action: () => Promise<{ error: string } | null>;
}

export function RefundButton({
  label,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  errorLabels,
  action,
}: RefundButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex gap-2">
        <Button
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await action();
              if (result?.error) {
                setError(errorLabels[result.error] ?? result.error);
                setConfirming(false);
              }
            });
          }}
        >
          {isPending ? pendingLabel : confirmLabel}
        </Button>
        {!isPending && (
          <Button
            variant="ghost"
            aria-label={cancelLabel}
            onClick={() => setConfirming(false)}
          >
            ✕
          </Button>
        )}
      </span>
      {error && <span className="text-xs text-cr-danger">{error}</span>}
    </span>
  );
}
