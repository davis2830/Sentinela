import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type {
  TeamMember,
  Team,
  InviteMemberPayload,
  CreateDirectUserPayload,
  UpdateUserPayload,
} from '../../types/users';
import {
  X,
  Send,
  UserPlus,
  Edit2,
  Mail,
  Lock,
  User,
  Shield,
  Layers,
  Power,
  Check,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'invite' | 'direct' | 'edit';
  editingMember: TeamMember | null;
  availableTeams: Team[];
  onSubmitInvite: (payload: InviteMemberPayload) => Promise<void>;
  onSubmitDirect: (payload: CreateDirectUserPayload) => Promise<void>;
  onSubmitEdit: (memberId: string, payload: UpdateUserPayload) => Promise<void>;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export default function UserFormModal({
  isOpen,
  onClose,
  mode,
  editingMember,
  availableTeams,
  onSubmitInvite,
  onSubmitDirect,
  onSubmitEdit,
  isLoading,
  errorMessage,
}: UserFormModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('member');
  const [isActive, setIsActive] = useState(true);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  useEffect(() => {
    if (editingMember && mode === 'edit') {
      setEmail(editingMember.email);
      setFirstName(editingMember.first_name || '');
      setLastName(editingMember.last_name || '');
      setRole(editingMember.role || 'member');
      setIsActive(editingMember.is_active);
      setSelectedTeamIds((editingMember.teams || []).map((t) => t.id));
    } else {
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setRole('member');
      setIsActive(true);
      setSelectedTeamIds([]);
    }
  }, [editingMember, mode, isOpen]);

  if (!isOpen) return null;

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'edit' && editingMember) {
      await onSubmitEdit(editingMember.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role,
        is_active: isActive,
        team_ids: selectedTeamIds,
      });
    } else if (mode === 'invite') {
      await onSubmitInvite({
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role,
        team_ids: selectedTeamIds,
      });
    } else {
      await onSubmitDirect({
        email: email.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role,
        is_active: isActive,
        team_ids: selectedTeamIds,
      });
    }
  };

  const titleText =
    mode === 'edit'
      ? 'Editar Integrante'
      : mode === 'invite'
      ? 'Invitar Integrante por Correo'
      : 'Crear Usuario Directo';

  const subtitleText =
    mode === 'edit'
      ? 'Modifica los datos, privilegios de acceso y cuadrillas asignadas'
      : mode === 'invite'
      ? 'Envía un enlace seguro con token temporal para registro corporativo'
      : 'Genera credenciales de acceso inmediato sin requerir correo saliente';

  const content = (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-base shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-green/10 border border-accent-green/20 text-accent-green flex items-center justify-center">
              {mode === 'edit' ? (
                <Edit2 size={20} />
              ) : mode === 'invite' ? (
                <Send size={20} />
              ) : (
                <UserPlus size={20} />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-main">{titleText}</h2>
              <p className="text-xs text-text-dim mt-0.5">{subtitleText}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-text-dim hover:text-text-main rounded-xl hover:bg-bg-card-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="m-6 mb-0 p-3.5 rounded-2xl bg-accent-red/10 border border-accent-red/20 text-accent-red text-xs flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Error al procesar la solicitud:</span>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
              <Mail size={13} className="text-accent-blue" />
              Correo Electrónico Corporativo <span className="text-accent-red">*</span>
            </label>
            <input
              type="email"
              required
              disabled={mode === 'edit'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operador@tuempresa.com"
              className={`w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main font-mono placeholder:text-text-dim focus:outline-none focus:border-accent-green ${
                mode === 'edit' ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            />
          </div>

          {/* Password (only in direct mode) */}
          {mode === 'direct' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <Lock size={13} className="text-accent-purple" />
                Contraseña Temporal de Acceso <span className="text-accent-red">*</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main font-mono placeholder:text-text-dim focus:outline-none focus:border-accent-green"
              />
            </div>
          )}

          {/* First & Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <User size={13} className="text-text-dim" />
                Nombre
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Juan"
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <User size={13} className="text-text-dim" />
                Apellidos
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez"
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
              />
            </div>
          </div>

          {/* Role selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
              <Shield size={13} className="text-accent-purple" />
              Rol de Seguridad en la Plataforma
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: 'admin',
                  name: 'Administrador',
                  icon: <ShieldCheck size={14} className="text-accent-purple" />,
                },
                {
                  id: 'operator',
                  name: 'Operador',
                  icon: <UserCheck size={14} className="text-accent-blue" />,
                },
                {
                  id: 'viewer',
                  name: 'Visualizador',
                  icon: <Shield size={14} className="text-accent-green" />,
                },
              ].map((r) => {
                const isSelected = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                      isSelected
                        ? 'bg-accent-purple/10 border-accent-purple ring-1 ring-accent-purple/30'
                        : 'bg-bg-dark border-border-base hover:border-border-accent'
                    }`}
                  >
                    {r.icon}
                    <span className="text-xs font-semibold text-text-main">{r.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Teams assignment */}
          {availableTeams.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <Layers size={13} className="text-accent-blue" />
                  Cuadrillas / Equipos de Trabajo
                </label>
                <span className="text-[10px] font-mono text-text-dim">
                  {selectedTeamIds.length} seleccionados
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {availableTeams.map((team) => {
                  const isChecked = selectedTeamIds.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => toggleTeam(team.id)}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isChecked
                          ? 'bg-bg-card border-accent-blue shadow-xs'
                          : 'bg-bg-dark border-border-base hover:border-border-accent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: team.color || '#3B82F6' }}
                        />
                        <span className="text-xs font-medium text-text-main truncate">
                          {team.name}
                        </span>
                      </div>
                      {isChecked && <Check size={12} className="text-accent-blue shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active status switch (in direct & edit modes) */}
          {(mode === 'direct' || mode === 'edit') && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-bg-dark border border-border-base">
              <div className="flex items-center gap-2.5">
                <Power size={14} className={isActive ? 'text-accent-green' : 'text-text-dim'} />
                <div>
                  <p className="text-xs font-semibold text-text-main">Habilitar Cuenta Activa</p>
                  <p className="text-[10px] text-text-dim">
                    Permite al usuario autenticarse de inmediato en la plataforma.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isActive ? 'bg-accent-green' : 'bg-border-accent'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-black shadow-lg transition duration-200 ease-in-out ${
                    isActive ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-border-base flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-text-dim hover:text-text-main transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold bg-accent-green text-black hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Procesando...
                </>
              ) : mode === 'edit' ? (
                <>
                  <Edit2 size={13} /> Guardar Cambios
                </>
              ) : mode === 'invite' ? (
                <>
                  <Send size={13} /> Enviar Invitación
                </>
              ) : (
                <>
                  <UserPlus size={13} /> Crear Usuario
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
