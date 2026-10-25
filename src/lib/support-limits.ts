/** Shared by the support form (client hints) and the server actions (enforcement). */
export const SUPPORT_LIMITS = {
  subjectMax: 120,
  bodyMin: 5,
  bodyMax: 2000,
  maxOpenTickets: 3,
  messagesPerWindow: 5,
  windowMs: 10 * 60_000,
} as const;
