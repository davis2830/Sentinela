import { apiFailure } from "../../services/errors";
import { useConfigurationDiagnostic } from "../../hooks/useConfigurationDiagnostic";
import { useLinkedResource } from "../../hooks/useLinkedResource";
import { useUrlFilter } from "../../hooks/useUrlFilter";
import { useAuthStore } from "../../store/authStore";
import React, { useState } from "react";
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

function renderNameServersList(nsData: unknown): string[] {
  if (!nsData) return [];
  if (Array.isArray(nsData))
    return nsData.map((item) => String(item).toLowerCase());
  if (typeof nsData === "string") {
    try {
      const parsed = JSON.parse(nsData);
      if (Array.isArray(parsed))
        return parsed.map((item) => String(item).toLowerCase());
    } catch {
      return nsData
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((s) => s.toLowerCase());
    }
  }
  return [];
}
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

  const getEndpoint = () => {
    switch (filter) {
      case "expiring":
        return "domains/expiring/?days=30";
      case "expired":
        return "domains/expired/";
      default:
        return "domains/";
    }
  };

  const { data: stats } = useQuery<DomainStats>({
    queryKey: ["domain-stats", organizationId],
    queryFn: async () => {
      const response = await api.get("domains/stats/");
      return (response.data?.data || {}) as DomainStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const { data: domains, isLoading } = useQuery<DomainInfo[]>({
    queryKey: ["domains", organizationId, filter],
    queryFn: async () => {
      const response = await api.get(getEndpoint());
      return (response.data?.data || []) as DomainInfo[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

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
      !window.confirm(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} dominios seleccionados?`,
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    try {
      await api.post("domains/bulk-action/", {
        action: "delete",
        domain_ids: selectedIds,
      });
    } catch (error) {
      window.alert(
        apiFailure(error).response?.data.message ||
          "No se pudo eliminar la selección. Puedes volver a intentarlo.",
      );
      setBulkDeleting(false);
      return;
    }
    setSelectedIds([]);
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
  const handleExportCSV = () => {
    if (!domains || domains.length === 0) return;
    const headers = [
      "Dominio",
      "Registrador",
      "Bloqueo EPP (Transfer Lock)",
      "Días Restantes",
      "Fecha Vencimiento",
      "Fecha Creación",
      "Servidores NS",
      "Última Sincronización",
    ];
    const rows = domains.map((d) => [
      d.domain,
      `"${d.registrar || "Desconocido"}"`,
      d.is_locked ? "Protegido (Locked)" : "Sin Bloqueo",
      d.days_until_expiration ?? "N/A",
      d.expiration_date
        ? new Date(d.expiration_date).toISOString().split("T")[0]
        : "N/A",
      d.creation_date
        ? new Date(d.creation_date).toISOString().split("T")[0]
        : "N/A",
      `"${renderNameServersList(d.name_servers).join(" ; ")}"`,
      d.last_scanned_at ? new Date(d.last_scanned_at).toISOString() : "N/A",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `sentinel_dominios_whois_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  const getStatusType = (domain: DomainInfo) => {
    if (domain.status === "error" || Boolean(domain.error_message))
      return "fallo";
    const days = domain.days_until_expiration;
    if (days !== null && days <= 0) return "expirado";
    if (days !== null && days <= 30) return "por_expirar";
    return "valido";
  };

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
  const totalCount = stats?.total || allDomains.length;
  const activeCount =
    stats?.active ||
    allDomains.filter(
      (d: DomainInfo) =>
        !d.error_message && (d.days_until_expiration ?? 999) > 30,
    ).length;
  const expiringCount =
    stats?.expiring_30d ||
    allDomains.filter(
      (d: DomainInfo) =>
        d.days_until_expiration !== null &&
        d.days_until_expiration <= 30 &&
        d.days_until_expiration > 0,
    ).length;
  const lockedCount =
    stats?.locked_count ||
    allDomains.filter((d: DomainInfo) => d.is_locked).length;

  // Filtered & Searched Domains
  const filteredDomains = allDomains.filter((domain: DomainInfo) => {
    const matchesSearch =
      domain.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (domain.registrar &&
        domain.registrar.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filter === "expiring") {
      return (
        domain.days_until_expiration !== null &&
        domain.days_until_expiration <= 30 &&
        domain.days_until_expiration > 0
      );
    }
    if (filter === "expired") {
      return (
        domain.status === "error" ||
        Boolean(domain.error_message) ||
        (domain.days_until_expiration !== null &&
          domain.days_until_expiration <= 0)
      );
    }

    return true;
  });

  useLinkedResource(domains, selectedDomain, setSelectedDomain);
  return {
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
