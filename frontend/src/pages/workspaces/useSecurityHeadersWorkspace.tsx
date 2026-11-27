import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnectivityDirectory } from "../../hooks/useConnectivityDirectory";
import { useConnectivityRefresh } from "../../hooks/useConnectivityRefresh";
import { useLinkedResource } from "../../hooks/useLinkedResource";
import { usePersistentViewMode } from "../../hooks/usePersistentViewMode";
import { useUrlFilter } from "../../hooks/useUrlFilter";
import { api } from "../../services/api";
import { apiFailure } from "../../services/errors";
import { useAuthStore } from "../../store/authStore";
import type {
  CreateSecurityHeaderTargetData,
  SecurityHeaderResult,
  SecurityHeaderStats,
  SecurityHeaderTarget,
} from "../../types/security_headers";
import { bulkOutcome } from "../../utils/bulkOutcome";
import { waitForFreshScan, type QueuedScan } from "../../utils/scanPolling";

export function useSecurityHeadersWorkspace() {
  const organizationId = useAuthStore((state) => state.user?.organization?.id);
  const queryClient = useQueryClient();

  const [selectedTarget, setSelectedTarget] =
    useState<SecurityHeaderTarget | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] =
    useState<SecurityHeaderTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecurityHeaderTarget | null>(
    null,
  );
  const [gradeFilter, setGradeFilter] = useUrlFilter("grade", [
    "all",
    "healthy",
    "warning",
    "critical",
    "unmeasured",
    "paused",
  ] as const);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = usePersistentViewMode(
    "security_headers",
    "table",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [bulkActionRunning, setBulkActionRunning] = useState(false);

  const autoRefresh = useConnectivityRefresh();

  const { data: stats } = useQuery<SecurityHeaderStats>({
    queryKey: ["security-header-stats", organizationId],
    queryFn: async () => {
      const response = await api.get("security-headers/stats/");
      return (response.data?.data || {}) as SecurityHeaderStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const directory = useConnectivityDirectory<SecurityHeaderTarget>(
    "security-headers/",
    "security-header-targets",
    { search: searchTerm, grade: gradeFilter },
    autoRefresh.refetchInterval,
  );
  const { data: targets, isLoading, isError, refetch } = directory;
  const selectionScope = JSON.stringify(directory.params);
  useEffect(() => setSelectedIds([]), [selectionScope]);

  // Keep selectedTarget fresh when list updates via polling or mutation
  useEffect(() => {
    if (!selectedTarget || !targets) return;
    const fresh = targets.find((t) => t.id === selectedTarget.id);
    if (fresh && fresh !== selectedTarget) {
      setSelectedTarget(fresh);
    }
  }, [targets, selectedTarget]);

  const { data: results, isLoading: isLoadingResults } = useQuery<
    SecurityHeaderResult[]
  >({
    queryKey: ["security-header-results", organizationId, selectedTarget?.id],
    queryFn: async () => {
      if (!selectedTarget) return [];
      const response = await api.get(
        `security-headers/${selectedTarget.id}/results/`,
      );
      return (response.data?.data || []) as SecurityHeaderResult[];
    },
    enabled: !!selectedTarget,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: ["security-header-targets", organizationId],
    });
    queryClient.invalidateQueries({
      queryKey: ["security-header-stats", organizationId],
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: CreateSecurityHeaderTargetData) => {
      await api.post("security-headers/", data);
    },
    onSuccess: () => {
      invalidateAll();
      setShowForm(false);
      setEditingTarget(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateSecurityHeaderTargetData>;
    }) => {
      await api.patch(`security-headers/${id}/`, data);
    },
    onSuccess: () => {
      invalidateAll();
      setShowForm(false);
      setEditingTarget(null);
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const response = await api.post(`security-headers/${id}/scan/`);
      const queued = response.data?.data as QueuedScan;
      return waitForFreshScan<SecurityHeaderTarget>(
        queued,
        async () =>
          (await api.get(`security-headers/${id}/`)).data
            ?.data as SecurityHeaderTarget,
        (target) => target.last_checked_at,
      );
    },
    onSuccess: (updatedTarget) => {
      invalidateAll();
      queryClient.invalidateQueries({
        queryKey: [
          "security-header-results",
          organizationId,
          selectedTarget?.id,
        ],
      });
      if (
        selectedTarget &&
        updatedTarget &&
        selectedTarget.id === updatedTarget.id
      ) {
        setSelectedTarget(updatedTarget);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`security-headers/${id}/`);
    },
    onSuccess: () => {
      invalidateAll();
      if (selectedTarget?.id === deleteTarget?.id) {
        setSelectedTarget(null);
      }
      setDeleteTarget(null);
    },
  });

  const handleToggleSelect = (target: SecurityHeaderTarget) => {
    setSelectedIds((prev) =>
      prev.includes(target.id)
        ? prev.filter((id) => id !== target.id)
        : [...prev, target.id],
    );
  };

  const handleToggleEnabled = (target: SecurityHeaderTarget) => {
    updateMutation.mutate({
      id: target.id,
      data: { enabled: !target.enabled },
    });
  };

  const handleExecuteBulkAction = async (
    action: "scan" | "pause" | "resume" | "delete",
  ) => {
    if (selectedIds.length === 0) return;
    if (
      action === "delete" &&
      !(await directory.confirmDelete(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} endpoints seleccionados?`,
      ))
    )
      return;

    setBulkActionRunning(true);
    try {
      const response = await api.post("security-headers/bulk-action/", {
        action,
        target_ids: selectedIds,
      });
      const outcome = bulkOutcome(response.data.data, selectedIds);
      setSelectedIds(outcome.pending);
      directory.setMessage(outcome.message);
      invalidateAll();
    } catch (err) {
      directory.setMessage(
        apiFailure(err).message ||
          "No se pudo confirmar la acción; la selección se conserva.",
      );
    } finally {
      setBulkActionRunning(false);
    }
  };

  const handleExportCSV = () => void directory.exportCSV();

  const handleFormSubmit = async (data: CreateSecurityHeaderTargetData) => {
    if (editingTarget) {
      await updateMutation.mutateAsync({ id: editingTarget.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleOpenCreate = () => {
    setEditingTarget(null);
    setShowForm(true);
  };

  const handleOpenEdit = (target: SecurityHeaderTarget) => {
    setEditingTarget(target);
    setShowForm(true);
  };

  useLinkedResource(targets, selectedTarget, setSelectedTarget);

  return {
    directory,
    stats,
    targets,
    isLoading,
    isError,
    refetch,
    selectedTarget,
    setSelectedTarget,
    showForm,
    setShowForm,
    editingTarget,
    setEditingTarget,
    deleteTarget,
    setDeleteTarget,
    gradeFilter,
    setGradeFilter,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    selectedIds,
    setSelectedIds,
    scanningId,
    bulkActionRunning,
    autoRefresh,
    results,
    isLoadingResults,
    scanMutation,
    deleteMutation,
    handleToggleSelect,
    handleToggleEnabled,
    handleExecuteBulkAction,
    handleExportCSV,
    handleFormSubmit,
    handleOpenCreate,
    handleOpenEdit,
  };
}
