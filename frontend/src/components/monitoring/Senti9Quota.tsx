import { Infinity as InfinityIcon } from "lucide-react";
import type { QuotaMetric } from "../../types/organization";

export default function Senti9Quota({ quota }: { quota: QuotaMetric }) {
  const limited = !quota.is_unlimited && quota.limit > 0;
  const percentage = limited
    ? Math.min(100, Math.max(0, (quota.current / quota.limit) * 100))
    : 0;
  return (
    <span className="senti9-quota">
      {quota.is_unlimited ? (
        <InfinityIcon size={16} className="text-slate-400" aria-hidden="true" />
      ) : limited ? (
        <span
          className="senti9-quota-track"
          role="progressbar"
          aria-label="Cupos de Senti9"
          aria-valuemin={0}
          aria-valuemax={quota.limit}
          aria-valuenow={Math.min(quota.current, quota.limit)}
          aria-valuetext={`${quota.current} de ${quota.limit} cupos utilizados`}
        >
          <span
            className={percentage >= 100 ? "bg-amber-400" : "bg-emerald-400"}
            style={{ width: `${percentage}%` }}
          />
        </span>
      ) : null}
      <span>
        <strong className="font-mono font-medium text-slate-200">
          {quota.current}
          {!quota.is_unlimited && ` / ${quota.limit}`}
        </strong>
        {quota.is_unlimited
          ? " agentes · sin límite de cupos"
          : " cupos utilizados"}
      </span>
    </span>
  );
}
