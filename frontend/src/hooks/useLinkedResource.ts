import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { api } from "../services/api";

// Deep links open once. Refetches update an open drawer without reopening a dismissed one.
export function useLinkedResource<T extends { id: string }>(
  items: T[] | undefined,
  selected: T | null,
  setSelected: Dispatch<SetStateAction<T | null>>,
) {
  const [params] = useSearchParams();
  const linkedId = params.get("resource");
  const opened = useRef<string | null>(null);
  const organization = useAuthStore((s) => s.user?.organization?.id);
  const routes: Record<string, string> = {
    "/monitoring": "monitoring",
    "/ssl": "ssl-certificates",
    "/dns": "dns-records",
    "/domains": "domains",
    "/api-checks": "api-checks",
    "/security-headers": "security-headers",
  };
  const route = routes[window.location.pathname];
  const lookup = useQuery<T>({
    queryKey: ["linked-resource", organization, route, linkedId],
    queryFn: async ({ signal }) =>
      (await api.get(`${route}/${linkedId}/`, { signal })).data.data,
    enabled: !!(
      organization &&
      route &&
      linkedId &&
      items &&
      !items.some((row) => row.id === linkedId) &&
      opened.current !== linkedId
    ),
  });
  useEffect(() => {
    if (!linkedId) opened.current = null;
    if (linkedId && opened.current !== linkedId) {
      const item = items?.find((i) => i.id === linkedId) || lookup.data;
      if (item) {
        opened.current = linkedId;
        setSelected(item);
        return;
      }
    }
    if (selected) {
      const fresh = items?.find((i) => i.id === selected.id);
      if (fresh && fresh !== selected) setSelected(fresh);
    }
  }, [items, linkedId, selected, setSelected, lookup.data]);
}
