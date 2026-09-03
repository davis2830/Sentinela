import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import ConfirmDelete from '../components/common/ConfirmDelete';
import {
  User as UserIcon,
  Lock,
  Building,
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
  Globe2,
  X,
  RefreshCw,
  Clock,
} from 'lucide-react';

interface APITokenItem {
  id: string;
  name: string;
  token: string;
  created_at: string;
  last_used_at: string | null;
}

type ProfileTab = 'personal' | 'security' | 'organization' | 'tokens';

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
];

const LOCALES = [
  { value: 'es-GT', label: 'Español (Guatemala)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'en-US', label: 'English (US)' },
];

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');

  // Form states for Personal Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for Security / Password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityMsg, setSecurityMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for Organization
  const [orgName, setOrgName] = useState('');
  const [orgTimezone, setOrgTimezone] = useState('UTC');
  const [orgLocale, setOrgLocale] = useState('es-GT');
  const [orgMsg, setOrgMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Token Modal & Copy states
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenNameInput, setTokenNameInput] = useState('');
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [deleteTokenTarget, setDeleteTokenTarget] = useState<APITokenItem | null>(null);

  // 1. Fetch current user & organization info
  const { data: meData, isLoading: isLoadingMe } = useQuery({
    queryKey: ['auth-me-profile'],
    queryFn: async () => {
      const res = await api.get('auth/me/');
      return res.data?.data;
    },
  });

  useEffect(() => {
    if (meData) {
      setFirstName(meData.first_name || '');
      setLastName(meData.last_name || '');
      setEmail(meData.email || '');
      if (meData.organization) {
        setOrgName(meData.organization.name || '');
        setOrgTimezone(meData.organization.timezone || 'UTC');
        setOrgLocale(meData.organization.locale || 'es-GT');
      }
    }
  }, [meData]);

  // 2. Fetch API tokens
  const { data: apiTokens, isLoading: isLoadingTokens } = useQuery({
    queryKey: ['user-api-tokens'],
    queryFn: async () => {
      const res = await api.get('auth/api-tokens/');
      return (res.data?.data || []) as APITokenItem[];
    },
  });

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch('auth/me/', {
        first_name: firstName,
        last_name: lastName,
        email,
      });
      return res.data?.data;
    },
    onSuccess: (updatedUser) => {
      if (updatedUser) {
        updateUser(updatedUser);
      }
      queryClient.invalidateQueries({ queryKey: ['auth-me-profile'] });
      setProfileMsg({ type: 'success', text: 'Perfil de usuario actualizado exitosamente.' });
      setTimeout(() => setProfileMsg(null), 4000);
    },
    onError: (err: any) => {
      setProfileMsg({
        type: 'error',
        text: err.response?.data?.message || 'Error al actualizar el perfil.',
      });
    },
  });

  // Password change mutation
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
      setSecurityMsg({ type: 'success', text: 'Contraseña actualizada correctamente.' });
      setTimeout(() => setSecurityMsg(null), 4000);
    },
    onError: (err: any) => {
      setSecurityMsg({
        type: 'error',
        text: err.response?.data?.message || 'Error al cambiar la contraseña. Verifica la contraseña actual.',
      });
    },
  });

  // Organization update mutation
  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      if (!meData?.organization?.id) return;
      await api.patch(`organizations/${meData.organization.id}/`, {
        name: orgName,
        timezone: orgTimezone,
        locale: orgLocale,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-me-profile'] });
      setOrgMsg({ type: 'success', text: 'Configuración de organización guardada.' });
      setTimeout(() => setOrgMsg(null), 4000);
    },
    onError: (err: any) => {
      setOrgMsg({
        type: 'error',
        text: err.response?.data?.message || 'Error al actualizar la organización.',
      });
    },
  });

  // API Token mutations
  const createTokenMutation = useMutation({
    mutationFn: async (name: string) => {
      await api.post('auth/api-tokens/', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-api-tokens'] });
      setShowTokenModal(false);
      setTokenNameInput('');
    },
  });

  const deleteTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      await api.delete(`auth/api-tokens/${tokenId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-api-tokens'] });
      setDeleteTokenTarget(null);
    },
  });

  const handleCopyToken = (tokenId: string, tokenStr: string) => {
    navigator.clipboard.writeText(tokenStr);
    setCopiedTokenId(tokenId);
    setTimeout(() => setCopiedTokenId(null), 2500);
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-accent-green" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
          <UserIcon className="text-accent-green" size={28} />
          Perfil de Usuario & Configuración
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Administra tus datos personales, credenciales de seguridad, organización y tokens de acceso
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border-base mb-8 overflow-x-auto">
        <button
          onClick={() => setActiveTab('personal')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'personal'
              ? 'border-accent-green text-accent-green font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <UserIcon size={18} />
          Datos Personales
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'security'
              ? 'border-accent-green text-accent-green font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Lock size={18} />
          Seguridad & Contraseña
        </button>
        <button
          onClick={() => setActiveTab('organization')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'organization'
              ? 'border-accent-green text-accent-green font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Building size={18} />
          Organización
        </button>
        <button
          onClick={() => setActiveTab('tokens')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'tokens'
              ? 'border-accent-green text-accent-green font-bold'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Key size={18} />
          API Tokens de Integración ({apiTokens?.length || 0})
        </button>
      </div>

      {/* TAB 1: PERSONAL INFO */}
      {activeTab === 'personal' && (
        <div className="bg-bg-card border border-border-base rounded-xl p-6 sm:p-8 shadow-xl max-w-2xl">
          <h2 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2 border-b border-border-base pb-3">
            <UserIcon size={20} className="text-accent-green" />
            Información del Perfil
          </h2>

          {profileMsg && (
            <div
              className={`p-4 rounded-xl mb-6 flex items-center gap-3 font-mono text-xs border ${
                profileMsg.type === 'success'
                  ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                  : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
              }`}
            >
              {profileMsg.type === 'success' ? (
                <CheckCircle2 size={18} className="shrink-0" />
              ) : (
                <AlertCircle size={18} className="shrink-0" />
              )}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfileMutation.mutate();
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Nombre (First Name)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Steed"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Apellido (Last Name)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Gálvez"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
              />
            </div>

            <div className="pt-2">
              <span className="block text-xs font-semibold text-text-dim mb-1">
                Rol en la Plataforma
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs font-semibold rounded-full">
                <ShieldCheck size={14} />
                {meData?.is_staff ? 'Administrador Plataforma' : 'Usuario Plataforma'}
              </span>
            </div>

            <div className="pt-4 border-t border-border-base flex justify-end">
              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                Guardar Perfil
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: SECURITY / PASSWORD */}
      {activeTab === 'security' && (
        <div className="bg-bg-card border border-border-base rounded-xl p-6 sm:p-8 shadow-xl max-w-2xl">
          <h2 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2 border-b border-border-base pb-3">
            <Lock size={20} className="text-accent-green" />
            Cambiar Contraseña
          </h2>

          {securityMsg && (
            <div
              className={`p-4 rounded-xl mb-6 flex items-center gap-3 font-mono text-xs border ${
                securityMsg.type === 'success'
                  ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                  : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
              }`}
            >
              {securityMsg.type === 'success' ? (
                <CheckCircle2 size={18} className="shrink-0" />
              ) : (
                <AlertCircle size={18} className="shrink-0" />
              )}
              <span>{securityMsg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Contraseña Actual
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Nueva Contraseña
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
              />
              <p className="text-xs text-text-dim mt-1 font-mono">Mínimo 8 caracteres.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Confirmar Nueva Contraseña
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
              />
            </div>

            <div className="pt-4 border-t border-border-base flex justify-end">
              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {changePasswordMutation.isPending ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                Actualizar Contraseña
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ORGANIZATION SETTINGS */}
      {activeTab === 'organization' && (
        <div className="bg-bg-card border border-border-base rounded-xl p-6 sm:p-8 shadow-xl max-w-2xl">
          <h2 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2 border-b border-border-base pb-3">
            <Building size={20} className="text-accent-green" />
            Configuración de la Organización
          </h2>

          {orgMsg && (
            <div
              className={`p-4 rounded-xl mb-6 flex items-center gap-3 font-mono text-xs border ${
                orgMsg.type === 'success'
                  ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                  : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
              }`}
            >
              {orgMsg.type === 'success' ? (
                <CheckCircle2 size={18} className="shrink-0" />
              ) : (
                <AlertCircle size={18} className="shrink-0" />
              )}
              <span>{orgMsg.text}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateOrgMutation.mutate();
            }}
            className="space-y-5"
          >
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Nombre de la Organización
              </label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                  <Clock size={14} /> Zona Horaria
                </label>
                <select
                  value={orgTimezone}
                  onChange={(e) => setOrgTimezone(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                  <Globe2 size={14} /> Idioma / Regionalización
                </label>
                <select
                  value={orgLocale}
                  onChange={(e) => setOrgLocale(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans"
                >
                  {LOCALES.map((loc) => (
                    <option key={loc.value} value={loc.value}>
                      {loc.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-border-base flex justify-end">
              <button
                type="submit"
                disabled={updateOrgMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {updateOrgMutation.isPending ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                Guardar Organización
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: API TOKENS */}
      {activeTab === 'tokens' && (
        <div className="bg-bg-card border border-border-base rounded-xl p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-base pb-4">
            <div>
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <Key size={20} className="text-accent-green" />
                API Tokens de Acceso Programático
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Genera claves secretas para integrar Sentinel con scripts o sistemas externos.
              </p>
            </div>

            <button
              onClick={() => setShowTokenModal(true)}
              className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity"
            >
              <Plus size={18} />
              Generar Nuevo Token
            </button>
          </div>

          {isLoadingTokens ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-accent-green" size={24} />
            </div>
          ) : apiTokens && apiTokens.length > 0 ? (
            <div className="space-y-3 font-mono text-xs">
              {apiTokens.map((t) => (
                <div
                  key={t.id}
                  className="p-4 bg-bg-dark border border-border-base rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-bold text-text-main text-sm">{t.name}</div>
                    <div className="text-text-dim text-[11px] mt-1 flex items-center gap-2">
                      <span>Creado: {new Date(t.created_at).toLocaleDateString('es-ES')}</span>
                      <span>•</span>
                      <span>Último uso: {t.last_used_at ? new Date(t.last_used_at).toLocaleDateString('es-ES') : 'Nunca'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="bg-bg-card border border-border-base px-3 py-1.5 rounded text-accent-green font-bold text-xs truncate max-w-[200px]">
                      {t.token}
                    </div>
                    <button
                      onClick={() => handleCopyToken(t.id, t.token)}
                      className="p-2 border border-border-base rounded text-text-muted hover:text-text-main hover:bg-bg-card-hover transition-colors"
                      title="Copiar token"
                    >
                      {copiedTokenId === t.id ? <Check size={16} className="text-accent-green" /> : <Copy size={16} />}
                    </button>
                    <button
                      onClick={() => setDeleteTokenTarget(t)}
                      className="p-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded transition-colors"
                      title="Revocar token"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-text-dim font-mono text-xs">
              No tienes tokens de API generados. Haz clic en "Generar Nuevo Token" para crear uno.
            </div>
          )}

          {/* Modal to Create Token */}
          {showTokenModal && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
              onClick={() => setShowTokenModal(false)}
            >
              <div
                className="bg-bg-card border border-border-base rounded-xl p-6 w-full max-w-md shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                    <Key size={20} className="text-accent-green" />
                    Generar Nuevo API Token
                  </h2>
                  <button onClick={() => setShowTokenModal(false)} className="text-text-muted hover:text-text-main">
                    <X size={20} />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!tokenNameInput.trim()) return;
                    createTokenMutation.mutate(tokenNameInput.trim());
                  }}
                >
                  <div className="mb-6">
                    <label className="block text-xs font-semibold text-text-muted mb-2">
                      Nombre Descriptivo del Token
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ej. Script Integración Grafana / Deployment Bot"
                      value={tokenNameInput}
                      onChange={(e) => setTokenNameInput(e.target.value)}
                      className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowTokenModal(false)}
                      className="flex-1 py-2.5 border border-border-base rounded-full text-sm text-text-muted hover:bg-bg-dark transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={createTokenMutation.isPending}
                      className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-full text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                      {createTokenMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : 'Generar Key'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Confirm */}
          <ConfirmDelete
            isOpen={!!deleteTokenTarget}
            itemName={deleteTokenTarget?.name || ''}
            isDeleting={deleteTokenMutation.isPending}
            onConfirm={() => deleteTokenTarget && deleteTokenMutation.mutate(deleteTokenTarget.id)}
            onClose={() => setDeleteTokenTarget(null)}
          />
        </div>
      )}
    </div>
  );
}
