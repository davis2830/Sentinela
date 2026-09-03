import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import { useAuthStore } from '../store/authStore';
import { Building, Users, UserPlus, Loader2, UserX, X, AlertTriangle } from 'lucide-react';

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
  last_login?: string;
}

export default function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('member');

  // Query Team Members
  const { data: members, isLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => {
      const response = await api.get('organizations/members/');
      return (response.data?.data || []) as TeamMember[];
    },
  });

  // Invite Member Mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post('organizations/members/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      setShowInviteModal(false);
      setEmail('');
      setFirstName('');
      setLastName('');
    },
  });

  // Revoke / Delete Member Mutation
  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`organizations/members/${userId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al revocar la invitación.');
    },
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate({
      email: email.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role,
    });
  };

  const handleRevoke = (member: TeamMember) => {
    if (confirm(`¿Estás seguro de que deseas revocar la invitación y eliminar al usuario ${member.email}?`)) {
      revokeMutation.mutate(member.id);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Building className="text-accent-blue" size={28} />
            Organización & Gestión de Equipo
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Gestión de usuarios miembros del equipo, roles de acceso e invitaciones a la plataforma
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 bg-accent-green text-black font-semibold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          <UserPlus size={18} />
          Invitar Miembro al Equipo
        </button>
      </div>

      {/* Members Table */}
      <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-border-base pb-3">
          <h2 className="text-base font-bold text-text-main flex items-center gap-2">
            <Users size={18} className="text-accent-green" />
            Miembros de la Organización ({members?.length || 0})
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-accent-green" size={28} />
          </div>
        ) : members && members.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-border-base text-text-dim text-xs">
                  <th className="py-3 px-4">Usuario / Nombre</th>
                  <th className="py-3 px-4">Correo Electrónico</th>
                  <th className="py-3 px-4">Rol Asignado</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Fecha Registro</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/50">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-bg-dark/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-text-main">
                      {m.first_name || m.last_name ? `${m.first_name} ${m.last_name}` : 'Usuario'}
                    </td>
                    <td className="py-3.5 px-4 text-text-muted">{m.email}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-full font-semibold text-xs">
                        {m.role === 'admin' ? 'Administrador' : m.role === 'member' ? 'Ingeniero Operaciones' : 'Visualizador'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {m.status_code === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 rounded-full font-semibold text-xs">
                          <AlertTriangle size={12} />
                          Invitación Pendiente
                        </span>
                      ) : m.status_code === 'active' ? (
                        <StatusBadge status="pass" label="Activo" />
                      ) : (
                        <StatusBadge status="fail" label="Revocado" />
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-text-dim">
                      {m.date_joined ? new Date(m.date_joined).toLocaleDateString('es-ES') : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {currentUser?.email !== m.email ? (
                        <button
                          onClick={() => handleRevoke(m)}
                          disabled={revokeMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-lg transition-colors font-bold text-[11px]"
                          title="Revocar invitación y eliminar usuario"
                        >
                          <UserX size={13} />
                          Revocar Invitación
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
            No hay miembros adicionales registrados.
          </p>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-base pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <UserPlus size={18} className="text-accent-blue" />
                Invitar Miembro a la Organización
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="text-text-muted hover:text-text-main">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-3.5 font-sans text-xs">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 font-mono text-text-main focus:outline-none focus:border-accent-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Nombre</label>
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-accent-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Apellido</label>
                  <input
                    type="text"
                    placeholder="Apellido"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-accent-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Rol Asignado</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-accent-blue"
                >
                  <option value="admin">Administrador (Acceso Total)</option>
                  <option value="member">Ingeniero Operaciones (Editar y Gestionar)</option>
                  <option value="viewer">Visualizador (Lectura Únicamente)</option>
                </select>
              </div>

              {inviteMutation.isError && (
                <div className="p-2.5 bg-accent-red/10 border border-accent-red/30 rounded-lg text-accent-red text-xs font-mono">
                  {(inviteMutation.error as any)?.response?.data?.message || (inviteMutation.error as any)?.response?.data?.detail || 'Error al invitar al usuario.'}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-base">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 bg-bg-dark border border-border-base rounded-lg text-text-muted hover:text-text-main"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="px-4 py-1.5 bg-accent-green text-black font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {inviteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Enviar Invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
