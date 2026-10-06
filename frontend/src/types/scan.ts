export type ScanAvailability = {
  status: 'ready' | 'cooldown' | 'pending' | 'subscription_required' | 'disabled' | 'agent_managed' | 'read_only';
  next_allowed_at: string | null;
  retry_after_seconds: number | null;
};
export interface ScannableResource { scan_availability?: ScanAvailability }
