'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/ui/Button';
import type { BookingStatus } from '@car-rental/types';

interface ActionItem {
  next: BookingStatus;
  label: string;
  variant: 'primary' | 'ghost';
  action: () => Promise<{ error: string } | null>;
}

interface ActionButtonsProps {
  actions: ActionItem[];
  errorLabels: Record<string, string>;
}

export function ActionButtons({ actions, errorLabels }: ActionButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAction(action: () => Promise<{ error: string } | null>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(errorLabels[result.error] ?? result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-cr-sm">
      <div className="flex flex-wrap gap-cr-sm">
        {actions.map(({ next, label, variant, action }) => (
          <Button
            key={next}
            variant={variant}
            disabled={isPending}
            onClick={() => handleAction(action)}
          >
            {isPending ? '…' : label}
          </Button>
        ))}
      </div>
      {error && (
        <p className="text-sm font-medium" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
