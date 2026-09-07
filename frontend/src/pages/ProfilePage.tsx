import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import ConfirmDelete from '../components/common/ConfirmDelete';
import NOCPageHeader from '../components/common/noc/NOCPageHeader';
import PasswordStrengthMeter from '../components/profile/PasswordStrengthMeter';
import CreateTokenModal from '../components/profile/CreateTokenModal';
import UserActivityTab from '../components/profile/UserActivityTab';
import type { APITokenItem } from '../types';
import {
  User as UserIcon,
  Lock,
  Key,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Plus,
  Trash2,
  ShieldCheck,
  RefreshCw,
  Clock,
  Sliders,
  Volume2,
  Users,
  Crown,
  Eye,
  EyeOff,
  LogOut,
  Laptop,
  Activity,
  ShieldAlert,
  Phone,
  Mail,
} from 'lucide-react';

type ProfileTab = 'personal' | 'security' | 'preferences' | 'tokens' | 'activity';

const TIMEZONES = [
  'America/Guatemala',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/New_York',
  'UTC',
  'Europe/Madrid',
  'Asia/Tokyo',
];

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);
  const logout = useAuthStore((state) => state.logout);
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');

  // Personal Info form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Security / Password form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securityMsg, setSecurityMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [revokeSessionsMsg, setRevokeSessionsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Preferences form
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [userTimezone, setUserTimezone] = useState('America/Guatemala');
  const [preferencesMsg, setPreferencesMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live time ticker for timezone preview
  const [liveTime, setLiveTime] = useState('');

  // Tokens state
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [revealedTokenIds, setRevealedTokenIds] = useState<Set<string>>(new Set());
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [deleteTokenTarget, setDeleteTokenTarget] = useState<APITokenItem | null>(null);

  // 1. Fetch current user data from /api/v1/auth/me/
  const { data: meData, isLoading: isLoadingMe, refetch: refetchMe } = useQuery({
    queryKey: ['auth-me-profile'],
    queryFn: async () => {
      const res = await api.get('auth/me/');
      return res.data?.data;
    },
  });

  // Populate form states when meData arrives
  useEffect(() => {
    if (meData) {
      setFirstName(meData.first_name || '');
      setLastName(meData.last_name || '');
      setEmail(meData.email || '');
      setPhoneNumber(meData.phone_number || '');
      setUserTimezone(meData.timezone || 'America/Guatemala');

      const prefs = meData.notification_preferences || {};
      setSoundAlerts(prefs.sound_alerts !== false);
    }
  }, [meData]);

  // Live clock ticker
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('es-ES', {
          timeZone: userTimezone || 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short',
        }).format(now);
        setLiveTime(formatted);
      } catch {
        setLiveTime(new Date().toLocaleTimeString());
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [userTimezone]);

  // 2. Fetch API tokens
  const { data: apiTokens = [], isLoading: isLoadingTokens } = useQuery({
    queryKey: ['user-api-tokens'],
    queryFn: async () => {
      const res = await api.get('auth/api-tokens/');
      return (res.data?.data || []) as APITokenItem[];
    },
  });

  // Dual-tone Web Audio API synthesized chime
  const playNOCChime = () => {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      const now = ctx.currentTime;

      // Note 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2: 880 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1);
      gain2.gain.setValueAtTime(0.18, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn('Web Audio API not permitted or supported:', e);
    }
  };

  // Mutation: Update Personal Info
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch('auth/me/', {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phoneNumber,
      });
      return res.data?.data;
    },
    onSuccess: (updatedUser) => {
      if (updatedUser) {
        updateUser(updatedUser);
      }
      queryClient.invalidateQueries({ queryKey: ['auth-me-profile'] });
      setProfileMsg({ type: 'success', text: 'Datos personales y contacto de guardia actualizados correctamente.' });
      setTimeout(() => setProfileMsg(null), 4500);
    },
    onError: (err: any) => {
      setProfileMsg({
        type: 'error',
        text: err.response?.data?.message || 'Error al actualizar el perfil.',
      });
    },
  });

  // Mutation: Change Password
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      await api.post('auth/password/change/', {
        old_password: oldPassword,
        new_password: newPassword,
      });
    },
    onSuccess: () => {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityMsg({ type: 'success', text: 'Contraseña actualizada correctamente con cifrado seguro.' });
      setTimeout(() => setSecurityMsg(null), 4500);
    },
    onError: (err: any) => {
      setSecurityMsg({
        type: 'error',
        text: err.response?.data?.message || 'Error al cambiar contraseña. Verifica tu contraseña actual.',
      });
    },
  });

  // Mutation: Revoke Other Active Sessions
  const revokeSessionsMutation = useMutation({
    mutationFn: async () => {
      await api.post('auth/revoke-sessions/');
    },
    onSuccess: () => {
      setRevokeSessionsMsg({
        type: 'success',
        text: 'Se han revocado exitosamente las sesiones remotas y tokens activos en otros dispositivos.',
      });
      setTimeout(() => setRevokeSessionsMsg(null), 5000);
    },
    onError: (err: any) => {
      setRevokeSessionsMsg({
        type: 'error',
        text: err.response?.data?.message || 'Error al revocar sesiones remotas.',
      });
    },
  });

  // Mutation: Update Operational Preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch('auth/me/', {
        timezone: userTimezone,
        notification_preferences: {
          sound_alerts: soundAlerts,
        },
      });
      return res.data?.data;
    },
    onSuccess: (updatedUser) => {
      if (updatedUser) {
        updateUser(updatedUser);
      }
      queryClient.invalidateQueries({ queryKey: ['auth-me-profile'] });
      setPreferencesMsg({ type: 'success', text: 'Preferencias operativas y huso horario guardados exitosamente.' });
      setTimeout(() => setPreferencesMsg(null), 4500);
    },
    onError: (err: any) => {
      setPreferencesMsg({
        type: 'error',
        text: err.response?.data?.message || 'Error al guardar las preferencias.',
      });
    },
  });

  // Mutation: Create API Token
  const createTokenMutation = useMutation({
    mutationFn: async (payload: { name: string; scope: 'read' | 'full'; expires_in_days: number | null }) => {
      await api.post('auth/api-tokens/', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-api-tokens'] });
      setShowTokenModal(false);
    },
  });

  // Mutation: Delete API Token
  const deleteTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      await api.delete(`auth/api-tokens/${tokenId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-api-tokens'] });
      setDeleteTokenTarget(null);
    },
  });

  // Helper: Copy Token with feedback
  const handleCopyToken = (tokenId: string, tokenStr: string) => {
    navigator.clipboard.writeText(tokenStr);
    setCopiedTokenId(tokenId);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  // Helper: Toggle unmasking
  const toggleRevealToken = (tokenId: string) => {
    setRevealedTokenIds((prev) => {
      const next = new Set(prev);
      if (next.has(tokenId)) {
        next.delete(tokenId);
      } else {
        next.add(tokenId);
      }
      return next;
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setSecurityMsg({ type: 'error', text: 'Las nuevas contraseñas no coinciden.' });
      return;
    }
    if (newPassword.length < 8) {
      setSecurityMsg({ type: 'error', text: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    changePasswordMutation.mutate();
  };

  if (isLoadingMe) {
    return (
      <div className="flex items-center justify-center py-28 text-text-muted">
        <Loader2 className="animate-spin text-accent-green mr-3" size={28} />
        <span className="font-mono text-xs">Cargando perfil operativo...</span>
      </div>
    );
  }

  const userInitials = `${(firstName?.[0] || 'U').toUpperCase()}${(lastName?.[0] || '').toUpperCase()}`;
  const isAdmin = meData?.role === 'admin' || meData?.is_staff;
  const isTeamLeadInAny = meData?.teams?.some((t: any) => t.is_lead);

  return (
    <div className="space-y-6 w-full pb-12 animate-in fade-in duration-300">
      {/* 1. Header con NOCPageHeader */}
      <NOCPageHeader
        title="Perfil de Usuario"
        badgeText="IDENTIDAD & SEGURIDAD"
        description="Gestión de credenciales, cuadrillas operativas, preferencias del NOC y tokens de integración"
        icon={<UserIcon size={26} className="text-accent-green" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetchMe()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border-base bg-bg-card hover:bg-bg-card-hover text-text-dim hover:text-text-main text-xs transition-colors cursor-pointer"
              title="Refrescar datos del perfil"
            >
              <RefreshCw size={13} />
              <span>Sincronizar</span>
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-accent-red/30 bg-accent-red/10 text-accent-red hover:bg-accent-red/20 text-xs font-semibold transition-colors cursor-pointer"
              title="Cerrar sesión en este dispositivo"
            >
              <LogOut size={13} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        }
      />

      {/* 2. Selector de 5 Pestañas Temáticas */}
      <div className="flex items-center gap-1.5 p-1.5 bg-bg-card border border-border-base rounded-2xl overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('personal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'personal'
              ? 'bg-accent-green/15 text-accent-green border border-accent-green/30 shadow-xs'
              : 'text-text-muted hover:text-text-main hover:bg-bg-dark'
          }`}
        >
          <UserIcon size={14} />
          <span>Datos Personales & Cuadrillas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'security'
              ? 'bg-accent-green/15 text-accent-green border border-accent-green/30 shadow-xs'
              : 'text-text-muted hover:text-text-main hover:bg-bg-dark'
          }`}
        >
          <Lock size={14} />
          <span>Seguridad & Contraseña</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'preferences'
              ? 'bg-accent-green/15 text-accent-green border border-accent-green/30 shadow-xs'
              : 'text-text-muted hover:text-text-main hover:bg-bg-dark'
          }`}
        >
          <Sliders size={14} />
          <span>Preferencias Operativas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tokens')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'tokens'
              ? 'bg-accent-green/15 text-accent-green border border-accent-green/30 shadow-xs'
              : 'text-text-muted hover:text-text-main hover:bg-bg-dark'
          }`}
        >
          <Key size={14} />
          <span>API Tokens ({apiTokens.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'activity'
              ? 'bg-accent-green/15 text-accent-green border border-accent-green/30 shadow-xs'
              : 'text-text-muted hover:text-text-main hover:bg-bg-dark'
          }`}
        >
          <Activity size={14} />
          <span>Bitácora de Actividad</span>
        </button>
      </div>

      {/* 3. CONTENIDO DE PESTAÑAS */}

      {/* TAB 1: DATOS PERSONALES & CUADRILLAS */}
      {activeTab === 'personal' && (
        <div className="space-y-6">
          {/* Banner Horizontal Compacto del Usuario */}
          <div className="bg-bg-card border border-border-base rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-accent-green/20 to-accent-blue/20 border-2 border-accent-green/30 flex items-center justify-center text-xl font-black text-accent-green font-mono shadow-md shrink-0">
                {userInitials}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-text-main">
                    {firstName} {lastName}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      isAdmin
                        ? 'bg-accent-purple/10 border-accent-purple/30 text-accent-purple'
                        : 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue'
                    }`}
                  >
                    <ShieldCheck size={12} />
                    {isAdmin ? 'Administrador NOC' : 'Operador de Turno'}
                  </span>
                  {isTeamLeadInAny && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      <Crown size={12} />
                      Team Lead
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-dim font-mono mt-1">{email}</p>
              </div>
            </div>

            <div className="flex items-center gap-5 sm:gap-7 text-xs text-text-dim border-t md:border-t-0 md:border-l border-border-base pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-start">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-text-dim block">
                  Organización
                </span>
                <span className="text-xs font-semibold text-text-main mt-0.5 block truncate max-w-[130px]">
                  {meData?.organization?.name || 'Sentinel NOC'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-text-dim block">
                  Huso Horario
                </span>
                <span className="text-xs font-mono text-text-main mt-0.5 block truncate max-w-[140px]">
                  {userTimezone}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-text-dim block">
                  Estado
                </span>
                <span className="text-xs font-semibold text-accent-green mt-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                  {meData?.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>

          {/* Formulario Unificado de Información Personal & Contacto */}
          <div className="bg-bg-card border border-border-base rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-bold text-text-main flex items-center gap-2">
                <UserIcon size={18} className="text-accent-green" />
                Información Personal & Contacto Operativo
              </h2>
              <p className="text-xs text-text-dim mt-0.5">
                Datos identificatorios utilizados en la asignación de incidentes y bitácoras del sistema
              </p>
            </div>

            {profileMsg && (
              <div
                className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs border font-sans ${
                  profileMsg.type === 'success'
                    ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                    : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                }`}
              >
                {profileMsg.type === 'success' ? (
                  <CheckCircle2 size={16} className="shrink-0" />
                ) : (
                  <AlertCircle size={16} className="shrink-0" />
                )}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateProfileMutation.mutate();
              }}
              className="space-y-6 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Nombre <span className="text-accent-red">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Apellido <span className="text-accent-red">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1.5">
                    <Mail size={13} /> Correo Electrónico <span className="text-accent-red">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1.5">
                    <Phone size={13} className="text-accent-yellow" /> Teléfono / Pager On-Call (Guardia)
                  </label>
                  <input
                    type="tel"
                    placeholder="ej. +502 5555-1234 / Ext 402"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                  />
                  <p className="text-[11px] text-text-dim mt-1">
                    Número de escalación para avisos telefónicos o guardias 24/7 de incidentes P1.
                  </p>
                </div>
              </div>

              {/* Sección Mis Cuadrillas de Trabajo */}
              <div className="pt-4 border-t border-border-base">
                <label className="block text-xs font-semibold text-text-muted mb-2 flex items-center gap-1.5">
                  <Users size={14} className="text-accent-blue" />
                  Mis Cuadrillas de Trabajo Asignadas
                </label>

                {meData?.teams && meData.teams.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {meData.teams.map((t: any) => (
                      <div
                        key={t.id}
                        className="p-3 bg-bg-dark border border-border-base rounded-xl flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: t.color || '#10b981' }}
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-text-main text-xs truncate block">
                              {t.name}
                            </span>
                            <span className="text-[10px] text-text-dim font-mono">
                              ID: {t.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>

                        {t.is_lead ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                            <Crown size={11} />
                            Team Lead
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-bg-card border border-border-base text-text-dim shrink-0">
                            Miembro
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3.5 bg-bg-dark border border-border-base rounded-xl text-text-dim text-xs">
                    No estás asignado a ninguna cuadrilla de guardia actualmente. Los administradores pueden asignarte en el módulo de Gestión de Cuadrillas.
                  </div>
                )}
              </div>

              {/* Matriz de Permisos RBAC Explicativa */}
              <div className="pt-4 border-t border-border-base">
                <label className="block text-xs font-semibold text-text-muted mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-accent-purple" />
                  Matriz de Permisos del Rol ({isAdmin ? 'Administrador' : 'Operador'})
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-sans">
                  {[
                    { label: 'Monitoreo de Red & Uptime', desc: 'Ver métricas, gráficos e histórico', granted: true },
                    { label: 'Gestión de Incidentes & RCA', desc: 'Crear, investigar y documentar post-mortem', granted: true },
                    { label: 'Reconocimiento de Alertas', desc: 'Acknowledge, silenciar y resolver', granted: true },
                    { label: 'API Tokens Personales', desc: 'Generación y revocación de credenciales', granted: true },
                    { label: 'Configuración de Reglas de Alerta', desc: 'Crear y editar umbrales de detección', granted: isAdmin },
                    { label: 'Gestión de Cuadrillas & Usuarios', desc: 'Crear equipos y asignar roles', granted: isAdmin },
                  ].map((perm, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                        perm.granted
                          ? 'bg-bg-dark/80 border-border-base text-text-main'
                          : 'bg-bg-dark/30 border-border-base/40 text-text-dim opacity-60'
                      }`}
                    >
                      <CheckCircle2
                        size={14}
                        className={`shrink-0 mt-0.5 ${perm.granted ? 'text-accent-green' : 'text-text-dim'}`}
                      />
                      <div>
                        <div className="font-semibold">{perm.label}</div>
                        <div className="text-[10px] text-text-dim mt-0.5">{perm.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border-base flex justify-end">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-black font-bold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 disabled:opacity-50 cursor-pointer"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="animate-spin" size={15} />
                  ) : (
                    <Save size={15} />
                  )}
                  Guardar Cambios de Perfil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: SEGURIDAD, CONTRASEÑA & SESIONES */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Formulario de Cambio de Contraseña */}
          <div className="lg:col-span-2 bg-bg-card border border-border-base rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-bold text-text-main flex items-center gap-2">
                <Lock size={18} className="text-accent-green" />
                Actualización de Contraseña
              </h2>
              <p className="text-xs text-text-dim mt-0.5">
                Ingresa tu contraseña actual y define una nueva clave con alta entropía criptográfica
              </p>
            </div>

            {securityMsg && (
              <div
                className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs border font-sans ${
                  securityMsg.type === 'success'
                    ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                    : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                }`}
              >
                {securityMsg.type === 'success' ? (
                  <CheckCircle2 size={16} className="shrink-0" />
                ) : (
                  <AlertCircle size={16} className="shrink-0" />
                )}
                <span>{securityMsg.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
              {/* Old Password */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Contraseña Actual <span className="text-accent-red">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main cursor-pointer"
                  >
                    {showOldPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Nueva Contraseña <span className="text-accent-red">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {/* Reactive Strength Meter */}
                <PasswordStrengthMeter password={newPassword} />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Confirmar Nueva Contraseña <span className="text-accent-red">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-border-base flex justify-end">
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending || !newPassword || !oldPassword}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-black font-bold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 disabled:opacity-50 cursor-pointer"
                >
                  {changePasswordMutation.isPending ? (
                    <Loader2 className="animate-spin" size={15} />
                  ) : (
                    <Save size={15} />
                  )}
                  Actualizar Contraseña
                </button>
              </div>
            </form>
          </div>

          {/* Tarjeta de Sesiones Activas & Revocación Remota */}
          <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-sm space-y-5">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                  <Laptop size={18} className="text-accent-blue" />
                  Sesión & Dispositivos
                </h3>
                <p className="text-xs text-text-dim mt-0.5">
                  Control de sesiones abiertas y tokens de refresco
                </p>
              </div>

              {revokeSessionsMsg && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-2 text-xs border ${
                    revokeSessionsMsg.type === 'success'
                      ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                      : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                  }`}
                >
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{revokeSessionsMsg.text}</span>
                </div>
              )}

              <div className="p-3.5 bg-bg-dark border border-border-base rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text-main flex items-center gap-1.5">
                    <Laptop size={13} className="text-accent-green" /> Este Navegador
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-green/10 text-accent-green border border-accent-green/30">
                    En línea
                  </span>
                </div>
                <div className="text-[11px] text-text-dim font-mono">
                  Último login:{' '}
                  {meData?.last_login
                    ? new Date(meData.last_login).toLocaleString('es-ES')
                    : 'Sesión activa'}
                </div>
              </div>

              <div className="p-3 bg-bg-dark/60 border border-border-base/70 rounded-xl text-[11px] text-text-dim leading-relaxed">
                Si detectas actividad inusual o utilizaste una computadora compartida, puedes invalidar de inmediato todas las sesiones remotas fuera de este navegador.
              </div>
            </div>

            <div className="pt-2 border-t border-border-base">
              <button
                type="button"
                onClick={() => revokeSessionsMutation.mutate()}
                disabled={revokeSessionsMutation.isPending}
                className="w-full py-2.5 px-4 rounded-full border border-accent-red/40 bg-accent-red/10 text-accent-red hover:bg-accent-red/20 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {revokeSessionsMutation.isPending ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <ShieldAlert size={14} />
                )}
                Cerrar Otras Sesiones Remotas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PREFERENCIAS OPERATIVAS */}
      {activeTab === 'preferences' && (
        <div className="bg-bg-card border border-border-base rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-text-main flex items-center gap-2">
              <Sliders size={18} className="text-accent-green" />
              Preferencias Operativas del Operador
            </h2>
            <p className="text-xs text-text-dim mt-0.5">
              Personaliza el comportamiento sonoro de alertas de consola y el huso horario de visualización del NOC
            </p>
          </div>

          {preferencesMsg && (
            <div
              className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs border font-sans ${
                preferencesMsg.type === 'success'
                  ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                  : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
              }`}
            >
              {preferencesMsg.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <AlertCircle size={16} className="shrink-0" />
              )}
              <span>{preferencesMsg.text}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updatePreferencesMutation.mutate();
            }}
            className="space-y-6 text-xs"
          >
            {/* 1. Alerta Sonora del NOC */}
            <div className="p-4 bg-bg-dark border border-border-base rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center text-accent-green shrink-0">
                  <Volume2 size={20} />
                </div>
                <div>
                  <div className="font-bold text-sm text-text-main flex items-center gap-2">
                    Sonido de Alerta NOC (Audio Chime)
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-accent-green/10 text-accent-green border border-accent-green/30">
                      Sintetizador Web Audio
                    </span>
                  </div>
                  <p className="text-xs text-text-dim mt-1 leading-relaxed max-w-lg">
                    Emite un tono acústico dual-tone en el navegador cuando se detecten caídas de servicio o incidentes críticos mientras tienes la consola abierta.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={playNOCChime}
                  className="px-3 py-1.5 rounded-full border border-border-base bg-bg-card hover:bg-bg-card-hover text-text-main text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Reproducir muestra de sonido"
                >
                  <Volume2 size={13} className="text-accent-green" />
                  Probar Tono
                </button>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soundAlerts}
                    onChange={(e) => setSoundAlerts(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-border-base peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-green"></div>
                </label>
              </div>
            </div>

            {/* 3. Huso Horario Personal con Reloj en Vivo */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-text-muted flex items-center gap-1.5">
                <Clock size={14} className="text-accent-blue" />
                Huso Horario Personal del Operador
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <select
                    value={userTimezone}
                    onChange={(e) => setUserTimezone(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-text-dim mt-1.5">
                    Se utilizará para proyectar gráficos, líneas de tiempo y bitácoras en tu zona local.
                  </p>
                </div>

                <div className="bg-bg-dark border border-border-base rounded-xl p-3 flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] text-text-dim font-mono">Reloj en Vivo ({userTimezone}):</span>
                  <span className="text-base font-bold font-mono text-accent-green mt-0.5">
                    {liveTime || '--:--:--'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border-base flex justify-end">
              <button
                type="submit"
                disabled={updatePreferencesMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-black font-bold rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 disabled:opacity-50 cursor-pointer"
              >
                {updatePreferencesMutation.isPending ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <Save size={15} />
                )}
                Guardar Preferencias Operativas
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: API TOKENS */}
      {activeTab === 'tokens' && (
        <div className="bg-bg-card border border-border-base rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-base pb-4">
            <div>
              <h2 className="text-base font-bold text-text-main flex items-center gap-2">
                <Key size={18} className="text-accent-yellow" />
                API Tokens de Acceso Programático
              </h2>
              <p className="text-xs text-text-dim mt-0.5">
                Credenciales secretas para integrar scripts de monitoreo, bots o exportadores de métricas
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowTokenModal(true)}
              className="flex items-center gap-2 bg-accent-green text-black font-bold px-4 py-2 rounded-full text-xs hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
            >
              <Plus size={15} />
              Generar Nuevo Token
            </button>
          </div>

          {isLoadingTokens ? (
            <div className="flex items-center justify-center py-16 text-text-dim font-mono text-xs">
              <RefreshCw className="animate-spin text-accent-green mr-2" size={20} />
              Cargando API tokens...
            </div>
          ) : apiTokens.length > 0 ? (
            <div className="space-y-3 font-sans text-xs">
              {apiTokens.map((t) => {
                const isRevealed = revealedTokenIds.has(t.id);
                const isCopied = copiedTokenId === t.id;
                const maskedToken = isRevealed
                  ? t.token
                  : `${t.token.slice(0, 4)}••••••••••••••••${t.token.slice(-4)}`;

                return (
                  <div
                    key={t.id}
                    className="p-4 bg-bg-dark border border-border-base rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-border-accent"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-text-main text-sm">{t.name}</span>

                        {/* Scope Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            t.scope === 'read'
                              ? 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue'
                              : 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                          }`}
                        >
                          {t.scope === 'read' ? 'Solo Lectura' : 'Full Access'}
                        </span>

                        {/* Expiry Badge */}
                        {t.is_expired ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-red/10 border border-accent-red/30 text-accent-red">
                            Expirado
                          </span>
                        ) : t.expires_at ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            Vence:{' '}
                            {new Date(t.expires_at).toLocaleDateString('es-ES', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-bg-card border border-border-base text-text-dim">
                            Permanente
                          </span>
                        )}
                      </div>

                      <div className="text-text-dim text-[11px] flex items-center gap-3 font-mono">
                        <span>
                          Creado:{' '}
                          {new Date(t.created_at).toLocaleDateString('es-ES', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span>•</span>
                        <span>
                          Último uso:{' '}
                          {t.last_used_at
                            ? new Date(t.last_used_at).toLocaleDateString('es-ES')
                            : 'Nunca utilizado'}
                        </span>
                      </div>
                    </div>

                    {/* Token String & Quick Actions */}
                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                      <div className="bg-bg-card border border-border-base px-3 py-1.5 rounded-xl font-mono text-xs text-accent-green select-all truncate max-w-[240px]">
                        {maskedToken}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleRevealToken(t.id)}
                        className="p-2 border border-border-base rounded-xl text-text-dim hover:text-text-main hover:bg-bg-card transition-colors cursor-pointer"
                        title={isRevealed ? 'Ocultar token' : 'Revelar token'}
                      >
                        {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyToken(t.id, t.token)}
                        className="p-2 border border-border-base rounded-xl text-text-dim hover:text-text-main hover:bg-bg-card transition-colors cursor-pointer"
                        title="Copiar token"
                      >
                        {isCopied ? (
                          <Check size={15} className="text-accent-green" />
                        ) : (
                          <Copy size={15} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTokenTarget(t)}
                        className="p-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-xl transition-colors cursor-pointer"
                        title="Revocar token"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-14 text-center text-text-dim font-mono text-xs border border-dashed border-border-base rounded-2xl">
              No tienes ningún API Token generado. Haz clic en "Generar Nuevo Token" para crear uno.
            </div>
          )}

          {/* Modal de Creación */}
          <CreateTokenModal
            isOpen={showTokenModal}
            onClose={() => setShowTokenModal(false)}
            onSubmit={async (payload) => {
              await createTokenMutation.mutateAsync(payload);
            }}
            isLoading={createTokenMutation.isPending}
          />

          {/* Modal de Confirmación de Borrado */}
          <ConfirmDelete
            isOpen={!!deleteTokenTarget}
            itemName={deleteTokenTarget?.name || ''}
            isDeleting={deleteTokenMutation.isPending}
            onConfirm={() => deleteTokenTarget && deleteTokenMutation.mutate(deleteTokenTarget.id)}
            onClose={() => setDeleteTokenTarget(null)}
          />
        </div>
      )}

      {/* TAB 5: BITÁCORA DE ACTIVIDAD (AUDIT LOG) */}
      {activeTab === 'activity' && <UserActivityTab userId={meData?.id || ''} />}
    </div>
  );
}
