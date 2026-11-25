export function formatExactDate(value: string | null | undefined): string {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registro";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatExactTime(value: string | null | undefined): string {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registro";
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeAgo(
  value: string | null | undefined,
  emptyLabel = "Sin señal",
): string {
  if (!value) return emptyLabel;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return emptyLabel;
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 5) return "hace unos s";
  if (diffSec < 60) return `hace ${diffSec} s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} d`;
}

export default function RelativeTime({
  value,
  emptyLabel = "Sin señal",
  prefix = "",
  className = "",
}: {
  value: string | null | undefined;
  emptyLabel?: string;
  prefix?: string;
  className?: string;
}) {
  const relative = formatRelativeAgo(value, emptyLabel);
  const exact = value ? formatExactDate(value) : emptyLabel;

  if (!value) {
    return (
      <span className={`font-mono ${className}`} title={emptyLabel}>
        {emptyLabel}
      </span>
    );
  }

  return (
    <time
      dateTime={value}
      title={exact}
      className={`font-mono ${className}`}
    >
      {prefix ? `${prefix} ${relative}` : relative}
    </time>
  );
}
