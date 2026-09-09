import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Team, TeamMember } from '../../types/users';
import {
  X,
  Layers,
  Edit2,
  Plus,
  Users,
  Check,
  Loader2,
  AlertTriangle,
  Palette,
  Mail,
  Crown,
} from 'lucide-react';

interface TeamFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team | null;
  availableMembers: TeamMember[];
  onSubmit: (data: {
    name: string;
    description: string;
    color: string;
    lead_id?: string | null;
    contact_email?: string;
    member_ids: string[];
  }) => Promise<void>;
  isLoading?: boolean;
  errorMessage?: string | null;
}

const COLOR_PRESETS = [
  { hex: '#10B981', name: 'Esmeralda' },
  { hex: '#3B82F6', name: 'Azul' },
  { hex: '#8B5CF6', name: 'Púrpura' },
  { hex: '#F59E0B', name: 'Ámbar' },
  { hex: '#EC4899', name: 'Rosa' },
  { hex: '#06B6D4', name: 'Cian' },
  { hex: '#14B8A6', name: 'Turquesa' },
  { hex: '#6366F1', name: 'Índigo' },
];

export default function TeamFormModal({
  isOpen,
  onClose,
  team,
  availableMembers,
  onSubmit,
  isLoading,
  errorMessage,
}: TeamFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [contactEmail, setContactEmail] = useState('');
  const [leadId, setLeadId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (team) {
      setName(team.name || '');
      setDescription(team.description || '');
      setColor(team.color || '#3B82F6');
      setContactEmail(team.contact_email || '');
      setLeadId(team.lead?.id || '');
      setSelectedMemberIds((team.members || []).map((m) => m.id));
    } else {
      setName('');
      setDescription('');
      setColor('#3B82F6');
      setContactEmail('');
      setLeadId('');
      setSelectedMemberIds([]);
    }
  }, [team, isOpen]);

  if (!isOpen) return null;

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId];
      if (!next.includes(leadId)) {
        setLeadId('');
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      color,
      lead_id: leadId || null,
      contact_email: contactEmail.trim(),
      member_ids: selectedMemberIds,
    });
  };

  const isEditing = !!team;
  // Filter only active registered users (invitations cannot be assigned yet until accepted)
  const assignableMembers = availableMembers.filter((m) => !m.is_invitation);

  const content = (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-base shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl border flex items-center justify-center transition-colors"
              style={{
                backgroundColor: `${color}15`,
                borderColor: `${color}30`,
                color: color,
              }}
            >
              {isEditing ? <Edit2 size={20} /> : <Layers size={20} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-main">
                {isEditing ? 'Editar Equipo de Trabajo' : 'Crear Equipo de Trabajo'}
              </h2>
              <p className="text-xs text-text-dim mt-0.5">
                {isEditing
                  ? 'Modifica el nombre, distintivo y asigna miembros operativos'
                  : 'Define una nueva cuadrilla u squad operativo para la organización'}
              </p>
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
              <span className="font-semibold">Error al guardar equipo:</span>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Team Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
              <Layers size={13} className="text-accent-blue" />
              Nombre del Equipo / Cuadrilla <span className="text-accent-red">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. SRE & Infraestructura Crítica, Soporte Nivel 1, SecOps"
              className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-main">
              Descripción del Alcance Operativo
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Responsables de la disponibilidad del cluster Kubernetes y base de datos..."
              className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green resize-none"
            />
          </div>

          {/* Contact Email / Alias */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
              <Mail size={13} className="text-accent-blue" />
              Correo o Alias de Contacto del Equipo
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="sre-team@tuempresa.com"
              className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main font-mono placeholder:text-text-dim focus:outline-none focus:border-accent-green"
            />
          </div>

          {/* Color Palette */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
              <Palette size={13} className="text-accent-purple" />
              Color Distintivo
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {COLOR_PRESETS.map((preset) => {
                const isSelected = color.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    title={preset.name}
                    onClick={() => setColor(preset.hex)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? 'ring-2 ring-text-main ring-offset-2 ring-offset-bg-card scale-110'
                        : 'opacity-80 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                  >
                    {isSelected && <Check size={14} className="text-black stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Members Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <Users size={13} className="text-accent-green" />
                Asignar Miembros al Equipo
              </label>
              <span className="text-[10px] font-mono text-text-dim">
                {selectedMemberIds.length} seleccionados
              </span>
            </div>

            {assignableMembers.length === 0 ? (
              <p className="text-xs text-text-dim italic p-3 rounded-xl bg-bg-dark border border-border-base">
                No hay operadores registrados activos disponibles para asignar.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {assignableMembers.map((member) => {
                  const isChecked = selectedMemberIds.includes(member.id);
                  const memberName = `${member.first_name || ''} ${member.last_name || ''}`.trim();
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleMember(member.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isChecked
                          ? 'bg-bg-card border-accent-blue shadow-xs'
                          : 'bg-bg-dark border-border-base hover:border-border-accent'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold text-text-main truncate">
                          {memberName || member.email}
                        </p>
                        {memberName && (
                          <p className="text-[10px] text-text-dim font-mono truncate">
                            {member.email}
                          </p>
                        )}
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-accent-blue text-white'
                            : 'border border-border-base bg-bg-card'
                        }`}
                      >
                        {isChecked && <Check size={11} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Team Lead Selector */}
          {selectedMemberIds.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <Crown size={13} className="text-accent-yellow" />
                Líder de Cuadrilla (Team Lead)
              </label>
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none focus:border-accent-green"
              >
                <option value="">Sin líder designado</option>
                {assignableMembers
                  .filter((m) => selectedMemberIds.includes(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email} ({m.email})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Footer */}
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
              disabled={isLoading || !name.trim()}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold bg-accent-green text-black hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Guardando...
                </>
              ) : isEditing ? (
                <>
                  <Edit2 size={13} /> Guardar Equipo
                </>
              ) : (
                <>
                  <Plus size={13} /> Crear Equipo
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
