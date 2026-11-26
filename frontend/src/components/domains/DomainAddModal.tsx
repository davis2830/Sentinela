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
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
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
  const organizationId = useAuthStore((state) => state.user?.organization?.id);
  const { destinations, isLoadingDestinations, targets } =
    useOrgContextForAddModal(true);

  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [autoRenewEnabled, setAutoRenewEnabled] = useState<boolean>(
    editingDomain?.auto_renew === true,
  );
  const [alsoWatchSsl, setAlsoWatchSsl] = useState(false);
  const [alsoWatchDns, setAlsoWatchDns] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [showManualDateInline, setShowManualDateInline] = useState(
    Boolean(manualExpirationInput),
  );

  // Lightweight cached DNS & SSL lists for live dependency counter
  const dnsQuery = useQuery<string[]>({
    queryKey: ["modal-dns-domains", organizationId],
    queryFn: async () => {
      try {
        const res = await api.get("dns-records/?page_size=200");
        const raw =
          res.data?.data?.results ?? res.data?.data ?? res.data?.results ?? [];
        return Array.isArray(raw)
          ? raw.map((r: { domain?: string }) => String(r.domain || ""))
          : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });

  const sslQuery = useQuery<string[]>({
    queryKey: ["modal-ssl-domains", organizationId],
    queryFn: async () => {
      try {
        const res = await api.get("ssl-certificates/?page_size=200");
        const raw =
          res.data?.data?.results ?? res.data?.data ?? res.data?.results ?? [];
        return Array.isArray(raw)
          ? raw.map((c: { domain?: string }) => String(c.domain || ""))
          : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });

  // Automatically reveal manual expiration field when RDAP/WHOIS fails or returns no expiration date
  useEffect(() => {
    if (
      testResult &&
      (!testResult.success || !testResult.expiration_date)
    ) {
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

  const duplicateDomain = useMemo(() => {
    if (!cleanHost || batchMode) return null;
    const candidate = registrable || cleanHost;
    return (
      existingDomains.find(
        (d) =>
          d.id !== editingDomain?.id &&
          (d.domain.toLowerCase() === cleanHost ||
            d.domain.toLowerCase() === candidate),
      ) || null
    );
  }, [existingDomains, cleanHost, registrable, editingDomain, batchMode]);

  // Live dependency summary for the typed domain
  const dependencyCounts = useMemo(() => {
    const apex = registrable || cleanHost;
    if (!apex || !hostValid || batchMode) return null;

    const targetCount = targets.filter((t) => {
      const h = parseHostAndPort(t.endpoint || "").host;
      return matchesDomainTree(h, apex);
    }).length;
    const dnsCount = (dnsQuery.data || []).filter((d) =>
      matchesDomainTree(d, apex),
    ).length;
    const sslCount = (sslQuery.data || []).filter((d) =>
      matchesDomainTree(d, apex),
    ).length;

    const total = targetCount + dnsCount + sslCount;
    if (total === 0) return null;
    return { total, targetCount, dnsCount, sslCount, apex };
  }, [registrable, cleanHost, hostValid, batchMode, targets, dnsQuery.data, sslQuery.data]);

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

  const submitItems = (keepOpen = false) => {
    if (!canSubmit) return;
    if (batchMode) {
      void onSubmitPayload({
        items: validBatchEntries.map((e) => ({
          domain: e.host,
          manual_expiration_date: null,
          auto_renew: autoRenewEnabled ? true : null,
        })),
        keepOpen: false,
      });
      return;
    }

    const domainToSave = registrable || cleanHost;
    void onSubmitPayload({
      items: [
        {
          domain: domainToSave,
          manual_expiration_date: manualExpirationInput || null,
          auto_renew: autoRenewEnabled
            ? true
            : editingDomain?.auto_renew === true
              ? false
              : null,
        },
      ],
      alsoWatchSsl: !isEditing && alsoWatchSsl,
      alsoWatchDns: !isEditing && alsoWatchDns,
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

  return (
    <ResourceAddModal
      title={isEditing ? "Editar dominio" : "Agregar dominio"}
      icon={<Globe2 size={17} className="text-accent-green shrink-0" />}
      submitLabel={submitLabel}
      submitCapability={isEditing ? "domain.update" : "domain.create"}
      testCapability={!batchMode ? "domain.test" : undefined}
      testLabel="Probar"
      testingLabel="Consultando..."
      testHint={
        !batchMode
          ? "Consultamos el registro del dominio. No se guarda nada."
          : undefined
      }
      canTest={canTest}
      isTesting={isTesting}
      onTest={!batchMode ? () => onTest(registrable || cleanHost) : undefined}
      diagnostic={diagnostic}
      canSubmit={canSubmit}
      isSubmitting={isSubmitting}
      showAddAnother={!isEditing && !batchMode}
      onAddAnother={() => submitItems(true)}
      onSubmit={handleFormSubmit}
      onClose={onClose}
      destinations={destinations}
      isLoadingDestinations={isLoadingDestinations}
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
            <div className="space-y-1.5">
              <label
                htmlFor="domain-manual-date-extra"
                className="block text-[11px] font-medium text-text-muted"
              >
                Fecha de vencimiento manual (para TLD sin RDAP)
              </label>
              <input
                id="domain-manual-date-extra"
                type="date"
                value={manualExpirationInput}
                onChange={(e) => onManualExpirationChange(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-1.5 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
              />
            </div>
          )}

          {!isEditing && !batchMode && (
            <div className="space-y-1.5">
              <span className="block text-[11px] font-medium text-text-muted">
                Vigilar también
              </span>
              <label className="flex items-center gap-2 text-xs text-text-main cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoWatchSsl}
                  onChange={(e) => setAlsoWatchSsl(e.target.checked)}
                  className="rounded border-border-accent bg-bg-dark text-accent-green focus:ring-accent-green/40"
                />
                <span>
                  Certificado SSL (:443) de{" "}
                  <span className="font-mono text-text-muted">
                    {registrable || cleanHost || "este dominio"}
                  </span>
                </span>
              </label>
              <label className="flex items-center gap-2 text-xs text-text-main cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoWatchDns}
                  onChange={(e) => setAlsoWatchDns(e.target.checked)}
                  className="rounded border-border-accent bg-bg-dark text-accent-green focus:ring-accent-green/40"
                />
                <span>
                  Registro DNS (A) de{" "}
                  <span className="font-mono text-text-muted">
                    {registrable || cleanHost || "este dominio"}
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>
      }
    >
      {/* Primary field or Batch paste */}
      {!batchMode ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="domain-name-input"
              className="text-xs font-semibold text-text-muted"
            >
              Dominio <span className="text-rose-400">*</span>
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
            id="domain-name-input"
            data-autofocus
            type="text"
            required
            placeholder="empresa.com o empresa.com.gt"
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
              Ingresa un dominio válido (ej. empresa.com o empresa.com.gt).
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="domain-batch-input"
              className="text-xs font-semibold text-text-muted"
            >
              Lista de dominios (uno por línea)
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
            id="domain-batch-input"
            data-autofocus
            rows={5}
            placeholder={"gctorque.com\ngctechops.com\nempresa.com.gt"}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            className="w-full bg-bg-dark border border-border-base rounded-xl p-3 text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
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
              El dominio registrable es{" "}
              <strong className="font-mono text-text-main">{registrable}</strong>
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

      {/* 1-line inline test result */}
      {testResult && !batchMode && (
        <div
          className={`rounded-xl border px-3 py-2.5 text-xs animate-in fade-in duration-150 ${
            testResult.success
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200"
          }`}
        >
          {testResult.success ? (
            <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap">
              <Check size={14} className="text-emerald-400 shrink-0" />
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
      )}

      {/* Contextual manual expiration date (only shown inline when needed) */}
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

      {/* Auto-renew switch (RDAP doesn't expose this, prevents accidental expiration) */}
      <label className="rounded-xl border border-border-base/80 bg-bg-dark/50 px-3 py-2 flex items-center justify-between gap-3 cursor-pointer">
        <span className="text-xs text-text-main">
          Renovación automática activada en el registrador
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={autoRenewEnabled}
          onClick={() => setAutoRenewEnabled((p) => !p)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer !min-h-0 !min-w-0 ${
            autoRenewEnabled ? "bg-accent-green" : "bg-border-accent/80"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform ${
              autoRenewEnabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </label>

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
