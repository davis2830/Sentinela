import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Incident, CreateIncidentData, IncidentPriority } from '../../types/incidents';
import {
  X,
  Loader2,
  AlertOctagon,
  Flame,
  UserCheck,
  Server,
  Globe,
  Lock,
  Activity,
  Plug,
  Shield,
} from 'lucide-react';

interface IncidentFormProps {
  incident?: Incident | null;
  onSubmit: (data: CreateIncidentData) => Promise<void>;
  onClose: () => void;
}

const PRIORITIES: { value: IncidentPriority; label: string; color: string }[] = [
  { value: 'critical', label: 'Crítico (P1)', color: 'text-rose-400' },
  { value: 'high', label: 'Alto (P2)', color: 'text-amber-400' },
  { value: 'medium', label: 'Medio (P3)', color: 'text-blue-400' },
  { value: 'low', label: 'Bajo (P4)', color: 'text-text-muted' },
];

const TARGET_TYPES = [
  { value: 'monitoring', label: 'Uptime & Latencia', icon: Globe },
  { value: 'ssl', label: 'Certificado SSL', icon: Lock },
  { value: 'dns', label: 'Registro DNS', icon: Activity },
  { value: 'domain', label: 'Dominio WHOIS', icon: Globe },
  { value: 'api_check', label: 'API Endpoint Check', icon: Plug },
  { value: 'security_headers', label: 'Cabecera de Seguridad', icon: Shield },
  { value: 'other', label: 'Infraestructura General', icon: Server },
];

const SUGGESTED_SERVICES = [
  'Gateway Principal HTTP/S',
  'Certificado Wildcard SSL',
  'Resolución DNS Zona Primaria',
  'Dominio Corporativo ICANN',
  'API Gateway Transaccional',
  'Cabeceras HSTS/CSP Producción',
];

interface Member {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export default function IncidentForm({ incident, onSubmit, onClose }: IncidentFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IncidentPriority>('medium');
  const [impactedService, setImpactedService] = useState('');
  const [targetType, setTargetType] = useState('monitoring');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch team members for assignee dropdown
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['org-members-select'],
    queryFn: async () => {
      try {
        const response = await api.get('organizations/members/');
        return (response.data?.data || response.data || []) as Member[];
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });

  useEffect(() => {
    if (incident) {
      setTitle(incident.title);
      setDescription(incident.description || '');
      setPriority(incident.priority);
      setImpactedService(incident.impacted_service || '');
      setTargetType(incident.target_type || 'monitoring');
      setAssignedTo(incident.assigned_to || '');
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setImpactedService('');
      setTargetType('monitoring');
      setAssignedTo('');
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
        impacted_service: impactedService.trim() || undefined,
        target_type: targetType || undefined,
        assigned_to: assignedTo || null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-3xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-base/60">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <AlertOctagon size={22} className="text-accent-red" />
            {incident ? 'Editar Incidente Operativo' : 'Registrar Nuevo Incidente Operativo'}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main p-1.5 rounded-full hover:bg-bg-dark transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Título del Incidente <span className="text-accent-red">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="ej. Degradación en servicio de autenticación y latencia elevada"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans"
            />
          </div>

          {/* Priority & Target Type Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1.5">
                <Flame size={14} className="text-amber-400" />
                Nivel de Prioridad
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as IncidentPriority)}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans cursor-pointer"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1.5">
                <Server size={14} className="text-sky-400" />
                Módulo / Tipo de Servicio
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans cursor-pointer"
              >
                {TARGET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Impacted Service Name & Suggestions */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Servicio o Activo Afectado
            </label>
            <input
              type="text"
              placeholder="ej. Servidor de Pagos (https://api.empresa.com)"
              value={impactedService}
              onChange={(e) => setImpactedService(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans"
            />
            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[10px] text-text-dim py-0.5">Sugerencias:</span>
              {SUGGESTED_SERVICES.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setImpactedService(sug)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-bg-dark border border-border-base text-text-muted hover:text-accent-green hover:border-accent-green/40 transition-colors cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee Selection */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1.5">
              <UserCheck size={14} className="text-accent-green" />
              Ingeniero o Responsable Asignado
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-sans cursor-pointer"
            >
              <option value="">-- Sin asignar (Albergar en cola NOC) --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name || m.last_name
                    ? `${m.first_name} ${m.last_name} (${m.email})`
                    : m.email}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Descripción & Diagnóstico Inicial
            </label>
            <textarea
              rows={3}
              placeholder="Detalles técnicos de la afectación, síntomas detectados y primer triage..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-border-base/60">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border-base rounded-full text-sm text-text-muted hover:bg-bg-dark transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-accent-red text-white font-semibold rounded-full text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={18} />
              ) : incident ? (
                'Actualizar Incidente'
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
