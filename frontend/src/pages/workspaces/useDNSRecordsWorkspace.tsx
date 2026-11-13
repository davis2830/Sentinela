import { useConnectivityDirectory } from "../../hooks/useConnectivityDirectory";
import { bulkOutcome } from "../../utils/bulkOutcome";
import { apiFailure } from "../../services/errors";
import { useConfigurationDiagnostic } from "../../hooks/useConfigurationDiagnostic";
import { useLinkedResource } from "../../hooks/useLinkedResource";
import { useUrlFilter } from "../../hooks/useUrlFilter";
import { useAuthStore } from "../../store/authStore";
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { waitForFreshScan, type QueuedScan } from "../../utils/scanPolling";
import type {
  DNSRecord,
  DNSRecordType,
  CreateDNSRecordData,
  DNSChangeHistory,
  DNSTestResolutionResult,
} from "../../types/dns";
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
  const [searchTerm, setSearchTerm] = useState("");
  // Persistent viewMode: remembers table or grid across refreshes and updates
  const [viewMode, setViewMode] = usePersistentViewMode("dns_records", "table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [, setScanningId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DNSRecord | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DNSRecord | null>(null);
  const [drawerTab, setDrawerTab] = useState<
    "history" | "details" | "security"
  >("history");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Live Test Resolution State
  const diagnostic = useConfigurationDiagnostic();
  const [isTestingResolution, setIsTestingResolution] = useState(false);
  const [testResult, setTestResult] = useState<DNSTestResolutionResult | null>(
    null,
  );

  // Read cadence follows the server plan; GET never triggers a scan.
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

  const createMutation = useMutation({
    mutationFn: async (data: CreateDNSRecordData) => {
      await api.post("dns-records/", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["dns-records", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["dns-stats", organizationId],
      });
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
      await api.patch(`dns-records/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["dns-records", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["dns-stats", organizationId],
      });
      handleCloseModal();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (id: string) => {
      setScanningId(id);
      const response = await api.post(`dns-records/${id}/scan/`);
      const queued = response.data?.data as QueuedScan;
      return waitForFreshScan<DNSRecord>(
        queued,
        async () =>
          (await api.get(`dns-records/${id}/`)).data?.data as DNSRecord,
        (record) => record.last_scanned_at,
      );
    },
    onSuccess: (updatedRecord) => {
      queryClient.invalidateQueries({
        queryKey: ["dns-records", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["dns-stats", organizationId],
      });
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`dns-records/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["dns-records", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["dns-stats", organizationId],
      });
      if (selectedRecord?.id === deleteTarget?.id) {
        setSelectedRecord(null);
      }
      setDeleteTarget(null);
    },
  });

  // Bulk Actions via backend endpoint
  const handleToggleSelect = (record: DNSRecord) => {
    setSelectedIds((prev) =>
      prev.includes(record.id)
        ? prev.filter((id) => id !== record.id)
        : [...prev, record.id],
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredRecords || filteredRecords.length === 0) return;
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map((r: DNSRecord) => r.id));
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
    queryClient.invalidateQueries({
      queryKey: ["dns-records", organizationId],
    });
    queryClient.invalidateQueries({ queryKey: ["dns-stats", organizationId] });
  };

  // Test DNS Resolution in Modal
  const handleTestResolution = async () => {
    if (!domainInput.trim()) return;
    setIsTestingResolution(true);
    setTestResult(null);

    let cleanDomain = domainInput
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "");
    if (cleanDomain.includes(":")) {
      cleanDomain = cleanDomain.split(":")[0];
    }

    try {
      const response = await diagnostic.run("dns-records/test-resolution/", {
        domain: cleanDomain,
        record_type: recordTypeInput,
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
        record_type: recordTypeInput,
        values: [],
        error_message:
          err.response?.data?.message || "Error al resolver la consulta DNS.",
      });
    } finally {
      setIsTestingResolution(false);
    }
  };

  // Export CSV Report
  const handleExportCSV = () => void directory.exportCSV();

  // Modal Handlers
  const handleOpenCreate = () => {
    setEditingRecord(null);
    setExpectedInput("");
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
    setRecordTypeInput(record.record_type);
    setTestResult(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRecord(null);
    setExpectedInput("");
    setDomainInput("");
    setRecordTypeInput("A");
    setTestResult(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;
    let cleanDomain = domainInput
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "");
    if (cleanDomain.includes(":")) {
      cleanDomain = cleanDomain.split(":")[0];
    }

    if (editingRecord) {
      updateMutation.mutate({
        id: editingRecord.id,
        data: {
          domain: cleanDomain,
          record_type: recordTypeInput,
          expected_values: expectedInput
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
        },
      });
    } else {
      createMutation.mutate({
        domain: cleanDomain,
        record_type: recordTypeInput,
        expected_values: expectedInput
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
      });
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case "A":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "AAAA":
        return "bg-teal-500/10 text-teal-400 border-teal-500/30";
      case "CNAME":
        return "bg-sky-500/10 text-sky-400 border-sky-500/30";
      case "MX":
        return "bg-violet-500/10 text-violet-400 border-violet-500/30";
      case "TXT":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "NS":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "SOA":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "PTR":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "CAA":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  };

  const isRecentMutation = (dateStr: string | null) => {
    if (!dateStr) return false;
    const changeTime = new Date(dateStr).getTime();
    const now = Date.now();
    return now - changeTime < 24 * 60 * 60 * 1000;
  };

  // KPI Calculations
  const allRecords = records || [];

  // Filtered & Searched Records
  const filteredRecords = allRecords;

  useLinkedResource(records, selectedRecord, setSelectedRecord);
  return {
    directory,
    expectedInput,
    setExpectedInput,
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
    deleteTarget,
    setDeleteTarget,
    selectedRecord,
    setSelectedRecord,
    drawerTab,
    setDrawerTab,
    bulkDeleting,
    diagnostic,
    isTestingResolution,
    testResult,
    setTestResult,
    autoRefresh,
    records,
    isLoading,
    history,
    isLoadingHistory,
    createMutation,
    updateMutation,
    scanMutation,
    deleteMutation,
    handleToggleSelect,
    handleSelectAllToggle,
    handleBulkDelete,
    handleTestResolution,
    handleExportCSV,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmit,
    getTypeBadgeClass,
    isRecentMutation,
    filteredRecords,
  };
}
