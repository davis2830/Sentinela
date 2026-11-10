import { useLinkedResource } from "../../hooks/useLinkedResource";
import { useUrlFilter } from "../../hooks/useUrlFilter";
import { useAuthStore } from "../../store/authStore";
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import type {
  Incident,
  IncidentTimelineEvent,
  IncidentAlert,
  CreateIncidentData,
  IncidentStatus,
  IncidentStats,
} from "../../types/incidents";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { usePersistentViewMode } from "../../hooks/usePersistentViewMode";
import type { Team } from "../../types/users";
import {
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Search,
  Wrench,
  ShieldAlert,
  Activity,
  Globe,
  Lock,
  Plug,
  Shield,
  Server,
} from "lucide-react";

const LIFECYCLE_STEPS: {
  status: IncidentStatus;
  label: string;
  icon: import("lucide-react").LucideIcon;
}[] = [
  { status: "open", label: "Abierto", icon: AlertOctagon },
  { status: "investigating", label: "Investigando", icon: Search },
  { status: "identified", label: "Identificado", icon: Wrench },
  { status: "mitigated", label: "Mitigado", icon: ShieldAlert },
  { status: "resolved", label: "Resuelto", icon: CheckCircle2 },
  { status: "closed", label: "Cerrado", icon: XCircle },
];
/** Data, mutations and transient workflow state; rendering stays in the page. */
export function useIncidentsWorkspace() {
  const organizationId = useAuthStore((state) => state.user?.organization?.id);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    null,
  );
  const [showForm, setShowForm] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Incident | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useUrlFilter("status", [
    "all",
    "active",
    "open",
    "investigating",
    "identified",
    "mitigated",
    "resolved",
    "closed",
  ] as const);
  const [priorityFilter, setPriorityFilter] = useUrlFilter("priority", [
    "all",
    "critical",
    "high",
    "medium",
    "low",
  ] as const);
  const [viewMode, setViewMode] = usePersistentViewMode("incidents", "table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerTab, setDrawerTab] = useState<
    "timeline" | "rca" | "alerts" | "details"
  >("timeline");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // RCA Form State in Drawer
  const [rcaRootCause, setRcaRootCause] = useState("");
  const [rcaResolutionSummary, setRcaResolutionSummary] = useState("");
  const [rcaPreventiveActions, setRcaPreventiveActions] = useState("");
  const [assigneeState, setAssigneeState] = useState("");
  const [teamAssigneeState, setTeamAssigneeState] = useState("");

  // Shared area clock; only stored data is consulted.
  const autoRefresh = useAutoRefresh({
    scopeKey: "management",
    intervalSeconds: 30,
    initialEnabled: true,
  });

  // Sync RCA & Assignee states when selectedIncident changes
  useEffect(() => {
    if (selectedIncident) {
      setRcaRootCause(selectedIncident.root_cause || "");
      setRcaResolutionSummary(selectedIncident.resolution_summary || "");
      setRcaPreventiveActions(selectedIncident.preventive_actions || "");
      setAssigneeState(selectedIncident.assigned_to || "");
      setTeamAssigneeState(selectedIncident.assigned_team || "");
    }
  }, [selectedIncident]);

  // Incidents List Query
  const { data: incidents, isLoading } = useQuery<Incident[]>({
    queryKey: ["incidents-list", organizationId],
    queryFn: async () => {
      const response = await api.get("incidents/");
      return (response.data?.data || []) as Incident[];
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Incidents Stats Query (Real-time MTTA/MTTR and SLA metrics)
  const { data: stats } = useQuery<IncidentStats>({
    queryKey: ["incidents-stats", organizationId],
    queryFn: async () => {
      const response = await api.get("incidents/stats/");
      return response.data?.data as IncidentStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Teams Query for quick assignment
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["teams-list-select", organizationId],
    queryFn: async () => {
      try {
        const response = await api.get("users/teams/");
        return (response.data?.data || []) as Team[];
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });

  // Timeline events query for selected incident
  const { data: timelineEvents, isLoading: isLoadingTimeline } = useQuery<
    IncidentTimelineEvent[]
  >({
    queryKey: ["incident-timeline", organizationId, selectedIncident?.id],
    queryFn: async () => {
      if (!selectedIncident) return [];
      const response = await api.get(
        `incidents/${selectedIncident.id}/timeline/`,
      );
      return (response.data?.data || []) as IncidentTimelineEvent[];
    },
    enabled: !!selectedIncident,
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Linked alerts query for selected incident
  const { data: linkedAlerts } = useQuery<IncidentAlert[]>({
    queryKey: ["incident-alerts", organizationId, selectedIncident?.id],
    queryFn: async () => {
      if (!selectedIncident) return [];
      const response = await api.get(
        `incidents/${selectedIncident.id}/alerts/`,
      );
      return (response.data?.data || []) as IncidentAlert[];
    },
    enabled: !!selectedIncident,
    refetchInterval: autoRefresh.refetchInterval,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateIncidentData) => {
      await api.post("incidents/", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["incidents-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["incidents-stats", organizationId],
      });
      setShowForm(false);
      setEditingIncident(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateIncidentData & { status: IncidentStatus }>;
    }) => {
      const response = await api.patch(`incidents/${id}/`, data);
      return response.data?.data as Incident;
    },
    onSuccess: (updatedIncident) => {
      queryClient.invalidateQueries({
        queryKey: ["incidents-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["incidents-stats", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["incident-timeline", organizationId, selectedIncident?.id],
      });
      if (selectedIncident && updatedIncident) {
        setSelectedIncident(updatedIncident);
      }
      setShowForm(false);
      setEditingIncident(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`incidents/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["incidents-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["incidents-stats", organizationId],
      });
      if (selectedIncident?.id === deleteTarget?.id) {
        setSelectedIncident(null);
      }
      setDeleteTarget(null);
    },
  });

  // Add Note Mutation (Resolves 404 URL bug)
  const addNoteMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      await api.post(`incidents/${id}/timeline/`, {
        note: note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["incident-timeline", organizationId, selectedIncident?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["incidents-list", organizationId],
      });
      setNoteInput("");
    },
  });

  // RCA Post-Mortem Mutation
  const rcaMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        root_cause?: string;
        resolution_summary?: string;
        preventive_actions?: string;
      };
    }) => {
      const response = await api.post(`incidents/${id}/rca/`, data);
      return response.data?.data as Incident;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: ["incidents-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["incident-timeline", organizationId, selectedIncident?.id],
      });
      if (selectedIncident && updated) {
        setSelectedIncident(updated);
      }
    },
  });

  // Quick Assign Mutation
  const assignMutation = useMutation({
    mutationFn: async ({
      id,
      assigned_to,
      assigned_team,
    }: {
      id: string;
      assigned_to?: string | null;
      assigned_team?: string | null;
    }) => {
      const response = await api.post(`incidents/${id}/assign/`, {
        assigned_to,
        assigned_team,
      });
      return response.data?.data as Incident;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: ["incidents-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["incidents-stats", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["incident-timeline", organizationId, selectedIncident?.id],
      });
      if (selectedIncident && updated) {
        setSelectedIncident(updated);
      }
    },
  });

  // Bulk Actions
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllToggle = () => {
    if (!filteredIncidents || filteredIncidents.length === 0) return;
    if (selectedIds.length === filteredIncidents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredIncidents.map((i: Incident) => i.id));
    }
  };

  const handleBulkAction = async (
    action: "resolve" | "mitigate" | "close" | "delete",
  ) => {
    if (selectedIds.length === 0) return;
    if (action === "delete") {
      if (
        !window.confirm(
          `¿Deseas eliminar permanentemente los ${selectedIds.length} incidentes seleccionados?`,
        )
      ) {
        return;
      }
    }
    setBulkProcessing(true);
    try {
      await api.post("incidents/bulk-action/", {
        action,
        incident_ids: selectedIds,
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({
        queryKey: ["incidents-list", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["incidents-stats", organizationId],
      });
    } catch (err) {
      console.error("Error en acción masiva de incidentes:", err);
    } finally {
      setBulkProcessing(false);
    }
  };

  // Form Handlers
  const handleFormSubmit = async (data: CreateIncidentData) => {
    if (editingIncident) {
      await updateMutation.mutateAsync({ id: editingIncident.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !noteInput.trim()) return;
    addNoteMutation.mutate({ id: selectedIncident.id, note: noteInput.trim() });
  };

  const handleSaveRca = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    rcaMutation.mutate({
      id: selectedIncident.id,
      data: {
        root_cause: rcaRootCause.trim(),
        resolution_summary: rcaResolutionSummary.trim(),
        preventive_actions: rcaPreventiveActions.trim(),
      },
    });
  };

  const handleSaveAssignee = () => {
    if (!selectedIncident) return;
    assignMutation.mutate({
      id: selectedIncident.id,
      assigned_to: assigneeState || null,
      assigned_team: teamAssigneeState || null,
    });
  };

  const handleStatusChange = (newStatus: IncidentStatus) => {
    if (!selectedIncident) return;
    updateMutation.mutate({
      id: selectedIncident.id,
      data: { status: newStatus },
    });
  };

  const handleOpenCreate = () => {
    setEditingIncident(null);
    setShowForm(true);
  };

  const handleOpenEdit = (incident: Incident, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingIncident(incident);
    setShowForm(true);
  };

  // Export CSV Function with UTF-8 BOM
  const handleExportCSV = () => {
    if (!incidents || incidents.length === 0) return;
    const headers = [
      "ID",
      "Titulo",
      "Prioridad",
      "Estado",
      "Servicio Afectado",
      "Tipo Modulo",
      "Responsable",
      "Alertas Vinculadas",
      "Duracion (minutos)",
      "Fecha Apertura",
      "Fecha Mitigacion",
      "Fecha Resolucion",
      "Fecha Cierre",
      "Causa Raiz",
      "Acciones Preventivas",
    ];
    const rows = incidents.map((i) => [
      `"${i.id}"`,
      `"${(i.title || "").replace(/"/g, '""')}"`,
      `"${i.priority}"`,
      `"${i.status}"`,
      `"${(i.impacted_service || "").replace(/"/g, '""')}"`,
      `"${i.target_type || ""}"`,
      `"${(i.assigned_to_name || "Sin asignar").replace(/"/g, '""')}"`,
      i.alerts_count,
      i.duration_minutes || 0,
      `"${i.opened_at}"`,
      `"${i.mitigated_at || ""}"`,
      `"${i.resolved_at || ""}"`,
      `"${i.closed_at || ""}"`,
      `"${(i.root_cause || "").replace(/"/g, '""')}"`,
      `"${(i.preventive_actions || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `sentinel_incidentes_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for navigating to affected module
  const getModuleRoute = (targetType?: string) => {
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
        return null;
    }
  };

  const getModuleIcon = (targetType?: string) => {
    switch (targetType) {
      case "monitoring":
        return <Globe size={14} className="text-emerald-400" />;
      case "ssl":
        return <Lock size={14} className="text-rose-400" />;
      case "dns":
        return <Activity size={14} className="text-sky-400" />;
      case "domain":
        return <Globe size={14} className="text-blue-400" />;
      case "api_check":
        return <Plug size={14} className="text-amber-400" />;
      case "security_headers":
        return <Shield size={14} className="text-purple-400" />;
      default:
        return <Server size={14} className="text-text-muted" />;
    }
  };

  // KPI Calculations (fallback to local if stats is loading)
  const allIncidents = useMemo(() => incidents || [], [incidents]);
  const totalCount = allIncidents.length;
  const criticalCount =
    stats?.critical_incidents ??
    stats?.active_critical ??
    allIncidents.filter(
      (i: Incident) =>
        i.priority === "critical" &&
        i.status !== "resolved" &&
        i.status !== "closed",
    ).length;
  const inProgressCount =
    stats?.in_mitigation ??
    stats?.in_progress_count ??
    allIncidents.filter(
      (i: Incident) =>
        i.status === "investigating" ||
        i.status === "identified" ||
        i.status === "mitigated",
    ).length;
  const resolvedCount = allIncidents.filter(
    (i: Incident) => i.status === "resolved" || i.status === "closed",
  ).length;

  // Filtered & Searched Incidents (Memoized)
  const filteredIncidents = useMemo(() => {
    return allIncidents.filter((incident: Incident) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        incident.title.toLowerCase().includes(term) ||
        (incident.description &&
          incident.description.toLowerCase().includes(term)) ||
        (incident.impacted_service &&
          incident.impacted_service.toLowerCase().includes(term)) ||
        (incident.assigned_to_name &&
          incident.assigned_to_name.toLowerCase().includes(term));

      if (!matchesSearch) return false;
      if (
        statusFilter === "active" &&
        ["resolved", "closed"].includes(incident.status)
      )
        return false;
      if (
        statusFilter !== "all" &&
        statusFilter !== "active" &&
        incident.status !== statusFilter
      )
        return false;
      if (priorityFilter !== "all" && incident.priority !== priorityFilter)
        return false;

      return true;
    });
  }, [allIncidents, searchTerm, statusFilter, priorityFilter]);

  const currentStepIndex = selectedIncident
    ? LIFECYCLE_STEPS.findIndex((s) => s.status === selectedIncident.status)
    : -1;

  useLinkedResource(incidents, selectedIncident, setSelectedIncident);
  return {
    navigate,
    selectedIncident,
    setSelectedIncident,
    showForm,
    setShowForm,
    editingIncident,
    setEditingIncident,
    deleteTarget,
    setDeleteTarget,
    noteInput,
    setNoteInput,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    viewMode,
    setViewMode,
    selectedIds,
    setSelectedIds,
    drawerTab,
    setDrawerTab,
    bulkProcessing,
    rcaRootCause,
    setRcaRootCause,
    rcaResolutionSummary,
    setRcaResolutionSummary,
    rcaPreventiveActions,
    setRcaPreventiveActions,
    assigneeState,
    setAssigneeState,
    teamAssigneeState,
    setTeamAssigneeState,
    autoRefresh,
    incidents,
    isLoading,
    teams,
    timelineEvents,
    isLoadingTimeline,
    linkedAlerts,
    updateMutation,
    deleteMutation,
    addNoteMutation,
    rcaMutation,
    assignMutation,
    handleToggleSelect,
    handleSelectAllToggle,
    handleBulkAction,
    handleFormSubmit,
    handleAddNote,
    handleSaveRca,
    handleSaveAssignee,
    handleStatusChange,
    handleOpenCreate,
    handleOpenEdit,
    handleExportCSV,
    getModuleRoute,
    getModuleIcon,
    allIncidents,
    totalCount,
    criticalCount,
    inProgressCount,
    resolvedCount,
    filteredIncidents,
    currentStepIndex,
  };
}
