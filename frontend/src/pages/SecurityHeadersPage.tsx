import ResourceActionButtons from "../components/common/ResourceActionButtons";
import SelectionCheckbox from "../components/common/SelectionCheckbox";
import {
  hasMeasurement,
  healthPalette,
  securityResponseTone,
} from "../utils/healthPresentation";
import MeasurementStatus from "../components/common/MeasurementStatus";
import { useCompactViewport } from "../hooks/useCompactViewport";
import {
  ReadFailure,
  DirectoryPagination,
  ActionFeedback,
} from "../components/common/DirectoryState";
import { useSecurityHeadersWorkspace } from "./workspaces/useSecurityHeadersWorkspace";
import AdminButton from "../components/common/AdminButton";
import ScanAction from "../components/common/ScanAction";
import type {
  SecurityHeaderTarget,
  SecurityHeaderResult,
} from "../types/security_headers";
import GradeBadge from "../components/common/GradeBadge";
import EmptyState from "../components/common/EmptyState";
import ConfirmDelete from "../components/common/ConfirmDelete";
import SecurityHeaderForm from "../components/security_headers/SecurityHeaderForm";
import SecurityHeaderTableView from "../components/security_headers/SecurityHeaderTableView";
import {
  NOCPageHeader,
  NOCToolbar,
  NOCBulkActionBar,
  NOCDrawer,
} from "../components/common/noc";
import {
  ShieldCheck,
  Plus,
  Loader2,
  Trash2,
  Clock,
  Pencil,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  FileCode2,
  ShieldAlert,
  Download,
  Lock,
  Layers,
  Server,
  Pause,
  Play,
  Search,
} from "lucide-react";

type GradeFilterType =
  | "all"
  | "grade_a"
  | "grade_bc"
  | "grade_df"
  | "healthy"
  | "warning"
  | "critical"
  | "unmeasured";
type DrawerTabType = "audit" | "leaks_raw" | "history";

const STANDARD_SECURITY_HEADERS = [
  {
    key: "content-security-policy",
    name: "Content-Security-Policy",
    weight: 25,
    description:
      "Previene XSS, inyección de datos y clickjacking restringiendo los orígenes de contenido.",
  },
  {
    key: "strict-transport-security",
    name: "Strict-Transport-Security (HSTS)",
    weight: 20,
    description:
      "Fuerza conexiones HTTPS seguras y protege contra ataques de degradación SSL/TLS.",
  },
  {
    key: "x-frame-options",
    name: "X-Frame-Options",
    weight: 15,
    description:
      "Protege contra Clickjacking evitando que el sitio sea embebido en iframes no autorizados.",
  },
  {
    key: "x-content-type-options",
    name: "X-Content-Type-Options",
    weight: 10,
    description:
      "Previene el MIME-sniffing obligando al navegador a respetar el Content-Type declarado.",
  },
  {
    key: "referrer-policy",
    name: "Referrer-Policy",
    weight: 10,
    description:
      "Controla cuánta información de referencia (URL previa) se transmite en peticiones salientes.",
  },
  {
    key: "permissions-policy",
    name: "Permissions-Policy",
    weight: 10,
    description:
      "Restringe el acceso del navegador a características de hardware (cámara, micrófono, geolocalización).",
  },
  {
    key: "cross-origin-opener-policy",
    name: "Cross-Origin-Opener-Policy (COOP)",
    weight: 5,
    description:
      "Aísla el contexto de navegación impidiendo accesos maliciosos entre orígenes.",
  },
  {
    key: "cross-origin-resource-policy",
    name: "Cross-Origin-Resource-Policy (CORP)",
    weight: 5,
    description:
      "Bloquea lectura no autorizada de recursos estáticos desde otros dominios.",
  },
];

export default function SecurityHeadersPage() {
  const compact = useCompactViewport();
  const {
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
    filteredTargets,
    foundHeadersDict,
    missingList,
    foundList,
    directivesAnalysis,
    infoLeaks,
    rawHeaders,
  } = useSecurityHeadersWorkspace();

  if (isError && !targets) return <ReadFailure retry={refetch} />;
  return (
    <div className="compact-workspace space-y-4 animate-in fade-in duration-300 font-sans">
      {isError && targets && <ReadFailure stale retry={refetch} />}
      <ActionFeedback>{directory.message}</ActionFeedback>
      {directory.confirmation}

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
          intervalSeconds: autoRefresh.intervalSeconds,
          ready: autoRefresh.ready,
          blockedReason: autoRefresh.blockedReason,
        }}
        actions={
          <>
            <AdminButton
              capability="security_headers.create"
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-5 py-2 rounded-full text-sm hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20"
            >
              <Plus size={16} />
              Nuevo Endpoint
            </AdminButton>
          </>
        }
      />

      {/* 3. TOOLBAR: Omnibar Search + Grade Status Pills + Grid/Table Switcher */}
      <NOCToolbar
        layout="inline"
        countsScope="total de la organización"
        utilities={[
          {
            label: "Exportar resultados filtrados",
            icon: <Download size={16} />,
            onClick: () => void handleExportCSV(),
            disabled: !targets?.length,
          },
        ]}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nombre de servicio, URL analizada o software de servidor..."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        statusPills={[
          { id: "all", label: "Todos", count: totalCount, variant: "all" },
          {
            id: "unmeasured",
            label: "Sin medición",
            count: unmeasuredCount,
            variant: "all",
          },
          {
            id: "healthy",
            label: "Saludables",
            description: "Score ≥70 sin fugas",
            count: gradeACount,
            variant: "success",
          },
          {
            id: "warning",
            label: "Advertencias",
            description: "Score 50–69 o fugas",
            count: gradeBCCount,
            variant: "warning",
          },
          {
            id: "critical",
            label: "Críticos",
            description: "Score <50",
            count: gradeDFCount,
            variant: "danger",
          },
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
            <AdminButton
              capability="security_headers.update"
              type="button"
              onClick={() => handleExecuteBulkAction("pause")}
              disabled={bulkActionRunning}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-bg-card border border-border-base text-text-muted hover:text-text-main font-semibold rounded-full text-xs transition-all disabled:opacity-50"
            >
              <Pause size={13} />
              Pausar
            </AdminButton>
            <AdminButton
              capability="security_headers.update"
              type="button"
              onClick={() => handleExecuteBulkAction("resume")}
              disabled={bulkActionRunning}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-bg-card border border-border-base text-accent-green hover:bg-accent-green/10 font-semibold rounded-full text-xs transition-all disabled:opacity-50"
            >
              <Play size={13} />
              Reanudar
            </AdminButton>
            <AdminButton
              capability="security_headers.delete"
              type="button"
              onClick={() => handleExecuteBulkAction("delete")}
              disabled={bulkActionRunning}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-red text-white font-semibold rounded-full text-xs hover:bg-accent-red/90 transition-all shadow-sm disabled:opacity-50"
            >
              <Trash2 size={13} />
              Eliminar
            </AdminButton>
          </>
        }
      />

      {/* 5. MAIN CONTENT: DUAL VIEW (GRID OR TABLE) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-accent-green" size={32} />
        </div>
      ) : filteredTargets && filteredTargets.length > 0 ? (
        viewMode === "grid" || compact ? (
          /* Grid View (Cards) */
          <div className="connectivity-card-grid">
            {filteredTargets.map((target: SecurityHeaderTarget) => {
              const grade =
                target.last_grade || calculateGrade(target.last_score);
              const isSelected = selectedIds.includes(target.id);

              return (
                <div
                  data-testid="connectivity-card"
                  key={target.id}
                  onClick={() => setSelectedTarget(target)}
                  className={`bg-bg-card border rounded-2xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between cursor-pointer group shadow-sm relative ${
                    isSelected
                      ? "border-accent-green bg-accent-green/[0.02] ring-1 ring-accent-green/40"
                      : "border-border-base/70"
                  }`}
                >
                  <div>
                    {/* Top row: Checkbox, Icon, Name, GradeBadge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 overflow-hidden">
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

                      <GradeBadge
                        grade={grade}
                        score={target.last_score}
                        tone={healthTone(target)}
                      />
                    </div>

                    <p
                      className="text-xs font-mono text-text-dim truncate mb-3"
                      title={target.url}
                    >
                      {target.url}
                    </p>

                    {/* Critical Protections Micro-Badges */}
                    <div className="flex items-center gap-1.5 mb-3 font-mono text-xs">
                      <span
                        className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                          hasMeasurement(target.last_checked_at) &&
                          target.has_hsts
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold"
                            : "bg-bg-dark/70 border border-border-base/40 text-text-dim"
                        }`}
                      >
                        <Lock size={10} />
                        HSTS
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                          hasMeasurement(target.last_checked_at) &&
                          target.has_csp
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold"
                            : "bg-bg-dark/70 border border-border-base/40 text-text-dim"
                        }`}
                      >
                        <FileCode2 size={10} />
                        CSP
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                          hasMeasurement(target.last_checked_at) &&
                          target.has_xfo
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold"
                            : "bg-bg-dark/70 border border-border-base/40 text-text-dim"
                        }`}
                      >
                        <Layers size={10} />
                        XFO
                      </span>
                      {target.info_leak_detected && (
                        <span
                          className="px-2 py-0.5 rounded flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold animate-pulse"
                          title={
                            target.server_header ||
                            target.powered_by_header ||
                            "Versión expuesta"
                          }
                        >
                          <ShieldAlert size={10} />
                          Fuga
                        </span>
                      )}
                    </div>

                    {/* Quick Metric Box */}
                    <div className="space-y-2 text-xs font-mono text-text-muted bg-bg-dark/50 rounded-xl p-3 border border-border-base/40">
                      <div className="flex justify-between border-b border-border-base/40 pb-1.5 font-sans">
                        <span className="text-text-dim font-medium">
                          Puntuación:
                        </span>
                        <span
                          className="font-mono font-bold ui-tone"
                          data-tone={healthTone(target)}
                        >
                          {target.last_score !== null
                            ? `${target.last_score} / 100`
                            : "Sin evaluar"}
                        </span>
                      </div>
                      <div className="flex justify-between font-sans">
                        <span className="text-text-dim font-medium">
                          Latencia:
                        </span>
                        <span
                          className={`font-mono font-semibold ${healthPalette[securityResponseTone(target)].text}`}
                        >
                          {target.last_response_time_ms !== null &&
                          target.last_response_time_ms !== undefined
                            ? `${target.last_response_time_ms} ms`
                            : "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-border-base/40 flex items-center justify-between text-xs text-text-dim relative pl-11">
                    <div
                      data-card-selection
                      className="absolute bottom-0 left-0"
                    >
                      <SelectionCheckbox
                        checked={isSelected}
                        label={`Seleccionar ${target.name}`}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleSelect(target);
                        }}
                      />
                    </div>

                    <span className="flex items-center gap-1 font-mono text-xs">
                      <Clock size={12} />
                      {target.last_checked_at
                        ? new Date(target.last_checked_at).toLocaleTimeString(
                            "es-ES",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )
                        : "Nunca"}
                    </span>

                    <div className="flex items-center gap-1">
                      <ResourceActionButtons
                        label={`Acciones de ${target.name}`}
                        actions={[
                          {
                            label: "Editar endpoint",
                            onClick: (e) => handleOpenEdit(target, e),
                            capability: "security_headers.update",
                            icon: (
                              <>
                                <Pencil size={14} />
                              </>
                            ),
                          },
                          {
                            label: "Eliminar endpoint",
                            onClick: (e) => {
                              e.stopPropagation();
                              setDeleteTarget(target);
                            },
                            capability: "security_headers.delete",
                            danger: true,
                            icon: (
                              <>
                                <Trash2 size={14} />
                              </>
                            ),
                          },
                        ]}
                      />
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
          capability="security_headers.create"
          icon={ShieldCheck}
          title={
            searchTerm || gradeFilter !== "all"
              ? "No se encontraron endpoints con los filtros aplicados"
              : "No hay endpoints de Security Headers monitoreados"
          }
          description={
            searchTerm || gradeFilter !== "all"
              ? "Prueba a cambiar el término de búsqueda o restablecer los filtros de calificación."
              : "Supervisa las cabeceras HTTP de seguridad de tus portales y endpoints REST."
          }
          actionLabel={
            searchTerm || gradeFilter !== "all"
              ? "Limpiar Filtros"
              : "Nuevo Endpoint"
          }
          onAction={() => {
            if (searchTerm || gradeFilter !== "all") {
              setSearchTerm("");
              setGradeFilter("all");
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
        title={selectedTarget?.name || ""}
        subtitle={
          selectedTarget && (
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-xs">
                {selectedTarget.url}
              </span>
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
              grade={
                selectedTarget.last_grade ||
                calculateGrade(selectedTarget.last_score)
              }
              score={selectedTarget.last_score}
              tone={healthTone(selectedTarget)}
            />
          )
        }
        headerActions={
          selectedTarget && (
            <ScanAction
              resource={selectedTarget}
              route="security-headers"
              pending={scanMutation.isPending}
              onScan={() => scanMutation.mutateAsync(selectedTarget.id)}
            />
          )
        }
        quickKpis={
          selectedTarget && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-xs text-text-dim">Puntuación</div>
                <div
                  className="text-base font-bold font-mono ui-tone mt-0.5"
                  data-tone={healthTone(selectedTarget)}
                >
                  {selectedTarget.last_score !== null
                    ? `${selectedTarget.last_score} / 100`
                    : "N/A"}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-xs text-text-dim">Cabeceras OK</div>
                <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                  {foundList.length}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-xs text-text-dim">Faltantes</div>
                <div
                  className={`text-base font-bold font-mono mt-0.5 ${
                    missingList.length > 0
                      ? "text-amber-400"
                      : "text-accent-green"
                  }`}
                >
                  {missingList.length}
                </div>
              </div>
              <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
                <div className="text-xs text-text-dim">Latencia HTTP</div>
                <div className="text-sm font-semibold font-mono text-text-muted mt-0.5 truncate">
                  {selectedTarget.last_response_time_ms !== null &&
                  selectedTarget.last_response_time_ms !== undefined
                    ? `${selectedTarget.last_response_time_ms} ms`
                    : "N/A"}
                </div>
              </div>
            </div>
          )
        }
        tabs={[
          { id: "audit", label: "Auditoría", icon: <ShieldCheck size={13} /> },

          {
            id: "leaks_raw",
            label: selectedTarget?.info_leak_detected
              ? "Fugas & Raw (Alerta)"
              : "Fugas & Raw",
            icon: selectedTarget?.info_leak_detected ? (
              <ShieldAlert size={13} className="text-amber-400" />
            ) : (
              <Server size={13} />
            ),
          },
          { id: "history", label: "Historial", icon: <Clock size={13} /> },
        ]}
        activeTab={drawerTab}
        onTabChange={(t) => setDrawerTab(t as DrawerTabType)}
        footerActions={
          selectedTarget && (
            <>
              <AdminButton
                capability="security_headers.update"
                type="button"
                onClick={() => handleOpenEdit(selectedTarget)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors"
              >
                <Pencil size={14} />
                Editar Configuración
              </AdminButton>
              <AdminButton
                capability="security_headers.delete"
                type="button"
                onClick={() => setDeleteTarget(selectedTarget)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors"
              >
                <Trash2 size={14} />
                Eliminar Endpoint
              </AdminButton>
            </>
          )
        }
        maxWidthClass="max-w-2xl"
      >
        {/* TAB 1: AUDITORÍA DE CABECERAS */}
        {selectedTarget && (
          <MeasurementStatus snapshot={selectedTarget.scan_availability} />
        )}
        {selectedTarget && drawerTab === "audit" && (
          <div className="space-y-4 font-sans">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-muted">
                Evaluación Estándar de Cabeceras HTTP
              </h4>
              <span className="text-xs font-mono text-text-dim">
                {foundList.length} de {STANDARD_SECURITY_HEADERS.length}{" "}
                implementadas
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
                        ? "bg-emerald-500/[0.04] border-emerald-500/30"
                        : "bg-bg-dark/60 border-border-base/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isFound ? (
                          <CheckCircle2
                            size={16}
                            className="text-emerald-400 shrink-0"
                          />
                        ) : (
                          <XCircle
                            size={16}
                            className="text-rose-400 shrink-0"
                          />
                        )}
                        <span className="font-mono text-xs font-bold text-text-main">
                          {hdr.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-text-dim">
                          +{hdr.weight} pts
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isFound
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/25"
                          }`}
                        >
                          {isFound ? "Presente" : "Ausente"}
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
                      <div className="mt-2 text-xs text-text-muted flex items-center gap-1 font-mono">
                        <span className="text-accent-green">&bull;</span>{" "}
                        {directiveInfo.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: FUGAS DE INFORMACIÓN & RAW HEADERS */}
        {selectedTarget && drawerTab === "leaks_raw" && (
          <div className="space-y-4 font-sans">
            {/* Server Leak Alert Card */}
            {selectedTarget.info_leak_detected ||
            Object.keys(infoLeaks).length > 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <ShieldAlert size={16} />
                  <span>
                    Vulnerabilidad de Divulgación de Tecnología (CWE-200)
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  El servidor web expone en sus cabeceras HTTP información
                  exacta de software, versiones o runtimes, lo cual facilita el
                  reconocimiento malicioso por atacantes.
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
                          <span className="font-bold text-amber-300">
                            {leak.header}:
                          </span>
                          <span className="text-text-main font-semibold">
                            {leak.value}
                          </span>
                        </div>
                        <div className="text-xs text-text-dim font-sans">
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
                  <span className="font-bold">
                    Servidor Protegido contra Fugas de Información
                  </span>
                  <p className="text-xs text-emerald-300/80 mt-0.5">
                    No se detectaron cabeceras que divulguen versiones de
                    software (Server o X-Powered-By).
                  </p>
                </div>
              </div>
            )}

            {/* Raw Headers Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-text-muted">
                  Cabeceras HTTP de Respuesta Recibidas (
                  {Object.keys(rawHeaders).length})
                </h4>
                <div className="relative w-48">
                  <Search
                    size={12}
                    className="absolute left-2.5 top-2.5 text-text-dim"
                  />
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
                      return (
                        key.toLowerCase().includes(q) ||
                        String(val).toLowerCase().includes(q)
                      );
                    })
                    .map(([key, val]) => (
                      <div
                        key={key}
                        className="p-2.5 bg-bg-dark/80 border border-border-base/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1 break-all"
                      >
                        <span className="text-text-muted font-bold">
                          {key}:
                        </span>
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
        {selectedTarget && drawerTab === "history" && (
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
                        {new Date(res.checked_at).toLocaleString("es-ES")}
                      </span>
                      {res.response_time_ms !== null &&
                        res.response_time_ms !== undefined && (
                          <span className="text-xs font-mono text-text-dim">
                            ({res.response_time_ms} ms)
                          </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="font-bold text-text-main">
                        {res.score} pts
                      </span>
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
        itemName={deleteTarget?.name || "este endpoint"}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
      <DirectoryPagination directory={directory} />
    </div>
  );
}
