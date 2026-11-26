import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Layers,
  Link2,
  Lock,
  Server,
  XCircle,
} from "lucide-react";
import { useOrgContextForAddModal } from "../../hooks/useOrgContextForAddModal";
import type { SSLCertificate, SSLTestConnectionResult } from "../../types/ssl";
import {
  extractRegistrableDomain,
  isInternalOrPrivateHost,
  isValidHost,
  isValidPort,
  parseBatchHostLines,
  parseHostAndPort,
} from "../../utils/hostInput";
import ResourceAddModal from "../common/connectivity/ResourceAddModal";
import {
  formatTLSVersion,
  parseIssuerOrganization,
} from "./useSSLCertificates";

const COMMON_SSL_PORTS = [
  { port: 443, label: "443 HTTPS" },
  { port: 8443, label: "8443 Paneles" },
  { port: 636, label: "636 LDAPS" },
  { port: 465, label: "465 SMTPS" },
  { port: 587, label: "587 SMTP" },
  { port: 993, label: "993 IMAPS" },
  { port: 143, label: "143 IMAP" },
];

type StartTlsProtocol = "SMTP" | "IMAP" | "LDAP" | "POP3";

interface TlsConfig {
  mode: "direct" | "starttls";
  protocol: StartTlsProtocol | null;
}

function inferTlsConfigFromPort(port: number): TlsConfig {
  switch (port) {
    case 587:
    case 25:
      return { mode: "starttls", protocol: "SMTP" };
    case 143:
      return { mode: "starttls", protocol: "IMAP" };
    case 389:
      return { mode: "starttls", protocol: "LDAP" };
    case 110:
      return { mode: "starttls", protocol: "POP3" };
    default:
      return { mode: "direct", protocol: null };
  }
}

export interface SSLModalSubmitPayload {
  items: { domain: string; port: number }[];
  linkTargetId?: string | null;
  alsoWatchDns?: boolean;
  alsoWatchDomain?: boolean;
  keepOpen?: boolean;
}

interface SSLAddModalProps {
  editingCert: SSLCertificate | null;
  existingCertificates: SSLCertificate[];
  domainInput: string;
  onDomainInputChange: (val: string) => void;
  portInput: number;
  onPortInputChange: (val: number) => void;
  isTesting: boolean;
  testResult: SSLTestConnectionResult | null;
  onClearTestResult: () => void;
  onTest: (host: string, port: number) => void;
  diagnostic: { notice: string; remaining: number };
  isSubmitting: boolean;
  onSubmitPayload: (payload: SSLModalSubmitPayload) => Promise<void> | void;
  onSelectExisting: (cert: SSLCertificate) => void;
  onClose: () => void;
}

export default function SSLAddModal({
  editingCert,
  existingCertificates,
  domainInput,
  onDomainInputChange,
  portInput,
  onPortInputChange,
  isTesting,
  testResult,
  onClearTestResult,
  onTest,
  diagnostic,
  isSubmitting,
  onSubmitPayload,
  onSelectExisting,
  onClose,
}: SSLAddModalProps) {
  const isEditing = Boolean(editingCert);
  const {
    allChannels,
    destinations,
    isLoadingDestinations,
    targets,
    dnsItems,
    watchedDomains,
    quickCreateDestination,
    isCreatingDestination,
    toggleChannelEnabled,
    isTogglingChannel,
  } = useOrgContextForAddModal(true);

  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [tlsOverride, setTlsOverride] = useState<TlsConfig | null>(null);
  const [linkChecked, setLinkChecked] = useState(true);
  const [alsoWatchDns, setAlsoWatchDns] = useState(false);
  const [alsoWatchDomain, setAlsoWatchDomain] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [extractedNotice, setExtractedNotice] = useState<string | null>(null);

  const parsed = useMemo(() => parseHostAndPort(domainInput), [domainInput]);
  const cleanHost = parsed.host;
  const hostValid = isValidHost(cleanHost, { allowSingleLabel: true });
  const portValid = isValidPort(portInput);
  const isInternal = Boolean(cleanHost && isInternalOrPrivateHost(cleanHost));

  const inferredTls = useMemo(
    () => inferTlsConfigFromPort(portInput),
    [portInput],
  );
  const activeTls = tlsOverride || inferredTls;

  // Reset manual TLS override whenever port changes so deduction stays automatic
  useEffect(() => {
    setTlsOverride(null);
  }, [portInput]);

  // Duplicate detection by host + port
  const duplicateCert = useMemo(() => {
    if (!cleanHost || batchMode) return null;
    return (
      existingCertificates.find(
        (c) =>
          c.id !== editingCert?.id &&
          c.domain.toLowerCase() === cleanHost &&
          (c.port || 443) === portInput,
      ) || null
    );
  }, [existingCertificates, cleanHost, portInput, editingCert, batchMode]);

  // Detect matching Uptime target for auto-link suggestion
  const matchingTarget = useMemo(() => {
    if (!cleanHost || batchMode || isEditing) return null;
    const matches = targets.filter((t) => {
      if (t.target_type !== "http" && t.target_type !== "https") return false;
      const targetParsed = parseHostAndPort(t.endpoint || "");
      return targetParsed.host === cleanHost;
    });
    matches.sort((a, b) => Number(b.enabled) - Number(a.enabled));
    return matches[0] || null;
  }, [targets, cleanHost, batchMode, isEditing]);

  // Existing coverage checks for "Vigilar también"
  const apexDomain =
    hostValid && !isInternal ? extractRegistrableDomain(cleanHost) : "";
  const dnsAlreadyWatched = Boolean(
    cleanHost &&
      dnsItems.some(
        (d) => d.domain === cleanHost && (d.record_type === "A" || d.record_type === "AAAA"),
      ),
  );
  const domainAlreadyWatched = Boolean(
    apexDomain && watchedDomains.includes(apexDomain),
  );

  // Batch parsing (host or host:port per line)
  const batchEntries = useMemo(
    () => (batchMode ? parseBatchHostLines(batchText) : []),
    [batchMode, batchText],
  );
  const validBatchEntries = useMemo(
    () => batchEntries.filter((e) => e.valid),
    [batchEntries],
  );
  const invalidBatchEntries = useMemo(
    () => batchEntries.filter((e) => !e.valid),
    [batchEntries],
  );

  const handleDomainChange = (raw: string) => {
    const p = parseHostAndPort(raw);
    if (p.hadUrlParts && p.host) {
      onDomainInputChange(p.host);
      if (p.port && isValidPort(p.port)) {
        onPortInputChange(p.port);
        setExtractedNotice(`Extraído de URL: ${p.host}:${p.port}`);
      } else {
        setExtractedNotice(`Extraído de URL: ${p.host}`);
      }
    } else {
      onDomainInputChange(raw);
      setExtractedNotice(null);
    }
    onClearTestResult();
  };

  const canTest = !batchMode && hostValid && portValid && !isInternal;
  const canSubmit = batchMode
    ? validBatchEntries.length > 0 && invalidBatchEntries.length === 0
    : hostValid && portValid && !duplicateCert;

  const disabledReason = batchMode
    ? invalidBatchEntries.length > 0
      ? "Corrige las líneas con error antes de guardar"
      : "Escribe al menos un host por línea"
    : !cleanHost
      ? "Escribe un dominio o host"
      : !hostValid
        ? "Dominio o host inválido"
        : !portValid
          ? "Puerto fuera de rango (1-65535)"
          : duplicateCert
            ? "Este certificado ya está vigilado"
            : isInternal
              ? "Los hosts internos requieren Guardián Senti9"
              : "Completa el campo requerido";

  const submitItems = (keepOpen = false) => {
    if (!canSubmit) return;
    if (batchMode) {
      void onSubmitPayload({
        items: validBatchEntries.map((e) => ({
          domain: e.host,
          port: e.port || portInput || 443,
        })),
        keepOpen: false,
      });
      return;
    }
    void onSubmitPayload({
      items: [{ domain: cleanHost, port: portInput }],
      linkTargetId: matchingTarget && linkChecked ? matchingTarget.id : null,
      alsoWatchDns:
        !isEditing && !isInternal && !dnsAlreadyWatched && alsoWatchDns,
      alsoWatchDomain:
        !isEditing && !isInternal && !domainAlreadyWatched && alsoWatchDomain,
      keepOpen,
    });
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitItems(false);
  };

  const submitLabel = isEditing
    ? "Guardar cambios"
    : batchMode
      ? `Agregar ${validBatchEntries.length || ""} ${validBatchEntries.length === 1 ? "certificado" : "certificados"}`.trim()
      : "Agregar certificado";

  const testResultSlot =
    testResult && !batchMode ? (
      <div
        className={`rounded-xl border px-3 py-2 text-xs animate-in fade-in duration-150 ${
          testResult.is_valid
            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
            : "border-rose-500/40 bg-rose-500/10 text-rose-200"
        }`}
      >
        {testResult.is_valid ? (
          <div className="flex items-center gap-1.5 font-mono text-[11px] flex-wrap">
            <Check size={13} className="text-emerald-400 shrink-0" />
            <span className="font-sans font-semibold text-emerald-300">
              {parseIssuerOrganization(testResult.issuer)}
            </span>
            {testResult.tls_version && (
              <span>· {formatTLSVersion(testResult.tls_version)}</span>
            )}
            {testResult.security_grade && (
              <span>· {testResult.security_grade}</span>
            )}
            {testResult.days_remaining != null && (
              <span>
                ·{" "}
                {testResult.days_remaining <= 0
                  ? `venció hace ${Math.abs(testResult.days_remaining)} días`
                  : `vence en ${testResult.days_remaining} días`}
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <XCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
              <span className="font-medium leading-snug">
                {testResult.days_remaining != null &&
                testResult.days_remaining <= 0
                  ? `El certificado venció hace ${Math.abs(testResult.days_remaining)} días`
                  : testResult.error_message ||
                    "No se pudo completar la conexión TLS"}
              </span>
            </div>
            <p className="text-[11px] text-rose-200/80 pl-5">
              Puedes agregarlo igual para vigilar este problema y recibir
              alertas.
            </p>
          </div>
        )}
      </div>
    ) : undefined;

  return (
    <ResourceAddModal
      title={isEditing ? "Editar certificado" : "Agregar certificado"}
      icon={<Lock size={17} className="text-accent-green shrink-0" />}
      headerAction={
        !isEditing ? (
          <button
            type="button"
            onClick={() => {
              setBatchMode((p) => !p);
              onClearTestResult();
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border-base bg-bg-dark text-[11px] text-text-muted hover:text-accent-green hover:border-accent-green/50 transition-colors cursor-pointer !min-h-0"
          >
            <Layers size={11} />
            <span>{batchMode ? "Uno solo" : "Agregar varios"}</span>
          </button>
        ) : undefined
      }
      submitLabel={submitLabel}
      submitCapability={isEditing ? "ssl_monitor.update" : "ssl_monitor.create"}
      disabledReason={disabledReason}
      testCapability={!batchMode ? "ssl_monitor.test" : undefined}
      testLabel="Probar"
      testingLabel="Probando TLS..."
      testHint={
        !batchMode
          ? "Probamos la conexión TLS. No se guarda nada."
          : undefined
      }
      testResultSlot={testResultSlot}
      canTest={canTest}
      isTesting={isTesting}
      onTest={!batchMode ? () => onTest(cleanHost, portInput) : undefined}
      diagnostic={diagnostic}
      canSubmit={canSubmit}
      isSubmitting={isSubmitting}
      showAddAnother={!isEditing && !batchMode}
      onAddAnother={() => submitItems(true)}
      onSubmit={handleFormSubmit}
      onClose={onClose}
      destinations={destinations}
      allChannels={allChannels}
      isLoadingDestinations={isLoadingDestinations}
      onQuickCreateDestination={quickCreateDestination}
      isCreatingDestination={isCreatingDestination}
      onToggleChannelEnabled={toggleChannelEnabled}
      isTogglingChannel={isTogglingChannel}
      focusKey={`${editingCert?.id || "new"}-${batchMode ? "batch" : "single"}`}
      moreOptionsOpen={moreOptionsOpen}
      onToggleMoreOptions={() => setMoreOptionsOpen((p) => !p)}
      moreOptionsSummary={
        [
          activeTls.mode === "starttls"
            ? `STARTTLS/${activeTls.protocol || "SMTP"}`
            : "TLS directo",
          alsoWatchDns || alsoWatchDomain ? "Cobertura extra" : null,
        ]
          .filter(Boolean)
          .join(" · ")
      }
      moreOptionsContent={
        <>
          {/* TLS mode & protocol override (deduced automatically from port) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-text-muted">
                Modo y protocolo TLS
              </span>
              <span className="text-[10px] font-mono text-text-dim">
                {tlsOverride ? "manual" : "deducido del puerto"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setTlsOverride({ mode: "direct", protocol: null })
                }
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] text-left transition-colors cursor-pointer !min-h-0 ${
                  activeTls.mode === "direct"
                    ? "bg-accent-green/15 border-accent-green/50 text-accent-green font-semibold"
                    : "bg-bg-card border-border-base text-text-muted hover:text-text-main"
                }`}
              >
                TLS directo
              </button>
              <button
                type="button"
                onClick={() =>
                  setTlsOverride({
                    mode: "starttls",
                    protocol: activeTls.protocol || "SMTP",
                  })
                }
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] text-left transition-colors cursor-pointer !min-h-0 ${
                  activeTls.mode === "starttls"
                    ? "bg-accent-green/15 border-accent-green/50 text-accent-green font-semibold"
                    : "bg-bg-card border-border-base text-text-muted hover:text-text-main"
                }`}
              >
                STARTTLS
              </button>
            </div>

            {activeTls.mode === "starttls" && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[11px] text-text-dim">Protocolo:</span>
                {(["SMTP", "IMAP", "LDAP", "POP3"] as StartTlsProtocol[]).map(
                  (proto) => (
                    <button
                      key={proto}
                      type="button"
                      onClick={() =>
                        setTlsOverride({ mode: "starttls", protocol: proto })
                      }
                      className={`px-2 py-0.5 rounded-md border font-mono text-[11px] transition-colors cursor-pointer !min-h-0 ${
                        activeTls.protocol === proto
                          ? "bg-sky-500/20 border-sky-500/50 text-sky-300 font-semibold"
                          : "bg-bg-card border-border-base text-text-dim hover:text-text-main"
                      }`}
                    >
                      {proto}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Symmetrical "Vigilar también" with real typed names & "Ya vigilado" detection */}
          {!isEditing && !batchMode && !isInternal && (
            <div className="pt-2 border-t border-border-base/50 space-y-1.5">
              <span className="block text-[11px] font-medium text-text-muted">
                Vigilar también
              </span>
              {hostValid ? (
                <>
                  <label
                    className={`flex items-center justify-between gap-2 text-xs ${
                      dnsAlreadyWatched
                        ? "text-text-dim cursor-default"
                        : "text-text-main cursor-pointer"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        disabled={dnsAlreadyWatched}
                        checked={dnsAlreadyWatched ? true : alsoWatchDns}
                        onChange={(e) => setAlsoWatchDns(e.target.checked)}
                        className="rounded border-border-accent bg-bg-dark text-accent-green focus:ring-accent-green/40 disabled:opacity-50"
                      />
                      <span className="truncate">
                        Registro DNS (A) de{" "}
                        <span className="font-mono text-text-muted">
                          {cleanHost}
                        </span>
                      </span>
                    </span>
                    {dnsAlreadyWatched && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 shrink-0">
                        <Check size={11} />
                        <span>Ya vigilado</span>
                      </span>
                    )}
                  </label>

                  {apexDomain && (
                    <label
                      className={`flex items-center justify-between gap-2 text-xs ${
                        domainAlreadyWatched
                          ? "text-text-dim cursor-default"
                          : "text-text-main cursor-pointer"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          disabled={domainAlreadyWatched}
                          checked={
                            domainAlreadyWatched ? true : alsoWatchDomain
                          }
                          onChange={(e) => setAlsoWatchDomain(e.target.checked)}
                          className="rounded border-border-accent bg-bg-dark text-accent-green focus:ring-accent-green/40 disabled:opacity-50"
                        />
                        <span className="truncate">
                          Vencimiento de{" "}
                          <span className="font-mono text-text-muted">
                            {apexDomain}
                          </span>
                        </span>
                      </span>
                      {domainAlreadyWatched && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 shrink-0">
                          <Check size={11} />
                          <span>Ya vigilado</span>
                        </span>
                      )}
                    </label>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-text-dim">
                  Escribe un dominio o host para ver qué más puedes vigilar.
                </p>
              )}
            </div>
          )}
        </>
      }
    >
      {/* Primary field or batch paste */}
      {!batchMode ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="sm:col-span-3">
              <label
                htmlFor="ssl-host-input"
                className="block text-xs font-semibold text-text-muted mb-1.5"
              >
                Dominio o host <span className="text-rose-400">*</span>
              </label>
              <input
                id="ssl-host-input"
                data-autofocus
                type="text"
                required
                placeholder="api.tuempresa.com"
                value={domainInput}
                onChange={(e) => handleDomainChange(e.target.value)}
                className={`w-full bg-bg-dark border rounded-xl px-3.5 py-2 text-sm text-text-main placeholder:text-text-dim/45 focus:outline-none font-mono ${
                  domainInput.trim() && !hostValid
                    ? "border-rose-500/70 focus:border-rose-400"
                    : "border-border-base focus:border-accent-green"
                }`}
              />
            </div>

            <div className="sm:col-span-1">
              <label
                htmlFor="ssl-port-input"
                className="block text-xs font-semibold text-text-muted mb-1.5"
              >
                Puerto
              </label>
              <input
                id="ssl-port-input"
                type="number"
                min={1}
                max={65535}
                value={portInput}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  onPortInputChange(Number.isNaN(val) ? 0 : val);
                  onClearTestResult();
                }}
                className={`w-full bg-bg-dark border rounded-xl px-2.5 py-2 text-sm text-text-main focus:outline-none font-mono text-center ${
                  !portValid
                    ? "border-rose-500/70 focus:border-rose-400"
                    : "border-border-base focus:border-accent-green"
                }`}
              />
            </div>
          </div>

          {/* Clickable common port chips (including STARTTLS ports 587 & 143) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {COMMON_SSL_PORTS.map((item) => (
              <button
                key={item.port}
                type="button"
                onClick={() => {
                  onPortInputChange(item.port);
                  onClearTestResult();
                }}
                className={`px-2 py-0.5 rounded-md border text-[11px] font-mono transition-colors cursor-pointer !min-h-0 ${
                  portInput === item.port
                    ? "bg-accent-green/15 border-accent-green/50 text-accent-green font-semibold"
                    : "bg-bg-dark border-border-base text-text-dim hover:text-text-main hover:border-border-accent"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {extractedNotice && (
            <p className="text-[11px] text-sky-300 font-mono">
              {extractedNotice}
            </p>
          )}

          {activeTls.mode === "starttls" && (
            <p className="text-[11px] text-sky-300">
              Modo deducido:{" "}
              <strong className="font-mono">
                STARTTLS/{activeTls.protocol || "SMTP"}
              </strong>{" "}
              para el puerto <span className="font-mono">{portInput}</span>.
              Puedes ajustarlo en Más opciones.
            </p>
          )}

          {domainInput.trim() && !hostValid && (
            <p className="text-[11px] text-rose-400">
              Ingresa un dominio o host válido (ej. api.tuempresa.com).
            </p>
          )}
          {!portValid && (
            <p className="text-[11px] text-rose-400">
              El puerto debe estar entre 1 y 65535.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="ssl-batch-input"
              className="text-xs font-semibold text-text-muted"
            >
              Varios certificados
            </label>
            <span className="text-[11px] font-mono text-text-dim">
              Formato: host o host:puerto por línea
            </span>
          </div>
          <textarea
            id="ssl-batch-input"
            data-autofocus
            rows={5}
            placeholder={"api.tuempresa.com\npanel.tuempresa.com:8443\ncorreo.tuempresa.com:587"}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            className="w-full bg-bg-dark border border-border-base rounded-xl p-3 text-xs font-mono text-text-main placeholder:text-text-dim/45 focus:outline-none focus:border-accent-green"
          />
          {batchEntries.length > 0 && (
            <div className="space-y-1 text-[11px] font-mono">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">
                  {validBatchEntries.length} válidos
                </span>
                {invalidBatchEntries.length > 0 && (
                  <span className="text-rose-400">
                    · {invalidBatchEntries.length} con error
                  </span>
                )}
              </div>
              {invalidBatchEntries.slice(0, 3).map((inv, idx) => (
                <div key={idx} className="text-rose-300 truncate">
                  {inv.raw} — {inv.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Duplicate warning */}
      {duplicateCert && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-amber-200 font-medium">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <span>Ya vigilas este certificado</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectExisting(duplicateCert);
            }}
            className="inline-flex items-center gap-1 text-accent-green hover:underline font-semibold cursor-pointer !min-h-0"
          >
            <span>Ver certificado</span>
            <ArrowUpRight size={12} />
          </button>
        </div>
      )}

      {/* Internal host -> Guardián Senti9 (same pattern as Uptime modal) */}
      {isInternal && !batchMode && (
        <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-sky-200">
              <Server size={13} className="text-sky-400 shrink-0" />
              <span>Host interno · usa Guardián Senti9</span>
            </span>
            <Link
              to="/monitoring/senti9"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent-green hover:underline font-semibold shrink-0"
            >
              <span>Abrir Senti9</span>
              <ArrowUpRight size={11} />
            </Link>
          </div>
          <p className="text-[11px] text-sky-200/85 leading-relaxed">
            El ejecutor cloud no alcanza{" "}
            <span className="font-mono">{cleanHost}</span>. Configura un agente
            Guardián Senti9 dentro de tu red para vigilar certificados internos.
          </p>
        </div>
      )}

      {/* Matching Uptime target suggestion */}
      {matchingTarget && !batchMode && (
        <label className="rounded-xl border border-border-base/80 bg-bg-dark/60 px-3 py-2 flex items-center justify-between gap-2 cursor-pointer">
          <span className="inline-flex items-center gap-2 text-text-main min-w-0">
            <Link2 size={13} className="text-accent-green shrink-0" />
            <span className="truncate">
              Detectamos el target{" "}
              <strong className="text-text-main">{matchingTarget.name}</strong>
              {!matchingTarget.enabled ? " (pausado)" : ""}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-medium text-accent-green">
            <input
              type="checkbox"
              checked={linkChecked}
              onChange={(e) => setLinkChecked(e.target.checked)}
              className="rounded border-border-accent bg-bg-dark text-accent-green focus:ring-accent-green/40"
            />
            <span>Vincular</span>
          </span>
        </label>
      )}
    </ResourceAddModal>
  );
}
