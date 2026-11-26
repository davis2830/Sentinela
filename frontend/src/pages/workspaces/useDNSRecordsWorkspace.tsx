import { useConnectivityDirectory } from "../../hooks/useConnectivityDirectory";
import { bulkOutcome } from "../../utils/bulkOutcome";
import { apiFailure } from "../../services/errors";
import { useConfigurationDiagnostic } from "../../hooks/useConfigurationDiagnostic";
import { useLinkedResource } from "../../hooks/useLinkedResource";
import { useUrlFilter } from "../../hooks/useUrlFilter";
import { useAuthStore } from "../../store/authStore";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import {
  emitScanFeedback,
  waitForFreshScan,
  type QueuedScan,
} from "../../utils/scanPolling";
import type { DNSModalSubmitPayload } from "../../components/dns/DNSAddModal";
import { extractRegistrableDomain } from "../../utils/hostInput";
import type {
  DNSRecord,
  DNSRecordType,
  DNSReferenceMode,
  DNSLinkedTarget,
  CreateDNSRecordData,
  DNSChangeHistory,
  DNSTestResolutionResult,
} from "../../types/dns";
import {
  getDNSHealthState,
  getDNSStateLabel,
} from "../../components/dns/useDNSRecords";
import { useConnectivityRefresh } from "../../hooks/useConnectivityRefresh";
import { usePersistentViewMode } from "../../hooks/usePersistentViewMode";

/** Data, mutations and transient workflow state; rendering stays in the page. */
export function useDNSRecordsWorkspace() {
  const organizationId = useAuthStore((state) => state.user?.organization?.id);
  const queryClient = useQueryClient();

  // State
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DNSRecord | null>(null);
  const [expectedInput, setExpectedInput] = useState("");
  const [referenceModeInput, setReferenceModeInput] =
    useState<DNSReferenceMode>("exact");
  const [domainInput, setDomainInput] = useState("");
  const [recordTypeInput, setRecordTypeInput] = useState<DNSRecordType>("A");
  const [typeFilter, setTypeFilter] = useUrlFilter("type", [
    "all",
    "A",
    "AAAA",
    "CNAME",
    "MX",
    "TXT",
    "NS",
    "SOA",
    "SRV",
    "CAA",
    "PTR",
  ] as const);
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  useEffect(() => {
    const paramSearch = searchParams.get("search");
    if (paramSearch !== null && paramSearch !== searchTerm) {
      setSearchTerm(paramSearch);
    }
    // Only react when URL query changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [viewMode, setViewMode] = usePersistentViewMode("dns_records", "table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [acceptingRefId, setAcceptingRefId] = useState<string | null>(null);
  const [linkingRecordId, setLinkingRecordId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DNSRecord | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DNSRecord | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkScanning, setBulkScanning] = useState(false);

  // Live Test Resolution State
  const diagnostic = useConfigurationDiagnostic();
  const [isTestingResolution, setIsTestingResolution] = useState(false);
  const [testResult, setTestResult] = useState<DNSTestResolutionResult | null>(
    null,
  );

  const autoRefresh = useConnectivityRefresh();

  // Main DNS records query
  const directory = useConnectivityDirectory<DNSRecord>(
    "dns-records/",
    "dns-records",
    { search: searchTerm, type: typeFilter },
    autoRefresh.refetchInterval,
  );
  const { data: records, isLoading, isError, refetch } = directory;
  const selectionScope = JSON.stringify(directory.params);
  useEffect(() => setSelectedIds([]), [selectionScope]);

  // Keep selectedRecord in sync with fresh query data
  useEffect(() => {
    if (!selectedRecord || !records) return;
    const fresh = records.find((r) => r.id === selectedRecord.id);
    if (fresh && fresh !== selectedRecord) {
      setSelectedRecord(fresh);
    }
  }, [records, selectedRecord]);

  // Selected record change history query
  const { data: history, isLoading: isLoadingHistory } = useQuery<
    DNSChangeHistory[]
  >({
    queryKey: ["dns-history", organizationId, selectedRecord?.id],
    queryFn: async () => {
      if (!selectedRecord) return [];
      const response = await api.get(
        `dns-records/${selectedRecord.id}/history/`,
      );
      return (response.data?.data || []) as DNSChangeHistory[];
    },
    enabled: !!selectedRecord,
  });

  const invalidateDNS = () => {
    queryClient.invalidateQueries({
      queryKey: ["dns-records", organizationId],
    });
    queryClient.invalidateQueries({
      queryKey: ["dns-stats", organizationId],
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: CreateDNSRecordData) => {
      await api.post("dns-records/", data);
    },
    onSuccess: () => {
      invalidateDNS();
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CreateDNSRecordData;
    }) => {
      const response = await api.patch(`dns-records/${id}/`, data);
      return response.data?.data as DNSRecord | undefined;
    },
    onSuccess: (updatedRecord) => {
      invalidateDNS();
      if (
        selectedRecord &&
        updatedRecord &&
        selectedRecord.id === updatedRecord.id
      ) {
        setSelectedRecord(updatedRecord);
      }
      handleCloseModal();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const current = records?.find((r) => r.id === id);
      const response = await api.post(`dns-records/${id}/scan/`);
      const queued = response.data?.data as QueuedScan;
      return waitForFreshScan<DNSRecord>(
        queued,
        async () =>
          (await api.get(`dns-records/${id}/`)).data?.data as DNSRecord,
        (record) => record.last_scanned_at,
        {
          label: current?.domain,
          formatResult: (rec) => {
            const st = getDNSHealthState(rec);
            const lat =
              rec.response_time_ms != null
                ? `${Math.round(rec.response_time_ms)} ms`
                : null;
            const stateTxt = getDNSStateLabel(rec, st).toLowerCase();
            return {
              message: [rec.domain, lat, stateTxt].filter(Boolean).join(" · "),
              tone:
                st === "resolved"
                  ? "success"
                  : st === "rotating"
                    ? "info"
                    : st === "propagating"
                      ? "warning"
                      : "danger",
            };
          },
          onView: (rec) => setSelectedRecord(rec),
        },
      );
    },
    onSuccess: (updatedRecord) => {
      invalidateDNS();
      queryClient.invalidateQueries({
        queryKey: ["dns-history", organizationId, selectedRecord?.id],
      });
      if (
        selectedRecord &&
        updatedRecord &&
        selectedRecord.id === updatedRecord.id
      ) {
        setSelectedRecord(updatedRecord);
      }
      setScanningId(null);
    },
    onError: () => {
      setScanningId(null);
    },
  });

  const acceptReferenceMutation = useMutation({
    mutationFn: async ({
      record,
      mode,
    }: {
      record: DNSRecord;
      mode?: DNSReferenceMode;
    }) => {
      setAcceptingRefId(record.id);
      const response = await api.post(
        `dns-records/${record.id}/accept-reference/`,
        mode ? { reference_mode: mode } : {},
      );
      return response.data?.data as DNSRecord | undefined;
    },
    onSuccess: (updatedRecord) => {
      invalidateDNS();
      if (
        selectedRecord &&
        updatedRecord &&
        selectedRecord.id === updatedRecord.id
      ) {
        setSelectedRecord(updatedRecord);
      }
      directory.setMessage(
        updatedRecord
          ? `Referencia actualizada para ${updatedRecord.record_type} ${updatedRecord.domain}${
              updatedRecord.reference_mode === "cidr" ? " (rango /24)" : ""
            }.`
          : "Referencia actualizada.",
      );
      setAcceptingRefId(null);
    },
    onError: () => {
      directory.setMessage(
        "No se pudo guardar el valor actual como referencia.",
      );
      setAcceptingRefId(null);
    },
  });

  const linkTargetMutation = useMutation({
    mutationFn: async ({
      record,
      target,
    }: {
      record: DNSRecord;
      target: DNSLinkedTarget;
    }) => {
      setLinkingRecordId(record.id);
      // Preserve any existing DNS links on that target before adding this record
      let existingIds: string[] = [];
      try {
        const covRes = await api.get(`/monitoring/${target.id}/coverage/`);
        const covData = covRes.data?.data;
        if (Array.isArray(covData?.dns)) {
          existingIds = covData.dns
            .map((item: { id?: string } | string) =>
              typeof item === "string" ? item : item?.id,
            )
            .filter(Boolean) as string[];
        }
      } catch {
        existingIds = [];
      }
      const nextDnsIds = Array.from(new Set([...existingIds, record.id]));
      await api.patch(`/monitoring/${target.id}/coverage/`, {
        dns: nextDnsIds,
      });
      return { record, target };
    },
    onSuccess: ({ record, target }) => {
      invalidateDNS();
      queryClient.invalidateQueries({
        queryKey: ["monitoring-targets", organizationId],
      });
      directory.setMessage(
        `${record.record_type} ${record.domain} vinculado al target ${target.name} en Uptime.`,
      );
      setLinkingRecordId(null);
    },
    onError: () => {
      directory.setMessage(
        "No se pudo vincular el registro DNS con el target.",
      );
      setLinkingRecordId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`dns-records/${id}/`);
    },
    onSuccess: () => {
      invalidateDNS();
      if (selectedRecord?.id === deleteTarget?.id) {
        setSelectedRecord(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Actions
  const handleToggleSelect = (record: DNSRecord) => {
    setSelectedIds((prev) =>
      prev.includes(record.id)
        ? prev.filter((id) => id !== record.id)
        : [...prev, record.id],
    );
  };

  const handleBulkScan = async () => {
    if (selectedIds.length === 0) return;
    setBulkScanning(true);
    try {
      const response = await api.post("dns-records/bulk-action/", {
        action: "scan",
        record_ids: selectedIds,
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
      invalidateDNS();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !(await directory.confirmDelete(
        `¿Deseas eliminar permanentemente los ${selectedIds.length} registros DNS seleccionados?`,
      ))
    )
      return;
    setBulkDeleting(true);
    try {
      const response = await api.post("dns-records/bulk-action/", {
        action: "delete",
        record_ids: selectedIds,
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
    invalidateDNS();
  };

  // Test DNS Resolution in Modal
  const handleTestResolution = async (
    overrideDomain?: string,
    overrideType?: DNSRecordType,
  ) => {
    const rawDomain = (overrideDomain ?? domainInput).trim();
    if (!rawDomain) return;
    const effectiveType = overrideType ?? recordTypeInput;
    setIsTestingResolution(true);
    setTestResult(null);

    let cleanDomain = rawDomain
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "");
    if (cleanDomain.includes(":")) {
      cleanDomain = cleanDomain.split(":")[0];
    }

    try {
      const response = await diagnostic.run("dns-records/test-resolution/", {
        domain: cleanDomain,
        record_type: effectiveType,
        expected_values: expectedInput
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
      });
      setTestResult(response.data?.data as DNSTestResolutionResult);
    } catch (caughtError: unknown) {
      const err = apiFailure(caughtError);
      if (diagnostic.isLimit(err)) return;
      setTestResult({
        success: false,
        domain: cleanDomain,
        record_type: effectiveType,
        values: [],
        error_message:
          err.response?.data?.message || "Error al resolver la consulta DNS.",
      });
    } finally {
      setIsTestingResolution(false);
    }
  };

  const handleExportCSV = () => void directory.exportCSV();

  // Modal Handlers
  const handleOpenCreate = () => {
    setEditingRecord(null);
    setExpectedInput("");
    setReferenceModeInput("exact");
    setDomainInput("");
    setRecordTypeInput("A");
    setTestResult(null);
    setShowModal(true);
  };

  const handleOpenEdit = (record: DNSRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRecord(record);
    setDomainInput(record.domain);
    setExpectedInput((record.expected_values || []).join("\n"));
    setReferenceModeInput(record.reference_mode || "exact");
    setRecordTypeInput(record.record_type);
    setTestResult(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRecord(null);
    setExpectedInput("");
    setReferenceModeInput("exact");
    setDomainInput("");
    setRecordTypeInput("A");
    setTestResult(null);
  };

  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  const handleSubmitDNSModal = async (payload: DNSModalSubmitPayload) => {
    if (payload.items.length === 0) return;
    setIsSubmittingModal(true);
    try {
      if (editingRecord) {
        const first = payload.items[0];
        const res = await api.patch(`dns-records/${editingRecord.id}/`, {
          domain: first.domain,
          record_type: first.record_type,
          expected_values: (first.expected_value || "")
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
          reference_mode: first.reference_mode,
        });
        const updated = res.data?.data as DNSRecord | undefined;
        invalidateDNS();
        if (selectedRecord && updated && selectedRecord.id === updated.id) {
          setSelectedRecord(updated);
        }
        handleCloseModal();
        emitScanFeedback({
          message: `Registro DNS actualizado · ${first.record_type} ${first.domain}`,
          tone: "success",
          actionLabel: updated ? "Ver" : undefined,
          onAction: updated ? () => setSelectedRecord(updated) : undefined,
        });
        return;
      }

      const createdList: DNSRecord[] = [];
      for (const item of payload.items) {
        const res = await api.post("dns-records/", {
          domain: item.domain,
          record_type: item.record_type,
          expected_values: (item.expected_value || "")
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
          reference_mode: item.reference_mode,
        });
        const created = res.data?.data as DNSRecord | undefined;
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
      if (first && payload.alsoWatchDomain) {
        try {
          const apex = extractRegistrableDomain(first.domain);
          if (apex) {
            await api.post("domains/", { domain: apex });
            void queryClient.invalidateQueries({
              queryKey: ["domains", organizationId],
            });
          }
        } catch {
          // Non-fatal companion creation
        }
      }

      invalidateDNS();
      if (payload.keepOpen) {
        setDomainInput("");
        setExpectedInput("");
        setTestResult(null);
      } else {
        handleCloseModal();
      }

      if (createdList.length === 1 && first) {
        emitScanFeedback({
          message: `Registro DNS agregado · ${first.record_type} ${first.domain}`,
          tone: "success",
          actionLabel: "Ver",
          onAction: () => setSelectedRecord(first),
        });
      } else if (createdList.length > 1) {
        emitScanFeedback({
          message: `${createdList.length} registros DNS agregados`,
          tone: "success",
          actionLabel: first ? "Ver" : undefined,
          onAction: first ? () => setSelectedRecord(first) : undefined,
        });
      }
    } catch (caughtError: unknown) {
      const err = apiFailure(caughtError);
      emitScanFeedback({
        message:
          err.response?.data?.message || "No se pudo guardar el registro DNS.",
        tone: "danger",
      });
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;
    void handleSubmitDNSModal({
      items: [
        {
          domain: domainInput.trim(),
          record_type: recordTypeInput,
          expected_value: expectedInput,
          reference_mode: referenceModeInput,
        },
      ],
    });
  };

  useLinkedResource(records, selectedRecord, setSelectedRecord);

  return {
    directory,
    expectedInput,
    setExpectedInput,
    referenceModeInput,
    setReferenceModeInput,
    isError,
    refetch,
    showModal,
    editingRecord,
    domainInput,
    setDomainInput,
    recordTypeInput,
    setRecordTypeInput,
    typeFilter,
    setTypeFilter,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    selectedIds,
    setSelectedIds,
    scanningId,
    acceptingRefId,
    linkingRecordId,
    deleteTarget,
    setDeleteTarget,
    selectedRecord,
    setSelectedRecord,
    bulkDeleting,
    bulkScanning,
    diagnostic,
    isTestingResolution,
    testResult,
    setTestResult,
    autoRefresh,
    records,
    isLoading,
    history: history || [],
    isLoadingHistory,
    createMutation,
    updateMutation,
    scanMutation,
    acceptReferenceMutation,
    linkTargetMutation,
    deleteMutation,
    handleToggleSelect,
    handleBulkScan,
    handleBulkDelete,
    handleTestResolution,
    handleExportCSV,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmit,
    handleSubmitDNSModal,
    isSubmittingModal,
  };
}
