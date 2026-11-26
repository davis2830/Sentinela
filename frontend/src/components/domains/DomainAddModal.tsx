import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Check,
  Globe2,
  Layers,
  Link2,
  Sparkles,
} from "lucide-react";
import { useOrgContextForAddModal } from "../../hooks/useOrgContextForAddModal";
import type { DomainInfo, DomainTestWhoisResult } from "../../types/domain";
import {
  extractRegistrableDomain,
  isValidHost,
  matchesDomainTree,
  parseBatchHostLines,
  parseHostAndPort,
} from "../../utils/hostInput";
import ResourceAddModal from "../common/connectivity/ResourceAddModal";
import { formatDomainDate } from "./useDomains";

type AutoRenewChoice = "yes" | "no" | "unknown";

function choiceToBoolOrNull(choice: AutoRenewChoice): boolean | null {
  if (choice === "yes") return true;
  if (choice === "no") return false;
  return null;
}

function boolOrNullToChoice(val: boolean | null | undefined): AutoRenewChoice {
  if (val === true) return "yes";
  if (val === false) return "no";
  return "unknown";
}

export interface DomainModalSubmitPayload {
  items: {
    domain: string;
    manual_expiration_date: string | null;
    auto_renew: boolean | null;
  }[];
  alsoWatchSsl?: boolean;
  alsoWatchDns?: boolean;
  keepOpen?: boolean;
}

interface DomainAddModalProps {
  editingDomain: DomainInfo | null;
  existingDomains: DomainInfo[];
  domainInput: string;
  onDomainInputChange: (val: string) => void;
  manualExpirationInput: string;
  onManualExpirationChange: (val: string) => void;
  isTesting: boolean;
  testResult: DomainTestWhoisResult | null;
  onClearTestResult: () => void;
  onTest: (domain: string) => void;
  diagnostic: { notice: string; remaining: number };
  isSubmitting: boolean;
  onSubmitPayload: (payload: DomainModalSubmitPayload) => Promise<void> | void;
  onSelectExisting: (domain: DomainInfo) => void;
  onClose: () => void;
}

export default function DomainAddModal({
  editingDomain,
  existingDomains,
  domainInput,
  onDomainInputChange,
  manualExpirationInput,
  onManualExpirationChange,
  isTesting,
  testResult,
  onClearTestResult,
  onTest,
  diagnostic,
  isSubmitting,
  onSubmitPayload,
  onSelectExisting,
  onClose,
}: DomainAddModalProps) {
  const isEditing = Boolean(editingDomain);
  const {
    allChannels,
    destinations,
    isLoadingDestinations,
    targets,
    sslItems,
    dnsItems,
    quickCreateDestination,
    isCreatingDestination,
    toggleChannelEnabled,
    isTogglingChannel,
  } = useOrgContextForAddModal(true);

  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [autoRenewChoice, setAutoRenewChoice] = useState<AutoRenewChoice>(() =>
    boolOrNullToChoice(editingDomain?.auto_renew),
  );
  const [alsoWatchSsl, setAlsoWatchSsl] = useState(false);
  const [alsoWatchDns, setAlsoWatchDns] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [showManualDateInline, setShowManualDateInline] = useState(
    Boolean(manualExpirationInput),
  );

  // Open manual expiration date field automatically when RDAP/WHOIS finds no data
  useEffect(() => {
    if (testResult && (!testResult.success || !testResult.expiration_date)) {
      setShowManualDateInline(true);
    }
  }, [testResult]);

  const parsed = useMemo(() => parseHostAndPort(domainInput), [domainInput]);
  const cleanHost = parsed.host;
  const hostValid = isValidHost(cleanHost);
  const registrable = useMemo(
    () => (hostValid ? extractRegistrableDomain(cleanHost) : ""),
    [cleanHost, hostValid],
  );
  const hasSubdomainSuggestion = Boolean(
    hostValid && registrable && registrable !== cleanHost,
  );
  const targetDomain = registrable || cleanHost;

  const duplicateDomain = useMemo(() => {
    if (!cleanHost || batchMode) return null;
    return (
      existingDomains.find(
        (d) =>
          d.id !== editingDomain?.id &&
          (d.domain.toLowerCase() === cleanHost ||
            d.domain.toLowerCase() === targetDomain),
      ) || null
    );
  }, [existingDomains, cleanHost, targetDomain, editingDomain, batchMode]);

  // Existing coverage checks for "Vigilar también"
  const sslAlreadyWatched = Boolean(
    targetDomain &&
      sslItems.some((c) => c.domain === targetDomain && c.port === 443),
  );
  const dnsAlreadyWatched = Boolean(
    targetDomain &&
      dnsItems.some(
        (d) =>
          d.domain === targetDomain &&
          (d.record_type === "A" || d.record_type === "AAAA"),
      ),
  );

  // Live dependency summary for the typed domain
  const dependencyCounts = useMemo(() => {
    if (!targetDomain || !hostValid || batchMode) return null;

    const targetCount = targets.filter((t) => {
      const h = parseHostAndPort(t.endpoint || "").host;
      return matchesDomainTree(h, targetDomain);
    }).length;
    const dnsCount = dnsItems.filter((d) =>
      matchesDomainTree(d.domain, targetDomain),
    ).length;
    const sslCount = sslItems.filter((c) =>
      matchesDomainTree(c.domain, targetDomain),
    ).length;

    const total = targetCount + dnsCount + sslCount;
    if (total === 0) return null;
    return { total, targetCount, dnsCount, sslCount };
  }, [targetDomain, hostValid, batchMode, targets, dnsItems, sslItems]);

  const batchEntries = useMemo(
    () =>
      batchMode
        ? parseBatchHostLines(batchText, { normalizeApex: true })
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

  const canTest = !batchMode && hostValid;
  const canSubmit = batchMode
    ? validBatchEntries.length > 0 && invalidBatchEntries.length === 0
    : hostValid && !duplicateDomain;

  const disabledReason = batchMode
    ? invalidBatchEntries.length > 0
      ? "Corrige las líneas con error antes de guardar"
      : "Escribe al menos un dominio por línea"
    : !cleanHost
      ? "Escribe un dominio"
      : !hostValid
        ? "Dominio inválido"
        : duplicateDomain
          ? "Ya vigilas este dominio"
          : "Completa el campo requerido";

  const submitItems = (keepOpen = false) => {
    if (!canSubmit) return;
    const autoRenewValue = choiceToBoolOrNull(autoRenewChoice);

    if (batchMode) {
      void onSubmitPayload({
        items: validBatchEntries.map((e) => ({
          domain: e.host,
          manual_expiration_date: null,
          auto_renew: autoRenewValue,
        })),
        keepOpen: false,
      });
      return;
    }

    void onSubmitPayload({
      items: [
        {
          domain: targetDomain,
          manual_expiration_date: manualExpirationInput || null,
          auto_renew: autoRenewValue,
        },
      ],
      alsoWatchSsl: !isEditing && !sslAlreadyWatched && alsoWatchSsl,
      alsoWatchDns: !isEditing && !dnsAlreadyWatched && alsoWatchDns,
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
      ? `Agregar ${validBatchEntries.length || ""} ${validBatchEntries.length === 1 ? "dominio" : "dominios"}`.trim()
      : "Agregar dominio";

  const testResultSlot =
    testResult && !batchMode ? (
      <div
        className={`rounded-xl border px-3 py-2 text-xs animate-in fade-in duration-150 ${
          testResult.success
            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
            : "border-amber-500/40 bg-amber-500/10 text-amber-200"
        }`}
      >
        {testResult.success ? (
          <div className="flex items-center gap-1.5 font-mono text-[11px] flex-wrap">
            <Check size={13} className="text-emerald-400 shrink-0" />
            <span className="font-sans font-semibold text-emerald-300">
              {testResult.registrar || "Registro público"}
            </span>
            {testResult.expiration_date && (
              <span>
                · vence {formatDomainDate(testResult.expiration_date)}
              </span>
            )}
            {testResult.name_servers && testResult.name_servers.length > 0 && (
              <span>· {testResult.name_servers.length} NS</span>
            )}
            {testResult.is_locked === true && <span>· bloqueado</span>}
            {testResult.is_locked === false && (
              <span className="text-amber-300">· sin bloqueo</span>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={14}
              className="text-amber-400 shrink-0 mt-0.5"
            />
            <span>
              No pudimos leer el registro de este dominio. Indica la fecha de
              vencimiento a mano abajo.
            </span>
          </div>
        )}
      </div>
    ) : undefined;

  return (
    <ResourceAddModal
      title={isEditing ? "Editar dominio" : "Agregar dominio"}
      icon={<Globe2 size={17} className="text-accent-green shrink-0" />}
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
      submitCapability={isEditing ? "domain.update" : "domain.create"}
      disabledReason={disabledReason}
      testCapability={!batchMode ? "domain.test" : undefined}
      testLabel="Probar"
      testingLabel="Consultando..."
      testHint={
        !batchMode
          ? "Consultamos el registro del dominio. No se guarda nada."
          : undefined
      }
      testResultSlot={testResultSlot}
      canTest={canTest}
      isTesting={isTesting}
      onTest={!batchMode ? () => onTest(targetDomain) : undefined}
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
      focusKey={`${editingDomain?.id || "new"}-${batchMode ? "batch" : "single"}`}
      moreOptionsOpen={moreOptionsOpen}
      onToggleMoreOptions={() => setMoreOptionsOpen((p) => !p)}
      moreOptionsSummary={
        [
          manualExpirationInput ? "Fecha manual" : null,
          alsoWatchSsl || alsoWatchDns ? "Cobertura extra" : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined
      }
      moreOptionsContent={
        <div className="space-y-3">
          {!showManualDateInline && (
            <div className="space-y-1">
              <label
                htmlFor="domain-manual-date-extra"
                className="block text-[11px] font-medium text-text-muted"
              >
                Fecha de vencimiento manual
              </label>
              <input
                id="domain-manual-date-extra"
                type="date"
                value={manualExpirationInput}
                onChange={(e) => onManualExpirationChange(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-1.5 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
              />
              <p className="text-[10px] text-text-dim">
                Solo hace falta si el TLD no publica fecha en RDAP (ej. .gt).
              </p>
            </div>
          )}

          {!isEditing && !batchMode && (
            <div className="space-y-1.5">
              <span className="block text-[11px] font-medium text-text-muted">
                Vigilar también
              </span>
              {hostValid && targetDomain ? (
                <>
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
                          {targetDomain}
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
                          {targetDomain}
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
                </>
              ) : (
                <p className="text-[11px] text-text-dim">
                  Escribe un dominio para ver qué más puedes vigilar.
                </p>
              )}
            </div>
          )}
        </div>
      }
    >
      {/* Primary field or Batch paste */}
      {!batchMode ? (
        <div className="space-y-1.5">
          <label
            htmlFor="domain-name-input"
            className="block text-xs font-semibold text-text-muted"
          >
            Dominio <span className="text-rose-400">*</span>
          </label>
          <input
            id="domain-name-input"
            data-autofocus
            type="text"
            required
            placeholder="empresa.com o empresa.com.gt"
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
              Ingresa un dominio válido (ej. empresa.com o empresa.com.gt).
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="domain-batch-input"
              className="text-xs font-semibold text-text-muted"
            >
              Varios dominios
            </label>
            <span className="text-[11px] font-mono text-text-dim">
              Formato: un dominio por línea
            </span>
          </div>
          <textarea
            id="domain-batch-input"
            data-autofocus
            rows={5}
            placeholder={"gctorque.com\ngctechops.com\nempresa.com.gt"}
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

      {/* PSL registrable domain suggestion */}
      {hasSubdomainSuggestion && !batchMode && (
        <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-sky-200 text-[11px]">
            <Sparkles size={12} className="text-sky-400 shrink-0" />
            <span>
              ¿Vigilar el dominio registrable{" "}
              <strong className="font-mono text-text-main">{registrable}</strong>
              ?
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onDomainInputChange(registrable);
              onClearTestResult();
            }}
            className="px-2 py-0.5 rounded-md bg-bg-dark border border-sky-500/40 text-sky-200 hover:border-accent-green hover:text-accent-green text-[11px] font-semibold cursor-pointer !min-h-0"
          >
            Usar {registrable}
          </button>
        </div>
      )}

      {/* Duplicate warning */}
      {duplicateDomain && !batchMode && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-amber-200 font-medium">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <span>
              Ya vigilas{" "}
              <span className="font-mono">{duplicateDomain.domain}</span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectExisting(duplicateDomain);
            }}
            className="inline-flex items-center gap-1 text-accent-green hover:underline font-semibold cursor-pointer !min-h-0"
          >
            <span>Ver dominio</span>
            <ArrowUpRight size={12} />
          </button>
        </div>
      )}

      {/* Contextual manual expiration date (auto-opened when RDAP/WHOIS finds no data) */}
      {showManualDateInline && !batchMode && (
        <div className="rounded-xl border border-border-accent/70 bg-bg-dark/60 p-3 space-y-1.5">
          <label
            htmlFor="domain-manual-date-inline"
            className="flex items-center gap-1.5 text-xs font-semibold text-text-main"
          >
            <Calendar size={13} className="text-sky-400 shrink-0" />
            <span>Fecha de vencimiento manual</span>
          </label>
          <input
            id="domain-manual-date-inline"
            type="date"
            value={manualExpirationInput}
            onChange={(e) => onManualExpirationChange(e.target.value)}
            className="w-full bg-bg-card border border-border-base rounded-lg px-3 py-1.5 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
          />
          <p className="text-[11px] text-text-dim">
            Si el registro llega a publicar la fecha oficial por RDAP, se usará
            automáticamente.
          </p>
        </div>
      )}

      {/* 3-state Auto-renew selector (Sí / No / No lo sé — default "No lo sé") */}
      <div className="rounded-xl border border-border-base/80 bg-bg-dark/50 px-3 py-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-text-main font-medium">
            Renovación automática en el registrador
          </span>
          <div
            className="inline-flex rounded-lg border border-border-base bg-bg-card p-0.5 text-[11px]"
            role="radiogroup"
            aria-label="Renovación automática en el registrador"
          >
            {(
              [
                { id: "yes", label: "Sí" },
                { id: "no", label: "No" },
                { id: "unknown", label: "No lo sé" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={autoRenewChoice === opt.id}
                onClick={() => setAutoRenewChoice(opt.id)}
                className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer !min-h-0 ${
                  autoRenewChoice === opt.id
                    ? opt.id === "yes"
                      ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                      : opt.id === "no"
                        ? "bg-amber-500/20 text-amber-300 font-semibold"
                        : "bg-accent-green/15 text-accent-green font-semibold"
                    : "text-text-dim hover:text-text-main"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-text-dim">
          {autoRenewChoice === "yes"
            ? "Solo avisaremos con los umbrales configurados."
            : "Si está en No o No lo sé, adelantaremos el aviso cuando queden menos de 30 días."}
        </p>
      </div>

      {/* Live cross-module dependency preview */}
      {dependencyCounts && !batchMode && (
        <div className="rounded-xl border border-border-base/80 bg-bg-dark/50 px-3 py-2 flex items-center gap-2 text-[11px] text-text-muted">
          <Link2 size={13} className="text-accent-green shrink-0" />
          <span>
            Encontramos{" "}
            <strong className="text-text-main">
              {dependencyCounts.total}{" "}
              {dependencyCounts.total === 1 ? "elemento" : "elementos"}
            </strong>{" "}
            que dependen de este dominio (
            {[
              dependencyCounts.targetCount > 0
                ? `${dependencyCounts.targetCount} ${dependencyCounts.targetCount === 1 ? "target" : "targets"}`
                : null,
              dependencyCounts.dnsCount > 0
                ? `${dependencyCounts.dnsCount} DNS`
                : null,
              dependencyCounts.sslCount > 0
                ? `${dependencyCounts.sslCount} ${dependencyCounts.sslCount === 1 ? "certificado" : "certificados"}`
                : null,
            ]
              .filter(Boolean)
              .join(", ")}
            ).
          </span>
        </div>
      )}
    </ResourceAddModal>
  );
}
