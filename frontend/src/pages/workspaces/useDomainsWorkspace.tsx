import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnectivityDirectory } from "../../hooks/useConnectivityDirectory";
import { bulkOutcome } from "../../utils/bulkOutcome";
import { apiFailure } from "../../services/errors";
import { useConfigurationDiagnostic } from "../../hooks/useConfigurationDiagnostic";
import { useLinkedResource } from "../../hooks/useLinkedResource";
import { useAuthStore } from "../../store/authStore";
import { api } from "../../services/api";
import {
  emitScanFeedback,
  waitForFreshScan,
  type QueuedScan,
} from "../../utils/scanPolling";
import type { DomainModalSubmitPayload } from "../../components/domains/DomainAddModal";
import type {
  CreateDomainInfoData,
  DomainInfo,
  DomainLinkedTarget,
  DomainTestWhoisResult,
  UnwatchedDomainSuggestion,
} from "../../types/domain";
import { useConnectivityRefresh } from "../../hooks/useConnectivityRefresh";
import { usePersistentViewMode } from "../../hooks/usePersistentViewMode";
import {
  DOMAIN_STATE_META,
  getDomainHealthState,
  getEffectiveDaysRemaining,
} from "../../components/domains/useDomains";

/** Data, mutations and transient workflow state; rendering stays in DomainsPage. */
export function useDomainsWorkspace() {
  const organizationId = useAuthStore((state) => state.user?.organization?.id);
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = usePersistentViewMode("domains", "table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [savingManualDateId, setSavingManualDateId] = useState<string | null>(
    null,
  );
  const [savingAutoRenewId, setSavingAutoRenewId] = useState<string | null>(
    null,
  );
  const [linkingDomainId, setLinkingDomainId] = useState<string | null>(null);
  const [watchingSuggestion, setWatchingSuggestion] = useState<string | null>(
    null,
  );

  // Modals & Drawer State
  const [showModal, setShowModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainInfo | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainInfo | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [manualExpirationInput, setManualExpirationInput] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DomainInfo | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkScanning, setBulkScanning] = useState(false);

  // Live Test WHOIS State
  const diagnostic = useConfigurationDiagnostic();
  const [isTestingWhois, setIsTestingWhois] = useState(false);
  const [testResult, setTestResult] = useState<DomainTestWhoisResult | null>(
    null,
  );

  const autoRefresh = useConnectivityRefresh();

  const directory = useConnectivityDirectory<DomainInfo>(
    "domains/",
    "domains",
    { search: searchTerm },
    autoRefresh.refetchInterval,
  );
  const { data: domains, isLoading, isError, refetch } = directory;
  const selectionScope = JSON.stringify(directory.params);
  useEffect(() => setSelectedIds([]), [selectionScope]);

  // Keep selectedDomain synced with fresh query results
  useEffect(() => {
    if (!selectedDomain || !domains) return;
    const fresh = domains.find((d) => d.id === selectedDomain.id);
    if (fresh && fresh !== selectedDomain) {
      setSelectedDomain(fresh);
    }
  }, [domains, selectedDomain]);

  // Cross-module unwatched root domains discovery (e.g., gctechops.com used in DNS/SSL/Uptime)
  const { data: unwatchedSuggestions } = useQuery<UnwatchedDomainSuggestion[]>({
    queryKey: ["domain-suggestions", organizationId],
    queryFn: async () => {
      const response = await api.get("domains/suggestions/");
      return (response.data?.data || []) as UnwatchedDomainSuggestion[];
    },
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });

  const invalidateDomains = () => {
    void queryClient.invalidateQueries({
      queryKey: ["domains", organizationId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["domain-stats", organizationId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["domain-suggestions", organizationId],
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: CreateDomainInfoData) => {
      const res = await api.post("domains/", data);
      return res.data?.data as DomainInfo | undefined;
    },
    onSuccess: (created) => {
      invalidateDomains();
      handleCloseModal();
      if (created) {
        directory.setMessage(
          `Dominio ${created.domain} agregado. Comprobando registro...`,
        );
      }
    },
  });

  const watchSuggestionMutation = useMutation({
    mutationFn: async (domainName: string) => {
      setWatchingSuggestion(domainName);
      const res = await api.post("domains/", { domain: domainName });
      return res.data?.data as DomainInfo | undefined;
    },
    onSuccess: (created) => {
      invalidateDomains();
      setWatchingSuggestion(null);
      if (created) {
        directory.setMessage(
          `Ahora vigilamos el vencimiento de ${created.domain}.`,
        );
      }
    },
    onError: () => {
      setWatchingSuggestion(null);
      directory.setMessage("No se pudo agregar el dominio sugerido.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      domain,
      manual_expiration_date,
    }: {
      id: string;
      domain?: string;
      manual_expiration_date?: string | null;
    }) => {
      const res = await api.patch(`domains/${id}/`, {
        ...(domain ? { domain } : {}),
        manual_expiration_date: manual_expiration_date || null,
      });
      return res.data?.data as DomainInfo | undefined;
    },
    onSuccess: (updated) => {
      invalidateDomains();
      if (selectedDomain && updated && selectedDomain.id === updated.id) {
        setSelectedDomain(updated);
      }
      handleCloseModal();
    },
  });

  const saveManualDateMutation = useMutation({
    mutationFn: async ({
      domain,
      dateStr,
    }: {
      domain: DomainInfo;
      dateStr: string | null;
    }) => {
      setSavingManualDateId(domain.id);
      const res = await api.patch(`domains/${domain.id}/`, {
        manual_expiration_date: dateStr,
      });
      return res.data?.data as DomainInfo | undefined;
    },
    onSuccess: (updated) => {
      invalidateDomains();
      if (selectedDomain && updated && selectedDomain.id === updated.id) {
        setSelectedDomain(updated);
      }
      directory.setMessage("Fecha manual de vencimiento guardada.");
      setSavingManualDateId(null);
    },
    onError: () => {
      directory.setMessage("No se pudo guardar la fecha manual.");
      setSavingManualDateId(null);
    },
  });

  const saveAutoRenewMutation = useMutation({
    mutationFn: async ({
      domain,
      autoRenew,
    }: {
      domain: DomainInfo;
      autoRenew: boolean | null;
    }) => {
      setSavingAutoRenewId(domain.id);
      const res = await api.patch(`domains/${domain.id}/`, {
        auto_renew: autoRenew,
      });
      return res.data?.data as DomainInfo | undefined;
    },
    onSuccess: (updated) => {
      invalidateDomains();
      if (selectedDomain && updated && selectedDomain.id === updated.id) {
        setSelectedDomain(updated);
      }
      if (updated) {
        const label =
          updated.auto_renew === true
            ? "activa"
            : updated.auto_renew === false
              ? "desactivada"
              : "sin confirmar";
        directory.setMessage(
          `Renovación automática de ${updated.domain}: ${label}.`,
        );
      }
      setSavingAutoRenewId(null);
    },
    onError: () => {
      directory.setMessage(
        "No se pudo actualizar el estado de renovación automática.",
      );
      setSavingAutoRenewId(null);
    },
  });

  const acknowledgeChangesMutation = useMutation({
    mutationFn: async (domain: DomainInfo) => {
      setAcknowledgingId(domain.id);
      const res = await api.post(`domains/${domain.id}/acknowledge-changes/`);
      return res.data?.data as DomainInfo | undefined;
    },
    onSuccess: (updated) => {
      invalidateDomains();
      if (selectedDomain && updated && selectedDomain.id === updated.id) {
        setSelectedDomain(updated);
      }
      directory.setMessage(
        updated
          ? `Cambios confirmados para ${updated.domain}.`
          : "Cambios confirmados.",
      );
      setAcknowledgingId(null);
    },
    onError: () => {
      directory.setMessage("No se pudieron confirmar los cambios.");
      setAcknowledgingId(null);
    },
  });

  const linkTargetMutation = useMutation({
    mutationFn: async ({
      domain,
      target,
    }: {
      domain: DomainInfo;
      target: DomainLinkedTarget;
    }) => {
      setLinkingDomainId(domain.id);
      await api.patch(`/monitoring/${target.id}/coverage/`, {
        domain: [domain.id],
      });
      return { domain, target };
    },
    onSuccess: ({ domain, target }) => {
      invalidateDomains();
      void queryClient.invalidateQueries({
        queryKey: ["monitoring-targets", organizationId],
      });
      directory.setMessage(
        `${domain.domain} vinculado al target ${target.name} en Uptime.`,
      );
      setLinkingDomainId(null);
    },
    onError: () => {
      directory.setMessage("No se pudo vincular el dominio con el target.");
      setLinkingDomainId(null);
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const current = domains?.find((d) => d.id === id);
      const response = await api.post(`domains/${id}/scan/`);
      const queued = response.data?.data as QueuedScan;
      return waitForFreshScan<DomainInfo>(
        queued,
        async () => (await api.get(`domains/${id}/`)).data?.data as DomainInfo,
        (domain) => domain.last_scanned_at,
        {
          label: current?.domain,
          formatResult: (dom) => {
            const st = getDomainHealthState(dom);
            const days = getEffectiveDaysRemaining(dom);
            const label = DOMAIN_STATE_META[st].label.toLowerCase();
            const daysPart =
              days !== null ? (days <= 0 ? "vencido" : `en ${days} d`) : null;
            return {
              message: [dom.domain, label, daysPart]
                .filter(Boolean)
                .join(" · "),
              tone:
                st === "valid"
                  ? "success"
                  : st === "expiring" || st === "changed"
                    ? "warning"
                    : st === "no_data" || st === "pending"
                      ? "info"
                      : "danger",
            };
          },
          onView: (dom) => setSelectedDomain(dom),
        },
      );
    },
    onSuccess: (updatedDomain) => {
      invalidateDomains();
      if (
        selectedDomain &&
        updatedDomain &&
        selectedDomain.id === updatedDomain.id
      ) {
        setSelectedDomain(updatedDomain);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`domains/${id}/`);
    },
    onSuccess: () => {
      invalidateDomains();
      if (selectedDomain?.id === deleteTarget?.id) {
        setSelectedDomain(null);
      }
      setDeleteTarget(null);
    },
  });

  // Selection & Bulk Actions
  const handleToggleSelect = (domain: DomainInfo) => {
    setSelectedIds((prev) =>
      prev.includes(domain.id)
        ? prev.filter((id) => id !== domain.id)
        : [...prev, domain.id],
    );
  };

  const handleBulkScan = async () => {
    if (selectedIds.length === 0) return;
    setBulkScanning(true);
    try {
      const response = await api.post("domains/bulk-action/", {
        action: "scan",
        domain_ids: selectedIds,
      });
      const outcome = bulkOutcome(response.data.data, selectedIds);
      setSelectedIds([]);
      directory.setMessage(outcome.message);
    } catch {
      directory.setMessage(
        "No se pudo iniciar la comprobación masiva. Intenta nuevamente.",
      );
    } finally {
      setBulkScanning(false);
      invalidateDomains();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !(await directory.confirmDelete(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} dominios seleccionados?`,
      ))
    )
      return;
    setBulkDeleting(true);
    try {
      const response = await api.post("domains/bulk-action/", {
        action: "delete",
        domain_ids: selectedIds,
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
    invalidateDomains();
  };

  // Live Test RDAP/WHOIS Query in Modal
  const handleTestWhois = async (overrideDomain?: string) => {
    const rawDomain = (overrideDomain ?? domainInput).trim();
    if (!rawDomain) return;
    setIsTestingWhois(true);
    setTestResult(null);

    let cleanDomain = rawDomain.toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (cleanDomain.includes(":")) {
      cleanDomain = cleanDomain.split(":")[0];
    }

    try {
      const response = await diagnostic.run("domains/test-whois/", {
        domain: cleanDomain,
      });
      setTestResult(response.data?.data as DomainTestWhoisResult);
    } catch (caughtError: unknown) {
      const err = apiFailure(caughtError);
      if (diagnostic.isLimit(err)) return;
      setTestResult({
        success: false,
        domain: cleanDomain,
        error_message:
          err.response?.data?.message ||
          "No se pudieron obtener datos RDAP/WHOIS. Puedes definir una fecha manual.",
      });
    } finally {
      setIsTestingWhois(false);
    }
  };

  const handleExportCSV = () => void directory.exportCSV();

  // Modal Handlers
  const handleOpenCreate = () => {
    setEditingDomain(null);
    setDomainInput("");
    setManualExpirationInput("");
    setTestResult(null);
    setShowModal(true);
  };

  const handleOpenEdit = (domain: DomainInfo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDomain(domain);
    setDomainInput(domain.domain);
    setManualExpirationInput(domain.manual_expiration_date || "");
    setTestResult(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDomain(null);
    setDomainInput("");
    setManualExpirationInput("");
    setTestResult(null);
  };

  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  const handleSubmitDomainModal = async (payload: DomainModalSubmitPayload) => {
    if (payload.items.length === 0) return;
    setIsSubmittingModal(true);
    try {
      if (editingDomain) {
        const first = payload.items[0];
        const res = await api.patch(`domains/${editingDomain.id}/`, {
          domain: first.domain,
          manual_expiration_date: first.manual_expiration_date,
          ...(first.auto_renew !== null ? { auto_renew: first.auto_renew } : {}),
        });
        const updated = res.data?.data as DomainInfo | undefined;
        invalidateDomains();
        if (selectedDomain && updated && selectedDomain.id === updated.id) {
          setSelectedDomain(updated);
        }
        handleCloseModal();
        emitScanFeedback({
          message: `Dominio actualizado · ${first.domain}`,
          tone: "success",
          actionLabel: updated ? "Ver" : undefined,
          onAction: updated ? () => setSelectedDomain(updated) : undefined,
        });
        return;
      }

      const createdList: DomainInfo[] = [];
      for (const item of payload.items) {
        const res = await api.post("domains/", {
          domain: item.domain,
          manual_expiration_date: item.manual_expiration_date,
          auto_renew: item.auto_renew,
        });
        const created = res.data?.data as DomainInfo | undefined;
        if (created) createdList.push(created);
      }

      const first = createdList[0];
      if (first && payload.alsoWatchSsl) {
        try {
          await api.post("ssl-certificates/", {
            domain: first.domain,
            port: 443,
          });
          void queryClient.invalidateQueries({
            queryKey: ["ssl-certificates", organizationId],
          });
        } catch {
          // Non-fatal companion creation
        }
      }
      if (first && payload.alsoWatchDns) {
        try {
          await api.post("dns-records/", {
            domain: first.domain,
            record_type: "A",
          });
          void queryClient.invalidateQueries({
            queryKey: ["dns-records", organizationId],
          });
        } catch {
          // Non-fatal companion creation
        }
      }

      invalidateDomains();
      if (payload.keepOpen) {
        setDomainInput("");
        setManualExpirationInput("");
        setTestResult(null);
      } else {
        handleCloseModal();
      }

      if (createdList.length === 1 && first) {
        emitScanFeedback({
          message: `Dominio agregado · ${first.domain}`,
          tone: "success",
          actionLabel: "Ver",
          onAction: () => setSelectedDomain(first),
        });
      } else if (createdList.length > 1) {
        emitScanFeedback({
          message: `${createdList.length} dominios agregados`,
          tone: "success",
          actionLabel: first ? "Ver" : undefined,
          onAction: first ? () => setSelectedDomain(first) : undefined,
        });
      }
    } catch (caughtError: unknown) {
      const err = apiFailure(caughtError);
      emitScanFeedback({
        message:
          err.response?.data?.message || "No se pudo guardar el dominio.",
        tone: "danger",
      });
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;
    void handleSubmitDomainModal({
      items: [
        {
          domain: domainInput.trim(),
          manual_expiration_date: manualExpirationInput || null,
          auto_renew: null,
        },
      ],
    });
  };

  useLinkedResource(domains, selectedDomain, setSelectedDomain);

  return {
    directory,
    isError,
    refetch,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    selectedIds,
    setSelectedIds,
    scanningId,
    acknowledgingId,
    savingManualDateId,
    savingAutoRenewId,
    linkingDomainId,
    watchingSuggestion,
    showModal,
    editingDomain,
    selectedDomain,
    setSelectedDomain,
    domainInput,
    setDomainInput,
    manualExpirationInput,
    setManualExpirationInput,
    deleteTarget,
    setDeleteTarget,
    bulkDeleting,
    bulkScanning,
    diagnostic,
    isTestingWhois,
    testResult,
    setTestResult,
    autoRefresh,
    domains,
    unwatchedSuggestions: unwatchedSuggestions || [],
    isLoading,
    createMutation,
    watchSuggestionMutation,
    updateMutation,
    saveManualDateMutation,
    saveAutoRenewMutation,
    acknowledgeChangesMutation,
    linkTargetMutation,
    scanMutation,
    deleteMutation,
    handleToggleSelect,
    handleBulkScan,
    handleBulkDelete,
    handleTestWhois,
    handleExportCSV,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitModal,
    handleSubmitDomainModal,
    isSubmittingModal,
  };
}
