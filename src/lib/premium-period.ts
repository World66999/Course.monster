/**
 * Premium period arithmetic. Pure (no database, no server-only imports) so the
 * exact rules can be unit-tested with a fake clock:
 *
 * - Monthly is one calendar month and Yearly twelve, from activation:
 *   10 Mar 14:05 -> 10 Apr 14:05; 31 Jan -> 28/29 Feb (the last day, never
 *   spilling into March); 29 Feb 2028 -> 28 Feb 2029 for a year.
 * - Calendar arithmetic is done in UTC, so the result doesn't depend on the
 *   server's timezone: a local-time add (date-fns addMonths) on a server in
 *   Europe/Berlin made a month across a DST change an hour short.
 * - A renewal while still active starts at the current expiry, so no paid
 *   time is lost; a renewal after expiry starts at the moment of payment.
 */

export function isActiveUntil(premiumUntil: Date | null | undefined, now = new Date()): boolean {
  return Boolean(premiumUntil && premiumUntil.getTime() > now.getTime());
}

/** Where a new period starts: the current expiry when still active, otherwise now. */
export function periodStart(currentUntil: Date | null, now = new Date()): Date {
  return isActiveUntil(currentUntil, now) ? (currentUntil as Date) : now;
}

export function periodEnd(start: Date, months: number): Date {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth() + months;
  // Clamp to the target month's last day: 31 Jan + 1 month is 28/29 Feb.
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      y,
      m,
      Math.min(start.getUTCDate(), lastDay),
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds()
    )
  );
}

/** True when the account had Premium at some point and it has since ended. */
export function hasExpired(premiumUntil: Date | null | undefined, now = new Date()): boolean {
  return Boolean(premiumUntil) && !isActiveUntil(premiumUntil, now);
}
