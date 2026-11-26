import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Globe,
  Layers,
  Server,
  XCircle,
} from "lucide-react";
import { useOrgContextForAddModal } from "../../hooks/useOrgContextForAddModal";
import type {
  DNSRecord,
  DNSRecordType,
  DNSReferenceMode,
  DNSTestResolutionResult,
} from "../../types/dns";
import {
  extractRegistrableDomain,
  isInternalOrPrivateHost,
  isValidHost,
  parseDnsBatchLines,
  parseHostAndPort,
  valuesToCidrPrefixes,
} from "../../utils/hostInput";
import ResourceAddModal from "../common/connectivity/ResourceAddModal";
import { formatDNSLatency } from "./useDNSRecords";

const PRIMARY_DNS_TYPES: DNSRecordType[] = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "NS",
];
const EXTRA_DNS_TYPES: DNSRecordType[] = ["SOA", "SRV", "CAA", "PTR"];

function placeholderForType(type: DNSRecordType): string {
  switch (type) {
    case "MX":
    case "NS":
    case "SOA":
    case "CAA":
      return "empresa.com";
    case "TXT":
      return "_dmarc.empresa.com";
    case "SRV":
      return "_sip._tcp.empresa.com";
    case "PTR":
      return "1.0.168.192.in-addr.arpa";
    default:
      return "api.empresa.com";
  }
}

export interface DNSModalSubmitPayload {
  items: {
    domain: string;
    record_type: DNSRecordType;
    expected_value?: string;
    reference_mode: DNSReferenceMode;
  }[];
  alsoWatchSsl?: boolean;
  alsoWatchDomain?: boolean;
  keepOpen?: boolean;
}

interface DNSAddModalProps {
  editingRecord: DNSRecord | null;
  existingRecords: DNSRecord[];
  domainInput: string;
  onDomainInputChange: (val: string) => void;
  recordTypeInput: DNSRecordType;
  onRecordTypeInputChange: (val: DNSRecordType) => void;
  expectedInput: string;
  onExpectedInputChange: (val: string) => void;
  referenceModeInput: DNSReferenceMode;
  onReferenceModeInputChange: (val: DNSReferenceMode) => void;
  isTesting: boolean;
  testResult: DNSTestResolutionResult | null;
  onClearTestResult: () => void;
  onTest: (domain: string, recordType: DNSRecordType) => void;
  diagnostic: { notice: string; remaining: number };
  isSubmitting: boolean;
  onSubmitPayload: (payload: DNSModalSubmitPayload) => Promise<void> | void;
  onSelectExisting: (record: DNSRecord) => void;
  onClose: () => void;
}

export default function DNSAddModal({
  editingRecord,
  existingRecords,
  domainInput,
  onDomainInputChange,
  recordTypeInput,
  onRecordTypeInputChange,
  expectedInput,
  onExpectedInputChange,
  referenceModeInput,
  onReferenceModeInputChange,
  isTesting,
  testResult,
  onClearTestResult,
  onTest,
  diagnostic,
  isSubmitting,
  onSubmitPayload,
  onSelectExisting,
  onClose,
}: DNSAddModalProps) {
  const isEditing = Boolean(editingRecord);
  const {
    allChannels,
    destinations,
    isLoadingDestinations,
    sslItems,
    watchedDomains,
    quickCreateDestination,
    isCreatingDestination,
    toggleChannelEnabled,
    isTogglingChannel,
  } = useOrgContextForAddModal(true);

  const [selectedTypes, setSelectedTypes] = useState<DNSRecordType[]>([
    recordTypeInput,
  ]);
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [resolverMode, setResolverMode] = useState<"public" | "senti9">(
    "public",
  );
  const [alsoWatchSsl, setAlsoWatchSsl] = useState(false);
  const [alsoWatchDomain, setAlsoWatchDomain] = useState(false);
  const [refChoice, setRefChoice] = useState<"none" | "exact" | "cidr">(() =>
    expectedInput.trim()
      ? referenceModeInput === "cidr" || referenceModeInput === "provider"
        ? "cidr"
        : "exact"
      : "none",
  );
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(
    Boolean(expectedInput.trim()),
  );

  const activeTypes = useMemo(
    () => (isEditing ? [recordTypeInput] : selectedTypes),
    [isEditing, recordTypeInput, selectedTypes],
  );
  const primaryType = activeTypes[0] || "A";
  const cidrSupported = activeTypes.some((t) => t === "A" || t === "AAAA");

  // If user switches away from A/AAAA while in CIDR mode, fall back cleanly to exact
  useEffect(() => {
    if (!cidrSupported && refChoice === "cidr") {
      setRefChoice(expectedInput.trim() ? "exact" : "none");
      onReferenceModeInputChange("exact");
    }
  }, [cidrSupported, refChoice, expectedInput, onReferenceModeInputChange]);

  const parsed = useMemo(() => parseHostAndPort(domainInput), [domainInput]);
  const cleanHost = parsed.host;
  const hostValid = isValidHost(cleanHost, {
    allowUnderscore: true,
    allowSingleLabel: true,
  });
  const isInternal = Boolean(cleanHost && isInternalOrPrivateHost(cleanHost));

  useEffect(() => {
    if (isInternal) {
      setResolverMode("senti9");
    }
  }, [isInternal]);

  // Existing coverage checks for symmetrical "Vigilar también"
  const apexDomain =
    hostValid && !isInternal && !cleanHost.startsWith("_")
      ? extractRegistrableDomain(cleanHost)
      : "";
  const sslAlreadyWatched = Boolean(
    cleanHost &&
      sslItems.some((c) => c.domain === cleanHost && c.port === 443),
  );
  const domainAlreadyWatched = Boolean(
    apexDomain && watchedDomains.includes(apexDomain),
  );

  // Duplicate check across selected types
  const duplicateRecords = useMemo(() => {
    if (!cleanHost || batchMode) return [];
    return existingRecords.filter(
      (r) =>
        r.id !== editingRecord?.id &&
        r.domain.toLowerCase() === cleanHost &&
        activeTypes.includes(r.record_type),
    );
  }, [existingRecords, cleanHost, activeTypes, editingRecord, batchMode]);

  // Batch parsing ("host" or "host TYPE" per line)
  const batchEntries = useMemo(
    () => (batchMode ? parseDnsBatchLines(batchText) : []),
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

  const toggleType = (type: DNSRecordType) => {
    onClearTestResult();
    if (isEditing) {
      onRecordTypeInputChange(type);
      return;
    }
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        const next = prev.filter((t) => t !== type);
        onRecordTypeInputChange(next[0]);
        return next;
      }
      const next = [...prev, type];
      onRecordTypeInputChange(next[0]);
      return next;
    });
  };

  const applyResolvedAsReference = (mode: "exact" | "cidr") => {
    if (!testResult?.success || !testResult.values.length) return;
    if (mode === "cidr" && !cidrSupported) return;
    setRefChoice(mode);
    onReferenceModeInputChange(mode);
    const values =
      mode === "cidr"
        ? valuesToCidrPrefixes(testResult.values)
        : testResult.values;
    onExpectedInputChange(values.join("\n"));
    setMoreOptionsOpen(true);
  };

  const canTest =
    !batchMode && hostValid && !isInternal && resolverMode === "public";
  const allDuplicates =
    !batchMode &&
    activeTypes.length > 0 &&
    duplicateRecords.length === activeTypes.length;
  const canSubmit = batchMode
    ? validBatchEntries.length > 0 &&
      invalidBatchEntries.length === 0 &&
      activeTypes.length > 0
    : hostValid && activeTypes.length > 0 && !allDuplicates;

  const totalToCreate = batchMode
    ? validBatchEntries.reduce(
        (sum, entry) => sum + (entry.explicitType ? 1 : activeTypes.length),
        0,
      )
    : Math.max(0, activeTypes.length - duplicateRecords.length);

  const disabledReason = batchMode
    ? invalidBatchEntries.length > 0
      ? "Corrige las líneas con error antes de guardar"
      : "Escribe al menos un host por línea"
    : !cleanHost
      ? "Escribe un dominio o host"
      : !hostValid
        ? "Dominio o host inválido"
        : allDuplicates
          ? "Ya vigilas estos tipos de registro para este host"
          : resolverMode === "senti9" || isInternal
            ? "La prueba rápida usa resolvers públicos; para zonas privadas usa Guardián Senti9"
            : "Completa el campo requerido";

  const submitItems = (keepOpen = false) => {
    if (!canSubmit) return;
    const effectiveMode: DNSReferenceMode =
      refChoice === "cidr" && cidrSupported ? "cidr" : "exact";
    const effectiveExpected = refChoice === "none" ? "" : expectedInput.trim();

    if (batchMode) {
      const items = validBatchEntries.flatMap((entry) => {
        const typesForLine = entry.explicitType
          ? [entry.explicitType as DNSRecordType]
          : activeTypes;
        return typesForLine.map((rt) => ({
          domain: entry.host,
          record_type: rt,
          expected_value: "",
          reference_mode: "exact" as DNSReferenceMode,
        }));
      });
      void onSubmitPayload({ items, keepOpen: false });
      return;
    }

    const dupSet = new Set(duplicateRecords.map((r) => r.record_type));
    const typesToCreate = isEditing
      ? [recordTypeInput]
      : activeTypes.filter((t) => !dupSet.has(t));

    void onSubmitPayload({
      items: typesToCreate.map((rt) => ({
        domain: cleanHost,
        record_type: rt,
        expected_value: typesToCreate.length === 1 ? effectiveExpected : "",
        reference_mode: effectiveMode,
      })),
      alsoWatchSsl:
        !isEditing &&
        !isInternal &&
        !cleanHost.startsWith("_") &&
        !sslAlreadyWatched &&
        alsoWatchSsl,
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
    : totalToCreate > 1
      ? `Agregar ${totalToCreate} registros`
      : "Agregar registro";

  const testResultSlot =
    testResult && !batchMode ? (
      <div
        className={`rounded-xl border px-3 py-2 space-y-2 text-xs animate-in fade-in duration-150 ${
          testResult.success
            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
            : "border-rose-500/40 bg-rose-500/10 text-rose-200"
        }`}
      >
        {testResult.success ? (
          <>
            <div className="flex items-start gap-1.5 font-mono text-[11px]">
              <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
              <span className="break-all leading-relaxed">
                <strong className="text-emerald-300">
                  {testResult.record_type || primaryType}
                </strong>
                {" -> "}
                <strong className="text-emerald-100">
                  {testResult.values.slice(0, 3).join(", ")}
                  {testResult.values.length > 3
                    ? ` +${testResult.values.length - 3}`
                    : ""}
                </strong>
                {" · "}
                {formatDNSLatency(testResult.response_time_ms)}
              </span>
            </div>

            {testResult.propagation_status === "propagating" && (
              <p className="text-[11px] text-amber-300 pl-5">
                1.1.1.1 y 8.8.8.8 devolvieron valores distintos (propagación en
                curso).
              </p>
            )}

            {activeTypes.length === 1 && testResult.values.length > 0 && (
              <div className="pl-5 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-emerald-200/85">
                  Usar valores encontrados:
                </span>
                <button
                  type="button"
                  onClick={() => applyResolvedAsReference("exact")}
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors cursor-pointer !min-h-0 ${
                    refChoice === "exact"
                      ? "bg-accent-green text-black border-accent-green font-semibold"
                      : "bg-bg-dark/80 border-emerald-500/40 text-emerald-200 hover:border-accent-green"
                  }`}
                >
                  Exacta
                </button>
                <button
                  type="button"
                  disabled={!cidrSupported}
                  title={
                    cidrSupported
                      ? "Usar prefijo CIDR (/24 o /48) de las IPs encontradas"
                      : "Rango (CIDR) solo aplica a registros A y AAAA"
                  }
                  onClick={() => applyResolvedAsReference("cidr")}
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed !min-h-0 ${
                    refChoice === "cidr"
                      ? "bg-accent-green text-black border-accent-green font-semibold"
                      : "bg-bg-dark/80 border-emerald-500/40 text-emerald-200 hover:border-accent-green"
                  }`}
                >
                  Rango (CIDR)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <XCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
              <span className="font-medium leading-snug">
                {testResult.error_message ||
                  "No se pudo resolver el registro en DNS públicos"}
              </span>
            </div>
            <p className="text-[11px] text-rose-200/80 pl-5">
              Puedes agregarlo igual para vigilar cuándo empiece a resolver.
            </p>
          </div>
        )}
      </div>
    ) : undefined;

  return (
    <ResourceAddModal
      title={isEditing ? "Editar registro DNS" : "Agregar registro"}
      icon={<Globe size={17} className="text-accent-green shrink-0" />}
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
      submitCapability={isEditing ? "dns_monitor.update" : "dns_monitor.create"}
      disabledReason={disabledReason}
      testCapability={!batchMode ? "dns_monitor.test" : undefined}
      testLabel={activeTypes.length > 1 ? `Probar ${primaryType}` : "Probar"}
      testingLabel="Resolviendo..."
      testHint={
        !batchMode
          ? "Resolvemos el registro con DNS públicos. No se guarda nada."
          : undefined
      }
      testResultSlot={testResultSlot}
      canTest={canTest}
      isTesting={isTesting}
      onTest={!batchMode ? () => onTest(cleanHost, primaryType) : undefined}
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
      focusKey={`${editingRecord?.id || "new"}-${batchMode ? "batch" : "single"}`}
      moreOptionsOpen={moreOptionsOpen}
      onToggleMoreOptions={() => setMoreOptionsOpen((p) => !p)}
      moreOptionsSummary={
        [
          refChoice === "none"
            ? "Sin referencia"
            : refChoice === "cidr"
              ? "Referencia CIDR"
              : "Referencia exacta",
          resolverMode === "senti9" ? "Guardián Senti9" : "1.1.1.1 / 8.8.8.8",
        ].join(" · ")
      }
      moreOptionsContent={
        <div className="space-y-3">
          {/* Reference mode selector */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-medium text-text-muted">
              Referencia esperada
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "none", label: "Sin referencia", disabled: false },
                  { id: "exact", label: "Exacta", disabled: false },
                  {
                    id: "cidr",
                    label: "Rango (CIDR)",
                    disabled: !cidrSupported,
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={opt.disabled}
                  title={
                    opt.disabled
                      ? "Rango (CIDR) solo aplica a registros A y AAAA"
                      : undefined
                  }
                  onClick={() => {
                    if (opt.disabled) return;
                    setRefChoice(opt.id);
                    if (opt.id === "none") {
                      onExpectedInputChange("");
                      onReferenceModeInputChange("exact");
                    } else {
                      onReferenceModeInputChange(opt.id);
                      if (
                        !expectedInput.trim() &&
                        testResult?.success &&
                        testResult.values.length > 0
                      ) {
                        const vals =
                          opt.id === "cidr"
                            ? valuesToCidrPrefixes(testResult.values)
                            : testResult.values;
                        onExpectedInputChange(vals.join("\n"));
                      }
                    }
                  }}
                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed !min-h-0 ${
                    refChoice === opt.id
                      ? "bg-accent-green/15 border-accent-green/50 text-accent-green font-semibold"
                      : "bg-bg-card border-border-base text-text-muted hover:text-text-main"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-text-dim">
              {refChoice === "none"
                ? "Solo alerta si el registro deja de resolver."
                : refChoice === "cidr"
                  ? "Ideal para CDN o proveedores con IPs rotativas (ej. 216.198.79.0/24)."
                  : "Alerta si el valor resuelto cambia y los resolvers coinciden tras el TTL."}
            </p>
          </div>

          {refChoice !== "none" && (
            <div className="space-y-1">
              <textarea
                rows={3}
                value={expectedInput}
                onChange={(e) => onExpectedInputChange(e.target.value)}
                placeholder={
                  refChoice === "cidr"
                    ? "216.198.79.0/24\n64.29.17.0/24"
                    : "104.21.76.164\n172.67.197.121"
                }
                className="w-full p-2.5 bg-bg-dark border border-border-base rounded-xl text-xs font-mono text-text-main placeholder:text-text-dim/45 focus:outline-none focus:border-accent-green"
              />
              <span className="block text-[10px] text-text-dim">
                Un valor o rango por línea (el orden no importa).
              </span>
            </div>
          )}

          {/* Selectable Resolver (public vs Guardián Senti9 for private zones) */}
          <div className="pt-2 border-t border-border-base/50 space-y-1.5">
            <span className="block text-[11px] font-medium text-text-muted">
              Resolvers
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setResolverMode("public")}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] text-left transition-colors cursor-pointer !min-h-0 ${
                  resolverMode === "public"
                    ? "bg-accent-green/15 border-accent-green/50 text-accent-green font-semibold"
                    : "bg-bg-card border-border-base text-text-muted hover:text-text-main"
                }`}
              >
                Públicos (1.1.1.1 / 8.8.8.8)
              </button>
              <button
                type="button"
                onClick={() => setResolverMode("senti9")}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] text-left transition-colors cursor-pointer !min-h-0 ${
                  resolverMode === "senti9"
                    ? "bg-sky-500/15 border-sky-500/50 text-sky-300 font-semibold"
                    : "bg-bg-card border-border-base text-text-muted hover:text-text-main"
                }`}
              >
                Guardián Senti9 (privado)
              </button>
            </div>
            {resolverMode === "senti9" && (
              <div className="flex items-center justify-between gap-2 text-[11px] text-sky-300">
                <span>
                  Usa un agente Guardián Senti9 para resolver zonas internas.
                </span>
                <Link
                  to="/monitoring/senti9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-accent-green hover:underline shrink-0"
                >
                  <span>Abrir Senti9</span>
                  <ArrowUpRight size={11} />
                </Link>
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
                  {!cleanHost.startsWith("_") && (
                    <label
                      className={`flex items-center justify-between gap-2 text-xs ${
                        sslAlreadyWatched
                          ? "text-text-dim cursor-default"
                          : "text-text-main cursor-pointer"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          disabled={sslAlreadyWatched}
                          checked={sslAlreadyWatched ? true : alsoWatchSsl}
                          onChange={(e) => setAlsoWatchSsl(e.target.checked)}
                          className="rounded border-border-accent bg-bg-dark text-accent-green focus:ring-accent-green/40 disabled:opacity-50"
                        />
                        <span className="truncate">
                          Certificado SSL (:443) de{" "}
                          <span className="font-mono text-text-muted">
                            {cleanHost}
                          </span>
                        </span>
                      </span>
                      {sslAlreadyWatched && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 shrink-0">
                          <Check size={11} />
                          <span>Ya vigilado</span>
                        </span>
                      )}
                    </label>
                  )}

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
        </div>
      }
    >
      {/* Host input or Batch mode */}
      {!batchMode ? (
        <div className="space-y-1.5">
          <label
            htmlFor="dns-host-input"
            className="block text-xs font-semibold text-text-muted"
          >
            Dominio o host <span className="text-rose-400">*</span>
          </label>
          <input
            id="dns-host-input"
            data-autofocus
            type="text"
            required
            placeholder={placeholderForType(primaryType)}
            value={domainInput}
            onChange={(e) => {
              const p = parseHostAndPort(e.target.value);
              onDomainInputChange(
                p.hadUrlParts && p.host ? p.host : e.target.value,
              );
              onClearTestResult();
            }}
            className={`w-full bg-bg-dark border rounded-xl px-3.5 py-2 text-sm text-text-main placeholder:text-text-dim/45 focus:outline-none font-mono ${
              domainInput.trim() && !hostValid
                ? "border-rose-500/70 focus:border-rose-400"
                : "border-border-base focus:border-accent-green"
            }`}
          />
          {domainInput.trim() && !hostValid && (
            <p className="text-[11px] text-rose-400">
              Ingresa un dominio o host válido (ej.{" "}
              {placeholderForType(primaryType)}).
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="dns-batch-input"
              className="text-xs font-semibold text-text-muted"
            >
              Varios registros
            </label>
            <span className="text-[11px] font-mono text-text-dim">
              Formato: host o host TIPO por línea
            </span>
          </div>
          <textarea
            id="dns-batch-input"
            data-autofocus
            rows={4}
            placeholder={"api.empresa.com A\nempresa.com MX\n_dmarc.empresa.com TXT"}
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

      {/* Multi-type chips (single in edit, multi in create) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text-muted">
            {isEditing
              ? "Tipo de registro"
              : batchMode
                ? "Tipos por defecto (si la línea no indica tipo)"
                : "Tipos a vigilar"}
          </span>
          {!isEditing && !batchMode && (
            <span className="text-[11px] text-text-dim">
              Puedes elegir varios
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {PRIMARY_DNS_TYPES.map((type) => {
            const active = activeTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`px-2.5 py-1 rounded-lg border font-mono text-xs font-semibold transition-colors cursor-pointer !min-h-0 ${
                  active
                    ? "bg-accent-green/15 border-accent-green/60 text-accent-green"
                    : "bg-bg-dark border-border-base text-text-muted hover:text-text-main hover:border-border-accent"
                }`}
              >
                {type}
              </button>
            );
          })}
          <select
            aria-label="Otros tipos DNS"
            value={EXTRA_DNS_TYPES.includes(primaryType) ? primaryType : ""}
            onChange={(e) => {
              const val = e.target.value as DNSRecordType;
              if (val) toggleType(val);
            }}
            className="px-2 py-1 rounded-lg border border-border-base bg-bg-dark font-mono text-xs text-text-muted focus:border-accent-green focus:outline-none cursor-pointer"
          >
            <option value="">Otros…</option>
            {EXTRA_DNS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Duplicate warning */}
      {duplicateRecords.length > 0 && !batchMode && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-amber-200 font-medium">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <span>
              Ya vigilas{" "}
              <span className="font-mono">
                {duplicateRecords.map((r) => r.record_type).join(", ")}
              </span>{" "}
              para este host
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectExisting(duplicateRecords[0]);
            }}
            className="inline-flex items-center gap-1 text-accent-green hover:underline font-semibold cursor-pointer !min-h-0"
          >
            <span>Ver registro</span>
            <ArrowUpRight size={12} />
          </button>
        </div>
      )}

      {/* Internal host -> Guardián Senti9 suggestion */}
      {isInternal && !batchMode && (
        <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-sky-200">
              <Server size={13} className="text-sky-400 shrink-0" />
              <span>Zona privada detectada · Guardián Senti9</span>
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
            Los resolvers públicos (1.1.1.1 y 8.8.8.8) no ven zonas privadas.
            Cambiamos el resolver a Guardián Senti9 para tu red interna.
          </p>
        </div>
      )}
    </ResourceAddModal>
  );
}
