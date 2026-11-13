import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { apiFailure } from "../services/errors";
import { useAuthStore } from "../store/authStore";
import { useDebouncedValue } from "./useDebouncedValue";
import { useConfirmation } from "./useConfirmation";
import type { useConnectivityRefresh } from "./useConnectivityRefresh";

export type DirectoryMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  summary?: Record<string, number>;
};
export function useConnectivityDirectory<T>(
  route: string,
  key: string,
  filters: Record<string, string>,
  refetchInterval: ReturnType<typeof useConnectivityRefresh>["refetchInterval"],
  options: { pollMs?: number } = {},
) {
  const org = useAuthStore((s) => s.user?.organization?.id);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const firstMeasurementUntil = useRef(Date.now() + 120_000);
  const confirmation = useConfirmation();
  const search = useDebouncedValue(filters.search || "", 300);
  const signature = JSON.stringify({ ...filters, search });
  useEffect(() => setPage(1), [signature]);
  const params = { ...JSON.parse(signature), page };
  const query = useQuery<{ rows: T[]; meta: DirectoryMeta | null }>({
    queryKey: [key, org, signature, page],
    queryFn: async ({ signal }) => {
      const r = await api.get(route, { params, signal });
      return {
        rows: Array.isArray(r.data.data) ? r.data.data : [],
        meta: r.data.meta || null,
      };
    },
    enabled: !!org,
    refetchInterval: (query) => {
      refetchInterval(query);
      if (options.pollMs) return options.pollMs;
      return query.state.data?.rows.some((row) => {
        const item = row as {
          runner_type?: string;
          enabled?: boolean;
          last_checked_at?: string | null;
          scan_availability?: {
            status?: string;
            execution?: { state: string };
          };
        };
        return (
          item.scan_availability?.status === "pending" ||
          (item.runner_type === "agent" &&
            item.enabled &&
            !item.last_checked_at &&
            Date.now() < firstMeasurementUntil.current) ||
          ["queued", "running"].includes(
            item.scan_availability?.execution?.state || "",
          )
        );
      })
        ? 5000
        : false;
    },
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    const failure = apiFailure(query.error);
    if (
      page > 1 &&
      query.isError &&
      failure.response?.status === 400 &&
      failure.response.data.errors.page.length
    )
      setPage((previous) => previous - 1);
  }, [query.isError, query.error, page]);
  return {
    ...query,
    data: query.data?.rows,
    meta: query.data?.meta,
    page,
    setPage,
    message,
    setMessage,
    confirmation: confirmation.dialog,
    confirmDelete: confirmation.ask,
    isLoading: query.isPending || query.isPlaceholderData,
    params,
    exportCSV: async () => {
      try {
        const r = await api.get(route, {
          params: { ...params, page: undefined, export: "csv" },
          responseType: "blob",
        });
        const url = URL.createObjectURL(r.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sentinel-${key}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage("CSV de resultados filtrados generado.");
      } catch {
        setMessage(
          "No se pudo exportar. Los filtros se conservan; puedes reintentar.",
        );
      }
    },
  };
}
