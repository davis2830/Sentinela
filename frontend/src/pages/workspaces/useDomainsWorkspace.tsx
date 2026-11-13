import { useConnectivityDirectory } from "../../hooks/useConnectivityDirectory";
import { domainStatus } from "../../utils/healthPresentation";
import { bulkOutcome } from "../../utils/bulkOutcome";
import { apiFailure } from "../../services/errors";
import { useConfigurationDiagnostic } from "../../hooks/useConfigurationDiagnostic";
import { useLinkedResource } from "../../hooks/useLinkedResource";
import { useUrlFilter } from "../../hooks/useUrlFilter";
import { useAuthStore } from "../../store/authStore";
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { waitForFreshScan, type QueuedScan } from "../../utils/scanPolling";
import type {
  DomainInfo,
  CreateDomainInfoData,
  DomainStats,
  DomainTestWhoisResult,
} from "../../types/domain";
import { useConnectivityRefresh } from "../../hooks/useConnectivityRefresh";
import { usePersistentViewMode } from "../../hooks/usePersistentViewMode";

/** Data, mutations and transient workflow state; rendering stays in the page. */
export function useDomainsWorkspace() {
  const organizationId = useAuthStore((state) => state.user?.organization?.id);

  const queryClient = useQueryClient();

  // State
  const [filter, setFilter] = useUrlFilter("status", [
    "all",
    "expiring",
    "expired",
  ] as const);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = usePersistentViewMode("domains", "table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Modals & Drawer State
  const [showModal, setShowModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainInfo | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainInfo | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DomainInfo | null>(null);
  const [drawerTab, setDrawerTab] = useState<
    "overview" | "security" | "nameservers"
  >("overview");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Live Test WHOIS State
  const diagnostic = useConfigurationDiagnostic();
  const [isTestingWhois, setIsTestingWhois] = useState(false);
  const [testResult, setTestResult] = useState<DomainTestWhoisResult | null>(
    null,
  );

  // Read cadence follows the server plan; GET never triggers a scan.
  const autoRefresh = useConnectivityRefresh();

  const { data: stats } = useQuery<DomainStats>({
    queryKey: ["domain-stats", organizationId],
    queryFn: async () => {
      const response = await api.get("domains/stats/");
      return (response.data?.data || {}) as DomainStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const directory = useConnectivityDirectory<DomainInfo>(
    "domains/",
    "domains",
    { search: searchTerm, status: filter },
    autoRefresh.refetchInterval,
  );
  const { data: domains, isLoading, isError, refetch } = directory;
  const selectionScope = JSON.stringify(directory.params);
  useEffect(() => setSelectedIds([]), [selectionScope]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateDomainInfoData) => {
      await api.post("domains/", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains", organizationId] });
      queryClient.invalidateQueries({
        queryKey: ["domain-stats", organizationId],
      });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, domain }: { id: string; domain: string }) => {
      await api.patch(`domains/${id}/`, { domain });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains", organizationId] });
      queryClient.invalidateQueries({
        queryKey: ["domain-stats", organizationId],
      });
      handleCloseModal();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const response = await api.post(`domains/${id}/scan/`);
      const queued = response.data?.data as QueuedScan;
      return waitForFreshScan<DomainInfo>(
        queued,
        async () => (await api.get(`domains/${id}/`)).data?.data as DomainInfo,
        (domain) => domain.last_scanned_at,
      );
    },
    onSuccess: (updatedDomain) => {
      queryClient.invalidateQueries({ queryKey: ["domains", organizationId] });
      queryClient.invalidateQueries({
        queryKey: ["domain-stats", organizationId],
      });
      if (
        selectedDomain &&
        updatedDomain &&
        selectedDomain.id === updatedDomain.id
      ) {
        setSelectedDomain(updatedDomain);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`domains/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains", organizationId] });
      queryClient.invalidateQueries({
        queryKey: ["domain-stats", organizationId],
      });
      if (selectedDomain?.id === deleteTarget?.id) {
        setSelectedDomain(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Actions via backend endpoint
  const handleToggleSelect = (domain: DomainInfo) => {
    setSelectedIds((prev) =>
      prev.includes(domain.id)
        ? prev.filter((id) => id !== domain.id)
        : [...prev, domain.id],
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredDomains || filteredDomains.length === 0) return;
    if (selectedIds.length === filteredDomains.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDomains.map((d: DomainInfo) => d.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !(await directory.confirmDelete(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} dominios seleccionados?`,
      ))
    )
      return;
    setBulkDeleting(true);
    try {
      const response = await api.post("domains/bulk-action/", {
        action: "delete",
        domain_ids: selectedIds,
      });
      const outcome = bulkOutcome(response.data.data, selectedIds);
      setSelectedIds(outcome.pending);
      directory.setMessage(outcome.message);
    } catch {
      directory.setMessage(
        "No se pudo eliminar la selección. Puedes volver a intentarlo.",
      );
      setBulkDeleting(false);
      return;
    }

    setBulkDeleting(false);
    queryClient.invalidateQueries({ queryKey: ["domains", organizationId] });
    queryClient.invalidateQueries({
      queryKey: ["domain-stats", organizationId],
    });
  };

  // Test WHOIS Query Live in Modal
  const handleTestWhois = async () => {
    if (!domainInput.trim()) return;
    setIsTestingWhois(true);
    setTestResult(null);

    let cleanDomain = domainInput.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (cleanDomain.includes(":")) {
      cleanDomain = cleanDomain.split(":")[0];
    }

    try {
      const response = await diagnostic.run("domains/test-whois/", {
        domain: cleanDomain,
      });
      setTestResult(response.data?.data as DomainTestWhoisResult);
    } catch (caughtError: unknown) {
      const err = apiFailure(caughtError);
      if (diagnostic.isLimit(err)) return;
      setTestResult({
        success: false,
        domain: cleanDomain,
        error_message:
          err.response?.data?.message || "Error al consultar servidores WHOIS.",
      });
    } finally {
      setIsTestingWhois(false);
    }
  };

  // Export CSV Report
  const handleExportCSV = () => void directory.exportCSV();

  // Modal Handlers
  const handleOpenCreate = () => {
    setEditingDomain(null);
    setDomainInput("");
    setTestResult(null);
    setShowModal(true);
  };

  const handleOpenEdit = (domain: DomainInfo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDomain(domain);
    setDomainInput(domain.domain);
    setTestResult(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDomain(null);
    setDomainInput("");
    setTestResult(null);
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;

    let cleanDomain = domainInput.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (cleanDomain.includes(":")) {
      cleanDomain = cleanDomain.split(":")[0];
    }

    if (editingDomain) {
      updateMutation.mutate({ id: editingDomain.id, domain: cleanDomain });
    } else {
      createMutation.mutate({ domain: cleanDomain });
    }
  };

  const getStatusType = domainStatus;

  const calculateLifePercentage = (domain: DomainInfo) => {
    if (!domain.creation_date || !domain.expiration_date) return null;
    const start = new Date(domain.creation_date).getTime();
    const end = new Date(domain.expiration_date).getTime();
    const now = Date.now();
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = now - start;
    return Math.min(Math.max(Math.round((elapsed / total) * 100), 0), 100);
  };

  // KPI Calculations
  const allDomains = domains || [];
  const totalCount = stats?.total ?? "—";
  const activeCount = stats?.active ?? "—";
  const expiringCount = stats?.expiring_30d ?? "—";
  const lockedCount = stats?.locked_count ?? "—";

  // Filtered & Searched Domains
  const filteredDomains = allDomains;

  useLinkedResource(domains, selectedDomain, setSelectedDomain);
  return {
    directory,
    isError,
    refetch,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    selectedIds,
    setSelectedIds,
    scanningId,
    showModal,
    editingDomain,
    selectedDomain,
    setSelectedDomain,
    domainInput,
    setDomainInput,
    deleteTarget,
    setDeleteTarget,
    drawerTab,
    setDrawerTab,
    bulkDeleting,
    diagnostic,
    isTestingWhois,
    testResult,
    setTestResult,
    autoRefresh,
    stats,
    domains,
    isLoading,
    createMutation,
    updateMutation,
    scanMutation,
    deleteMutation,
    handleToggleSelect,
    handleSelectAllToggle,
    handleBulkDelete,
    handleTestWhois,
    handleExportCSV,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitModal,
    getStatusType,
    calculateLifePercentage,
    totalCount,
    activeCount,
    expiringCount,
    lockedCount,
    filteredDomains,
  };
}
