import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import NOCPageHeader from '../components/common/noc/NOCPageHeader';
import NOCKpiGrid from '../components/common/noc/NOCKpiGrid';
import NOCKpiCard from '../components/common/noc/NOCKpiCard';
import UpgradePlanModal from '../components/organization/UpgradePlanModal';
import InvoiceReceiptModal from '../components/organization/InvoiceReceiptModal';
import type { OrganizationData, SubscriptionSummary, OrganizationTeamMember } from '../types/organization';
import {
  Building,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Sparkles,
  Zap,
  Shield,
  Lock,
  Users,
  UserPlus,
  Trash2,
  Mail,
  RefreshCw,
  Globe,
  Phone,
  Clock,
  Check,
  Server,
  KeyRound,
  Sliders,
  ShieldAlert,
  ArrowUpRight,
  Database,
  FileText,
} from 'lucide-react';

type OrgTab = 'company' | 'billing' | 'team';

export default function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<OrgTab>('company');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Form states - Company & Compliance
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [timezoneVal, setTimezoneVal] = useState('UTC');
  const [localeVal, setLocaleVal] = useState('es-ES');
  const [billingEmail, setBillingEmail] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // SLA & Observability
  const [slaTarget, setSlaTarget] = useState('99.90');
  const [flappingThreshold, setFlappingThreshold] = useState(3);
  const [defaultInterval, setDefaultInterval] = useState(60);

  // Retention & Compliance
  const [metricsRetention, setMetricsRetention] = useState(90);
  const [auditRetention, setAuditRetention] = useState(365);
  const [incidentsRetention, setIncidentsRetention] = useState(180);

  // Security
  const [sessionTimeout, setSessionTimeout] = useState(120);
  const [require2fa, setRequire2fa] = useState(false);
  const [allowedIpRanges, setAllowedIpRanges] = useState('');

  // Invitation Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  // Feedback notifications
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Fetch current organization details
  const { data: orgData, isLoading: isLoadingOrg } = useQuery<OrganizationData>({
    queryKey: ['current-organization'],
    queryFn: async () => {
      const res = await api.get('organizations/current/');
      return res.data?.data;
    },
  });

  // 2. Fetch live subscription and quota summary
  const { data: subData, isLoading: isLoadingSub } = useQuery<SubscriptionSummary>({
    queryKey: ['org-subscription'],
    queryFn: async () => {
      const res = await api.get('organizations/current/subscription/');
      return res.data?.data;
    },
  });

  // 3. Fetch team members
  const { data: members, isLoading: isLoadingMembers } = useQuery<OrganizationTeamMember[]>({
    queryKey: ['org-members'],
    queryFn: async () => {
      const res = await api.get('organizations/members/');
      return res.data?.data || [];
    },
  });

  // 4. Fetch invoices / billing history
  const { data: invoices = [], isLoading: isLoadingInvoices } = useQuery<any[]>({
    queryKey: ['org-invoices'],
    queryFn: async () => {
      const res = await api.get('organizations/current/invoices/');
      return res.data?.data || [];
    },
    enabled: activeTab === 'billing',
  });

  // Populate form when orgData loads
  useEffect(() => {
    if (orgData) {
      setName(orgData.name || '');
      setSlug(orgData.slug || '');
      setTimezoneVal(orgData.timezone || 'UTC');
      setLocaleVal(orgData.locale || 'es-ES');
      setBillingEmail(orgData.billing_email || '');
      setTaxId(orgData.tax_id || '');
      setContactPhone(orgData.contact_phone || '');
      setWebsite(orgData.website || '');
      setLogoUrl(orgData.logo_url || '');
      setSlaTarget(String(orgData.sla_target_percentage ?? '99.90'));
      setFlappingThreshold(orgData.alert_flapping_threshold ?? 3);
      setDefaultInterval(orgData.default_scan_interval_seconds ?? 60);
      setMetricsRetention(orgData.metrics_retention_days ?? 90);
      setAuditRetention(orgData.audit_logs_retention_days ?? 365);
      setIncidentsRetention(orgData.resolved_incidents_retention_days ?? 180);
      setSessionTimeout(orgData.session_timeout_minutes ?? 120);
      setRequire2fa(Boolean(orgData.require_2fa));
      setAllowedIpRanges(orgData.allowed_ip_ranges || '');
    }
  }, [orgData]);

  // Mutation: Save Organization Settings
  const updateOrgMutation = useMutation({
    mutationFn: async (payload: Partial<OrganizationData>) => {
      const res = await api.patch('organizations/current/', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setSaveMsg({ type: 'success', text: 'Configuración guardada exitosamente.' });
      queryClient.invalidateQueries({ queryKey: ['current-organization'] });
      setTimeout(() => setSaveMsg(null), 3000);
    },
    onError: (err: any) => {
      setSaveMsg({
        type: 'error',
        text: err.response?.data?.message || 'Error al guardar la configuración.',
      });
    },
  });

  // Mutation: Invite Team Member
  const inviteMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post('organizations/members/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      queryClient.invalidateQueries({ queryKey: ['org-subscription'] });
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteFirstName('');
      setInviteLastName('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error al enviar la invitación.');
    },
  });

  // Mutation: Revoke / Delete Member
  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`organizations/members/${userId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      queryClient.invalidateQueries({ queryKey: ['org-subscription'] });
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
      sla_target_percentage: parseFloat(slaTarget) || 99.90,
      alert_flapping_threshold: Number(flappingThreshold),
      default_scan_interval_seconds: Number(defaultInterval),
      metrics_retention_days: Number(metricsRetention),
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
      const res = await api.get('organizations/current/export/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sentinel-backup-${slug || 'org'}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Error al descargar el archivo de respaldo.');
    }
  };

  // Compute total quota usage for KPI
  const usage = subData?.usage;
  const totalUsed = (usage?.targets.current || 0) + (usage?.ssl_certificates.current || 0) + (usage?.api_checks.current || 0);
  const totalLimit = (usage?.targets.limit || 0) + (usage?.ssl_certificates.limit || 0) + (usage?.api_checks.limit || 0);
  const overallPct = totalLimit > 0 && totalLimit < 9999 ? Math.round((totalUsed / totalLimit) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* 1. Header with NOC Standard */}
      <NOCPageHeader
        title="Organización & Facturación"
        description="Centro de administración corporativo: identidad de empresa, límites de plan, políticas de observabilidad y equipo"
        badgeText="CONFIGURACIÓN & PLANES"
        icon={<Building size={24} />}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadBackup}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text-main bg-white/5 border border-border-base hover:bg-white/10 transition-colors"
              title="Descargar copia de respaldo en formato JSON"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Exportar Backup</span>
            </button>

            <button
              onClick={() => setShowUpgradeModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-accent-green bg-accent-green/10 border border-accent-green/30 hover:bg-accent-green/20 transition-colors"
            >
              <Sparkles size={15} />
              <span>Cambiar Plan</span>
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={updateOrgMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-accent-green text-black hover:bg-accent-green-glow transition-all shadow-lg shadow-accent-green/10 disabled:opacity-50"
            >
              {updateOrgMutation.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              <span>Guardar Cambios</span>
            </button>
          </div>
        }
      />

      {/* Save Notification */}
      {saveMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-sm animate-in slide-in-from-top duration-200 border ${
            saveMsg.type === 'success'
              ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
              : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
          }`}
        >
          {saveMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="font-medium">{saveMsg.text}</span>
        </div>
      )}

      {/* 2. Top KPI Cards */}
      <NOCKpiGrid columns={4}>
        <NOCKpiCard
          title="Plan Activo & Suscripción"
          value={subData?.plan_name || 'Pro / Growth'}
          subtitle={
            subData?.is_in_trial
              ? `${subData.trial_days_remaining} días restantes de prueba`
              : 'Suscripción corporativa activa'
          }
          icon={<Sparkles size={18} className="text-accent-yellow" />}
          badge={{
            text: subData?.plan_tier?.toUpperCase() || 'PRO',
            variant: subData?.is_in_trial ? 'warning' : 'success',
          }}
        />

        <NOCKpiCard
          title="Consumo Global de Cuotas"
          value={`${totalUsed} / ${totalLimit >= 9999 ? '∞' : totalLimit}`}
          subtitle={`${overallPct}% de capacidad asignada en uso`}
          icon={<Zap size={18} className="text-accent-green" />}
          badge={{
            text: `${overallPct}%`,
            variant: overallPct > 80 ? 'danger' : overallPct > 50 ? 'warning' : 'success',
          }}
        />

        <NOCKpiCard
          title="Meta SLA Corporativo"
          value={`${orgData?.sla_target_percentage ?? '99.90'}%`}
          subtitle={`Retención: ${orgData?.metrics_retention_days ?? 90} días TimescaleDB`}
          icon={<Shield size={18} className="text-accent-blue" />}
          badge={{
            text: 'SRE GOAL',
            variant: 'info',
          }}
        />

        <NOCKpiCard
          title="Seguridad & Acceso"
          value={orgData?.require_2fa ? '2FA Obligatorio' : '2FA Opcional'}
          subtitle={`Timeout: ${orgData?.session_timeout_minutes ?? 120} min inactividad`}
          icon={<Lock size={18} className="text-accent-purple" />}
          badge={{
            text: 'POLICIES',
            variant: orgData?.require_2fa ? 'success' : 'neutral',
          }}
        />
      </NOCKpiGrid>

      {/* 3. Navigation Tabs */}
      <div className="flex border-b border-border-base gap-2">
        <button
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'company'
              ? 'border-accent-green text-text-main'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Building size={16} />
          <span>Empresa & Cumplimiento</span>
        </button>

        <button
          onClick={() => setActiveTab('billing')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'billing'
              ? 'border-accent-green text-text-main'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Sparkles size={16} />
          <span>Plan & Límites en Vivo</span>
          {subData?.is_in_trial && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30">
              TRIAL
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'team'
              ? 'border-accent-green text-text-main'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Users size={16} />
          <span>Equipo & Accesos ({members?.length || 0})</span>
        </button>
      </div>

      {/* 4. Tab 1: Empresa & Cumplimiento */}
      {activeTab === 'company' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* General Information Card */}
          <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-text-main mb-4 flex items-center gap-2">
              <Building size={18} className="text-accent-blue" />
              Identidad de la Organización
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Nombre de la Empresa / Organización
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ej. Banco Industrial S.A."
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Slug / Identificador URL
                </label>
                <input
                  type="text"
                  value={slug}
                  disabled
                  className="w-full bg-bg-dark/50 border border-border-base/50 rounded-xl px-4 py-2.5 text-sm text-text-dim cursor-not-allowed font-mono"
                />
                <p className="text-[11px] text-text-dim mt-1.5">
                  El slug identifica a tu empresa en portales y status pages públicas.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Huso Horario Predeterminado
                </label>
                <select
                  value={timezoneVal}
                  onChange={(e) => setTimezoneVal(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                >
                  <option value="America/Guatemala">America/Guatemala (UTC-6)</option>
                  <option value="America/Mexico_City">America/Mexico_City (UTC-6)</option>
                  <option value="America/Bogota">America/Bogota (UTC-5)</option>
                  <option value="America/Lima">America/Lima (UTC-5)</option>
                  <option value="America/Santiago">America/Santiago (UTC-3 / UTC-4)</option>
                  <option value="America/Buenos_Aires">America/Buenos_Aires (UTC-3)</option>
                  <option value="America/New_York">America/New_York (UTC-5 / UTC-4)</option>
                  <option value="UTC">UTC (Tiempo Universal)</option>
                  <option value="Europe/Madrid">Europe/Madrid (UTC+1 / UTC+2)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Identificación Fiscal (RUT / RFC / NIF / CIF)
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="Ej. RFC: BCO980201-XYZ"
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                />
              </div>
            </div>
          </div>

          {/* Contact & Billing Card */}
          <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-text-main mb-4 flex items-center gap-2">
              <Mail size={18} className="text-accent-purple" />
              Contacto Operativo & Facturación
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Correo de Facturación
                </label>
                <input
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="facturas@empresa.com"
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Teléfono de Contacto de Guardia
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+502 2345 6789"
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Sitio Web Principal
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://empresa.com"
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                />
              </div>
            </div>
          </div>

          {/* Policies & Compliance Card */}
          <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-text-main mb-4 flex items-center gap-2">
              <ShieldAlert size={18} className="text-accent-yellow" />
              Políticas de Observabilidad & SLA (SRE)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Meta Mensual de SLA (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="90.00"
                  max="99.99"
                  value={slaTarget}
                  onChange={(e) => setSlaTarget(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                />
                <p className="text-[11px] text-text-dim mt-1.5">
                  Estándar para contratos corporativos (ej. 99.90% o 99.95%).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Umbral Anti-Flapping (Oscilaciones)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={flappingThreshold}
                  onChange={(e) => setFlappingThreshold(Number(e.target.value))}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                />
                <p className="text-[11px] text-text-dim mt-1.5">
                  Cambios de estado en 15m para escalar a alerta crítica anti-ruido.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Frecuencia Base de Chequeo (s)
                </label>
                <input
                  type="number"
                  min="15"
                  max="600"
                  value={defaultInterval}
                  onChange={(e) => setDefaultInterval(Number(e.target.value))}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                />
                <p className="text-[11px] text-text-dim mt-1.5">
                  Intervalo sugerido al registrar nuevos objetivos (segundos).
                </p>
              </div>
            </div>
          </div>

          {/* Retention & ISO 27001 Card */}
          <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-text-main mb-4 flex items-center gap-2">
              <Database size={18} className="text-accent-green" />
              Retención Histórica & Auditoría (ISO 27001 / SOC 2)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Retención de Métricas (Días)
                </label>
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={metricsRetention}
                  onChange={(e) => setMetricsRetention(Number(e.target.value))}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                />
                <p className="text-[11px] text-text-dim mt-1.5">
                  Compresión y retención de series de tiempo en TimescaleDB.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Retención de Auditoría (Días)
                </label>
                <input
                  type="number"
                  min="30"
                  max="3650"
                  value={auditRetention}
                  onChange={(e) => setAuditRetention(Number(e.target.value))}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                />
                <p className="text-[11px] text-text-dim mt-1.5">
                  Bitácora inmutable de eventos y cambios de configuración.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Retención de Incidentes (Días)
                </label>
                <input
                  type="number"
                  min="30"
                  max="3650"
                  value={incidentsRetention}
                  onChange={(e) => setIncidentsRetention(Number(e.target.value))}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                />
                <p className="text-[11px] text-text-dim mt-1.5">
                  Historial de RCA, post-mortems y análisis de incidentes resueltos.
                </p>
              </div>
            </div>
          </div>

          {/* Security & Access Policies Card */}
          <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-text-main mb-4 flex items-center gap-2">
              <Lock size={18} className="text-accent-red" />
              Seguridad & Controles de Acceso
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Timeout de Inactividad de Sesión (Minutos)
                </label>
                <input
                  type="number"
                  min="15"
                  max="1440"
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(Number(e.target.value))}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                />
                <p className="text-[11px] text-text-dim mt-1.5">
                  Tiempo de espera antes de invalidar la sesión por inactividad.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Exigir Autenticación 2FA Obligatoria
                </label>
                <div className="flex items-center gap-3 mt-3">
                  <input
                    type="checkbox"
                    id="require2fa"
                    checked={require2fa}
                    onChange={(e) => setRequire2fa(e.target.checked)}
                    className="w-4 h-4 rounded text-accent-green border-border-base bg-bg-dark focus:ring-accent-green"
                  />
                  <label htmlFor="require2fa" className="text-sm font-medium text-text-main cursor-pointer">
                    Obligatorio para todos los miembros y operadores
                  </label>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Lista Blanca de IPs / Rangos CIDR Permitidos
                </label>
                <textarea
                  value={allowedIpRanges}
                  onChange={(e) => setAllowedIpRanges(e.target.value)}
                  rows={2}
                  placeholder="Ej. 190.148.20.0/24, 200.50.10.15 (dejar en blanco para permitir acceso global)"
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                />
                <p className="text-[11px] text-text-dim mt-1.5">
                  Restringe el acceso a la plataforma únicamente desde las VPNs o IPs corporativas de tu empresa.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Save Bar */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={updateOrgMutation.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-accent-green text-black hover:bg-accent-green-glow transition-all shadow-lg shadow-accent-green/20"
            >
              {updateOrgMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              <span>Guardar Configuración Corporativa</span>
            </button>
          </div>
        </form>
      )}

      {/* 5. Tab 2: Plan SaaS & Cuotas en Vivo */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* Subscription Banner */}
          <div className="bg-gradient-to-r from-bg-card via-bg-card-hover to-bg-card border border-border-base rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-green/10 text-accent-green border border-accent-green/30 uppercase tracking-wider">
                  Nivel de Suscripción
                </span>
                {subData?.is_in_trial && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 uppercase tracking-wider">
                    Prueba Pro (14 Días)
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-text-main">
                {subData?.plan_name || 'Pro / Growth'}
              </h2>
              <p className="text-text-muted text-sm mt-1 max-w-xl">
                {subData?.is_in_trial
                  ? `Tu prueba gratuita concluye en ${subData.trial_days_remaining} días. Puedes actualizar a Business o Enterprise en cualquier momento para desbloquear más agentes satélite y ventanas de mantenimiento.`
                  : 'Suscripción corporativa activa. Facturación mensual automatizada.'}
              </p>
            </div>

            <button
              onClick={() => setShowUpgradeModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-accent-green text-black hover:bg-accent-green-glow transition-all shadow-lg shadow-accent-green/20 whitespace-nowrap"
            >
              <Sparkles size={16} />
              <span>Ver Todos los Planes & Upgrade</span>
            </button>
          </div>

          {/* Live Quota Meters Grid */}
          <div>
            <h3 className="text-sm font-bold text-text-main uppercase tracking-wider mb-4 flex items-center gap-2">
              <Zap size={16} className="text-accent-green" />
              Consumo de Cuotas del Plan en Tiempo Real
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Metric 1: Uptime Targets */}
              <div className="bg-bg-card border border-border-base rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Server size={16} className="text-accent-blue" />
                    <span className="text-xs font-semibold text-text-muted">Monitores de Uptime</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-text-main">
                    {usage?.targets?.current ?? 0} / {(usage?.targets?.limit ?? 9999) >= 9999 ? '∞' : usage?.targets?.limit}
                  </span>
                </div>
                <div className="w-full bg-bg-dark h-2 rounded-full overflow-hidden mb-2 border border-border-base/40">
                  <div
                    className={`h-full transition-all duration-500 ${
                      (usage?.targets?.percentage || 0) > 80
                        ? 'bg-accent-red'
                        : (usage?.targets?.percentage || 0) > 50
                        ? 'bg-accent-yellow'
                        : 'bg-accent-blue'
                    }`}
                    style={{ width: `${usage?.targets?.percentage || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-text-dim">
                  <span>{usage?.targets?.percentage ?? 0}% consumido</span>
                  <span>Frecuencia: {subData?.limits?.min_check_interval_seconds ?? 60}s</span>
                </div>
              </div>

              {/* Metric 2: SSL Certificates */}
              <div className="bg-bg-card border border-border-base rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-accent-green" />
                    <span className="text-xs font-semibold text-text-muted">Certificados SSL</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-text-main">
                    {usage?.ssl_certificates?.current ?? 0} /{' '}
                    {(usage?.ssl_certificates?.limit ?? 9999) >= 9999 ? '∞' : usage?.ssl_certificates?.limit}
                  </span>
                </div>
                <div className="w-full bg-bg-dark h-2 rounded-full overflow-hidden mb-2 border border-border-base/40">
                  <div
                    className="h-full bg-accent-green transition-all duration-500"
                    style={{ width: `${usage?.ssl_certificates?.percentage || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-text-dim">
                  <span>{usage?.ssl_certificates?.percentage ?? 0}% consumido</span>
                  <span>Multi-puerto activo</span>
                </div>
              </div>

              {/* Metric 3: API Checks */}
              <div className="bg-bg-card border border-border-base rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-accent-purple" />
                    <span className="text-xs font-semibold text-text-muted">API Checks Sintéticos</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-text-main">
                    {usage?.api_checks?.current ?? 0} /{' '}
                    {(usage?.api_checks?.limit ?? 9999) >= 9999 ? '∞' : usage?.api_checks?.limit}
                  </span>
                </div>
                <div className="w-full bg-bg-dark h-2 rounded-full overflow-hidden mb-2 border border-border-base/40">
                  <div
                    className="h-full bg-accent-purple transition-all duration-500"
                    style={{ width: `${usage?.api_checks?.percentage || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-text-dim">
                  <span>{usage?.api_checks?.percentage ?? 0}% consumido</span>
                  <span>JSON Schema</span>
                </div>
              </div>

              {/* Metric 4: Team Members */}
              <div className="bg-bg-card border border-border-base rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-accent-blue" />
                    <span className="text-xs font-semibold text-text-muted">Miembros de Equipo</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-text-main">
                    {usage?.team_members?.current ?? 0} /{' '}
                    {(usage?.team_members?.limit ?? 9999) >= 9999 ? '∞' : usage?.team_members?.limit}
                  </span>
                </div>
                <div className="w-full bg-bg-dark h-2 rounded-full overflow-hidden mb-2 border border-border-base/40">
                  <div
                    className="h-full bg-accent-blue transition-all duration-500"
                    style={{ width: `${usage?.team_members?.percentage || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-text-dim">
                  <span>{usage?.team_members?.percentage ?? 0}% consumido</span>
                  <span>Roles RBAC</span>
                </div>
              </div>

              {/* Metric 5: Status Pages */}
              <div className="bg-bg-card border border-border-base rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-accent-yellow" />
                    <span className="text-xs font-semibold text-text-muted">Status Pages Públicas</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-text-main">
                    {usage?.status_pages?.current ?? 0} /{' '}
                    {(usage?.status_pages?.limit ?? 9999) >= 9999 ? '∞' : usage?.status_pages?.limit}
                  </span>
                </div>
                <div className="w-full bg-bg-dark h-2 rounded-full overflow-hidden mb-2 border border-border-base/40">
                  <div
                    className="h-full bg-accent-yellow transition-all duration-500"
                    style={{ width: `${usage?.status_pages?.percentage || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-text-dim">
                  <span>{usage?.status_pages?.percentage ?? 0}% consumido</span>
                  <span>Dominio custom</span>
                </div>
              </div>

              {/* Metric 6: Private Agents */}
              <div className="bg-bg-card border border-border-base rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Server size={16} className="text-accent-green" />
                    <span className="text-xs font-semibold text-text-muted">Agentes Satélite (On-Premise)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-text-main">
                    {usage?.private_agents?.current ?? 0} /{' '}
                    {(usage?.private_agents?.limit ?? 9999) >= 9999 ? '∞' : usage?.private_agents?.limit}
                  </span>
                </div>
                <div className="w-full bg-bg-dark h-2 rounded-full overflow-hidden mb-2 border border-border-base/40">
                  <div
                    className="h-full bg-accent-green transition-all duration-500"
                    style={{ width: `${usage?.private_agents?.percentage || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-text-dim">
                  <span>{usage?.private_agents?.percentage ?? 0}% consumido</span>
                  <span>Red Privada / LAN</span>
                </div>
              </div>
            </div>
          </div>

          {/* Capabilities Comparison Banner */}
          <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-text-main uppercase tracking-wider mb-4">
              Capacidades Habilitadas en tu Plan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-bg-dark border border-border-base flex items-start gap-3">
                <Check size={18} className="text-accent-green shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-text-main">Frecuencia de Escaneo</h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Chequeos automáticos cada {subData?.limits.min_check_interval_seconds} segundos.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-bg-dark border border-border-base flex items-start gap-3">
                <Check size={18} className="text-accent-green shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-text-main">Retención TimescaleDB</h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {subData?.limits.metrics_retention_days} días de historial de latencia y disponibilidad.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-bg-dark border border-border-base flex items-start gap-3">
                {subData?.limits.maintenance_windows ? (
                  <Check size={18} className="text-accent-green shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-accent-yellow shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-xs font-bold text-text-main">Ventanas de Mantenimiento</h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {subData?.limits.maintenance_windows
                      ? 'Supresión inteligente de alertas habilitada.'
                      : 'Disponible a partir del plan Business.'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-bg-dark border border-border-base flex items-start gap-3">
                {subData?.limits.rca_postmortem ? (
                  <Check size={18} className="text-accent-green shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-accent-yellow shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-xs font-bold text-text-main">Análisis Causa Raíz (RCA)</h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {subData?.limits.rca_postmortem
                      ? 'Gestión estructurada de incidentes y post-mortem.'
                      : 'Disponible a partir del plan Business.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Historial de Facturación & Comprobantes */}
          <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
                  <FileText size={16} className="text-accent-blue" />
                  Historial de Facturación & Recibos
                </h3>
                <p className="text-xs text-text-dim mt-0.5">
                  Comprobantes pro-forma y facturas mensuales generadas para auditoría, contabilidad y SLA
                </p>
              </div>
            </div>

            {isLoadingInvoices ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 size={20} className="animate-spin text-accent-green" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-dim border border-dashed border-border-base rounded-xl">
                No hay facturas registradas en este periodo.
              </div>
            ) : (
              <div className="overflow-x-auto border border-border-base rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg-dark/70 border-b border-border-base text-text-dim uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Factura / Recibo</th>
                      <th className="py-3 px-4">Periodo</th>
                      <th className="py-3 px-4">Fecha Emisión</th>
                      <th className="py-3 px-4">Plan</th>
                      <th className="py-3 px-4">Monto</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Comprobante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-base/60 font-sans">
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-bg-card-hover/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-accent-blue">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3 px-4 text-text-muted">{inv.period}</td>
                        <td className="py-3 px-4 text-text-dim font-mono">{inv.date}</td>
                        <td className="py-3 px-4 font-medium text-text-main">{inv.plan_name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-text-main">
                          ${inv.amount_usd.toFixed(2)} USD
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-accent-green/10 text-accent-green border-accent-green/30">
                            {inv.status_label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-accent-green bg-accent-green/10 border border-accent-green/30 hover:bg-accent-green/20 transition-colors cursor-pointer"
                          >
                            <Download size={13} />
                            <span>Ver Recibo</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Tab 3: Equipo & Accesos */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Quota Exceeded Banner */}
          {usage?.team_members?.is_exceeded && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-4 animate-in fade-in">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-xs font-bold text-text-main">
                    Límite de Miembros de Equipo Alcanzado ({usage.team_members.current} / {usage.team_members.limit})
                  </h4>
                  <p className="text-xs text-text-muted mt-0.5">
                    Tu plan {subData?.plan_name || 'Free'} ha alcanzado la cuota máxima de miembros permitida.
                    Para invitar a nuevos operadores o ingenieros, actualiza a un plan superior.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="shrink-0 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-400 text-black hover:bg-amber-300 transition-colors shadow-sm cursor-pointer"
              >
                Subir de Plan
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-text-main">Directorio de Operadores & Miembros</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Gestiona los ingenieros con acceso a esta organización y asigna roles RBAC.
              </p>
            </div>

            <button
              onClick={() => {
                if (usage?.team_members?.is_exceeded) {
                  setShowUpgradeModal(true);
                } else {
                  setShowInviteModal(true);
                }
              }}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-xl text-xs hover:bg-accent-green-glow transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <UserPlus size={15} />
              <span>Invitar Miembro</span>
            </button>
          </div>

          {/* Members Table */}
          <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-sm">
            {isLoadingMembers ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 size={24} className="animate-spin text-accent-green" />
              </div>
            ) : members?.length === 0 ? (
              <div className="p-12 text-center text-text-muted text-sm">
                No hay otros miembros registrados en esta organización.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg-dark/50 border-b border-border-base text-text-dim uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3.5 px-4">Usuario</th>
                      <th className="py-3.5 px-4">Rol RBAC</th>
                      <th className="py-3.5 px-4">Estado</th>
                      <th className="py-3.5 px-4">Fecha de Alta</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-base/60">
                    {members?.map((m) => (
                      <tr key={m.id} className="hover:bg-bg-card-hover/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-text-main">
                            {m.first_name || m.last_name ? `${m.first_name} ${m.last_name}` : m.email}
                          </div>
                          <div className="text-[11px] text-text-dim font-mono">{m.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              m.role === 'admin'
                                ? 'bg-accent-purple/10 text-accent-purple border-accent-purple/30'
                                : 'bg-white/5 text-text-muted border-white/10'
                            }`}
                          >
                            {m.role === 'admin' ? 'Administrador' : 'Operador'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                              m.status_code === 'active'
                                ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
                                : 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30'
                            }`}
                          >
                            {m.status_label || (m.status_code === 'active' ? 'Activo' : 'Pendiente')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-text-dim">
                          {new Date(m.date_joined).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {currentUser?.id !== m.id && (
                            <button
                              onClick={() => {
                                if (confirm(`¿Estás seguro de revocar y eliminar el acceso para ${m.email}?`)) {
                                  revokeMutation.mutate(m.id);
                                }
                              }}
                              className="p-1.5 text-text-dim hover:text-accent-red rounded-lg hover:bg-accent-red/10 transition-colors"
                              title="Revocar acceso"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upgrade Plan Modal */}
      <UpgradePlanModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={subData?.plan_tier || 'pro'}
        subscriptionSummary={subData}
      />

      {/* Invoice Receipt Modal */}
      <InvoiceReceiptModal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        invoice={selectedInvoice}
        organizationName={orgData?.name || 'Sentinel'}
      />

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-text-main mb-1 flex items-center gap-2">
              <UserPlus size={18} className="text-accent-green" />
              Invitar Nuevo Miembro
            </h3>
            <p className="text-xs text-text-muted mb-4">
              Se enviará un enlace de activación por correo para unirse a esta organización.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                inviteMutation.mutate({
                  email: inviteEmail.trim(),
                  first_name: inviteFirstName.trim(),
                  last_name: inviteLastName.trim(),
                  role: inviteRole,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="operador@empresa.com"
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">Nombre</label>
                  <input
                    type="text"
                    value={inviteFirstName}
                    onChange={(e) => setInviteFirstName(e.target.value)}
                    placeholder="Juan"
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">Apellido</label>
                  <input
                    type="text"
                    value={inviteLastName}
                    onChange={(e) => setInviteLastName(e.target.value)}
                    placeholder="Pérez"
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">Rol de Acceso</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                >
                  <option value="member">Operador (Monitoreo & Acciones)</option>
                  <option value="admin">Administrador (Control total de la Organización)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-base">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main rounded-xl border border-border-base hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-accent-green text-black rounded-xl hover:bg-accent-green-glow transition-colors"
                >
                  {inviteMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  <span>Enviar Invitación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
