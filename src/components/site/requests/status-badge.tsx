import { Flame, Lightbulb, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { REQUEST_STATUS_LABELS, REQUEST_KIND_LABELS, type RequestStatus, type RequestKind } from "@/lib/request-shared";

const STATUS_VARIANT: Record<RequestStatus, "default" | "secondary" | "outline" | "success" | "warning"> = {
  REQUESTED: "default",
  IN_PROGRESS: "warning",
  AVAILABLE: "success",
  RESOLVED: "success",
  CLOSED: "secondary",
  REJECTED: "outline",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}

/** Shown alongside the real status — a request can be both "Requested" and popular at once. */
export function PopularBadge() {
  return (
    <Badge variant="warning">
      <Flame className="h-3 w-3" aria-hidden />
      Popular
    </Badge>
  );
}

export function RequestKindBadge({ kind }: { kind: RequestKind }) {
  return (
    <Badge variant={kind === "RECOMMENDATION" ? "success" : "default"}>
      {kind === "RECOMMENDATION" ? <Sparkles className="h-3 w-3" aria-hidden /> : <Lightbulb className="h-3 w-3" aria-hidden />}
      {REQUEST_KIND_LABELS[kind]}
    </Badge>
  );
}
