import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { bookingToDTO } from '@/server/mappers';
import { StatusChip } from '@/ui/StatusChip';
import {
  BOOKING_TRANSITIONS,
  bookingStatusFromDb,
  returnConditionFromDb,
  type BookingStatus,
  type UserRole,
  type OtpStatusDTO,
} from '@car-rental/types';
import { transitionBooking } from '../actions';
import { ActionButtons } from './ActionButtons';
import { OtpPanel } from './OtpPanel';
import { InspectionForm } from './InspectionForm';
import { issueBookingOtp, prepareVehicle, recordInspection } from './bookingDetailActions';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

const BOOKING_INCLUDE = {
  vehicle: { select: { id: true, name: true } },
  customer: { select: { name: true, email: true } },
  pickupBranch: { select: { name: true } },
  dropoffBranch: { select: { name: true } },
  payment: true,
  otp: true,
  contract: true,
  inspection: true,
} as const;

/** Statuses that a provider/staff can action (legal next states for the role). */
function providerNextStatuses(
  current: BookingStatus,
  role: UserRole,
): BookingStatus[] {
  return BOOKING_TRANSITIONS[current]
    .filter((t) => (t.allowedRoles as string[]).includes(role))
    .map((t) => t.next);
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    redirect(wrongRoleTarget(user.role, locale));
  }
  if (user.role !== 'admin' && !user.providerId) redirect(wrongRoleTarget(user.role, locale));

  const raw = await prisma.booking.findFirst({
    where: { id, ...tenantScope(user) },
    include: BOOKING_INCLUDE,
  });

  if (!raw) notFound();

  const booking = bookingToDTO(raw);
  const customerName = raw.customer.name;
  const customerEmail = raw.customer.email;

  const t = await getTranslations('bookings');

  const currentStatus = bookingStatusFromDb(raw.status);
  const nextStatuses = providerNextStatuses(currentStatus, user.role);

  // Build action items for the client component
  // Exclude vehicle-prepared from the generic action buttons — the dedicated
  // "Prepare vehicle" button (prepareVehicle action) handles that transition.
  const actionItems = nextStatuses
    .filter((next) => next !== 'vehicle-prepared')
    .map((next) => ({
      next,
      label: t(`action.${next}`),
      variant: (next === 'rejected' || next === 'cancelled' ? 'ghost' : 'primary') as
        | 'primary'
        | 'ghost',
      action: transitionBooking.bind(null, locale, id, next),
    }));

  const errorLabels: Record<string, string> = {
    ILLEGAL_TRANSITION: t('error.illegalTransition'),
    FORBIDDEN_ROLE: t('error.forbiddenRole'),
    not_found: t('error.notFound'),
    invalid_status: t('error.illegalTransition'),
  };

  // OTP status (never exposes hash or plaintext)
  const otpStatus: OtpStatusDTO | null = raw.otp
    ? {
        issued: true,
        expiresAt: raw.otp.expiresAt.toISOString(),
        consumedAt: raw.otp.consumedAt?.toISOString() ?? null,
        attempts: raw.otp.attempts,
      }
    : null;

  const contractSigned = raw.contract?.signedAt !== null && raw.contract !== null;

  // Provider can issue/re-issue OTP when booking is confirmed or vehicle-prepared
  const canIssueOtp =
    currentStatus === 'confirmed' || currentStatus === 'vehicle-prepared';

  // Show "Prepare vehicle" button separately when status is confirmed
  const canPrepare = currentStatus === 'confirmed' && nextStatuses.includes('vehicle-prepared');

  // Show inspection form when status is returned
  const showInspection = currentStatus === 'returned';

  // Show inspection record when completed and inspection exists
  const completedInspection =
    currentStatus === 'completed' && raw.inspection
      ? {
          condition: returnConditionFromDb(raw.inspection.condition),
          notes: raw.inspection.notes,
          inspectedAt: raw.inspection.inspectedAt.toISOString(),
        }
      : null;

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl max-w-3xl">
      {/* Back link */}
      <Link
        href={`/${locale}/dashboard/bookings`}
        className="text-cr-primary text-sm font-semibold hover:underline mb-cr-md inline-block"
      >
        {t('backToList')}
      </Link>

      <div className="flex items-center gap-cr-md mb-cr-lg flex-wrap">
        <h1 className="text-2xl font-bold text-cr-text">{t('detail.title')}</h1>
        <StatusChip status={booking.status} label={t(`status.${booking.status}`)} />
      </div>

      {/* Customer */}
      <section className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md mb-cr-md">
        <h2 className="text-sm font-semibold text-cr-text-muted uppercase mb-cr-sm">
          {t('detail.customer')}
        </h2>
        <p className="text-cr-text font-medium">{customerName}</p>
        <p className="text-cr-text-muted text-sm">{customerEmail}</p>
      </section>

      {/* Vehicle & dates */}
      <section className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md mb-cr-md">
        <h2 className="text-sm font-semibold text-cr-text-muted uppercase mb-cr-sm">
          {t('detail.vehicle')}
        </h2>
        <p className="text-cr-text font-medium">{booking.vehicle.name}</p>
        <div className="flex gap-cr-lg mt-cr-sm flex-wrap text-sm text-cr-text-muted">
          <span>
            {t('columns.dates')}: {booking.startDate} {t('dateSeparator')} {booking.endDate}
          </span>
          <span>
            {t('columns.plan')}: {t(`plan.${booking.plan}`)}
          </span>
          {booking.pickupBranchName && (
            <span>
              {t('detail.pickup')}: {booking.pickupBranchName}
            </span>
          )}
          {booking.dropoffBranchName && (
            <span>
              {t('detail.dropoff')}: {booking.dropoffBranchName}
            </span>
          )}
        </div>
      </section>

      {/* Itemised amounts */}
      <section className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md mb-cr-lg">
        <h2 className="text-sm font-semibold text-cr-text-muted uppercase mb-cr-sm">
          {t('detail.pricing')}
        </h2>
        <dl className="grid grid-cols-2 gap-x-cr-lg gap-y-cr-xs text-sm">
          <dt className="text-cr-text-muted">{t('detail.baseAmount')}</dt>
          <dd className="text-cr-text text-end">
            {booking.currency} {booking.baseAmount.toFixed(2)}
          </dd>
          <dt className="text-cr-text-muted">{t('detail.tax')}</dt>
          <dd className="text-cr-text text-end">
            {booking.currency} {booking.taxAmount.toFixed(2)}
          </dd>
          <dt className="text-cr-text-muted">{t('detail.serviceCharge')}</dt>
          <dd className="text-cr-text text-end">
            {booking.currency} {booking.serviceCharge.toFixed(2)}
          </dd>
          <dt className="text-cr-text font-semibold border-t border-cr-border pt-cr-xs">
            {t('detail.total')}
          </dt>
          <dd className="text-cr-text font-semibold text-end border-t border-cr-border pt-cr-xs">
            {booking.currency} {booking.totalAmount.toFixed(2)}
          </dd>
        </dl>
      </section>

      {/* Payment */}
      {booking.payment && (
        <section className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md mb-cr-md">
          <h2 className="text-sm font-semibold text-cr-text-muted uppercase mb-cr-sm">
            {t('detail.payment')}
          </h2>
          <dl className="grid grid-cols-2 gap-x-cr-lg gap-y-cr-xs text-sm">
            <dt className="text-cr-text-muted">{t('detail.paymentAmount')}</dt>
            <dd className="text-cr-text text-end font-semibold">
              {booking.payment.currency} {booking.payment.amount.toFixed(2)}
            </dd>
            <dt className="text-cr-text-muted">{t('detail.paymentMethod')}</dt>
            <dd className="text-cr-text text-end capitalize">
              {t(`detail.paymentMethodValue.${booking.payment.method}`)}
            </dd>
            <dt className="text-cr-text-muted">{t('detail.paymentStatus')}</dt>
            <dd className="text-end">
              <StatusChip
                status={booking.payment.status}
                label={t(`detail.paymentStatusValue.${booking.payment.status}`)}
              />
            </dd>
          </dl>
        </section>
      )}

      {/* Prepare vehicle (confirmed → vehicle-prepared) */}
      {canPrepare && (
        <section className="mb-cr-md">
          <ActionButtons
            actions={[
              {
                next: 'vehicle-prepared',
                label: t('action.vehicle-prepared'),
                variant: 'primary',
                action: prepareVehicle.bind(null, locale, id),
              },
            ]}
            errorLabels={errorLabels}
          />
        </section>
      )}

      {/* OTP lockbox panel (confirmed or vehicle-prepared) */}
      {(canIssueOtp || otpStatus !== null) && (
        <OtpPanel
          otpStatus={otpStatus}
          contractSigned={contractSigned}
          canIssue={canIssueOtp}
          issueAction={issueBookingOtp.bind(null, locale, id)}
          errorLabels={errorLabels}
        />
      )}

      {/* Return inspection form (returned → completed) */}
      {showInspection && (
        <InspectionForm
          inspectAction={recordInspection.bind(null, locale, id)}
          errorLabels={errorLabels}
        />
      )}

      {/* Completed inspection summary */}
      {completedInspection && (
        <section className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md mb-cr-md">
          <h2 className="text-sm font-semibold text-cr-text-muted uppercase mb-cr-sm">
            {t('inspection.sectionTitle')}
          </h2>
          <dl className="grid grid-cols-2 gap-x-cr-lg gap-y-cr-xs text-sm">
            <dt className="text-cr-text-muted">{t('inspection.conditionLabel')}</dt>
            <dd className="text-cr-text font-medium">
              {t(`inspection.condition.${completedInspection.condition}`)}
            </dd>
            {completedInspection.notes && (
              <>
                <dt className="text-cr-text-muted">{t('inspection.notesLabel')}</dt>
                <dd className="text-cr-text">{completedInspection.notes}</dd>
              </>
            )}
            <dt className="text-cr-text-muted">{t('inspection.inspectedAt')}</dt>
            <dd className="text-cr-text text-end">
              {new Date(completedInspection.inspectedAt).toLocaleString()}
            </dd>
          </dl>
        </section>
      )}

      {/* Generic transition actions (reject/cancel/return etc.) */}
      {actionItems.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cr-text-muted uppercase mb-cr-sm">
            {t('detail.actions')}
          </h2>
          <ActionButtons actions={actionItems} errorLabels={errorLabels} />
        </section>
      )}
    </main>
  );
}
