import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  SecurityHeaderTarget,
  SecurityHeaderResult,
  CreateSecurityHeaderTargetData,
  SecurityHeaderStats,
  SecurityGrade,
} from '../types/security_headers';
import GradeBadge from '../components/common/GradeBadge';
import EmptyState from '../components/common/EmptyState';
import ConfirmDelete from '../components/common/ConfirmDelete';
import SecurityHeaderForm from '../components/security_headers/SecurityHeaderForm';
import SecurityHeaderTableView from '../components/security_headers/SecurityHeaderTableView';
import {
  NOCPageHeader,
  NOCKpiGrid,
  NOCKpiCard,
  NOCToolbar,
  NOCBulkActionBar,
  NOCDrawer,
} from '../components/common/noc';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { usePersistentViewMode } from '../hooks/usePersistentViewMode';
import {
  ShieldCheck,
  Plus,
  Loader2,
  Trash2,
  RefreshCw,
  Clock,
  Pencil,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  FileCode2,
  AlertTriangle,
  ShieldAlert,
  CheckSquare,
  Square,
  Activity,
  Zap,
  Download,
  Copy,
  Check,
  Lock,
  Layers,
  Server,
  Code2,
  Eye,
  Pause,
  Play,
  Search,
} from 'lucide-react';

type GradeFilterType = 'all' | 'grade_a' | 'grade_bc' | 'grade_df';
type DrawerTabType = 'audit' | 'remediation' | 'leaks_raw' | 'history';
type ServerSnippetType = 'nginx' | 'apache' | 'caddy' | 'cloudflare' | 'iis';

const STANDARD_SECURITY_HEADERS = [
  {
    key: 'content-security-policy',
    name: 'Content-Security-Policy',
    weight: 25,
    description: 'Previene XSS, inyección de datos y clickjacking restringiendo los orígenes de contenido.',
  },
  {
    key: 'strict-transport-security',
    name: 'Strict-Transport-Security (HSTS)',
    weight: 20,
    description: 'Fuerza conexiones HTTPS seguras y protege contra ataques de degradación SSL/TLS.',
  },
  {
    key: 'x-frame-options',
    name: 'X-Frame-Options',
    weight: 15,
    description: 'Protege contra Clickjacking evitando que el sitio sea embebido en iframes no autorizados.',
  },
  {
    key: 'x-content-type-options',
    name: 'X-Content-Type-Options',
    weight: 10,
    description: 'Previene el MIME-sniffing obligando al navegador a respetar el Content-Type declarado.',
  },
  {
    key: 'referrer-policy',
    name: 'Referrer-Policy',
    weight: 10,
    description: 'Controla cuánta información de referencia (URL previa) se transmite en peticiones salientes.',
  },
  {
    key: 'permissions-policy',
    name: 'Permissions-Policy',
    weight: 10,
    description: 'Restringe el acceso del navegador a características de hardware (cámara, micrófono, geolocalización).',
  },
  {
    key: 'cross-origin-opener-policy',
    name: 'Cross-Origin-Opener-Policy (COOP)',
    weight: 5,
    description: 'Aísla el contexto de navegación impidiendo accesos maliciosos entre orígenes.',
  },
  {
    key: 'cross-origin-resource-policy',
    name: 'Cross-Origin-Resource-Policy (CORP)',
    weight: 5,
    description: 'Bloquea lectura no autorizada de recursos estáticos desde otros dominios.',
  },
];

export default function SecurityHeadersPage() {
  const queryClient = useQueryClient();

  // State
  const [selectedTarget, setSelectedTarget] = useState<SecurityHeaderTarget | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SecurityHeaderTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecurityHeaderTarget | null>(null);
  const [gradeFilter, setGradeFilter] = useState<GradeFilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = usePersistentViewMode('security_headers', 'table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTabType>('audit');
  const [serverSnippetType, setServerSnippetType] = useState<ServerSnippetType>('nginx');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [rawHeadersFilter, setRawHeadersFilter] = useState('');
  const [bulkActionRunning, setBulkActionRunning] = useState(false);

  // Auto-refresh hook (15s countdown)
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 15,
    initialEnabled: true,
  });

  // Stats query
  const { data: stats } = useQuery<SecurityHeaderStats>({
    queryKey: ['security-header-stats'],
    queryFn: async () => {
      const response = await api.get('security-headers/stats/');
      return (response.data?.data || {}) as SecurityHeaderStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Targets query
  const { data: targets, isLoading } = useQuery<SecurityHeaderTarget[]>({
    queryKey: ['security-header-targets'],
    queryFn: async () => {
      const response = await api.get('security-headers/');
      return (response.data?.data || []) as SecurityHeaderTarget[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Target scan results query for selectedTarget
  const { data: results, isLoading: isLoadingResults } = useQuery<SecurityHeaderResult[]>({
    queryKey: ['security-header-results', selectedTarget?.id],
    queryFn: async () => {
      if (!selectedTarget) return [];
      const response = await api.get(`security-headers/${selectedTarget.id}/results/`);
      return (response.data?.data || []) as SecurityHeaderResult[];
    },
    enabled: !!selectedTarget,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSecurityHeaderTargetData) => {
      await api.post('security-headers/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
      setShowForm(false);
      setEditingTarget(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateSecurityHeaderTargetData }) => {
      await api.patch(`security-headers/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
      setShowForm(false);
      setEditingTarget(null);
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const response = await api.post(`security-headers/${id}/scan/`);
      return response.data?.data;
    },
    onSuccess: (updatedTarget) => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-results', selectedTarget?.id] });
      if (selectedTarget && updatedTarget && selectedTarget.id === updatedTarget.id) {
        setSelectedTarget(updatedTarget);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
    },
  });

  const scanAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('security-headers/scan-all/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`security-headers/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
      if (selectedTarget?.id === deleteTarget?.id) {
        setSelectedTarget(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Actions
  const handleToggleSelect = (target: SecurityHeaderTarget) => {
    setSelectedIds((prev) =>
      prev.includes(target.id) ? prev.filter((id) => id !== target.id) : [...prev, target.id]
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

  const handleExecuteBulkAction = async (action: 'scan' | 'pause' | 'resume' | 'delete') => {
    if (selectedIds.length === 0) return;
    if (
      action === 'delete' &&
      !window.confirm(`¿Deseas eliminar permanentemente los ${selectedIds.length} endpoints seleccionados?`)
    ) {
      return;
    }

    setBulkActionRunning(true);
    try {
      await api.post('security-headers/bulk-action/', {
        action,
        target_ids: selectedIds,
      });
      queryClient.invalidateQueries({ queryKey: ['security-header-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-header-stats'] });
      if (action === 'delete') {
        setSelectedIds([]);
      }
    } catch (err) {
      console.error('Error executing bulk action:', err);
    } finally {
      setBulkActionRunning(false);
    }
  };

  // CSV Export Function
  const handleExportCSV = () => {
    if (!targets || targets.length === 0) return;

    const headers = [
      'Nombre',
      'URL',
      'Calificación',
      'Puntuación',
      'HSTS Activo',
      'CSP Activo',
      'X-Frame-Options',
      'Fuga de Stack',
      'Servidor Detectado',
      'Latencia (ms)',
      'Estado Monitoreo',
      'Último Análisis',
    ];

    const rows = targets.map((t) => [
      `"${(t.name || '').replace(/"/g, '""')}"`,
      `"${(t.url || '').replace(/"/g, '""')}"`,
      `"${t.last_grade || (t.last_score !== null ? calculateGrade(t.last_score) : 'N/A')}"`,
      t.last_score !== null ? t.last_score : '',
      t.has_hsts ? 'Sí' : 'No',
      t.has_csp ? 'Sí' : 'No',
      t.has_xfo ? 'Sí' : 'No',
      t.info_leak_detected ? 'Sí' : 'No',
      `"${(t.server_header || t.powered_by_header || '').replace(/"/g, '""')}"`,
      t.last_response_time_ms !== null && t.last_response_time_ms !== undefined ? t.last_response_time_ms : '',
      t.enabled ? 'Activo' : 'Pausado',
      t.last_checked_at ? new Date(t.last_checked_at).toLocaleString('es-ES') : 'Nunca',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
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

  const handleOpenEdit = (target: SecurityHeaderTarget, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTarget(target);
    setShowForm(true);
  };

  const parseHeadersList = (headers: string[] | Record<string, string> | undefined): string[] => {
    if (!headers) return [];
    if (Array.isArray(headers)) return headers;
    return Object.keys(headers);
  };

  const calculateGrade = (score: number | null): SecurityGrade | null => {
    if (score === null) return null;
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  // KPI Calculations
  const allTargets = targets || [];
  const totalCount = stats?.total || allTargets.length;
  const gradeACount =
    stats?.grade_a ||
    allTargets.filter((t: SecurityHeaderTarget) => t.last_score !== null && t.last_score >= 80).length;
  const gradeBCCount =
    stats?.grade_bc ||
    allTargets.filter((t: SecurityHeaderTarget) => t.last_score !== null && t.last_score >= 60 && t.last_score < 80).length;
  const gradeDFCount =
    stats?.grade_df ||
    allTargets.filter((t: SecurityHeaderTarget) => t.last_score === null || t.last_score < 60).length;
  const infoLeaksCount =
    stats?.info_leaks_count ?? allTargets.filter((t) => t.info_leak_detected).length;

  const optimalRate =
    totalCount > 0 ? Math.round((gradeACount / totalCount) * 1000) / 10 : 100.0;

  // Filtered & Searched Targets
  const filteredTargets = allTargets.filter((t: SecurityHeaderTarget) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.server_header && t.server_header.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.powered_by_header && t.powered_by_header.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    const score = t.last_score;
    if (gradeFilter === 'grade_a') return score !== null && score >= 80;
    if (gradeFilter === 'grade_bc') return score !== null && score >= 60 && score < 80;
    if (gradeFilter === 'grade_df') return score === null || score < 60;

    return true;
  });

  const latestResult: SecurityHeaderResult | null =
    results && results.length > 0 ? results[0] : null;

  const foundHeadersDict: Record<string, string> =
    latestResult?.headers_found && typeof latestResult.headers_found === 'object' && !Array.isArray(latestResult.headers_found)
      ? (latestResult.headers_found as Record<string, string>)
      : {};

  const missingList = latestResult ? parseHeadersList(latestResult.headers_missing) : [];
  const foundList = latestResult ? parseHeadersList(latestResult.headers_found) : [];
  const directivesAnalysis = latestResult?.directives_analysis || {};
  const infoLeaks = latestResult?.info_leaks || {};
  const rawHeaders = latestResult?.raw_headers || {};

  // Generate Web Server Snippets based on missing / standard headers
  const generateServerSnippet = (type: ServerSnippetType, target: SecurityHeaderTarget | null) => {
    const hostname = target ? target.name : 'Servidor Web';

    if (type === 'nginx') {
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

    if (type === 'apache') {
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

    if (type === 'caddy') {
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

    if (type === 'cloudflare') {
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

    if (type === 'iis') {
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

    return '';
  };

  const handleCopySnippet = () => {
    const text = generateServerSnippet(serverSnippetType, selectedTarget);
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* 1. TOP HEADER (Standard NOC Header) */}
      <NOCPageHeader
        title="Cabeceras de Seguridad"
        badgeText="HEADER AUDIT"
        description="Auditoría de cabeceras HTTP recomendadas (HSTS, CSP, X-Frame-Options) y análisis de mitigación contra ataques web."
        icon={<ShieldCheck size={26} />}
        autoRefresh={{
          enabled: autoRefresh.enabled,
          countdown: autoRefresh.countdown,
          onToggle: autoRefresh.toggle,
        }}
        actions={
          <>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-bg-card border border-border-base text-text-muted hover:text-text-main hover:border-accent-green/40 font-medium px-4 py-2 rounded-full text-sm transition-all shadow-sm"
              title="Descargar reporte de auditoría en formato CSV"
            >
              <Download size={15} />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => scanAllMutation.mutate()}
              disabled={scanAllMutation.isPending}
              className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/40 text-accent-green font-medium px-4 py-2 rounded-full text-sm hover:bg-accent-green/20 transition-all disabled:opacity-50"
              title="Escanear cabeceras de todos los endpoints inmediatamente"
            >
              <RefreshCw
                size={15}
                className={scanAllMutation.isPending ? 'animate-spin' : ''}
              />
              Escanear Todos
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
            >
              <Plus size={16} />
              Nuevo Endpoint
            </button>
          </>
        }
      />

      {/* 2. NOC COMMAND CENTER: KPI STRIP */}
      <NOCKpiGrid columns={4}>
        {/* KPI 1: Calificación Óptima */}
        <NOCKpiCard
          title="Tasa de Excelencia"
          icon={<ShieldCheck size={16} className="text-accent-green" />}
          badge={{
            text: optimalRate >= 80.0 ? 'Óptimo' : 'Atención',
            variant: optimalRate >= 80.0 ? 'success' : 'warning',
          }}
          value={`${optimalRate}%`}
          valueSuffix="Grado A/A+"
          progress={{ value: optimalRate }}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Blindaje de Seguridad</span>
              <span>
                {gradeACount} de {totalCount} endpoints
              </span>
            </div>
          }
        />

        {/* KPI 2: Puntuación Promedio */}
        <NOCKpiCard
          title="Puntuación Media"
          icon={<Activity size={16} className="text-sky-400" />}
          badge={{
            text: 'Benchmark OWASP',
            variant: 'info',
          }}
          value={stats?.avg_score ? `${Math.round(stats.avg_score)}` : '0'}
          valueColor="text-sky-400"
          valueSuffix="/ 100 pts"
          subtitle="Basado en presencia y configuración de cabeceras"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Nivel Recomendado</span>
              <span className="text-sky-400 font-semibold">&ge; 80 puntos</span>
            </div>
          }
        />

        {/* KPI 3: Distribución por Grados */}
        <NOCKpiCard
          title="Distribución de Calidad"
          icon={<Zap size={16} className="text-amber-400" />}
          badge={{
            text: `${totalCount} Sitios`,
            variant: 'neutral',
          }}
          distribution={[
            { label: 'Grado A/A+', count: gradeACount, variant: 'success' },
            { label: 'Grado B/C', count: gradeBCCount, variant: 'warning' },
            { label: 'Grado D/F', count: gradeDFCount, variant: 'danger' },
          ]}
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>HSTS / CSP / X-Frame</span>
              <span className="text-accent-green">Auditado</span>
            </div>
          }
        />

        {/* KPI 4: Fugas de Servidor / Stack Disclosure */}
        <NOCKpiCard
          title="Fugas de Servidor"
          icon={<ShieldAlert size={16} className={infoLeaksCount > 0 ? 'text-amber-400' : 'text-accent-green'} />}
          badge={{
            text: infoLeaksCount > 0 ? 'Exposición Detectada' : 'Protegido',
            variant: infoLeaksCount > 0 ? 'warning' : 'success',
          }}
          value={infoLeaksCount > 0 ? `${infoLeaksCount} sitios` : '0 sitios'}
          valueColor={infoLeaksCount > 0 ? 'text-amber-400' : 'text-accent-green'}
          valueSuffix="con versión expuesta"
          subtitle="Cabeceras Server y X-Powered-By auditadas"
          footer={
            <div className="flex justify-between text-[11px] text-text-dim">
              <span>Estándar Evaluado</span>
              <span className="text-accent-green font-medium">CWE-200 / ISO 27001</span>
            </div>
          }
        />
      </NOCKpiGrid>

      {/* 3. TOOLBAR: Omnibar Search + Grade Status Pills + Grid/Table Switcher */}
      <NOCToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nombre de servicio, URL analizada o software de servidor..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        statusPills={[
          { id: 'all', label: 'Todos', count: totalCount, variant: 'all' },
          { id: 'grade_a', label: 'Grado A / A+', count: gradeACount, variant: 'success' },
          { id: 'grade_bc', label: 'Grado B / C', count: gradeBCCount, variant: 'warning' },
          { id: 'grade_df', label: 'Grado D / F', count: gradeDFCount, variant: 'danger' },
        ]}
        selectedStatus={gradeFilter}
        onStatusChange={(st) => setGradeFilter(st as GradeFilterType)}
      />

      {/* 4. FLOATING BULK ACTIONS BAR */}
      <NOCBulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        itemLabel="endpoints"
        actions={
          <>
            <button
              type="button"
              onClick={() => handleExecuteBulkAction('scan')}
              disabled={bulkActionRunning}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={13} className={bulkActionRunning ? 'animate-spin' : ''} />
              Escanear
            </button>
            <button
              type="button"
              onClick={() => handleExecuteBulkAction('pause')}
              disabled={bulkActionRunning}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-semibold rounded-full text-xs transition-all disabled:opacity-50"
            >
              <Pause size={13} />
              Pausar
            </button>
            <button
              type="button"
              onClick={() => handleExecuteBulkAction('resume')}
              disabled={bulkActionRunning}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-bg-card border border-border-base text-accent-green hover:bg-accent-green/10 font-semibold rounded-full text-xs transition-all disabled:opacity-50"
            >
              <Play size={13} />
              Reanudar
            </button>
            <button
              type="button"
              onClick={() => handleExecuteBulkAction('delete')}
              disabled={bulkActionRunning}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50"
            >
              <Trash2 size={13} />
              Eliminar
            </button>
          </>
        }
      />

      {/* 5. MAIN CONTENT: DUAL VIEW (GRID OR TABLE) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredTargets && filteredTargets.length > 0 ? (
        viewMode === 'grid' ? (
          /* Grid View (Cards) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTargets.map((target: SecurityHeaderTarget) => {
              const grade = target.last_grade || calculateGrade(target.last_score);
              const isSelected = selectedIds.includes(target.id);
              const isScanning = scanningId === target.id;

              return (
                <div
                  key={target.id}
                  onClick={() => setSelectedTarget(target)}
                  className={`bg-bg-card/95 border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
                    isSelected
                      ? 'border-accent-green bg-accent-green/[0.02] ring-1 ring-accent-green/40'
                      : 'border-border-base/70'
                  }`}
                >
                  <div>
                    {/* Top row: Checkbox, Icon, Name, GradeBadge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(target);
                          }}
                          className="text-text-dim hover:text-accent-green transition-colors shrink-0"
                          title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-accent-green" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>

                        <div className="w-9 h-9 rounded-xl bg-bg-dark border border-border-base flex items-center justify-center shrink-0 text-accent-green group-hover:border-accent-green/40 transition-colors">
                          <Shield size={16} />
                        </div>
                        <h3
                          className="font-bold text-text-main truncate text-base group-hover:text-accent-green transition-colors font-sans"
                          title={target.name}
                        >
                          {target.name}
                        </h3>
                      </div>

                      <GradeBadge grade={grade} score={target.last_score} />
                    </div>

                    <p className="text-xs font-mono text-text-dim truncate mb-3" title={target.url}>
                      {target.url}
                    </p>

                    {/* Critical Protections Micro-Badges */}
                    <div className="flex items-center gap-1.5 mb-3 font-mono text-[10px]">
                      <span
                        className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                          target.has_hsts
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold'
                            : 'bg-bg-dark/70 border border-border-base/40 text-text-dim'
                        }`}
                      >
                        <Lock size={10} />
                        HSTS
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                          target.has_csp
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold'
                            : 'bg-bg-dark/70 border border-border-base/40 text-text-dim'
                        }`}
                      >
                        <FileCode2 size={10} />
                        CSP
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                          target.has_xfo
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold'
                            : 'bg-bg-dark/70 border border-border-base/40 text-text-dim'
                        }`}
                      >
                        <Layers size={10} />
                        XFO
                      </span>
                      {target.info_leak_detected && (
                        <span
                          className="px-2 py-0.5 rounded flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold animate-pulse"
                          title={target.server_header || target.powered_by_header || 'Versión expuesta'}
                        >
                          <ShieldAlert size={10} />
                          Fuga
                        </span>
                      )}
                    </div>

                    {/* Quick Metric Box */}
                    <div className="space-y-2 text-xs font-mono text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40">
                      <div className="flex justify-between border-b border-border-base/40 pb-1.5 font-sans">
                        <span className="text-text-dim font-medium">Puntuación:</span>
                        <span
                          className={`font-mono font-bold ${
                            target.last_score !== null && target.last_score >= 80
                              ? 'text-accent-green'
                              : target.last_score !== null && target.last_score >= 60
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {target.last_score !== null ? `${target.last_score} / 100` : 'Sin evaluar'}
                        </span>
                      </div>
                      <div className="flex justify-between font-sans">
                        <span className="text-text-dim font-medium">Latencia:</span>
                        <span className="text-text-main font-mono font-semibold">
                          {target.last_response_time_ms !== null && target.last_response_time_ms !== undefined
                            ? `${target.last_response_time_ms} ms`
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Clock size={12} />
                      {target.last_checked_at
                        ? new Date(target.last_checked_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Nunca'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          scanMutation.mutate(target.id);
                        }}
                        disabled={isScanning}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors disabled:opacity-50"
                        title="Escanear cabeceras ahora"
                      >
                        <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(target, e)}
                        className="p-1.5 text-text-dim hover:text-accent-green hover:bg-accent-green/10 rounded-full transition-colors"
                        title="Editar endpoint"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(target);
                        }}
                        className="p-1.5 text-text-dim hover:text-accent-red hover:bg-accent-red/10 rounded-full transition-colors"
                        title="Eliminar endpoint"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Compact Table View */
          <SecurityHeaderTableView
            targets={filteredTargets}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAllToggle}
            onSelectTarget={(t) => setSelectedTarget(t)}
            onScan={(id, e) => {
              e.stopPropagation();
              scanMutation.mutate(id);
            }}
            scanningId={scanningId}
            onEdit={(t, e) => handleOpenEdit(t, e)}
            onDelete={(t, e) => {
              e.stopPropagation();
              setDeleteTarget(t);
            }}
          />
        )
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title={
            searchTerm || gradeFilter !== 'all'
              ? 'No se encontraron endpoints con los filtros aplicados'
              : 'No hay endpoints de Security Headers monitoreados'
          }
          description={
            searchTerm || gradeFilter !== 'all'
              ? 'Prueba a cambiar el término de búsqueda o restablecer los filtros de calificación.'
              : 'Supervisa las cabeceras HTTP de seguridad de tus portales y endpoints REST.'
          }
          actionLabel={searchTerm || gradeFilter !== 'all' ? 'Limpiar Filtros' : 'Nuevo Endpoint'}
          onAction={() => {
            if (searchTerm || gradeFilter !== 'all') {
              setSearchTerm('');
              setGradeFilter('all');
            } else {
              handleOpenCreate();
            }
          }}
        />
      )}

      {/* 6. SLIDE-OVER DETAIL DRAWER (Zero Context Loss with NOCDrawer) */}
      <NOCDrawer
        isOpen={!!selectedTarget}
        onClose={() => setSelectedTarget(null)}
        title={selectedTarget?.name || ''}
        subtitle={
          selectedTarget && (
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-xs">{selectedTarget.url}</span>
              <a
                href={selectedTarget.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-green hover:underline flex items-center gap-1 shrink-0 text-xs"
              >
                Abrir <ExternalLink size={11} />
              </a>
            </div>
          )
        }
        statusBadge={
          selectedTarget && (
            <GradeBadge
              grade={selectedTarget.last_grade || calculateGrade(selectedTarget.last_score)}
              score={selectedTarget.last_score}
            />
          )
        }
        headerActions={
          selectedTarget && (
            <button
              type="button"
              onClick={() => scanMutation.mutate(selectedTarget.id)}
              disabled={scanMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-full text-xs font-semibold transition-all disabled:opacity-50"
              title="Escanear cabeceras inmediatamente"
            >
              <RefreshCw
                size={13}
                className={scanMutation.isPending ? 'animate-spin' : ''}
              />
              <span>{scanMutation.isPending ? 'Escaneando...' : 'Re-escanear'}</span>
            </button>
          )
        }
        quickKpis={
          selectedTarget && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Puntuación</div>
                <div className="text-base font-bold font-mono text-accent-green mt-0.5">
                  {selectedTarget.last_score !== null ? `${selectedTarget.last_score} / 100` : 'N/A'}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Cabeceras OK</div>
                <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                  {foundList.length}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Faltantes</div>
                <div
                  className={`text-base font-bold font-mono mt-0.5 ${
                    missingList.length > 0 ? 'text-amber-400' : 'text-accent-green'
                  }`}
                >
                  {missingList.length}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-[11px] text-text-dim">Latencia HTTP</div>
                <div className="text-sm font-semibold font-mono text-text-muted mt-0.5 truncate">
                  {selectedTarget.last_response_time_ms !== null && selectedTarget.last_response_time_ms !== undefined
                    ? `${selectedTarget.last_response_time_ms} ms`
                    : 'N/A'}
                </div>
              </div>
            </div>
          )
        }
        tabs={[
          { id: 'audit', label: 'Auditoría', icon: <ShieldCheck size={13} /> },
          { id: 'remediation', label: 'Remediación & Snippets', icon: <Code2 size={13} /> },
          {
            id: 'leaks_raw',
            label: selectedTarget?.info_leak_detected ? 'Fugas & Raw (Alerta)' : 'Fugas & Raw',
            icon: selectedTarget?.info_leak_detected ? <ShieldAlert size={13} className="text-amber-400" /> : <Server size={13} />,
          },
          { id: 'history', label: 'Historial', icon: <Clock size={13} /> },
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as DrawerTabType)}
        footerActions={
          selectedTarget && (
            <>
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedTarget)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors"
              >
                <Pencil size={14} />
                Editar Configuración
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedTarget)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors"
              >
                <Trash2 size={14} />
                Eliminar Endpoint
              </button>
            </>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {/* TAB 1: AUDITORÍA DE CABECERAS */}
        {selectedTarget && drawerTab === 'audit' && (
          <div className="space-y-4 font-sans">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-muted">
                Evaluación Estándar de Cabeceras HTTP
              </h4>
              <span className="text-[11px] font-mono text-text-dim">
                {foundList.length} de {STANDARD_SECURITY_HEADERS.length} implementadas
              </span>
            </div>

            <div className="space-y-3">
              {STANDARD_SECURITY_HEADERS.map((hdr) => {
                const isFound = hdr.key in foundHeadersDict;
                const value = foundHeadersDict[hdr.key];
                const directiveInfo = directivesAnalysis[hdr.key];

                return (
                  <div
                    key={hdr.key}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isFound
                        ? 'bg-emerald-500/[0.04] border-emerald-500/30'
                        : 'bg-bg-dark/60 border-border-base/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isFound ? (
                          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle size={16} className="text-rose-400 shrink-0" />
                        )}
                        <span className="font-mono text-xs font-bold text-text-main">
                          {hdr.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-text-dim">
                          +{hdr.weight} pts
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isFound
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                          }`}
                        >
                          {isFound ? 'Presente' : 'Ausente'}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-text-dim mt-1.5 leading-relaxed">
                      {hdr.description}
                    </p>

                    {/* If present, show configured value */}
                    {isFound && value && (
                      <div className="mt-2.5 p-2 bg-bg-dark border border-border-base/60 rounded-lg text-xs font-mono text-emerald-300 break-all">
                        {value}
                      </div>
                    )}

                    {/* If directives analysis notes exist */}
                    {directiveInfo?.notes && (
                      <div className="mt-2 text-[11px] text-text-muted flex items-center gap-1 font-mono">
                        <span className="text-accent-green">&bull;</span> {directiveInfo.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: REMEDIACIÓN & SNIPPETS PARA SERVIDORES WEB */}
        {selectedTarget && drawerTab === 'remediation' && (
          <div className="space-y-4 font-sans">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-text-main">
                  Generador de Configuración de Servidor Web
                </h4>
                <p className="text-[11px] text-text-dim mt-0.5">
                  Aplica estas directivas en tu infraestructura para elevar la calificación a Grado A+.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopySnippet}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green text-black font-semibold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-sm shrink-0"
              >
                {copiedSnippet ? <Check size={13} /> : <Copy size={13} />}
                {copiedSnippet ? '¡Copiado!' : 'Copiar Snippet'}
              </button>
            </div>

            {/* Server Selector Pills */}
            <div className="flex flex-wrap gap-1.5 bg-bg-dark/60 p-1.5 rounded-xl border border-border-base/70">
              {(['nginx', 'apache', 'caddy', 'cloudflare', 'iis'] as ServerSnippetType[]).map((srv) => (
                <button
                  key={srv}
                  type="button"
                  onClick={() => setServerSnippetType(srv)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    serverSnippetType === srv
                      ? 'bg-accent-green text-black shadow-sm'
                      : 'text-text-muted hover:text-text-main hover:bg-bg-card'
                  }`}
                >
                  {srv === 'nginx' && 'Nginx'}
                  {srv === 'apache' && 'Apache (.htaccess)'}
                  {srv === 'caddy' && 'Caddy'}
                  {srv === 'cloudflare' && 'Cloudflare'}
                  {srv === 'iis' && 'IIS (web.config)'}
                </button>
              ))}
            </div>

            {/* Code Box */}
            <div className="relative">
              <pre className="bg-bg-dark border border-border-base rounded-xl p-4 text-xs font-mono text-text-muted overflow-x-auto leading-relaxed max-h-[360px]">
                {generateServerSnippet(serverSnippetType, selectedTarget)}
              </pre>
            </div>

            {/* Missing Headers List Tip */}
            {missingList.length > 0 && (
              <div className="bg-bg-card border border-border-base rounded-xl p-3 text-xs space-y-1">
                <span className="font-semibold text-text-main">Cabeceras prioritarias a incorporar:</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {missingList.map((m) => (
                    <span
                      key={m}
                      className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-md text-[11px] font-mono"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FUGAS DE INFORMACIÓN & RAW HEADERS */}
        {selectedTarget && drawerTab === 'leaks_raw' && (
          <div className="space-y-4 font-sans">
            {/* Server Leak Alert Card */}
            {selectedTarget.info_leak_detected || Object.keys(infoLeaks).length > 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <ShieldAlert size={16} />
                  <span>Vulnerabilidad de Divulgación de Tecnología (CWE-200)</span>
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  El servidor web expone en sus cabeceras HTTP información exacta de software, versiones o runtimes, lo cual facilita el reconocimiento malicioso por atacantes.
                </p>

                <div className="space-y-2 pt-1">
                  {Object.keys(infoLeaks).map((key) => {
                    const leak = infoLeaks[key];
                    return (
                      <div
                        key={key}
                        className="bg-bg-dark/80 border border-amber-500/20 rounded-xl p-2.5 text-xs font-mono space-y-1"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-amber-300">{leak.header}:</span>
                          <span className="text-text-main font-semibold">{leak.value}</span>
                        </div>
                        <div className="text-[11px] text-text-dim font-sans">
                          Mitigación sugerida: {leak.recommendation}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex items-center gap-3 text-xs text-emerald-400">
                <CheckCircle2 size={18} className="shrink-0" />
                <div>
                  <span className="font-bold">Servidor Protegido contra Fugas de Información</span>
                  <p className="text-[11px] text-emerald-300/80 mt-0.5">
                    No se detectaron cabeceras que divulguen versiones de software (Server o X-Powered-By).
                  </p>
                </div>
              </div>
            )}

            {/* Raw Headers Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-text-muted">
                  Cabeceras HTTP de Respuesta Recibidas ({Object.keys(rawHeaders).length})
                </h4>
                <div className="relative w-48">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-text-dim" />
                  <input
                    type="text"
                    placeholder="Filtrar cabecera..."
                    value={rawHeadersFilter}
                    onChange={(e) => setRawHeadersFilter(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-lg pl-7 pr-2.5 py-1 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
                  />
                </div>
              </div>

              {Object.keys(rawHeaders).length > 0 ? (
                <div className="space-y-1.5 font-mono text-xs max-h-[320px] overflow-y-auto pr-1">
                  {Object.entries(rawHeaders)
                    .filter(([key, val]) => {
                      if (!rawHeadersFilter.trim()) return true;
                      const q = rawHeadersFilter.toLowerCase();
                      return key.toLowerCase().includes(q) || String(val).toLowerCase().includes(q);
                    })
                    .map(([key, val]) => (
                      <div
                        key={key}
                        className="p-2.5 bg-bg-dark/80 border border-border-base/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1 break-all"
                      >
                        <span className="text-text-muted font-bold">{key}:</span>
                        <span className="text-text-main">{String(val)}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-6 bg-bg-dark/50 border border-border-base rounded-xl text-center text-xs text-text-dim">
                  No hay cabeceras raw almacenadas para este escaneo.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: HISTORIAL */}
        {selectedTarget && drawerTab === 'history' && (
          <div className="space-y-4 font-sans">
            <h4 className="text-xs font-semibold text-text-muted">
              Historial de Auditorías Realizadas
            </h4>
            {isLoadingResults ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-accent-green" size={28} />
              </div>
            ) : results && results.length > 0 ? (
              <div className="space-y-2.5">
                {results.map((res: SecurityHeaderResult) => (
                  <div
                    key={res.id}
                    className="p-3.5 bg-bg-dark/80 border border-border-base rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-text-dim" />
                      <span className="font-mono text-text-muted">
                        {new Date(res.checked_at).toLocaleString('es-ES')}
                      </span>
                      {res.response_time_ms !== null && res.response_time_ms !== undefined && (
                        <span className="text-[11px] font-mono text-text-dim">
                          ({res.response_time_ms} ms)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="font-bold text-text-main">{res.score} pts</span>
                      <GradeBadge grade={res.grade} score={res.score} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center">
                <p className="text-text-dim text-xs">
                  No hay historial previo registrado para este endpoint.
                </p>
              </div>
            )}
          </div>
        )}
      </NOCDrawer>

      {/* 7. CREATE / EDIT FORM MODAL */}
      {showForm && (
        <SecurityHeaderForm
          target={editingTarget}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingTarget(null);
          }}
        />
      )}

      {/* 8. DELETE CONFIRMATION MODAL */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name || 'este endpoint'}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
