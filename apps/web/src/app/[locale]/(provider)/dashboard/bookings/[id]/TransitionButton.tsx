'use client';
import { useTransition } from 'react';
import { Button } from '@/ui/Button';
import type { BookingStatus } from '@car-rental/types';

interface TransitionButtonProps {
  label: string;
  action: () => Promise<{ error: string } | null>;
  next: BookingStatus;
  onError: (code: string) => void;
  variant?: 'primary' | 'ghost';
}

export function TransitionButton({
  label,
  action,
  onError,
  variant = 'primary',
}: TransitionButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        onError(result.error);
      }
    });
  }

  return (
    <Button variant={variant} onClick={handleClick} disabled={isPending}>
      {isPending ? '…' : label}
    </Button>
  );
}
