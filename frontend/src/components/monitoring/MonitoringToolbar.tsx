import ConnectivityToolbar from "../common/noc/ConnectivityToolbar";

interface MonitoringToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  protocol: string;
  onProtocolChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  summary?: Record<string, number>;
  tags: string[];
  tag: string;
  onTagChange: (value: string) => void;
  viewMode: "grid" | "table";
  onViewModeChange: (value: "grid" | "table") => void;
}

export default function MonitoringToolbar({
  search,
  onSearchChange,
  protocol,
  onProtocolChange,
  status,
  onStatusChange,
  summary,
  tags,
  tag,
  onTagChange,
  viewMode,
  onViewModeChange,
}: MonitoringToolbarProps) {
  return (
    <ConnectivityToolbar
      testId="monitoring-toolbar"
      searchTerm={search}
      onSearchChange={onSearchChange}
      searchLabel="Buscar monitores por nombre, URL o IP"
      searchPlaceholder="Buscar por nombre, URL o IP…"
      categories={["all", "https", "http", "tcp", "dns", "api", "ssl"].map(
        (id) => ({ id, label: id === "all" ? "Todos" : id.toUpperCase() }),
      )}
      categoryLabel="Tipo"
      categoryAriaLabel="Filtrar por protocolo"
      selectedCategory={protocol}
      onCategoryChange={onProtocolChange}
      statusPills={[
        {
          id: "all",
          label: "Todos",
          count: summary?.total ?? "—",
          variant: "all",
        },
        {
          id: "down",
          label: "Caídos",
          count: summary?.down ?? "—",
          variant: "danger",
        },
        {
          id: "up",
          label: "Online",
          count: summary?.up ?? "—",
          variant: "success",
        },
        {
          id: "slow",
          label: "Lentos",
          count: summary?.slow ?? "—",
          variant: "warning",
        },
        {
          id: "disabled",
          label: "Pausados",
          count: summary?.paused ?? "—",
          variant: "neutral",
        },
      ]}
      countsScope="conteos de toda la organización"
      selectedStatus={status}
      onStatusChange={onStatusChange}
      extraFilters={
        tags.length ? (
          <select
            aria-label="Filtrar por etiqueta"
            title="Etiquetas disponibles en esta página y etiqueta aplicada"
            value={tag}
            onChange={(event) => onTagChange(event.target.value)}
            className="h-11 min-w-0 rounded-full border border-border-base bg-bg-dark px-3 text-xs font-medium text-text-main focus:border-accent-green"
          >
            <option value="all">Tag</option>
            {tags.map((value) => (
              <option key={value} value={value}>
                #{value}
              </option>
            ))}
          </select>
        ) : undefined
      }
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
    />
  );
}
