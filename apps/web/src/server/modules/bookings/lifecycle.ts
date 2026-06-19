import { BOOKING_TRANSITIONS, type BookingStatus, type UserRole } from '@car-rental/types';

export class LifecycleError extends Error {
  constructor(
    public readonly code: 'ILLEGAL_TRANSITION' | 'FORBIDDEN_ROLE',
    message: string
  ) {
    super(message);
    this.name = 'LifecycleError';
  }
}

/**
 * Assert that transitioning from `from` to `to` is permitted for `role`.
 * Throws LifecycleError if the transition is illegal or the role is not allowed.
 */
export function assertTransition(
  from: BookingStatus,
  to: BookingStatus,
  role: UserRole
): void {
  const allowed = BOOKING_TRANSITIONS[from];

  const transition = allowed.find((t) => t.next === to);

  if (!transition) {
    throw new LifecycleError(
      'ILLEGAL_TRANSITION',
      `Transition from '${from}' to '${to}' is not allowed`
    );
  }

  if (!(transition.allowedRoles as string[]).includes(role)) {
    throw new LifecycleError(
      'FORBIDDEN_ROLE',
      `Role '${role}' cannot transition from '${from}' to '${to}'`
    );
  }
}
