import { securityTone, measuredAt } from "../../utils/endpointPresentation";
import { useLinkedResource } from "../../hooks/useLinkedResource";
import { useUrlFilter } from "../../hooks/useUrlFilter";
import { useAuthStore } from "../../store/authStore";
import React, { useState } from "react";
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

type DrawerTabType = "audit" | "remediation" | "leaks_raw" | "history";
type ServerSnippetType = "nginx" | "apache" | "caddy" | "cloudflare" | "iis";

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
  const [serverSnippetType, setServerSnippetType] =
    useState<ServerSnippetType>("nginx");
  const [copiedSnippet, setCopiedSnippet] = useState(false);
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
  const { data: targets, isLoading } = useQuery<SecurityHeaderTarget[]>({
    queryKey: ["security-header-targets", organizationId],
    queryFn: async () => {
      const response = await api.get("security-headers/");
      return (response.data?.data || []) as SecurityHeaderTarget[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

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
      !window.confirm(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} endpoints seleccionados?`,
      )
    ) {
      return;
    }

    setBulkActionRunning(true);
    try {
      await api.post("security-headers/bulk-action/", {
        action,
        target_ids: selectedIds,
      });
      queryClient.invalidateQueries({
        queryKey: ["security-header-targets", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["security-header-stats", organizationId],
      });
      if (action === "delete") {
        setSelectedIds([]);
      }
    } catch (err) {
      console.error("Error executing bulk action:", err);
    } finally {
      setBulkActionRunning(false);
    }
  };

  // CSV Export Function
  const handleExportCSV = () => {
    if (!targets || targets.length === 0) return;

    const headers = [
      "Nombre",
      "URL",
      "Calificación",
      "Puntuación",
      "HSTS Activo",
      "CSP Activo",
      "X-Frame-Options",
      "Fuga de Stack",
      "Servidor Detectado",
      "Latencia (ms)",
      "Estado Monitoreo",
      "Último Análisis",
    ];

    const rows = targets.map((t) => [
      `"${(t.name || "").replace(/"/g, '""')}"`,
      `"${(t.url || "").replace(/"/g, '""')}"`,
      `"${t.last_grade || (t.last_score !== null ? calculateGrade(t.last_score) : "N/A")}"`,
      t.last_score !== null ? t.last_score : "",
      t.has_hsts ? "Sí" : "No",
      t.has_csp ? "Sí" : "No",
      t.has_xfo ? "Sí" : "No",
      t.info_leak_detected ? "Sí" : "No",
      `"${(t.server_header || t.powered_by_header || "").replace(/"/g, '""')}"`,
      t.last_response_time_ms !== null && t.last_response_time_ms !== undefined
        ? t.last_response_time_ms
        : "",
      t.enabled ? "Activo" : "Pausado",
      t.last_checked_at
        ? new Date(t.last_checked_at).toLocaleString("es-ES")
        : "Nunca",
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentinel_security_headers_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
  const totalCount = stats?.total || allTargets.length;
  const healthTone = (t: SecurityHeaderTarget) =>
    !measuredAt(t as unknown as Record<string, unknown>)
      ? "muted"
      : securityTone(t.last_score) === "success" && t.info_leak_detected
        ? "warning"
        : securityTone(t.last_score);
  const gradeACount =
    stats?.healthy ??
    allTargets.filter((t) => healthTone(t) === "success").length;
  const gradeBCCount =
    stats?.warning ??
    allTargets.filter((t) => healthTone(t) === "warning").length;
  const gradeDFCount =
    stats?.critical ??
    allTargets.filter((t) => healthTone(t) === "danger").length;
  const unmeasuredCount =
    stats?.unmeasured ??
    allTargets.filter((t) => healthTone(t) === "muted").length;
  const infoLeaksCount =
    stats?.info_leaks_count ??
    allTargets.filter((t) => t.info_leak_detected).length;

  // Filtered & Searched Targets
  const filteredTargets = allTargets.filter((t: SecurityHeaderTarget) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.server_header &&
        t.server_header.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.powered_by_header &&
        t.powered_by_header.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    const score = t.last_score;
    if (gradeFilter === "healthy") return healthTone(t) === "success";
    if (gradeFilter === "warning") return healthTone(t) === "warning";
    if (gradeFilter === "critical") return healthTone(t) === "danger";
    if (gradeFilter === "unmeasured") return healthTone(t) === "muted";
    if (gradeFilter === "grade_a") return score !== null && score >= 80;
    if (gradeFilter === "grade_bc")
      return score !== null && score >= 60 && score < 80;
    if (gradeFilter === "grade_df") return score === null || score < 60;

    return true;
  });

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

  // Generate Web Server Snippets based on missing / standard headers
  const generateServerSnippet = (
    type: ServerSnippetType,
    target: SecurityHeaderTarget | null,
  ) => {
    const hostname = target ? target.name : "Servidor Web";

    if (type === "nginx") {
      return `# ========================================================
# Cabeceras de Seguridad recomendadas para ${hostname}
# Agregar en el bloque 'server' o 'location /' de nginx.conf
# ========================================================

# Protección contra Clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;

# Prevención de sniffing de tipos MIME
add_header X-Content-Type-Options "nosniff" always;

# HSTS estricto (1 año, subdominios y apto para preload)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Política de control de orígenes de contenido (CSP)
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'self';" always;

# Protección de privacidad de referencia
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Restricción de permisos de hardware
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;

# Aislamiento de contexto de navegación (COOP & CORP)
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;

# Suprimir versión del servidor (Mitigación Fuga de Stack)
server_tokens off;`;
    }

    if (type === "apache") {
      return `# ========================================================
# Cabeceras de Seguridad recomendadas para ${hostname}
# Agregar en .htaccess o en VirtualHost de httpd.conf
# Requiere habilitar: a2enmod headers
# ========================================================

<IfModule mod_headers.c>
    # Protección contra Clickjacking
    Header always set X-Frame-Options "SAMEORIGIN"

    # Prevención de sniffing de tipos MIME
    Header always set X-Content-Type-Options "nosniff"

    # HSTS estricto (1 año, subdominios y apto para preload)
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

    # Política de control de orígenes de contenido (CSP)
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'self';"

    # Privacidad de referencia
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    # Restricción de permisos de hardware
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"

    # Suprimir cabeceras que exponen runtimes
    Header always unset X-Powered-By
    Header always unset Server
</IfModule>

# Suprimir versión del servidor (Mitigación Fuga de Stack)
ServerTokens Prod
ServerSignature Off`;
    }

    if (type === "caddy") {
      return `# ========================================================
# Cabeceras de Seguridad recomendadas para Caddy Server
# Agregar en el bloque del sitio en Caddyfile
# ========================================================

header {
    # HSTS estricto (1 año, subdominios y preload)
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

    # Anti-Clickjacking y Anti-Sniffing
    X-Frame-Options "SAMEORIGIN"
    X-Content-Type-Options "nosniff"

    # Políticas de Referencia y Permisos
    Referrer-Policy "strict-origin-when-cross-origin"
    Permissions-Policy "camera=(), microphone=(), geolocation=()"

    # Content-Security-Policy
    Content-Security-Policy "default-src 'self'; object-src 'none';"

    # Aislamiento de contexto
    Cross-Origin-Opener-Policy "same-origin"

    # Ocultar firmas de servidor
    -Server
    -X-Powered-By
}`;
    }

    if (type === "cloudflare") {
      return `# ========================================================
# Reglas de Transformación en Cloudflare Dashboard
# Ruta: Reglas (Rules) -> Reglas de Transformación (Transform Rules)
# Pestaña: Modificar Cabecera de Respuesta HTTP (Response Header)
# ========================================================

1. Establecer cabeceras estáticas (Set static):
   - Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
   - X-Frame-Options           = "SAMEORIGIN"
   - X-Content-Type-Options    = "nosniff"
   - Referrer-Policy           = "strict-origin-when-cross-origin"
   - Permissions-Policy        = "camera=(), microphone=(), geolocation=()"
   - Content-Security-Policy   = "default-src 'self'; object-src 'none';"

2. Eliminar cabeceras dinámicas que exponen stack (Remove headers):
   - Server
   - X-Powered-By
   - X-AspNet-Version`;
    }

    if (type === "iis") {
      return `<!-- ======================================================== -->
<!-- Configuración para Microsoft IIS (web.config)             -->
<!-- Agregar dentro de la etiqueta <system.webServer>           -->
<!-- ======================================================== -->

<httpProtocol>
  <customHeaders>
    <add name="X-Frame-Options" value="SAMEORIGIN" />
    <add name="X-Content-Type-Options" value="nosniff" />
    <add name="Strict-Transport-Security" value="max-age=31536000; includeSubDomains; preload" />
    <add name="Referrer-Policy" value="strict-origin-when-cross-origin" />
    <add name="Permissions-Policy" value="camera=(), microphone=(), geolocation=()" />
    <remove name="X-Powered-By" />
  </customHeaders>
</httpProtocol>

<!-- Ocultar cabecera Server en IIS 10.0+ -->
<security>
  <requestFiltering removeServerHeader="true" />
</security>`;
    }

    return "";
  };

  const handleCopySnippet = () => {
    const text = generateServerSnippet(serverSnippetType, selectedTarget);
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  useLinkedResource(targets, selectedTarget, setSelectedTarget);
  return {
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
    serverSnippetType,
    setServerSnippetType,
    copiedSnippet,
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
    generateServerSnippet,
    handleCopySnippet,
  };
}
