export type ScanAvailability = {
  status:
    | "ready"
    | "cooldown"
    | "pending"
    | "subscription_required"
    | "disabled"
    | "agent_managed"
    | "read_only";
  next_allowed_at: string | null;
  retry_after_seconds: number | null;
  execution?: {
    id: string;
    state: "queued" | "running" | "completed" | "failed" | "expired";
    error_code: string;
  };
  measurement?: {
    at: string | null;
    origin: "cloud" | "agent";
    cadence_seconds: number;
    freshness: "unmeasured" | "stale" | "current";
  };
};
export interface ScannableResource {
  scan_availability?: ScanAvailability;
}
