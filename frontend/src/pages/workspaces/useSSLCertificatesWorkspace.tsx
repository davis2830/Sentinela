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

  const getEndpoint = () => {
    switch (filter) {
      case "expiring":
        return "ssl-certificates/expiring/?days=15";
      case "expired":
        return "ssl-certificates/expired/";
      default:
        return "ssl-certificates/";
    }
  };

  const { data: stats } = useQuery<SSLStats>({
    queryKey: ["ssl-stats", organizationId],
    queryFn: async () => {
      const response = await api.get("ssl-certificates/stats/");
      return (response.data?.data || {}) as SSLStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  const {
    data: certificates,
    isLoading,
    isError,
    refetch,
  } = useQuery<SSLCertificate[]>({
    queryKey: ["ssl-certificates", organizationId, filter],
    queryFn: async () => {
      const response = await api.get(getEndpoint());
      return (response.data?.data || []) as SSLCertificate[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

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
      !window.confirm(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} certificados seleccionados?`,
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    try {
      await api.post("ssl-certificates/bulk-action/", {
        action: "delete",
        certificate_ids: selectedIds,
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
  const handleExportCSV = () => {
    if (!certificates || certificates.length === 0) return;
    const headers = [
      "Dominio",
      "Puerto",
      "Autoridad Emisora (CA)",
      "Estado",
      "Grado Seguridad",
      "Vigencia (Días)",
      "Fecha Expiración",
      "Versión TLS",
      "Algoritmo",
      "SANs Cubiertos",
    ];
    const rows = certificates.map((c) => [
      c.domain,
      c.port || 443,
      `"${(c.issuer || "").replace(/"/g, '""')}"`,
      c.is_valid ? "Válido" : "Fallo",
      c.security_grade || "A",
      c.days_remaining ?? "N/A",
      c.expiration_date
        ? new Date(c.expiration_date).toISOString().split("T")[0]
        : "N/A",
      c.tls_version || "TLSv1.3",
      c.algorithm || "SHA-256",
      `"${(c.san_domains || []).join("; ")}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `sentinel_inventario_ssl_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  const getStatusType = (cert: SSLCertificate) => {
    if (!cert.is_valid) return "fallo";
    const days = cert.days_remaining;
    if (days !== null && days <= 0) return "expirado";
    if (days !== null && days <= 15) return "por_expirar";
    return "valido";
  };

  // KPI Calculations
  const allCerts = certificates || [];
  const totalCount = stats?.total || allCerts.length;
  const validCount =
    stats?.valid || allCerts.filter((c: SSLCertificate) => c.is_valid).length;
  const expiringCount =
    stats?.expiring_15d ||
    allCerts.filter(
      (c: SSLCertificate) =>
        c.days_remaining !== null &&
        c.days_remaining <= 15 &&
        c.days_remaining > 0,
    ).length;
  const expiredCount = (stats?.expired || 0) + (stats?.invalid || 0);

  // Filtered & Searched Certificates
  const filteredCertificates = allCerts.filter((cert: SSLCertificate) => {
    const matchesSearch =
      cert.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cert.issuer &&
        cert.issuer.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (cert.algorithm &&
        cert.algorithm.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (cert.san_domains &&
        cert.san_domains.some((san) =>
          san.toLowerCase().includes(searchTerm.toLowerCase()),
        ));

    if (!matchesSearch) return false;

    if (filter === "expiring") {
      return (
        cert.days_remaining !== null &&
        cert.days_remaining <= 15 &&
        cert.days_remaining > 0
      );
    }
    if (filter === "expired") {
      return (
        !cert.is_valid ||
        (cert.days_remaining !== null && cert.days_remaining <= 0)
      );
    }

    return true;
  });

  useLinkedResource(certificates, selectedCert, setSelectedCert);
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
