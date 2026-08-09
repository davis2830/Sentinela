import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import { useAuthStore } from '../store/authStore';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Loader2,
  Check,
  X,
  Shield,
  Lock,
  Search,
  Power,
  Mail,
  Send,
  AlertTriangle,
  Building,
  UserX,
} from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  status_code: 'active' | 'pending' | 'revoked';
  status_label: string;
  date_joined: string;
  last_login?: string | null;
  is_invitation?: boolean;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'invite' | 'direct' | 'edit'>('invite');
  const [editingUser, setEditingUser] = useState<TeamMember | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('member');
  const [isActive, setIsActive] = useState(true);

  // Query Unified Members & Invitations List
  const { data: members, isLoading } = useQuery({
    queryKey: ['org-members-unified'],
    queryFn: async () => {
      const response = await api.get('organizations/members/');
      return (response.data?.data || []) as TeamMember[];
    },
  });

  // Invite via SMTP Magic Link Mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post('organizations/members/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
      closeModal();
    },
  });

  // Create Direct User Mutation
  const createDirectMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post('users/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
      closeModal();
    },
  });

  // Update User Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await api.patch(`users/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
      closeModal();
    },
  });

  // Delete User or Revoke Invitation Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`organizations/members/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members-unified'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al eliminar usuario o revocar invitación.');
    },
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setRole('member');
    setIsActive(true);
    setMode('invite');
  };

  const handleOpenEdit = (u: TeamMember) => {
    setEditingUser(u);
    setMode('edit');
    setEmail(u.email);
    setFirstName(u.first_name || '');
    setLastName(u.last_name || '');
    setRole(u.role || 'member');
    setIsActive(u.is_active);
    setShowModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'edit' && editingUser) {
      updateMutation.mutate({
        id: editingUser.id,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          role,
          is_active: isActive,
        },
      });
    } else if (mode === 'invite') {
      inviteMutation.mutate({
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role,
      });
    } else {
      createDirectMutation.mutate({
        email: email.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role,
        is_active: isActive,
      });
    }
  };

  const handleToggleActive = (u: TeamMember) => {
    if (currentUser?.email === u.email) {
      alert('No puedes desactivar tu propia cuenta actual.');
      return;
    }
    if (u.is_invitation) {
      alert('Esta es una invitación pendiente. Para gestionarla puedes revocar la invitación.');
      return;
    }
    updateMutation.mutate({
      id: u.id,
      data: { is_active: !u.is_active },
    });
  };

  const handleDelete = (u: TeamMember) => {
    if (currentUser?.email === u.email) {
      alert('No puedes eliminar tu propio usuario.');
      return;
    }
    const actionText = u.is_invitation ? 'revocar la invitación pendiente para' : 'eliminar al usuario';
    if (confirm(`¿Estás seguro de que deseas ${actionText} ${u.email}?`)) {
      deleteMutation.mutate(u.id);
    }
  };

  const filteredMembers = (members || []).filter((m) => {
    const q = searchTerm.toLowerCase();
    return (
      m.email.toLowerCase().includes(q) ||
      m.first_name.toLowerCase().includes(q) ||
      m.last_name.toLowerCase().includes(q)
    );
  });

  const activeMutationError =
    inviteMutation.error || createDirectMutation.error || updateMutation.error;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Users className="text-accent-green" size={28} />
            Módulo de Usuarios & Equipo
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Gestión unificada de miembros del equipo, invitaciones seguras por correo SMTP y control de roles
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              closeModal();
              setMode('invite');
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-accent-green text-black font-bold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Send size={16} />
            Invitar por Correo (SMTP)
          </button>
          <button
            onClick={() => {
              closeModal();
              setMode('direct');
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-bg-card border border-border-base text-text-main hover:border-accent-green font-mono px-3.5 py-2 rounded-md text-sm transition-colors"
          >
            <UserPlus size={16} className="text-accent-blue" />
            Crear Usuario Directo
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-bg-card border border-border-base rounded-xl p-4 mb-6 shadow-xl flex items-center gap-3">
        <Search size={16} className="text-accent-green shrink-0" />
        <input
          type="text"
          placeholder="Buscar miembros por correo electrónico o nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none"
        />
      </div>

      {/* Unified Users & Team Table */}
      <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-accent-green" size={28} />
          </div>
        ) : filteredMembers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-border-base text-text-dim uppercase">
                  <th className="py-3 px-4">Usuario / Nombre</th>
                  <th className="py-3 px-4">Correo Electrónico</th>
                  <th className="py-3 px-4">Rol Asignado</th>
                  <th className="py-3 px-4">Estado de Cuenta</th>
                  <th className="py-3 px-4">Último Ingreso</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/50">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-bg-dark/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-text-main">
                      {m.first_name || m.last_name ? `${m.first_name} ${m.last_name}` : 'Usuario'}
                    </td>
                    <td className="py-3.5 px-4 text-text-muted">{m.email}</td>
                    <td className="py-3.5 px-4">
                      <span className="uppercase px-2.5 py-1 bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-md font-bold text-[11px]">
                        {m.role === 'admin' ? 'Administrador' : m.role === 'member' ? 'Ingeniero Operaciones' : 'Visualizador'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {m.status_code === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 rounded-md font-bold text-[11px] uppercase">
                          <AlertTriangle size={12} />
                          Invitación Pendiente
                        </span>
                      ) : (
                        <button
                          onClick={() => handleToggleActive(m)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-[11px] uppercase transition-colors ${
                            m.is_active
                              ? 'bg-accent-green/10 text-accent-green border border-accent-green/30 hover:bg-accent-red/10 hover:text-accent-red hover:border-accent-red/30'
                              : 'bg-accent-red/10 text-accent-red border border-accent-red/30 hover:bg-accent-green/10 hover:text-accent-green hover:border-accent-green/30'
                          }`}
                          title="Haz clic para cambiar estado Activo/Desactivado"
                        >
                          <Power size={12} />
                          {m.is_active ? 'Activo' : 'Desactivado'}
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-text-dim">
                      {m.last_login ? new Date(m.last_login).toLocaleString('es-ES') : 'Sin ingresos'}
                    </td>
                    <td className="py-3.5 px-4 text-right flex items-center justify-end gap-2">
                      {!m.is_invitation && (
                        <button
                          onClick={() => handleOpenEdit(m)}
                          className="p-1.5 border border-border-base hover:border-accent-blue text-text-muted hover:text-accent-blue rounded-lg transition-colors"
                          title="Editar usuario"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      {currentUser?.email !== m.email ? (
                        <button
                          onClick={() => handleDelete(m)}
                          className="p-1.5 border border-border-base hover:border-accent-red text-text-muted hover:text-accent-red rounded-lg transition-colors"
                          title={m.is_invitation ? 'Revocar Invitación' : 'Eliminar Usuario'}
                        >
                          {m.is_invitation ? <UserX size={14} /> : <Trash2 size={14} />}
                        </button>
                      ) : (
                        <span className="text-[11px] text-text-dim italic">Su Cuenta</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-dim text-xs py-8 text-center font-mono">
            No se encontraron usuarios ni invitaciones registradas.
          </p>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-base pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2 font-mono">
                <Users size={18} className="text-accent-green" />
                {mode === 'edit'
                  ? 'Editar Usuario'
                  : mode === 'invite'
                  ? 'Invitar Miembro (Enlace Mágico SMTP)'
                  : 'Crear Usuario Directo'}
              </h3>
              <button onClick={closeModal} className="text-text-muted hover:text-text-main">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-mono uppercase text-text-muted mb-1 font-bold">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  disabled={mode === 'edit'}
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 font-mono text-text-main focus:outline-none focus:border-accent-green disabled:opacity-60"
                />
              </div>

              {mode === 'direct' && (
                <div>
                  <label className="block font-mono uppercase text-text-muted mb-1 font-bold">Contraseña Inicial</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 font-mono text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono uppercase text-text-muted mb-1 font-bold">Nombre</label>
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
                <div>
                  <label className="block font-mono uppercase text-text-muted mb-1 font-bold">Apellido</label>
                  <input
                    type="text"
                    placeholder="Apellido"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono uppercase text-text-muted mb-1 font-bold">Rol de Acceso</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 font-mono text-text-main focus:outline-none focus:border-accent-green"
                >
                  <option value="admin">Administrador (Acceso total)</option>
                  <option value="member">Ingeniero Operaciones (Editar y Gestionar)</option>
                  <option value="viewer">Visualizador (Lectura Únicamente)</option>
                </select>
              </div>

              {mode !== 'invite' && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActiveToggle"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-border-base bg-bg-dark text-accent-green focus:ring-accent-green"
                  />
                  <label htmlFor="isActiveToggle" className="font-mono text-xs text-text-main cursor-pointer">
                    Usuario Activo (Permite iniciar sesión)
                  </label>
                </div>
              )}

              {activeMutationError && (
                <div className="p-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-xs font-mono">
                  {(activeMutationError as any)?.response?.data?.message ||
                    (activeMutationError as any)?.response?.data?.detail ||
                    'Error al procesar la solicitud.'}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-base">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-1.5 bg-bg-dark border border-border-base rounded-lg text-text-muted hover:text-text-main"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending || createDirectMutation.isPending || updateMutation.isPending}
                  className="px-4 py-1.5 bg-accent-green text-black font-bold rounded-lg hover:opacity-90 disabled:opacity-50 font-mono flex items-center gap-2"
                >
                  {inviteMutation.isPending || createDirectMutation.isPending || updateMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : mode === 'edit' ? (
                    'Guardar Cambios'
                  ) : mode === 'invite' ? (
                    'Enviar Invitación SMTP'
                  ) : (
                    'Crear Usuario'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
