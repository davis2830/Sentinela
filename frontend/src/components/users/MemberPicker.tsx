import { useState } from "react";
import { useMemberDirectory } from "../../hooks/useMemberDirectory";
import DirectoryPagination from "./DirectoryPagination";
import type { TeamMember } from "../../types/users";

export default function MemberPicker({
  value,
  onChange,
  label = "Buscar integrante",
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const directory = useMemberDirectory({ page, search, status: "active" });
  const [selected, setSelected] = useState<TeamMember>();
  const options = directory.data?.data.filter((u) => !u.is_invitation) || [];
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        {label}
        <input
          type="search"
          className="block w-full min-h-11 bg-bg-dark border border-border-base rounded-xl px-3"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {directory.isError ? (
        <button
          type="button"
          className="min-h-11"
          onClick={() => void directory.refetch()}
        >
          Reintentar búsqueda de integrantes
        </button>
      ) : (
        <select
          aria-label="Integrante asignado"
          className="min-h-11 w-full bg-bg-dark border border-border-base rounded-xl"
          value={value}
          onChange={(e) => {
            setSelected(options.find((u) => u.id === e.target.value));
            onChange(e.target.value);
          }}
        >
          <option value="">Sin asignar</option>
          {value && !options.some((u) => u.id === value) && (
            <option value={value}>
              {selected?.email || "Integrante asignado"}
            </option>
          )}
          {options.map((u) => (
            <option key={u.id} value={u.id}>
              {u.first_name} {u.last_name} · {u.email}
            </option>
          ))}
        </select>
      )}
      {directory.isLoading && <p role="status">Buscando integrantes…</p>}
      <DirectoryPagination meta={directory.data?.meta} onPage={setPage} />
    </div>
  );
}
