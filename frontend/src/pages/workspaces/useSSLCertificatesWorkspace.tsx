import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnectivityDirectory } from "../../hooks/useConnectivityDirectory";
import { useConfigurationDiagnostic } from "../../hooks/useConfigurationDiagnostic";
import { useConnectivityRefresh } from "../../hooks/useConnectivityRefresh";
import { useLinkedResource } from "../../hooks/useLinkedResource";
import { usePersistentViewMode } from "../../hooks/usePersistentViewMode";
import { useUrlFilter } from "../../hooks/useUrlFilter";
import { api } from "../../services/api";
import { apiFailure } from "../../services/errors";
import { useAuthStore } from "../../store/authStore";
import { bulkOutcome } from "../../utils/bulkOutcome";
import { waitForFreshScan, type QueuedScan } from "../../utils/scanPolling";
import type {
  CreateSSLCertificateData,
  SSLCertificate,
  SSLLinkedTarget,
  SSLTestConnectionResult,
} from "../../types/ssl";
import type { SSLDrawerSection } from "../../components/ssl/SSLCertificateTableView";
import {
  loadSSLThresholds,
  saveSSLThresholds,
  useSSLCertificates,
  type SSLDensity,
  type SSLGroupBy,
  type SSLOriginFilter,
  type SSLSortField,
  type SSLThresholds,
} from "../../components/ssl/useSSLCertificates";

/** Data, filters, thresholds, mutations and transient workflow state for SSL & TLS. */
export function useSSLCertificatesWorkspace() {
  const organizationId = useAuthStore((state) => state.user?.organization?.id);
  const queryClient = useQueryClient();

  // Status filter (URL-synced) + search + facet filters
  const [statusFilter, setStatusFilter] = useUrlFilter("status", [
    "all",
    "expired",
    "problem",
    "expiring",
    "valid",
  ] as const);
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(
    () => searchParams.get("search") || "",
  );

  useEffect(() => {
    const paramSearch = searchParams.get("search");
    if (paramSearch !== null && paramSearch !== searchTerm) {
      setSearchTerm(paramSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [issuerFilter, setIssuerFilter] = useState("all");
  const [tlsFilter, setTlsFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState<SSLOriginFilter>("all");
  const [groupBy, setGroupBy] = useState<SSLGroupBy>("none");
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  // Default order: soonest expiration first (with expired & problems above healthy)
  const [sortField, setSortField] = useState<SSLSortField>("expiry");
  const [sortAsc, setSortAsc] = useState(true);

  // Configurable thresholds (default: amber <= 14d, red <= 7d for Let's Encrypt)
  const [thresholds, setThresholdsState] = useState<SSLThresholds>(() =>
    loadSSLThresholds(),
  );
  const setThresholds = (next: SSLThresholds) => {
    setThresholdsState(next);
    saveSSLThresholds(next);
  };

  // Persistent viewMode & density
  const [viewMode, setViewMode] = usePersistentViewMode(
    "ssl_certificates",
    "table",
  );
  const [density, setDensityState] = useState<SSLDensity>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sentinel_ssl_density");
      if (saved === "compact" || saved === "comfortable") return saved;
    }
    return "compact";
  });
  const setDensity = (next: SSLDensity) => {
    setDensityState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("sentinel_ssl_density", next);
    }
  };

  // Selection & scanning
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [linkingCertId, setLinkingCertId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Modals & Drawer State
  const [showModal, setShowModal] = useState(false);
  const [editingCert, setEditingCert] = useState<SSLCertificate | null>(null);
  const [selectedCert, setSelectedCert] = useState<SSLCertificate | null>(null);
  const [drawerSection, setDrawerSection] =
    useState<SSLDrawerSection>("overview");
  const [domainInput, setDomainInput] = useState("");
  const [portInput, setPortInput] = useState<number>(443);
  const [deleteTarget, setDeleteTarget] = useState<SSLCertificate | null>(null);

  // Live Test Connection State
  const diagnostic = useConfigurationDiagnostic();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<SSLTestConnectionResult | null>(
    null,
  );

  // Read cadence follows the server plan; GET never triggers a scan.
  const autoRefresh = useConnectivityRefresh();

  const directory = useConnectivityDirectory<SSLCertificate>(
    "ssl-certificates/",
    "ssl-certificates",
    { search: searchTerm, ordering: "days_remaining" },
    autoRefresh.refetchInterval,
  );
  const { data: certificates, isLoading, isError, refetch } = directory;
  const selectionScope = JSON.stringify(directory.params);
  useEffect(() => setSelectedIds([]), [selectionScope]);

  const allCerts = certificates || [];

  // Keep selectedCert synced when background polling or scan updates the list
  useEffect(() => {
    if (!selectedCert) return;
    const fresh = allCerts.find((c) => c.id === selectedCert.id);
    if (fresh && fresh !== selectedCert) {
      setSelectedCert(fresh);
    }
  }, [allCerts, selectedCert]);

  // Unified client-side summary, threshold-aware status, facets, sorting & grouping
  const { summary, facets, sortedCertificates, groupedCertificates } =
    useSSLCertificates({
      certificates: allCerts,
      thresholds,
      statusFilter,
      issuerFilter,
      tlsFilter,
      gradeFilter,
      originFilter,
      search: searchTerm,
      sortField,
      sortAsc,
      groupBy,
    });

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSortChange = (field: SSLSortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const hasFilters =
    Boolean(searchTerm) ||
    statusFilter !== "all" ||
    issuerFilter !== "all" ||
    tlsFilter !== "all" ||
    gradeFilter !== "all" ||
    originFilter !== "all";

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setIssuerFilter("all");
    setTlsFilter("all");
    setGradeFilter("all");
    setOriginFilter("all");
    setGroupBy("none");
  };

  const createMutation = useMutation({
    mutationFn: async (data: CreateSSLCertificateData) => {
      await api.post("ssl-certificates/", data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["ssl-certificates", organizationId],
      });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      domain,
      port,
    }: {
      id: string;
      domain: string;
      port: number;
    }) => {
      await api.patch(`ssl-certificates/${id}/`, { domain, port });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["ssl-certificates", organizationId],
      });
      handleCloseModal();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const current = allCerts.find((c) => c.id === id);
      const response = await api.post(`ssl-certificates/${id}/scan/`);
      const queued = response.data?.data as QueuedScan;
      return waitForFreshScan<SSLCertificate>(
        queued,
        async () =>
          (await api.get(`ssl-certificates/${id}/`)).data
            ?.data as SSLCertificate,
        (certificate) => certificate.last_scanned_at,
        {
          label: current?.domain,
          formatResult: (cert) => {
            const days =
              cert.days_remaining != null
                ? cert.days_remaining <= 0
                  ? "vencido"
                  : `en ${cert.days_remaining} d`
                : null;
            const statusTxt = cert.error_message
              ? "con problemas"
              : cert.is_valid
                ? "válido"
                : "inválido";
            return {
              message: [cert.domain, statusTxt, days]
                .filter(Boolean)
                .join(" · "),
              tone: cert.error_message || !cert.is_valid
                ? "danger"
                : cert.days_remaining != null &&
                    cert.days_remaining <= thresholds.warningDays
                  ? "warning"
                  : "success",
            };
          },
          onView: (cert) => setSelectedCert(cert),
        },
      );
    },
    onSuccess: (updatedCert) => {
      void queryClient.invalidateQueries({
        queryKey: ["ssl-certificates", organizationId],
      });
      if (selectedCert && updatedCert && selectedCert.id === updatedCert.id) {
        setSelectedCert(updatedCert);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`ssl-certificates/${id}/`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["ssl-certificates", organizationId],
      });
      if (selectedCert?.id === deleteTarget?.id) {
        setSelectedCert(null);
      }
      setDeleteTarget(null);
    },
  });

  const linkTargetMutation = useMutation({
    mutationFn: async ({
      cert,
      target,
    }: {
      cert: SSLCertificate;
      target: SSLLinkedTarget;
    }) => {
      setLinkingCertId(cert.id);
      await api.patch(`monitoring/${target.id}/coverage/`, {
        ssl: [cert.id],
      });
      return { cert, target };
    },
    onSuccess: ({ cert, target }) => {
      directory.setMessage(
        `${cert.domain} vinculado al target ${target.name} en Uptime.`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["ssl-certificates", organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["monitoring-targets", organizationId],
      });
      setLinkingCertId(null);
    },
    onError: () => {
      directory.setMessage(
        "No se pudo vincular el certificado con el target en Uptime.",
      );
      setLinkingCertId(null);
    },
  });

  const handleToggleSelect = (cert: SSLCertificate) => {
    setSelectedIds((prev) =>
      prev.includes(cert.id)
        ? prev.filter((id) => id !== cert.id)
        : [...prev, cert.id],
    );
  };

  const handleSelectAllToggle = () => {
    if (sortedCertificates.length === 0) return;
    if (selectedIds.length === sortedCertificates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedCertificates.map((c) => c.id));
    }
  };

  const handleBulkScan = async () => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      const response = await api.post("ssl-certificates/bulk-action/", {
        action: "scan",
        certificate_ids: selectedIds,
      });
      const outcome = bulkOutcome(response.data.data, selectedIds);
      setSelectedIds(outcome.pending);
      directory.setMessage(outcome.message);
      void queryClient.invalidateQueries({
        queryKey: ["ssl-certificates", organizationId],
      });
    } catch {
      directory.setMessage("No se pudo revalidar la selección.");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !(await directory.confirmDelete(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} certificados seleccionados? Los que estén vinculados a Uptime se desvincularán.`,
      ))
    )
      return;
    setBulkBusy(true);
    try {
      const response = await api.post("ssl-certificates/bulk-action/", {
        action: "delete",
        certificate_ids: selectedIds,
      });
      const outcome = bulkOutcome(response.data.data, selectedIds);
      setSelectedIds(outcome.pending);
      directory.setMessage(outcome.message);
    } catch {
      directory.setMessage(
        "No se pudo eliminar la selección. Puedes volver a intentarlo.",
      );
      setBulkBusy(false);
      return;
    }

    setBulkBusy(false);
    void queryClient.invalidateQueries({
      queryKey: ["ssl-certificates", organizationId],
    });
  };

  const handleTestConnection = async () => {
    if (!domainInput.trim()) return;
    setIsTestingConnection(true);
    setTestResult(null);

    let cleanDomain = domainInput.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (cleanDomain.includes(":")) {
      cleanDomain = cleanDomain.split(":")[0];
    }

    try {
      const response = await diagnostic.run(
        "ssl-certificates/test-connection/",
        {
          domain: cleanDomain,
          port: portInput || 443,
        },
      );
      setTestResult(response.data?.data as SSLTestConnectionResult);
    } catch (caughtError: unknown) {
      const err = apiFailure(caughtError);
      if (diagnostic.isLimit(err)) return;
      setTestResult({
        domain: cleanDomain,
        port: portInput || 443,
        is_valid: false,
        error_message:
          err.response?.data?.message ||
          "Error de conexión con el servidor SSL.",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleExportCSV = () => void directory.exportCSV();

  const handleOpenCreate = () => {
    setEditingCert(null);
    setDomainInput("");
    setPortInput(443);
    setTestResult(null);
    setShowModal(true);
  };

  const handleOpenEdit = (cert: SSLCertificate) => {
    setEditingCert(cert);
    setDomainInput(cert.domain);
    setPortInput(cert.port || 443);
    setTestResult(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCert(null);
    setDomainInput("");
    setPortInput(443);
    setTestResult(null);
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;

    let cleanDomain = domainInput.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    let port = portInput || 443;

    if (cleanDomain.includes(":")) {
      const parts = cleanDomain.split(":");
      cleanDomain = parts[0];
      port = parseInt(parts[1], 10) || 443;
    }

    if (editingCert) {
      updateMutation.mutate({ id: editingCert.id, domain: cleanDomain, port });
    } else {
      createMutation.mutate({ domain: cleanDomain, port });
    }
  };

  const handleSelectCert = (
    cert: SSLCertificate,
    section: SSLDrawerSection = "overview",
  ) => {
    setDrawerSection(section);
    setSelectedCert(cert);
  };

  useLinkedResource(certificates, selectedCert, setSelectedCert);

  return {
    directory,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    issuerFilter,
    setIssuerFilter,
    tlsFilter,
    setTlsFilter,
    gradeFilter,
    setGradeFilter,
    originFilter,
    setOriginFilter,
    groupBy,
    setGroupBy,
    collapsedGroups,
    toggleGroup,
    sortField,
    sortAsc,
    handleSortChange,
    thresholds,
    setThresholds,
    viewMode,
    setViewMode,
    density,
    setDensity,
    selectedIds,
    setSelectedIds,
    scanningId,
    linkingCertId,
    bulkBusy,
    showModal,
    editingCert,
    selectedCert,
    setSelectedCert,
    drawerSection,
    handleSelectCert,
    domainInput,
    setDomainInput,
    portInput,
    setPortInput,
    deleteTarget,
    setDeleteTarget,
    diagnostic,
    isTestingConnection,
    testResult,
    setTestResult,
    autoRefresh,
    certificates: allCerts,
    isLoading,
    isError,
    refetch,
    createMutation,
    updateMutation,
    scanMutation,
    deleteMutation,
    linkTargetMutation,
    handleToggleSelect,
    handleSelectAllToggle,
    handleBulkScan,
    handleBulkDelete,
    handleTestConnection,
    handleExportCSV,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitModal,
    hasFilters,
    clearAllFilters,
    summary,
    facets,
    sortedCertificates,
    groupedCertificates,
  };
}
