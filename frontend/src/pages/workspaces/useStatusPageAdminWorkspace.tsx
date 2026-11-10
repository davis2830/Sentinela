import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useAuthStore } from "../../store/authStore";
import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import type {
  StatusPageConfigData,
  ScheduledMaintenanceItem,
  MaintenanceStatus,
  StatusPageAdminStats,
  AvailableTargetItem,
  ComponentSettingItem,
  StatusPageSubscriberItem,
  StatusPageSummaryItem,
  StatusPageCreatePayload,
  AnnouncementType,
} from "../../types/status_page";
/** Data, mutations and transient workflow state; rendering stays in the page. */
export function useStatusPageAdminWorkspace() {
  const organizationId = useAuthStore((state) => state.user?.organization?.id);
  const autoRefresh = useAutoRefresh({
    intervalSeconds: 30,
    scopeKey: "management",
  });

  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "branding" | "components" | "maintenances" | "broadcast"
  >("branding");

  // Config Form States
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [showUptimePct, setShowUptimePct] = useState(true);
  const [showLatency24h, setShowLatency24h] = useState(true);

  // Broadcast Announcement States
  const [customAnnouncement, setCustomAnnouncement] = useState("");
  const [announcementType, setAnnouncementType] =
    useState<AnnouncementType>("info");
  const [announcementActive, setAnnouncementActive] = useState(false);

  // Component Picker Modal State
  const [showComponentPicker, setShowComponentPicker] = useState(false);

  // Maintenance States
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [editingMaint, setEditingMaint] =
    useState<ScheduledMaintenanceItem | null>(null);
  const [maintTitle, setMaintTitle] = useState("");
  const [maintDesc, setMaintDesc] = useState("");
  const [maintStatus, setMaintStatus] =
    useState<MaintenanceStatus>("scheduled");
  const [maintStart, setMaintStart] = useState("");
  const [maintEnd, setMaintEnd] = useState("");
  const [initialUpdate, setInitialUpdate] = useState("");
  const [selectedMaintIds, setSelectedMaintIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Maintenance Update Modal State
  const [updatingMaint, setUpdatingMaint] =
    useState<ScheduledMaintenanceItem | null>(null);

  // Multi-Status Pages Query
  const {
    data: pages = [],
    isLoading: isLoadingPages,
    isError: isPagesError,
  } = useQuery<StatusPageSummaryItem[]>({
    queryKey: ["status-page-pages", organizationId],
    refetchInterval: autoRefresh.refetchInterval,
    queryFn: async () => {
      const response = await api.get("status-page/pages/");
      return (response.data?.data || []) as StatusPageSummaryItem[];
    },
  });

  // Active Selected Status Page ID
  const selectionKey = `sentinel_active_status_page_id:${organizationId || "none"}`;
  const [pageSelection, setPageSelection] = useState(() => ({
    scope: organizationId,
    id: localStorage.getItem(selectionKey) || "",
  }));
  const activePageId =
    pageSelection.scope === organizationId
      ? pageSelection.id
      : localStorage.getItem(selectionKey) || "";
  const setActivePageId = useCallback(
    (id: string) => setPageSelection({ scope: organizationId, id }),
    [organizationId],
  );
  const hasActivePage = Boolean(
    activePageId && pages.some((page) => page.id === activePageId),
  );

  // Multi-page modals
  const [showCreatePageModal, setShowCreatePageModal] = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);

  // Sync activePageId when pages load
  useEffect(() => {
    if (pages.length > 0) {
      const exists = pages.some((p) => p.id === activePageId);
      if (!activePageId || !exists) {
        const defaultPage = pages.find((p) => p.is_default) || pages[0];
        setActivePageId(defaultPage.id);
        localStorage.setItem(selectionKey, defaultPage.id);
      }
    }
  }, [pages, activePageId, organizationId, selectionKey, setActivePageId]);

  const handleSelectPage = (pageId: string) => {
    setActivePageId(pageId);
    localStorage.setItem(selectionKey, pageId);
  };

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];

  // Delete Targets
  const [deleteTarget, setDeleteTarget] =
    useState<ScheduledMaintenanceItem | null>(null);
  const [subscriberToDelete, setSubscriberToDelete] = useState<string | null>(
    null,
  );

  // 1. Config Query
  const { data: config } = useQuery({
    queryKey: ["status-page-config", organizationId, activePageId],
    queryFn: async () => {
      const response = await api.get("status-page/config/", {
        params: activePageId ? { page_id: activePageId } : {},
      });
      return response.data?.data as StatusPageConfigData;
    },
    enabled: hasActivePage,
  });

  // 2. Admin Stats Query
  const { data: stats } = useQuery({
    queryKey: ["status-page-stats", organizationId, activePageId],
    queryFn: async () => {
      const response = await api.get("status-page/stats/", {
        params: activePageId ? { page_id: activePageId } : {},
      });
      return response.data?.data as StatusPageAdminStats;
    },
    refetchInterval: autoRefresh.refetchInterval,
    enabled: hasActivePage,
  });

  // 3. Available Targets Query
  const { data: availableTargets = [] } = useQuery<AvailableTargetItem[]>({
    queryKey: ["status-page-available-targets", organizationId],
    queryFn: async () => {
      const response = await api.get("status-page/available-targets/");
      return (response.data?.data || []) as AvailableTargetItem[];
    },
  });

  // 4. Maintenances List Query
  const { data: maintenances = [] } = useQuery<ScheduledMaintenanceItem[]>({
    queryKey: ["status-page-maintenances", organizationId, activePageId],
    refetchInterval: autoRefresh.refetchInterval,
    queryFn: async () => {
      const response = await api.get("status-page/maintenances/", {
        params: activePageId ? { page_id: activePageId } : {},
      });
      return (response.data?.data || []) as ScheduledMaintenanceItem[];
    },
    enabled: hasActivePage,
  });

  // 5. Subscribers List Query
  const { data: subscribers = [] } = useQuery<StatusPageSubscriberItem[]>({
    queryKey: ["status-page-subscribers", organizationId, activePageId],
    refetchInterval: autoRefresh.refetchInterval,
    queryFn: async () => {
      const response = await api.get("status-page/subscribers/", {
        params: activePageId ? { page_id: activePageId } : {},
      });
      return (response.data?.data || []) as StatusPageSubscriberItem[];
    },
    enabled: hasActivePage,
  });

  // Populate config fields
  useEffect(() => {
    if (config) {
      setCompanyName(config.company_name || "");
      setSlug(config.slug || "");
      setDescription(config.description || "");
      setLogoUrl(config.logo_url || "");
      setWebsiteUrl(config.website_url || "");
      setSupportEmail(config.support_email || "");
      setIsPublic(config.is_public ?? true);
      setShowUptimePct(config.show_uptime_pct ?? true);
      setShowLatency24h(config.show_latency_24h ?? true);
      setCustomAnnouncement(config.custom_announcement || "");
      setAnnouncementType(config.announcement_type || "info");
      setAnnouncementActive(config.announcement_active ?? false);
    }
  }, [config]);

  // Mutations
  const saveConfigMutation = useMutation({
    mutationFn: async (data: Partial<StatusPageConfigData>) => {
      await api.patch("status-page/config/", data, {
        params: activePageId ? { page_id: activePageId } : {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["status-page-config", organizationId, activePageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["status-page-stats", organizationId, activePageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["status-page-pages", organizationId],
      });
    },
  });

  const createPageMutation = useMutation({
    mutationFn: async (payload: StatusPageCreatePayload) => {
      const res = await api.post("status-page/pages/", payload);
      return res.data?.data;
    },
    onSuccess: (newPage) => {
      queryClient.invalidateQueries({
        queryKey: ["status-page-pages", organizationId],
      });
      if (newPage?.id) {
        handleSelectPage(newPage.id);
      }
    },
  });

  const setDefaultPageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      await api.post(`status-page/pages/${pageId}/set-default/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["status-page-pages", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["status-page-stats", organizationId, activePageId],
      });
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      await api.delete(`status-page/pages/${pageId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["status-page-pages", organizationId],
      });
      setPageToDelete(null);
    },
  });

  const saveMaintMutation = useMutation({
    mutationFn: async (
      data: Partial<
        import("../../types/status_page").ScheduledMaintenanceItem
      > & { initial_update?: string },
    ) => {
      if (editingMaint) {
        await api.patch(`status-page/maintenances/${editingMaint.id}/`, data);
      } else {
        await api.post("status-page/maintenances/", {
          ...data,
          status_page_id: activePageId || undefined,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["status-page-maintenances", organizationId, activePageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["status-page-stats", organizationId, activePageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["status-page-pages", organizationId],
      });
      setShowMaintModal(false);
      setEditingMaint(null);
    },
  });

  const deleteMaintMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`status-page/maintenances/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["status-page-maintenances", organizationId, activePageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["status-page-stats", organizationId, activePageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["status-page-pages", organizationId],
      });
      setDeleteTarget(null);
    },
  });

  const postUpdateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { message: string; status?: MaintenanceStatus };
    }) => {
      await api.post(`status-page/maintenances/${id}/updates/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["status-page-maintenances", organizationId, activePageId],
      });
      setUpdatingMaint(null);
    },
  });

  const deleteSubscriberMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`status-page/subscribers/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["status-page-subscribers", organizationId, activePageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["status-page-stats", organizationId, activePageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["status-page-pages", organizationId],
      });
      setSubscriberToDelete(null);
    },
  });

  // Handlers
  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate({
      company_name: companyName.trim(),
      slug: slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-"),
      description: description.trim(),
      logo_url: logoUrl.trim(),
      website_url: websiteUrl.trim(),
      support_email: supportEmail.trim(),
      is_public: isPublic,
      show_uptime_pct: showUptimePct,
      show_latency_24h: showLatency24h,
    });
  };

  const handleSaveAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate({
      custom_announcement: customAnnouncement.trim(),
      announcement_type: announcementType,
      announcement_active: announcementActive,
    });
  };

  const handleSaveComponentSettings = async (
    settings: ComponentSettingItem[],
  ) => {
    await saveConfigMutation.mutateAsync({
      component_settings: settings,
    });
  };

  const handleOpenCreateMaint = () => {
    setEditingMaint(null);
    setMaintTitle("");
    setMaintDesc("");
    setMaintStatus("scheduled");
    const nowISO = new Date().toISOString().slice(0, 16);
    const endISO = new Date(Date.now() + 3600000 * 2)
      .toISOString()
      .slice(0, 16);
    setMaintStart(nowISO);
    setMaintEnd(endISO);
    setInitialUpdate("Mantenimiento planificado registrado en la plataforma.");
    setShowMaintModal(true);
  };

  const handleOpenEditMaint = (m: ScheduledMaintenanceItem) => {
    setEditingMaint(m);
    setMaintTitle(m.title);
    setMaintDesc(m.description);
    setMaintStatus(m.status);
    setMaintStart(new Date(m.start_time).toISOString().slice(0, 16));
    setMaintEnd(new Date(m.end_time).toISOString().slice(0, 16));
    setShowMaintModal(true);
  };

  const handleSaveMaint = (e: React.FormEvent) => {
    e.preventDefault();
    saveMaintMutation.mutate({
      title: maintTitle.trim(),
      description: maintDesc.trim(),
      status: maintStatus,
      start_time: new Date(maintStart).toISOString(),
      end_time: new Date(maintEnd).toISOString(),
      initial_update: initialUpdate.trim(),
    });
  };

  // Bulk Maintenance Handlers
  const handleToggleSelectMaint = (id: string) => {
    setSelectedMaintIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllMaint = () => {
    if (selectedMaintIds.length === maintenances.length) {
      setSelectedMaintIds([]);
    } else {
      setSelectedMaintIds(maintenances.map((m) => m.id));
    }
  };

  const handleBulkMaintAction = async (
    action: "completed" | "cancelled" | "delete",
  ) => {
    if (selectedMaintIds.length === 0) return;
    if (action === "delete") {
      if (
        !window.confirm(
          `¿Deseas eliminar permanentemente los ${selectedMaintIds.length} mantenimientos seleccionados?`,
        )
      ) {
        return;
      }
    }
    setBulkProcessing(true);
    try {
      await api.post("status-page/maintenances/bulk-action/", {
        action,
        maintenance_ids: selectedMaintIds,
      });
      setSelectedMaintIds([]);
      queryClient.invalidateQueries({
        queryKey: ["status-page-maintenances", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["status-page-stats", organizationId],
      });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleExportSubscribersCSV = () => {
    const url = `${api.defaults.baseURL}status-page/subscribers/export/${
      activePageId ? `?page_id=${activePageId}` : ""
    }`;
    window.open(url, "_blank");
  };

  const publicUrl = `/status/${activePage?.slug || slug || "demo"}`;
  return {
    autoRefresh,
    activeTab,
    setActiveTab,
    companyName,
    setCompanyName,
    slug,
    setSlug,
    description,
    setDescription,
    logoUrl,
    setLogoUrl,
    websiteUrl,
    setWebsiteUrl,
    supportEmail,
    setSupportEmail,
    isPublic,
    setIsPublic,
    showUptimePct,
    setShowUptimePct,
    showLatency24h,
    setShowLatency24h,
    customAnnouncement,
    setCustomAnnouncement,
    announcementType,
    setAnnouncementType,
    announcementActive,
    setAnnouncementActive,
    showComponentPicker,
    setShowComponentPicker,
    showMaintModal,
    setShowMaintModal,
    editingMaint,
    maintTitle,
    setMaintTitle,
    maintDesc,
    setMaintDesc,
    maintStart,
    setMaintStart,
    maintEnd,
    setMaintEnd,
    initialUpdate,
    setInitialUpdate,
    selectedMaintIds,
    setSelectedMaintIds,
    bulkProcessing,
    updatingMaint,
    setUpdatingMaint,
    pages,
    isLoadingPages,
    isPagesError,
    activePageId,
    showCreatePageModal,
    setShowCreatePageModal,
    showDirectoryModal,
    setShowDirectoryModal,
    pageToDelete,
    setPageToDelete,
    handleSelectPage,
    activePage,
    deleteTarget,
    setDeleteTarget,
    subscriberToDelete,
    setSubscriberToDelete,
    config,
    stats,
    availableTargets,
    maintenances,
    subscribers,
    saveConfigMutation,
    createPageMutation,
    setDefaultPageMutation,
    deletePageMutation,
    saveMaintMutation,
    deleteMaintMutation,
    postUpdateMutation,
    deleteSubscriberMutation,
    handleSaveBranding,
    handleSaveAnnouncement,
    handleSaveComponentSettings,
    handleOpenCreateMaint,
    handleOpenEditMaint,
    handleSaveMaint,
    handleToggleSelectMaint,
    handleSelectAllMaint,
    handleBulkMaintAction,
    handleExportSubscribersCSV,
    publicUrl,
  };
}
