import { apiFailure } from "../../services/errors";
import { useLinkedResource } from "../../hooks/useLinkedResource";
import { useUrlFilter } from "../../hooks/useUrlFilter";
import { useAuthStore } from "../../store/authStore";
import React, { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import type {
  AlertRule,
  Alert,
  CreateAlertRuleData,
  AlertStatus,
  AlertStats,
  AlertTargetType,
} from "../../types/alerts";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { usePersistentViewMode } from "../../hooks/usePersistentViewMode";

type MainTab = "alerts" | "rules";

interface SnoozeTarget {
  type: "alert" | "rule" | "bulk";
  id?: string;
  name: string;
  isCurrentlySnoozed?: boolean;
}
/** Data, mutations and transient workflow state; rendering stays in the page. */
export function useAlertsWorkspace() {
  const organizationId = useAuthStore((state) => state.user?.organization?.id);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetIdFilter = searchParams.get("target_id");
  const targetTypeFilter = searchParams.get("target_type");
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<MainTab>("alerts");
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null);

  // Persistent view mode ('grid' | 'table') per Sentinel NOC standard
  const [viewMode, setViewMode] = usePersistentViewMode("alerts", "table");

  // Inspection Drawer
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [drawerTab, setDrawerTab] = useState<"rca" | "timeline" | "actions">(
    "rca",
  );

  // Multi-Selection
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);

  // Snooze Modal State
  const [snoozeTarget, setSnoozeTarget] = useState<SnoozeTarget | null>(null);
  const [snoozeMinutes, setSnoozeMinutes] = useState<number>(60);

  // Filters
  const [statusFilter, setStatusFilter] = useUrlFilter(
    "status",
    ["all", "unresolved", "active", "acknowledged", "resolved"] as const,
    "active",
  );
  const [severityFilter, setSeverityFilter] = useUrlFilter("severity", [
    "all",
    "critical",
    "warning",
    "info",
  ] as const);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionNotification, setActionNotification] = useState<{
    message: string;
    type: "success" | "info" | "error";
  } | null>(null);

  // Shared area clock; only stored data is consulted.
  const autoRefresh = useAutoRefresh({
    scopeKey: "management",
    intervalSeconds: 30,
    initialEnabled: true,
  });

  // Rules query
  const { data: rules, isLoading: isLoadingRules } = useQuery<AlertRule[]>({
    queryKey: ["alert-rules", organizationId],
    queryFn: async () => {
      const response = await api.get("alert-rules/");
      return (response.data?.data || []) as AlertRule[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Alerts stats query
  const { data: stats } = useQuery<AlertStats>({
    queryKey: ["alerts-stats", organizationId],
    queryFn: async () => {
      const response = await api.get("alerts/stats/");
      return (response.data?.data || {}) as AlertStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Alerts query
  const getAlertsEndpoint = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all" && statusFilter !== "unresolved")
      params.append("status", statusFilter);
    if (severityFilter !== "all") params.append("severity", severityFilter);
    const queryString = params.toString();
    return queryString ? `alerts/?${queryString}` : "alerts/";
  };

  const { data: alerts, isLoading: isLoadingAlerts } = useQuery<Alert[]>({
    queryKey: ["alerts-list", organizationId, statusFilter, severityFilter],
    queryFn: async () => {
      const response = await api.get(getAlertsEndpoint());
      return (response.data?.data || []) as Alert[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Helper: Get route from target_type
  const getModuleRoute = (targetType: AlertTargetType | string) => {
    switch (targetType) {
      case "monitoring":
        return "/monitoring";
      case "ssl":
        return "/ssl";
      case "dns":
        return "/dns";
      case "domain":
        return "/domains";
      case "api_check":
        return "/api-checks";
      case "security_headers":
        return "/security-headers";
      default:
        return "/monitoring";
    }
  };

  const getModuleName = (targetType: AlertTargetType | string) => {
    switch (targetType) {
      case "monitoring":
        return "Uptime & Latencia";
      case "ssl":
        return "Certificados SSL";
      case "dns":
        return "Registros DNS";
      case "domain":
        return "Dominios WHOIS";
      case "api_check":
        return "API Checks Sintéticos";
      case "security_headers":
        return "Cabeceras de Seguridad";
      default:
        return targetType;
    }
  };

  // Rule mutations
  const createRuleMutation = useMutation({
    mutationFn: async (data: CreateAlertRuleData) => {
      await api.post("alert-rules/", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["alert-rules", organizationId],
      });
      notify("Regla creada exitosamente.", "success");
    },
    onError: (caughtError: unknown) => {
      const err = apiFailure(caughtError);
      notify(
        err?.response?.data?.message || "Error al crear la regla.",
        "error",
      );
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateAlertRuleData>;
    }) => {
      await api.patch(`alert-rules/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["alert-rules", organizationId],
      });
      notify("Regla actualizada exitosamente.", "success");
    },
    onError: (caughtError: unknown) => {
      const err = apiFailure(caughtError);
      notify(
        err?.response?.data?.message || "Error al actualizar la regla.",
        "error",
      );
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`alert-rules/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["alert-rules", organizationId],
      });
      setDeleteTarget(null);
      notify("Regla eliminada del sistema.", "info");
    },
  });

  // Alert status update mutation
  const updateAlertStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AlertStatus }) => {
      await api.patch(`alerts/${id}/`, { status });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["alerts-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["alerts-stats", organizationId],
      });
      if (selectedAlert?.id === vars.id) {
        setSelectedAlert((prev) =>
          prev ? { ...prev, status: vars.status } : null,
        );
      }
      notify(
        `Alerta marcada como ${vars.status === "resolved" ? "resuelta" : "reconocida"}.`,
        "success",
      );
    },
  });

  const acknowledgeAllMutation = useMutation({
    mutationFn: async () => {
      await api.post("alerts/acknowledge-all/");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["alerts-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["alerts-stats", organizationId],
      });
      notify("Todas las alertas activas han sido reconocidas.", "success");
    },
  });

  const resolveAllMutation = useMutation({
    mutationFn: async () => {
      await api.post("alerts/resolve-all/");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["alerts-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["alerts-stats", organizationId],
      });
      notify("Todas las alertas han sido marcadas como resueltas.", "success");
    },
  });

  const createIncidentMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await api.post(`alerts/${alertId}/create-incident/`);
      return res.data?.data;
    },
    onSuccess: (data, alertId) => {
      queryClient.invalidateQueries({
        queryKey: ["alerts-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["alerts-stats", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["incidents-list", organizationId],
      });
      if (selectedAlert?.id === alertId) {
        setSelectedAlert((prev) =>
          prev
            ? {
                ...prev,
                incident_id: data?.incident?.id || "linked",
                incident_title: data?.incident?.title || "Incidente Creado",
              }
            : null,
        );
      }
      notify("Alerta elevada a Incidente formal exitosamente.", "success");
    },
    onError: (caughtError: unknown) => {
      const err = apiFailure(caughtError);
      notify(
        err?.response?.data?.message || "Error al crear el incidente.",
        "error",
      );
    },
  });

  // Evaluate Rules on Demand
  const evaluateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("alert-rules/evaluate/");
      return res.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["alerts-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["alerts-stats", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["alert-rules", organizationId],
      });
      const msg =
        data?.message || "Evaluación de reglas completada correctamente.";
      notify(msg, "success");
    },
    onError: (caughtError: unknown) => {
      const err = apiFailure(caughtError);
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "Error al evaluar las reglas de alerta.";
      notify(errorMsg, "error");
    },
  });

  // Snooze Alert Mutation
  const snoozeAlertMutation = useMutation({
    mutationFn: async ({ id, minutes }: { id: string; minutes: number }) => {
      const res = await api.post(`alerts/${id}/snooze/`, { minutes });
      return res.data?.data;
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["alerts-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["alerts-stats", organizationId],
      });
      if (selectedAlert?.id === vars.id) {
        setSelectedAlert(data?.alert || null);
      }
      setSnoozeTarget(null);
      const msg =
        vars.minutes > 0
          ? `Alerta silenciada por ${vars.minutes} minutos.`
          : "Silencio desactivado. Notificaciones reanudadas.";
      notify(msg, "info");
    },
  });

  // Snooze Rule Mutation
  const snoozeRuleMutation = useMutation({
    mutationFn: async ({ id, minutes }: { id: string; minutes: number }) => {
      const res = await api.post(`alert-rules/${id}/snooze/`, { minutes });
      return res.data?.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["alert-rules", organizationId],
      });
      setSnoozeTarget(null);
      const msg =
        vars.minutes > 0
          ? `Regla silenciada por ${vars.minutes} minutos.`
          : "Silencio desactivado. Regla activa normalmente.";
      notify(msg, "info");
    },
  });

  // Bulk Actions Mutation
  const bulkActionMutation = useMutation({
    mutationFn: async ({
      action,
      alert_ids,
      minutes,
    }: {
      action: "acknowledge" | "resolve" | "snooze" | "delete";
      alert_ids: string[];
      minutes?: number;
    }) => {
      const res = await api.post("alerts/bulk-action/", {
        action,
        alert_ids,
        minutes,
      });
      return res.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["alerts-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["alerts-stats", organizationId],
      });
      setSelectedAlertIds([]);
      setSnoozeTarget(null);
      notify(
        data?.message || "Acción en lote completada con éxito.",
        "success",
      );
    },
    onError: (caughtError: unknown) => {
      const err = apiFailure(caughtError);
      notify(
        err?.response?.data?.message || "Error en acción masiva.",
        "error",
      );
    },
  });

  const notify = (message: string, type: "success" | "info" | "error") => {
    setActionNotification({ message, type });
    setTimeout(() => setActionNotification(null), 6000);
  };

  // Handlers
  const handleOpenCreateRule = () => {
    setEditingRule(null);
    setShowRuleModal(true);
  };

  const handleOpenEditRule = (rule: AlertRule) => {
    setEditingRule(rule);
    setShowRuleModal(true);
  };

  const handleCloseRuleModal = () => {
    setShowRuleModal(false);
    setEditingRule(null);
  };

  const handleRuleSubmit = async (data: CreateAlertRuleData) => {
    if (editingRule) {
      await updateRuleMutation.mutateAsync({ id: editingRule.id, data });
    } else {
      await createRuleMutation.mutateAsync(data);
    }
  };

  // Filtered alerts by search term (Memoized)
  const filteredAlerts = useMemo(() => {
    return (alerts || []).filter((alert: Alert) => {
      if (targetIdFilter && alert.target_id !== targetIdFilter) return false;
      if (targetTypeFilter && alert.target_type !== targetTypeFilter)
        return false;
      if (statusFilter === "unresolved" && alert.status === "resolved")
        return false;
      if (
        statusFilter !== "all" &&
        statusFilter !== "unresolved" &&
        alert.status !== statusFilter
      )
        return false;
      if (severityFilter !== "all" && alert.severity !== severityFilter)
        return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        alert.title.toLowerCase().includes(term) ||
        (alert.message && alert.message.toLowerCase().includes(term)) ||
        (alert.target_type && alert.target_type.toLowerCase().includes(term))
      );
    });
  }, [
    alerts,
    searchTerm,
    targetIdFilter,
    targetTypeFilter,
    statusFilter,
    severityFilter,
  ]);

  // Filtered rules by search term (Memoized)
  const filteredRules = useMemo(() => {
    return (rules || []).filter((rule: AlertRule) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        rule.name.toLowerCase().includes(term) ||
        (rule.target_type && rule.target_type.toLowerCase().includes(term)) ||
        (rule.condition && rule.condition.toLowerCase().includes(term))
      );
    });
  }, [rules, searchTerm]);

  // Multi-selection helpers
  const handleToggleSelectAlert = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAlertIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllVisible = () => {
    if (
      selectedAlertIds.length === filteredAlerts.length &&
      filteredAlerts.length > 0
    ) {
      setSelectedAlertIds([]);
    } else {
      setSelectedAlertIds(filteredAlerts.map((a) => a.id));
    }
  };

  // Export to CSV with UTF-8 BOM
  const handleExportCSV = () => {
    const listToExport = filteredAlerts;
    if (listToExport.length === 0) {
      notify(
        "No hay alertas disponibles para exportar con los filtros actuales.",
        "info",
      );
      return;
    }

    const headers = [
      "ID",
      "Título",
      "Módulo",
      "Severidad",
      "Estado",
      "Ocurrencias",
      "Anti-Flapping",
      "Disparo Inicial",
      "Última Detección",
      "Resuelto En",
      "Auto-Resuelto",
      "Silenciado Hasta",
      "Mensaje Detallado",
    ];

    const rows = listToExport.map((a) => [
      `"${a.id}"`,
      `"${(a.title || "").replace(/"/g, '""')}"`,
      `"${a.target_type || ""}"`,
      `"${a.severity || ""}"`,
      `"${a.status || ""}"`,
      a.occurrence_count || 1,
      a.is_flapping ? `SÍ (${a.flapping_count || 3})` : "NO",
      `"${a.triggered_at ? new Date(a.triggered_at).toLocaleString("es-ES") : ""}"`,
      `"${a.last_seen_at ? new Date(a.last_seen_at).toLocaleString("es-ES") : ""}"`,
      `"${a.resolved_at ? new Date(a.resolved_at).toLocaleString("es-ES") : ""}"`,
      a.auto_resolved ? "SÍ" : "NO",
      `"${a.snoozed_until ? new Date(a.snoozed_until).toLocaleString("es-ES") : "NO"}"`,
      `"${(a.message || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `sentinel_smart_alerts_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(
      `${listToExport.length} alertas exportadas a CSV con éxito.`,
      "success",
    );
  };

  // Snooze submit handler
  const handleConfirmSnooze = () => {
    if (!snoozeTarget) return;

    if (snoozeTarget.type === "alert" && snoozeTarget.id) {
      snoozeAlertMutation.mutate({
        id: snoozeTarget.id,
        minutes: snoozeMinutes,
      });
    } else if (snoozeTarget.type === "rule" && snoozeTarget.id) {
      snoozeRuleMutation.mutate({
        id: snoozeTarget.id,
        minutes: snoozeMinutes,
      });
    } else if (snoozeTarget.type === "bulk") {
      bulkActionMutation.mutate({
        action: "snooze",
        alert_ids: selectedAlertIds,
        minutes: snoozeMinutes,
      });
    }
  };

  const totalAlertsCount =
    (stats?.total_active || 0) +
    (stats?.acknowledged || 0) +
    (stats?.resolved || 0);

  // Helper to check if item is currently snoozed
  const isItemSnoozed = (snoozedUntil?: string | null) => {
    if (!snoozedUntil) return false;
    return new Date(snoozedUntil) > new Date();
  };

  useLinkedResource(alerts, selectedAlert, setSelectedAlert);
  return {
    navigate,
    setSearchParams,
    targetIdFilter,
    activeTab,
    setActiveTab,
    showRuleModal,
    editingRule,
    deleteTarget,
    setDeleteTarget,
    viewMode,
    setViewMode,
    selectedAlert,
    setSelectedAlert,
    drawerTab,
    setDrawerTab,
    selectedAlertIds,
    setSelectedAlertIds,
    snoozeTarget,
    setSnoozeTarget,
    snoozeMinutes,
    setSnoozeMinutes,
    statusFilter,
    setStatusFilter,
    severityFilter,
    setSeverityFilter,
    searchTerm,
    setSearchTerm,
    actionNotification,
    setActionNotification,
    autoRefresh,
    rules,
    isLoadingRules,
    stats,
    alerts,
    isLoadingAlerts,
    getModuleRoute,
    getModuleName,
    deleteRuleMutation,
    updateAlertStatusMutation,
    acknowledgeAllMutation,
    resolveAllMutation,
    createIncidentMutation,
    evaluateMutation,
    snoozeAlertMutation,
    snoozeRuleMutation,
    bulkActionMutation,
    handleOpenCreateRule,
    handleOpenEditRule,
    handleCloseRuleModal,
    handleRuleSubmit,
    filteredAlerts,
    filteredRules,
    handleToggleSelectAlert,
    handleSelectAllVisible,
    handleExportCSV,
    handleConfirmSnooze,
    totalAlertsCount,
    isItemSnoozed,
  };
}
