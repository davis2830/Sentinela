import { Server } from "lucide-react";
import type { QuotaMetric } from "../../types/organization";

export default function Senti9Quota({ quota }: { quota: QuotaMetric }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-base bg-bg-dark/80 text-xs text-text-muted shadow-sm select-none">
      <Server size={13} className="text-accent-green shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-mono font-medium text-text-main">
          {quota.current}
          {!quota.is_unlimited && ` / ${quota.limit}`}
        </strong>
        {quota.is_unlimited ? " agentes Senti9 (sin límite)" : " agentes Senti9"}
      </span>
    </span>
  );
}
