import type { Alert } from './alerts';
import type { Incident } from './incidents';
import type { ScanAvailability } from './scan';

export type CoverageModule = 'ssl' | 'dns' | 'domain' | 'security';
export interface CoverageResource {
  id: string;
  scan_availability?: ScanAvailability;
  last_scanned_at?: string | null;
  last_checked_at?: string | null;
  [field: string]: unknown;
}
export interface CoverageSection {
  status: 'linked' | 'unlinked' | 'needs_review' | 'not_applicable';
  resources: CoverageResource[];
  candidates: {id: string; label: string}[];
  candidates_truncated: boolean;
}
export interface EndpointCoverage {
  sections: Record<CoverageModule, CoverageSection>;
  activity: {alerts: Alert[]; incidents: Incident[]; changes: {id:string; description:string; timestamp:string}[]};
}
