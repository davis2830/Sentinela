import { securityTone, measuredAt } from "../../utils/endpointPresentation";
import { useConnectivityDirectory } from "../../hooks/useConnectivityDirectory";
import { apiFailure } from "../../services/errors";
import { bulkOutcome } from "../../utils/bulkOutcome";
import { useLinkedResource } from "../../hooks/useLinkedResource";
import { useUrlFilter } from "../../hooks/useUrlFilter";
import { useAuthStore } from "../../store/authStore";
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { waitForFreshScan, type QueuedScan } from "../../utils/scanPolling";
import type {
  SecurityHeaderTarget,
  SecurityHeaderResult,
  CreateSecurityHeaderTargetData,
  SecurityHeaderStats,
  SecurityGrade,
} from "../../types/security_headers";
import { useConnectivityRefresh } from "../../hooks/useConnectivityRefresh";
import { usePersistentViewMode } from "../../hooks/usePersistentViewMode";

type DrawerTabType = "audit" | "leaks_raw" | "history";

/** Data, mutations and transient workflow state; rendering stays in the page. */
export function useSecurityHeadersWorkspace() {
  const organizationId = useAuthStore((state) => state.user?.organization?.id);

  const queryClient = useQueryClient();

  // State
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
    "grade_a",
    "grade_bc",
    "grade_df",
    "healthy",
    "warning",
    "critical",
    "unmeasured",
  ] as const);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = usePersistentViewMode(
    "security_headers",
    "table",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTabType>("audit");
  const [rawHeadersFilter, setRawHeadersFilter] = useState("");
  const [bulkActionRunning, setBulkActionRunning] = useState(false);

  // Read cadence follows the server plan; GET never triggers a scan.
  const autoRefresh = useConnectivityRefresh();

  // Stats query
  const { data: stats } = useQuery<SecurityHeaderStats>({
    queryKey: ["security-header-stats", organizationId],
    queryFn: async () => {
      const response = await api.get("security-headers/stats/");
      return (response.data?.data || {}) as SecurityHeaderStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Targets query
  const directory = useConnectivityDirectory<SecurityHeaderTarget>(
    "security-headers/",
    "security-header-targets",
    { search: searchTerm, grade: gradeFilter },
    autoRefresh.refetchInterval,
  );
  const { data: targets, isLoading, isError, refetch } = directory;
  const selectionScope = JSON.stringify(directory.params);
  useEffect(() => setSelectedIds([]), [selectionScope]);

  // Target scan results query for selectedTarget
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

  const createMutation = useMutation({
    mutationFn: async (data: CreateSecurityHeaderTargetData) => {
      await api.post("security-headers/", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["security-header-targets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["security-header-stats", organizationId],
      });
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
      data: CreateSecurityHeaderTargetData;
    }) => {
      await api.patch(`security-headers/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["security-header-targets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["security-header-stats", organizationId],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["security-header-targets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["security-header-stats", organizationId],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["security-header-targets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["security-header-stats", organizationId],
      });
      if (selectedTarget?.id === deleteTarget?.id) {
        setSelectedTarget(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Actions
  const handleToggleSelect = (target: SecurityHeaderTarget) => {
    setSelectedIds((prev) =>
      prev.includes(target.id)
        ? prev.filter((id) => id !== target.id)
        : [...prev, target.id],
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredTargets || filteredTargets.length === 0) return;
    if (selectedIds.length === filteredTargets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTargets.map((t) => t.id));
    }
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
      queryClient.invalidateQueries({
        queryKey: ["security-header-targets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["security-header-stats", organizationId],
      });
    } catch (err) {
      directory.setMessage(
        apiFailure(err).response?.data.message ||
          "No se pudo confirmar la acción; la selección se conserva.",
      );
    } finally {
      setBulkActionRunning(false);
    }
  };

  // CSV Export Function
  const handleExportCSV = () => void directory.exportCSV();

  // Form Handlers
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

  const handleOpenEdit = (
    target: SecurityHeaderTarget,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    setEditingTarget(target);
    setShowForm(true);
  };

  const parseHeadersList = (
    headers: string[] | Record<string, string> | undefined,
  ): string[] => {
    if (!headers) return [];
    if (Array.isArray(headers)) return headers;
    return Object.keys(headers);
  };

  const calculateGrade = (score: number | null): SecurityGrade | null => {
    if (score === null) return null;
    if (score >= 95) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    return "F";
  };

  // KPI Calculations
  const allTargets = targets || [];
  const healthTone = (t: SecurityHeaderTarget) =>
    !measuredAt(t as unknown as Record<string, unknown>)
      ? "muted"
      : securityTone(t.last_score) === "success" && t.info_leak_detected
        ? "warning"
        : securityTone(t.last_score);
  const totalCount = stats?.total ?? "—";
  const gradeACount = stats?.healthy ?? "—";
  const gradeBCCount = stats?.warning ?? "—";
  const gradeDFCount = stats?.critical ?? "—";
  const unmeasuredCount = stats?.unmeasured ?? "—";
  const infoLeaksCount = stats?.info_leaks_count ?? "—";

  // Filtered & Searched Targets
  const filteredTargets = allTargets;

  const latestResult: SecurityHeaderResult | null =
    results && results.length > 0 ? results[0] : null;

  const foundHeadersDict: Record<string, string> =
    latestResult?.headers_found &&
    typeof latestResult.headers_found === "object" &&
    !Array.isArray(latestResult.headers_found)
      ? (latestResult.headers_found as Record<string, string>)
      : {};

  const missingList = latestResult
    ? parseHeadersList(latestResult.headers_missing)
    : [];
  const foundList = latestResult
    ? parseHeadersList(latestResult.headers_found)
    : [];
  const directivesAnalysis = latestResult?.directives_analysis || {};
  const infoLeaks = latestResult?.info_leaks || {};
  const rawHeaders = latestResult?.raw_headers || {};

  useLinkedResource(targets, selectedTarget, setSelectedTarget);
  return {
    directory,
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
    drawerTab,
    setDrawerTab,
    rawHeadersFilter,
    setRawHeadersFilter,
    bulkActionRunning,
    autoRefresh,
    targets,
    isLoading,
    results,
    isLoadingResults,
    scanMutation,
    deleteMutation,
    handleToggleSelect,
    handleSelectAllToggle,
    handleExecuteBulkAction,
    handleExportCSV,
    handleFormSubmit,
    handleOpenCreate,
    handleOpenEdit,
    calculateGrade,
    totalCount,
    healthTone,
    gradeACount,
    gradeBCCount,
    gradeDFCount,
    unmeasuredCount,
    infoLeaksCount,
    filteredTargets,
    foundHeadersDict,
    missingList,
    foundList,
    directivesAnalysis,
    infoLeaks,
    rawHeaders,
  };
}
