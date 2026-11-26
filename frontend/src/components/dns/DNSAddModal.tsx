import { useMemo, useState, type FormEvent } from "react";
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
  isInternalOrPrivateHost,
  isValidHost,
  parseBatchHostLines,
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
  const { destinations, isLoadingDestinations } =
    useOrgContextForAddModal(true);

  const [selectedTypes, setSelectedTypes] = useState<DNSRecordType[]>([
    recordTypeInput,
  ]);
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState("");
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

  const activeTypes = isEditing ? [recordTypeInput] : selectedTypes;
  const primaryType = activeTypes[0] || "A";

  const parsed = useMemo(() => parseHostAndPort(domainInput), [domainInput]);
  const cleanHost = parsed.host;
  const hostValid = isValidHost(cleanHost, {
    allowUnderscore: true,
    allowSingleLabel: true,
  });
  const isInternal = Boolean(cleanHost && isInternalOrPrivateHost(cleanHost));

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

  const batchEntries = useMemo(
    () =>
      batchMode
        ? parseBatchHostLines(batchText, { allowUnderscore: true })
        : [],
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
    setRefChoice(mode);
    onReferenceModeInputChange(mode);
    const values =
      mode === "cidr"
        ? valuesToCidrPrefixes(testResult.values)
        : testResult.values;
    onExpectedInputChange(values.join("\n"));
    setMoreOptionsOpen(true);
  };

  const canTest = !batchMode && hostValid && !isInternal;
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
    ? validBatchEntries.length * activeTypes.length
    : activeTypes.length - duplicateRecords.length;

  const submitItems = (keepOpen = false) => {
    if (!canSubmit) return;
    const effectiveMode: DNSReferenceMode =
      refChoice === "cidr" ? "cidr" : "exact";
    const effectiveExpected = refChoice === "none" ? "" : expectedInput.trim();

    if (batchMode) {
      const items = validBatchEntries.flatMap((entry) =>
        activeTypes.map((rt) => ({
          domain: entry.host,
          record_type: rt,
          expected_value: "",
          reference_mode: "exact" as DNSReferenceMode,
        })),
      );
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
        // Only apply expected_value when creating a single type or editing
        expected_value:
          typesToCreate.length === 1 ? effectiveExpected : "",
        reference_mode: effectiveMode,
      })),
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

  return (
    <ResourceAddModal
      title={isEditing ? "Editar registro DNS" : "Agregar registro"}
      icon={<Globe size={17} className="text-accent-green shrink-0" />}
      submitLabel={submitLabel}
      submitCapability={isEditing ? "dns_monitor.update" : "dns_monitor.create"}
      testCapability={!batchMode ? "dns_monitor.test" : undefined}
      testLabel={
        activeTypes.length > 1 ? `Probar ${primaryType}` : "Probar"
      }
      testingLabel="Resolviendo..."
      testHint={
        !batchMode
          ? "Resolvemos el registro con DNS públicos. No se guarda nada."
          : undefined
      }
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
      isLoadingDestinations={isLoadingDestinations}
      focusKey={`${editingRecord?.id || "new"}-${batchMode ? "batch" : "single"}`}
      moreOptionsOpen={moreOptionsOpen}
      onToggleMoreOptions={() => setMoreOptionsOpen((p) => !p)}
      moreOptionsSummary={
        refChoice === "none"
          ? "Sin referencia"
          : refChoice === "cidr"
            ? "Referencia CIDR"
            : "Referencia exacta"
      }
      moreOptionsContent={
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            <span className="block text-[11px] font-medium text-text-muted">
              Referencia esperada
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "none", label: "Sin referencia" },
                  { id: "exact", label: "Exacta" },
                  { id: "cidr", label: "Rango (CIDR)" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
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
                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer !min-h-0 ${
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
                className="w-full p-2.5 bg-bg-dark border border-border-base rounded-xl text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
              />
              <span className="block text-[10px] text-text-dim">
                Un valor o rango por línea (el orden no importa).
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-border-base/50 flex items-center justify-between text-[11px] text-text-dim">
            <span>Resolvers</span>
            <span className="font-mono text-text-muted">
              1.1.1.1 y 8.8.8.8 (públicos)
            </span>
          </div>
        </div>
      }
    >
      {/* Host input or Batch mode */}
      {!batchMode ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="dns-host-input"
              className="text-xs font-semibold text-text-muted"
            >
              Dominio o host <span className="text-rose-400">*</span>
            </label>
            {!isEditing && (
              <button
                type="button"
                onClick={() => {
                  setBatchMode(true);
                  onClearTestResult();
                }}
                className="inline-flex items-center gap-1 text-[11px] text-text-dim hover:text-accent-green transition-colors cursor-pointer !min-h-0"
              >
                <Layers size={11} />
                <span>Agregar varios</span>
              </button>
            )}
          </div>
          <input
            id="dns-host-input"
            data-autofocus
            type="text"
            required
            placeholder={placeholderForType(primaryType)}
            value={domainInput}
            onChange={(e) => {
              const p = parseHostAndPort(e.target.value);
              onDomainInputChange(p.hadUrlParts && p.host ? p.host : e.target.value);
              onClearTestResult();
            }}
            className={`w-full bg-bg-dark border rounded-xl px-3.5 py-2 text-sm text-text-main placeholder:text-text-dim focus:outline-none font-mono ${
              domainInput.trim() && !hostValid
                ? "border-rose-500/70 focus:border-rose-400"
                : "border-border-base focus:border-accent-green"
            }`}
          />
          {domainInput.trim() && !hostValid && (
            <p className="text-[11px] text-rose-400">
              Ingresa un dominio o host válido (ej. {placeholderForType(primaryType)}).
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="dns-batch-input"
              className="text-xs font-semibold text-text-muted"
            >
              Lista de dominios o hosts (uno por línea)
            </label>
            <button
              type="button"
              onClick={() => setBatchMode(false)}
              className="text-[11px] text-accent-green hover:underline cursor-pointer !min-h-0"
            >
              Volver a uno solo
            </button>
          </div>
          <textarea
            id="dns-batch-input"
            data-autofocus
            rows={4}
            placeholder={"api.empresa.com\nwww.empresa.com\n_dmarc.empresa.com"}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            className="w-full bg-bg-dark border border-border-base rounded-xl p-3 text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
          />
          {batchEntries.length > 0 && (
            <div className="text-[11px] font-mono flex items-center gap-2">
              <span className="text-emerald-400">
                {validBatchEntries.length} válidos
              </span>
              {invalidBatchEntries.length > 0 && (
                <span className="text-rose-400">
                  · {invalidBatchEntries.length} con error
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Multi-type chips (single in edit, multi in create) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text-muted">
            {isEditing ? "Tipo de registro" : "Tipos a vigilar"}
          </span>
          {!isEditing && (
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
            value={
              EXTRA_DNS_TYPES.includes(primaryType) ? primaryType : ""
            }
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

      {/* Internal host -> Guardián Senti9 */}
      {isInternal && !batchMode && (
        <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-sky-200">
              <Server size={13} className="text-sky-400 shrink-0" />
              <span>Zona privada detectada</span>
            </span>
            <Link
              to="/monitoring/senti9"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-accent-green hover:underline font-semibold shrink-0"
            >
              <span>Guardián Senti9</span>
              <ArrowUpRight size={11} />
            </Link>
          </div>
          <p className="text-[11px] text-sky-200/85 leading-relaxed">
            Los resolvers públicos (1.1.1.1 y 8.8.8.8) no resuelven dominios
            internos. Usa Guardián Senti9 para vigilar zonas privadas.
          </p>
        </div>
      )}

      {/* 1-line inline test result + quick "Usar estos valores como referencia" */}
      {testResult && !batchMode && (
        <div
          className={`rounded-xl border px-3 py-2.5 space-y-2 text-xs animate-in fade-in duration-150 ${
            testResult.success
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/40 bg-rose-500/10 text-rose-200"
          }`}
        >
          {testResult.success ? (
            <>
              <div className="flex items-start gap-2 font-mono text-[11px]">
                <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span className="break-all leading-relaxed">
                  Resuelve a{" "}
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
                <div className="pl-5 flex items-center gap-2 flex-wrap pt-0.5">
                  <span className="text-[11px] text-emerald-200/85">
                    Usar como referencia:
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
                    onClick={() => applyResolvedAsReference("cidr")}
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors cursor-pointer !min-h-0 ${
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
                Puedes agregarlo igualmente para vigilar cuándo empiece a
                resolver.
              </p>
            </div>
          )}
        </div>
      )}
    </ResourceAddModal>
  );
}
