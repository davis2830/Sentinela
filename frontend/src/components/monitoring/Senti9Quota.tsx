import { Link } from "react-router-dom";
import { ArrowUpRight, Server } from "lucide-react";
import type { QuotaMetric } from "../../types/organization";

export default function Senti9Quota({
  quota,
  onUpgrade,
}: {
  quota: QuotaMetric;
  onUpgrade?: () => void;
}) {
  const nearOrAtLimit =
    !quota.is_unlimited &&
    quota.limit > 0 &&
    quota.current / quota.limit >= 0.8;

  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border-base bg-bg-dark/80 text-xs text-text-muted select-none">
      <Server
        size={12}
        className={nearOrAtLimit ? "text-amber-400 shrink-0" : "text-accent-green shrink-0"}
        aria-hidden="true"
      />
      <span>
        {quota.is_unlimited ? (
          <>
            <strong className="font-mono font-semibold text-text-main">
              {quota.current}
            </strong>{" "}
            guardianes (plan ilimitado)
          </>
        ) : (
          <>
            <strong className="font-mono font-semibold text-text-main">
              {quota.current} de {quota.limit}
            </strong>{" "}
            guardianes del plan
          </>
        )}
      </span>
      {nearOrAtLimit &&
        (onUpgrade ? (
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-accent-green hover:underline cursor-pointer !min-h-0 !min-w-0"
            title="Ampliar límite de guardianes en tu plan"
          >
            <span>Mejorar plan</span>
            <ArrowUpRight size={11} />
          </button>
        ) : (
          <Link
            to="/organization"
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-accent-green hover:underline"
            title="Ampliar límite de guardianes en tu plan"
          >
            <span>Mejorar plan</span>
            <ArrowUpRight size={11} />
          </Link>
        ))}
    </span>
  );
}
