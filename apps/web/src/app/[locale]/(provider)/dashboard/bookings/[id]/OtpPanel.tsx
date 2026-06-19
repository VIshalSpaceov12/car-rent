'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/StatusChip';
import type { OtpStatusDTO } from '@car-rental/types';

interface OtpPanelProps {
  otpStatus: OtpStatusDTO | null;
  contractSigned: boolean;
  canIssue: boolean;
  issueAction: () => Promise<{ code: string } | { error: string }>;
  errorLabels: Record<string, string>;
}

export function OtpPanel({
  otpStatus,
  contractSigned,
  canIssue,
  issueAction,
  errorLabels,
}: OtpPanelProps) {
  const t = useTranslations('bookings.otp');
  const [isPending, startTransition] = useTransition();
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleIssue() {
    setError(null);
    setIssuedCode(null);
    startTransition(async () => {
      const result = await issueAction();
      if ('error' in result) {
        setError(errorLabels[result.error] ?? result.error);
      } else {
        setIssuedCode(result.code);
      }
    });
  }

  const otpState: 'consumed' | 'expired' | 'issued' | 'none' = otpStatus
    ? otpStatus.consumedAt !== null
      ? 'consumed'
      : otpStatus.expiresAt && new Date(otpStatus.expiresAt) < new Date()
        ? 'expired'
        : 'issued'
    : 'none';

  return (
    <section className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md mb-cr-md">
      <h2 className="text-sm font-semibold text-cr-text-muted uppercase mb-cr-sm">
        {t('sectionTitle')}
      </h2>

      {/* OTP state badge */}
      <div className="flex flex-wrap items-center gap-cr-sm mb-cr-sm">
        <StatusChip status={otpState} label={t(`state.${otpState}`)} />
        {otpStatus && (
          <span className="text-xs text-cr-text-muted">
            {t('attempts', { count: otpStatus.attempts })}
          </span>
        )}
        {/* Contract signed indicator */}
        <StatusChip
          status={contractSigned ? 'confirmed' : 'reserved'}
          label={contractSigned ? t('contractSigned') : t('contractPending')}
        />
      </div>

      {/* Issue / re-issue button */}
      {canIssue && (
        <div className="flex flex-col gap-cr-sm">
          <Button variant="primary" disabled={isPending} onClick={handleIssue}>
            {isPending
              ? t('issuing')
              : otpState === 'none'
                ? t('issueButton')
                : t('reissueButton')}
          </Button>

          {/* One-time code display — only shown in this render, never stored */}
          {issuedCode !== null && (
            <div
              className="rounded-cr-card border border-cr-border bg-cr-surface-alt p-cr-md"
              role="status"
              aria-live="polite"
            >
              <p className="text-xs text-cr-text-muted mb-cr-xs">{t('codeHint')}</p>
              <p
                className="text-4xl font-mono font-bold tracking-widest text-cr-primary text-center py-cr-sm"
                aria-label={t('codeAriaLabel')}
              >
                {issuedCode}
              </p>
              <p className="text-xs text-cr-text-muted text-center mt-cr-xs">{t('codeOnceWarning')}</p>
            </div>
          )}

          {error && (
            <p className="text-sm font-medium text-cr-danger">{error}</p>
          )}
        </div>
      )}
    </section>
  );
}
