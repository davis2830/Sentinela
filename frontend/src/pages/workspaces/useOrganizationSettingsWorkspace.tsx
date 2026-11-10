import { useMemberDirectory } from "../../hooks/useMemberDirectory";
import { apiFailure } from "../../services/errors";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import type {
  OrganizationData,
  SubscriptionSummary,
} from "../../types/organization";

type OrgTab = "company" | "billing" | "team";
/** Data, mutations and transient workflow state; rendering stays in the page. */
export function useOrganizationSettingsWorkspace() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<OrgTab>(
    searchParams.get("tab") === "billing" ? "billing" : "company",
  );
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Form states - Company & Compliance
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezoneVal, setTimezoneVal] = useState("America/Guatemala");
  const [localeVal, setLocaleVal] = useState("es-ES");
  const [billingEmail, setBillingEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // SLA & Observability
  const [slaTarget, setSlaTarget] = useState("99.90");
  const [flappingThreshold, setFlappingThreshold] = useState(3);
  const [defaultInterval, setDefaultInterval] = useState(60);

  // Retention & Compliance
  const [metricsRetention, setMetricsRetention] = useState(90);
  const [auditRetention, setAuditRetention] = useState(365);
  const [incidentsRetention, setIncidentsRetention] = useState(180);

  // Security
  const [sessionTimeout, setSessionTimeout] = useState(120);
  const [require2fa, setRequire2fa] = useState(false);
  const [allowedIpRanges, setAllowedIpRanges] = useState("");

  // Invitation Form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  // Feedback notifications
  const [saveMsg, setSaveMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 1. Fetch current organization details
  const { data: orgData } = useQuery<OrganizationData>({
    queryKey: ["current-organization"],
    queryFn: async () => {
      const res = await api.get("organizations/current/");
      return res.data?.data;
    },
  });

  // 2. Fetch live subscription and quota summary
  const { data: subData } = useQuery<SubscriptionSummary>({
    queryKey: ["org-subscription"],
    queryFn: async () => {
      const res = await api.get("organizations/current/subscription/");
      return res.data?.data;
    },
  });

  const [memberPage, setMemberPage] = useState(1);
  const [memberSearch, setMemberSearch] = useState("");
  const { data: memberDirectory, isLoading: isLoadingMembers } =
    useMemberDirectory(
      { page: memberPage, search: memberSearch },
      activeTab === "team",
    );
  const members = memberDirectory?.data || [];

  // 4. Fetch invoices / billing history
  const { isLoading: isLoadingInvoices } = useQuery<unknown[]>({
    queryKey: ["org-invoices"],
    queryFn: async () => {
      const res = await api.get("organizations/current/invoices/");
      return res.data?.data || [];
    },
    enabled: activeTab === "billing",
  });

  // Populate form when orgData loads
  useEffect(() => {
    if (orgData) {
      setName(orgData.name || "");
      setSlug(orgData.slug || "");
      setTimezoneVal(orgData.timezone || "America/Guatemala");
      setLocaleVal(orgData.locale || "es-ES");
      setBillingEmail(orgData.billing_email || "");
      setTaxId(orgData.tax_id || "");
      setContactPhone(orgData.contact_phone || "");
      setWebsite(orgData.website || "");
      setLogoUrl(orgData.logo_url || "");
      setSlaTarget(String(orgData.sla_target_percentage ?? "99.90"));
      setFlappingThreshold(orgData.alert_flapping_threshold ?? 3);
      setDefaultInterval(orgData.default_scan_interval_seconds ?? 60);
      setMetricsRetention(orgData.metrics_retention_days ?? 90);
      setAuditRetention(orgData.audit_logs_retention_days ?? 365);
      setIncidentsRetention(orgData.resolved_incidents_retention_days ?? 180);
      setSessionTimeout(orgData.session_timeout_minutes ?? 120);
      setRequire2fa(Boolean(orgData.require_2fa));
      setAllowedIpRanges(orgData.allowed_ip_ranges || "");
    }
  }, [orgData]);

  // Mutation: Save Organization Settings
  const updateOrgMutation = useMutation({
    mutationFn: async (payload: Partial<OrganizationData>) => {
      const res = await api.patch("organizations/current/", payload);
      return res.data;
    },
    onSuccess: () => {
      setSaveMsg({
        type: "success",
        text: "Configuración guardada exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["current-organization"] });
      setTimeout(() => setSaveMsg(null), 3000);
    },
    onError: (caughtError: unknown) => {
      const err = apiFailure(caughtError);
      setSaveMsg({
        type: "error",
        text:
          err.response?.data?.message || "Error al guardar la configuración.",
      });
    },
  });

  // Mutation: Invite Team Member
  const inviteMutation = useMutation({
    mutationFn: async (
      data: import("../../types/users").InviteMemberPayload,
    ) => {
      await api.post("organizations/members/", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      queryClient.invalidateQueries({ queryKey: ["org-subscription"] });
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
    },
    onError: (caughtError: unknown) => {
      const err = apiFailure(caughtError);
      alert(err.response?.data?.message || "Error al enviar la invitación.");
    },
  });

  // Mutation: Revoke / Delete Member
  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`organizations/members/${userId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      queryClient.invalidateQueries({ queryKey: ["org-subscription"] });
    },
  });

  // Handle Save
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrgMutation.mutate({
      name: name.trim(),
      timezone: timezoneVal,
      locale: localeVal,
      billing_email: billingEmail.trim(),
      tax_id: taxId.trim(),
      contact_phone: contactPhone.trim(),
      website: website.trim(),
      logo_url: logoUrl.trim(),
      sla_target_percentage: parseFloat(slaTarget) || 99.9,
      alert_flapping_threshold: Number(flappingThreshold),
      default_scan_interval_seconds: Number(defaultInterval),
      ...(Number(metricsRetention) !== orgData?.metrics_retention_days
        ? { metrics_retention_days: Number(metricsRetention) }
        : {}),
      audit_logs_retention_days: Number(auditRetention),
      resolved_incidents_retention_days: Number(incidentsRetention),
      session_timeout_minutes: Number(sessionTimeout),
      require_2fa: require2fa,
      allowed_ip_ranges: allowedIpRanges.trim(),
    });
  };

  // Download Backup JSON
  const handleDownloadBackup = async () => {
    try {
      const res = await api.get("organizations/current/export/", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `sentinel-backup-${slug || "org"}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert("Error al descargar el archivo de respaldo.");
    }
  };

  // Compute total quota usage for KPI
  const usage = subData?.usage;
  const totalUsed =
    (usage?.targets?.current || 0) +
    (usage?.ssl_certificates?.current || 0) +
    (usage?.api_checks?.current || 0);
  const totalLimit =
    (usage?.targets?.limit || 0) +
    (usage?.ssl_certificates?.limit || 0) +
    (usage?.api_checks?.limit || 0);
  const overallPct =
    totalLimit > 0 && totalLimit < 9999
      ? Math.round((totalUsed / totalLimit) * 100)
      : 0;
  return {
    currentUser,
    activeTab,
    setActiveTab,
    showUpgradeModal,
    setShowUpgradeModal,
    showInviteModal,
    setShowInviteModal,
    name,
    setName,
    slug,
    timezoneVal,
    setTimezoneVal,
    billingEmail,
    setBillingEmail,
    taxId,
    setTaxId,
    contactPhone,
    setContactPhone,
    website,
    setWebsite,
    slaTarget,
    setSlaTarget,
    flappingThreshold,
    setFlappingThreshold,
    defaultInterval,
    setDefaultInterval,
    metricsRetention,
    setMetricsRetention,
    auditRetention,
    setAuditRetention,
    incidentsRetention,
    setIncidentsRetention,
    sessionTimeout,
    setSessionTimeout,
    require2fa,
    setRequire2fa,
    allowedIpRanges,
    setAllowedIpRanges,
    inviteEmail,
    setInviteEmail,
    inviteFirstName,
    setInviteFirstName,
    inviteLastName,
    setInviteLastName,
    inviteRole,
    setInviteRole,
    saveMsg,
    orgData,
    subData,
    setMemberPage,
    memberSearch,
    setMemberSearch,
    memberDirectory,
    isLoadingMembers,
    members,
    isLoadingInvoices,
    updateOrgMutation,
    inviteMutation,
    revokeMutation,
    handleSaveSettings,
    handleDownloadBackup,
    usage,
    totalUsed,
    totalLimit,
    overallPct,
  };
}
