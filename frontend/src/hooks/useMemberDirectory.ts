import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { useDebouncedValue } from "./useDebouncedValue";
import type { paths } from "../types/generated/api";
type DirectoryResponse =
  paths["/api/v1/organizations/members/"]["get"]["responses"][200]["content"]["application/json"];

export type DirectoryMeta = NonNullable<DirectoryResponse["meta"]>;
export function useMemberDirectory(
  filters: {
    page: number;
    search?: string;
    role?: string;
    status?: string;
    team?: string;
  },
  enabled = true,
) {
  const search = useDebouncedValue(filters.search || "", 300);
  const params = {
    ...filters,
    search,
    team: filters.team === "all" ? undefined : filters.team,
  };
  return useQuery({
    queryKey: ["org-members-unified", params],
    enabled,
    queryFn: async ({ signal }) =>
      (
        await api.get<DirectoryResponse>("organizations/members/", {
          params,
          signal,
        })
      ).data,
  });
}
