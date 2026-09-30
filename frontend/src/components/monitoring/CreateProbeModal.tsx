import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { AgentProbe } from '../../types/agent_probe';
import {
  X,
  Server,
  Terminal,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  Play,
  ArrowRight,
} from 'lucide-react';

interface CreateProbeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateProbeModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateProbeModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [createdProbe, setCreatedProbe] = useState<AgentProbe | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (probeName: string) => {
      const res = await api.post('agent-probes/', { name: probeName });
      return res.data?.data as AgentProbe;
    },
    onSuccess: (data) => {
      setCreatedProbe(data);
      queryClient.invalidateQueries({ queryKey: ['agent-probes'] });
      queryClient.invalidateQueries({ queryKey: ['org-subscription'] });
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      setErrorMsg(
        err.response?.data?.message ||
          'Error al registrar el agente satélite. Verifica tus cuotas de plan.'
      );
    },
  });

  if (!isOpen) return null;

  const handleCopy = (text: string, isToken: boolean) => {
    navigator.clipboard.writeText(text);
    if (isToken) {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  };

  const handleClose = () => {
    setName('');
    setCreatedProbe(null);
    setErrorMsg(null);
    onClose();
  };

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-border-base bg-gradient-to-r from-bg-card via-bg-card-hover to-bg-card flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-accent-purple/10 text-accent-purple border border-accent-purple/30">
              <Server size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-text-main">
                  {createdProbe ? 'Guardián Sentinine Registrado' : 'Conectar Nuevo Guardián Sentinine'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-purple/10 text-accent-purple border border-accent-purple/30">
                  LAN / ON-PREMISE
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Vigila redes privadas locales, bases de datos y VPCs sin abrir puertos de firewall.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-text-muted hover:text-text-main rounded-xl hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-6 p-4 rounded-2xl bg-accent-red/10 border border-accent-red/30 text-accent-red flex items-center gap-3 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!createdProbe ? (
          /* Step 1: Input Name */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              createMutation.mutate(name.trim());
            }}
            className="p-6 space-y-5"
          >
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Nombre Descriptivo del Sentinine / Datacenter *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Datacenter Santiago / VPC AWS Privada / LAN Oficina"
                className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-purple"
              />
              <p className="text-[11px] text-text-dim mt-1.5">
                Identifica la ubicación física o red interna donde correrá este guardián Sentinine.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-bg-dark/60 border border-border-base/80 space-y-2 text-xs text-text-muted">
              <div className="flex items-center gap-2 text-text-main font-semibold">
                <ShieldCheck size={16} className="text-accent-purple" />
                <span>Seguridad Saliente Exclusiva (Outbound Only)</span>
              </div>
              <p className="leading-relaxed text-text-dim text-[11px]">
                El agente Sentinine no requiere abrir puertos entrantes en tu firewall. Se conecta a Sentinel mediante HTTPS saliente para solicitar tareas y reportar los chequeos locales de tu red privada.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border-base">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main rounded-xl border border-border-base hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !name.trim()}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-accent-green text-black rounded-xl hover:bg-accent-green-glow transition-all shadow-md shadow-accent-green/20 disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>Generar Token & Comando</span>
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Show Token & Docker Command */
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-2xl bg-accent-purple/10 border border-accent-purple/30 text-accent-purple flex items-center gap-3 text-xs">
              <CheckCircle2 size={18} className="shrink-0" />
              <div>
                <div className="font-bold">¡Guardián Sentinine {createdProbe.name} listo para iniciar!</div>
                <div className="text-[11px] text-accent-purple/80 mt-0.5">
                  Ejecuta el siguiente comando en tu servidor local para iniciar la telemetría.
                </div>
              </div>
            </div>

            {/* Docker Command Card */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal size={14} className="text-accent-cyan" />
                  Comando Docker Oficial (1-Clic)
                </label>
                <button
                  onClick={() => handleCopy(createdProbe.docker_command || '', false)}
                  className="flex items-center gap-1.5 text-xs text-accent-purple hover:underline font-mono"
                >
                  {copiedCommand ? (
                    <>
                      <Check size={13} /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> Copiar comando
                    </>
                  )}
                </button>
              </div>

              <div className="relative group">
                <pre className="p-4 rounded-2xl bg-bg-dark border border-border-base text-xs font-mono text-purple-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {createdProbe.docker_command}
                </pre>
              </div>
            </div>

            {/* Token Card */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Token Secreto de Sentinine (X-Probe-Token)
                </label>
                <button
                  onClick={() => handleCopy(createdProbe.raw_token || '', true)}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main font-mono"
                >
                  {copiedToken ? (
                    <>
                      <Check size={13} className="text-accent-green" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> Copiar token
                    </>
                  )}
                </button>
              </div>
              <div className="p-3 rounded-xl bg-bg-dark border border-border-base text-xs font-mono text-text-main flex items-center justify-between">
                <span>{createdProbe.raw_token}</span>
              </div>
              <p className="text-[11px] text-accent-yellow mt-1.5 flex items-center gap-1">
                <span>Guarda este token de forma segura; no se volverá a mostrar en texto plano.</span>
              </p>
            </div>

            {/* Quick Steps */}
            <div className="p-4 rounded-2xl bg-white/5 border border-border-base text-xs space-y-2">
              <div className="font-semibold text-text-main">¿Qué ocurre a continuación?</div>
              <ol className="list-decimal list-inside space-y-1 text-text-dim text-[11px] leading-relaxed">
                <li>El contenedor Sentinine se iniciará en segundo plano en tu servidor o red local.</li>
                <li>Emitirá latidos (heartbeat) salientes a Sentinel y cambiará su estado a <strong className="text-accent-green">Online</strong>.</li>
                <li>Ahora podrás seleccionar este Sentinine al crear o editar cualquier objetivo de monitoreo LAN.</li>
              </ol>
            </div>

            <div className="flex justify-end pt-3 border-t border-border-base">
              <button
                onClick={handleClose}
                className="px-6 py-2.5 text-xs font-bold bg-accent-green text-black rounded-xl hover:bg-accent-green-glow transition-colors"
              >
                Entendido y Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
