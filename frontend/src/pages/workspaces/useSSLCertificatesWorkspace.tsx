import { sslStatus } from "../../utils/healthPresentation";
import { useConnectivityDirectory } from "../../hooks/useConnectivityDirectory";
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
  SSLCertificate,
  CreateSSLCertificateData,
  SSLStats,
  SSLTestConnectionResult,
} from "../../types/ssl";
import { useConnectivityRefresh } from "../../hooks/useConnectivityRefresh";
import { usePersistentViewMode } from "../../hooks/usePersistentViewMode";

/** Data, mutations and transient workflow state; rendering stays in the page. */
export function useSSLCertificatesWorkspace() {
  const organizationId = useAuthStore((state) => state.user?.organization?.id);

  const queryClient = useQueryClient();

  // State
  const [filter, setFilter] = useUrlFilter("status", [
    "all",
    "expiring",
    "expired",
  ] as const);
  const [searchTerm, setSearchTerm] = useState("");
  // Persistent viewMode: remembers table or grid across refreshes and updates
  const [viewMode, setViewMode] = usePersistentViewMode(
    "ssl_certificates",
    "table",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Modals & Drawer State
  const [showModal, setShowModal] = useState(false);
  const [editingCert, setEditingCert] = useState<SSLCertificate | null>(null);
  const [selectedCert, setSelectedCert] = useState<SSLCertificate | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [portInput, setPortInput] = useState<number>(443);
  const [deleteTarget, setDeleteTarget] = useState<SSLCertificate | null>(null);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"overview" | "sans" | "technical">(
    "overview",
  );
  const [sanSearchTerm, setSanSearchTerm] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Live Test Connection State
  const diagnostic = useConfigurationDiagnostic();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<SSLTestConnectionResult | null>(
    null,
  );

  // Read cadence follows the server plan; GET never triggers a scan.
  const autoRefresh = useConnectivityRefresh();

  const { data: stats } = useQuery<SSLStats>({
    queryKey: ["ssl-stats", organizationId],
    queryFn: async () => {
      const response = await api.get("ssl-certificates/stats/");
      return (response.data?.data || {}) as SSLStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const directory = useConnectivityDirectory<SSLCertificate>(
    "ssl-certificates/",
    "ssl-certificates",
    { search: searchTerm, status: filter },
    autoRefresh.refetchInterval,
  );
  const { data: certificates, isLoading, isError, refetch } = directory;
  const selectionScope = JSON.stringify(directory.params);
  useEffect(() => setSelectedIds([]), [selectionScope]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateSSLCertificateData) => {
      await api.post("ssl-certificates/", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ssl-certificates", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["ssl-stats", organizationId],
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
      queryClient.invalidateQueries({
        queryKey: ["ssl-certificates", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["ssl-stats", organizationId],
      });
      handleCloseModal();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const response = await api.post(`ssl-certificates/${id}/scan/`);
      const queued = response.data?.data as QueuedScan;
      return waitForFreshScan<SSLCertificate>(
        queued,
        async () =>
          (await api.get(`ssl-certificates/${id}/`)).data
            ?.data as SSLCertificate,
        (certificate) => certificate.last_scanned_at,
      );
    },
    onSuccess: (updatedCert) => {
      queryClient.invalidateQueries({
        queryKey: ["ssl-certificates", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["ssl-stats", organizationId],
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
      queryClient.invalidateQueries({
        queryKey: ["ssl-certificates", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["ssl-stats", organizationId],
      });
      if (selectedCert?.id === deleteTarget?.id) {
        setSelectedCert(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Actions via backend endpoint
  const handleToggleSelect = (cert: SSLCertificate) => {
    setSelectedIds((prev) =>
      prev.includes(cert.id)
        ? prev.filter((id) => id !== cert.id)
        : [...prev, cert.id],
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredCertificates) return;
    if (selectedIds.length === filteredCertificates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCertificates.map((c) => c.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !(await directory.confirmDelete(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} certificados seleccionados?`,
      ))
    )
      return;
    setBulkDeleting(true);
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
      setBulkDeleting(false);
      return;
    }

    setBulkDeleting(false);
    queryClient.invalidateQueries({
      queryKey: ["ssl-certificates", organizationId],
    });
    queryClient.invalidateQueries({ queryKey: ["ssl-stats", organizationId] });
  };

  // Test SSL Connection in Modal
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

  // Export CSV Report
  const handleExportCSV = () => void directory.exportCSV();

  // Modal Handlers
  const handleOpenCreate = () => {
    setEditingCert(null);
    setDomainInput("");
    setPortInput(443);
    setTestResult(null);
    setShowModal(true);
  };

  const handleOpenEdit = (cert: SSLCertificate, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  const handleCopyFingerprint = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFingerprint(true);
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  const getStatusType = sslStatus;

  // KPI Calculations
  const allCerts = certificates || [];
  const totalCount = stats?.total ?? "—";
  const validCount = stats?.valid ?? "—";
  const expiringCount = stats?.expiring_30d ?? "—";
  const expiredCount = stats?.expired ?? "—";
  const filteredCertificates = allCerts;

  useLinkedResource(certificates, selectedCert, setSelectedCert);
  return {
    directory,
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
    editingCert,
    selectedCert,
    setSelectedCert,
    domainInput,
    setDomainInput,
    portInput,
    setPortInput,
    deleteTarget,
    setDeleteTarget,
    copiedFingerprint,
    drawerTab,
    setDrawerTab,
    sanSearchTerm,
    setSanSearchTerm,
    bulkDeleting,
    diagnostic,
    isTestingConnection,
    testResult,
    setTestResult,
    autoRefresh,
    stats,
    certificates,
    isLoading,
    isError,
    refetch,
    createMutation,
    updateMutation,
    scanMutation,
    deleteMutation,
    handleToggleSelect,
    handleSelectAllToggle,
    handleBulkDelete,
    handleTestConnection,
    handleExportCSV,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitModal,
    handleCopyFingerprint,
    getStatusType,
    totalCount,
    validCount,
    expiringCount,
    expiredCount,
    filteredCertificates,
  };
}
