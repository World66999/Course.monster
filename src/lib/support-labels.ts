import type { TicketStatus, TicketTopic } from "@prisma/client";

export const TICKET_STATUS: Record<TicketStatus, { label: string; variant: "info" | "success" | "secondary" }> = {
  OPEN: { label: "Open", variant: "info" },
  ANSWERED: { label: "Answered", variant: "success" },
  CLOSED: { label: "Closed", variant: "secondary" },
};

export const TICKET_TOPIC: Record<TicketTopic, string> = {
  OTHER_PAYMENT_METHOD: "Another payment method",
  PAYMENT_PROBLEM: "Payment problem",
  OTHER: "Other",
};
