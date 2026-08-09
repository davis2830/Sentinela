import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import { useAuthStore } from '../store/authStore';
import { Users, UserPlus, Edit2, Trash2, Loader2, Check, X, Shield, Lock, Search, Power } from 'lucide-react';

interface UserItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  last_login: string | null;
  created_at: string;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('member');
  const [isActive, setIsActive] = useState(true);

  // Query Users
  const { data: users, isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const response = await api.get('users/');
      return (response.data?.data || []) as UserItem[];
    },
  });

  // Create User Mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post('users/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      closeModal();
    },
  });

  // Update User Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await api.patch(`users/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      closeModal();
    },
  });

  // Delete User Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`users/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Error al eliminar usuario.');
    },
  });

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingUser(null);
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setRole('member');
    setIsActive(true);
  };

  const handleOpenEdit = (u: UserItem) => {
    setEditingUser(u);
    setEmail(u.email);
    setFirstName(u.first_name || '');
    setLastName(u.last_name || '');
    setRole(u.is_staff ? 'admin' : 'member');
    setIsActive(u.is_active);
    setShowCreateModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateMutation.mutate({
        id: editingUser.id,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          role,
          is_active: isActive,
        },
      });
    } else {
      createMutation.mutate({
        email: email.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role,
        is_active: isActive,
      });
    }
  };

  const handleToggleActive = (u: UserItem) => {
    if (currentUser?.email === u.email) {
      alert('No puedes desactivar tu propia cuenta actual.');
      return;
    }
    updateMutation.mutate({
      id: u.id,
      data: { is_active: !u.is_active },
    });
  };

  const handleDelete = (u: UserItem) => {
    if (currentUser?.email === u.email) {
      alert('No puedes eliminar tu propio usuario.');
      return;
    }
    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario ${u.email}?`)) {
      deleteMutation.mutate(u.id);
    }
  };

  const filteredUsers = (users || []).filter((u) => {
    const q = searchTerm.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Users className="text-accent-green" size={28} />
            Módulo de Gestión de Usuarios
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Administración completa de cuentas, nombres, roles de acceso y activación de usuarios en la plataforma
          </p>
        </div>

        <button
          onClick={() => {
            closeModal();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 bg-accent-green text-black font-bold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          <UserPlus size={18} />
          Crear Nuevo Usuario
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-bg-card border border-border-base rounded-xl p-4 mb-6 shadow-xl flex items-center gap-3">
        <Search size={16} className="text-accent-green shrink-0" />
        <input
          type="text"
          placeholder="Buscar por correo electrónico o nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none"
        />
      </div>

      {/* Users Table */}
      <div className="bg-bg-card border border-border-base rounded-xl p-6 shadow-xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-accent-green" size={28} />
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-border-base text-text-dim uppercase">
                  <th className="py-3 px-4">Usuario / Nombre</th>
                  <th className="py-3 px-4">Correo Electrónico</th>
                  <th className="py-3 px-4">Rol Asignado</th>
                  <th className="py-3 px-4">Estado (Activar/Desactivar)</th>
                  <th className="py-3 px-4">Última Sesión</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/50">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-bg-dark/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-text-main">
                      {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : 'Usuario'}
                    </td>
                    <td className="py-3.5 px-4 text-text-muted">{u.email}</td>
                    <td className="py-3.5 px-4">
                      <span className="uppercase px-2.5 py-1 bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-md font-bold text-[11px]">
                        {u.is_staff ? 'Administrador' : 'Ingeniero Operaciones'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-[11px] uppercase transition-colors ${u.is_active
                          ? 'bg-accent-green/10 text-accent-green border border-accent-green/30 hover:bg-accent-red/10 hover:text-accent-red hover:border-accent-red/30'
                          : 'bg-accent-red/10 text-accent-red border border-accent-red/30 hover:bg-accent-green/10 hover:text-accent-green hover:border-accent-green/30'
                          }`}
                        title="Haz clic para cambiar estado Activo/Inactivo"
                      >
                        <Power size={12} />
                        {u.is_active ? 'Activo' : 'Desactivado'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-text-dim">
                      {u.last_login ? new Date(u.last_login).toLocaleString('es-ES') : 'Sin ingresos'}
                    </td>
                    <td className="py-3.5 px-4 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 border border-border-base hover:border-accent-blue text-text-muted hover:text-accent-blue rounded-lg transition-colors"
                        title="Editar nombre, rol o estado"
                      >
                        <Edit2 size={14} />
                      </button>
                      {currentUser?.email !== u.email && (
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 border border-border-base hover:border-accent-red text-text-muted hover:text-accent-red rounded-lg transition-colors"
                          title="Eliminar usuario"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-dim text-xs py-8 text-center font-mono">
            No se encontraron usuarios coincidentes.
          </p>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showCreateModal && (
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
                {editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
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
                  disabled={!!editingUser}
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 font-mono text-text-main focus:outline-none focus:border-accent-green disabled:opacity-60"
                />
              </div>

              {!editingUser && (
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
                  <option value="admin">Administrador (Staff con acceso total)</option>
                  <option value="member">Ingeniero Operaciones (Editar y Gestionar)</option>
                  <option value="viewer">Visualizador (Lectura Únicamente)</option>
                </select>
              </div>

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
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-1.5 bg-accent-green text-black font-bold rounded-lg hover:opacity-90 disabled:opacity-50 font-mono"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : editingUser ? (
                    'Guardar Cambios'
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
