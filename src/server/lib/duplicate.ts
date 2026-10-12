export const DUPLICATE_WINDOW_DAYS = 30;

/** FR-07: a lead with the same phone created at/after this instant makes the new one a duplicate. */
export function duplicateWindowStart(now: Date): Date {
  return new Date(now.getTime() - DUPLICATE_WINDOW_DAYS * 24 * 3600 * 1000);
}
