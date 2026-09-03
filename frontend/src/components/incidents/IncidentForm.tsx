import React, { useState, useEffect } from 'react';
import type { Incident, CreateIncidentData, IncidentPriority } from '../../types/incidents';
import { X, Loader2, AlertOctagon } from 'lucide-react';

interface IncidentFormProps {
  incident?: Incident | null;
  onSubmit: (data: CreateIncidentData) => Promise<void>;
  onClose: () => void;
}

const PRIORITIES: { value: IncidentPriority; label: string }[] = [
  { value: 'critical', label: 'Crítico' },
  { value: 'high', label: 'Alto' },
  { value: 'medium', label: 'Medio' },
  { value: 'low', label: 'Bajo' },
];

export default function IncidentForm({ incident, onSubmit, onClose }: IncidentFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IncidentPriority>('medium');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (incident) {
      setTitle(incident.title);
      setDescription(incident.description);
      setPriority(incident.priority);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
    }
  }, [incident]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        priority,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <AlertOctagon size={20} className="text-accent-red" />
            {incident ? 'Editar Incidente' : 'Registrar Nuevo Incidente'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Título del Incidente
            </label>
            <input
              type="text"
              required
              placeholder="ej. Caída parcial de base de datos principal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Prioridad
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as IncidentPriority)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Descripción & Diagnóstico Inicial
            </label>
            <textarea
              rows={4}
              placeholder="Detalles técnicos de la afectación..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border-base">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border-base rounded-full text-sm text-text-muted hover:bg-bg-dark transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-accent-red text-white font-semibold rounded-full text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={18} />
              ) : incident ? (
                'Actualizar'
              ) : (
                'Crear Incidente'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
