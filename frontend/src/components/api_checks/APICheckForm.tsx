import React, { useState, useEffect } from 'react';
import type { APICheckTarget, CreateAPICheckTargetData, HTTPMethod } from '../../types/api_checks';
import { X, Loader2, Plug } from 'lucide-react';

interface APICheckFormProps {
  target?: APICheckTarget | null;
  onSubmit: (data: CreateAPICheckTargetData) => Promise<void>;
  onClose: () => void;
}

const HTTP_METHODS: HTTPMethod[] = ['GET', 'POST', 'PUT', 'PATCH'];

export default function APICheckForm({ target, onSubmit, onClose }: APICheckFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState<HTTPMethod>('GET');
  const [expectedStatus, setExpectedStatus] = useState<number>(200);
  const [expectedTimeMs, setExpectedTimeMs] = useState<number>(2000);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (target) {
      setName(target.name);
      setUrl(target.url);
      setMethod(target.method);
      setExpectedStatus(target.expected_status);
      setExpectedTimeMs(target.expected_response_time_ms);
      setEnabled(target.enabled);
    } else {
      setName('');
      setUrl('');
      setMethod('GET');
      setExpectedStatus(200);
      setExpectedTimeMs(2000);
      setEnabled(true);
    }
  }, [target]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        url: url.trim(),
        method,
        expected_status: Number(expectedStatus),
        expected_response_time_ms: Number(expectedTimeMs),
        enabled,
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
        className="bg-bg-card border border-border-base rounded-xl p-6 w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <Plug size={20} className="text-accent-green" />
            {target ? 'Editar API Check Target' : 'Nuevo API Check Target'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-main">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-text-muted mb-1.5">
              Nombre del Servicio API
            </label>
            <input
              type="text"
              required
              placeholder="ej. Users Microservice Health"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-text-muted mb-1.5">
              URL del Endpoint
            </label>
            <input
              type="url"
              required
              placeholder="ej. https://api.miempresa.com/v1/health"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-lg px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-text-muted mb-1.5">
                Método HTTP
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HTTPMethod)}
                className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-text-muted mb-1.5">
                Status Esperado
              </label>
              <input
                type="number"
                required
                min={100}
                max={599}
                value={expectedStatus}
                onChange={(e) => setExpectedStatus(Number(e.target.value))}
                className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-text-muted mb-1.5">
                Max Latencia (ms)
              </label>
              <input
                type="number"
                required
                min={10}
                max={30000}
                step={50}
                value={expectedTimeMs}
                onChange={(e) => setExpectedTimeMs(Number(e.target.value))}
                className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="enabledCheck"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded bg-bg-dark border-border-base text-accent-green focus:ring-accent-green focus:ring-offset-bg-dark cursor-pointer"
            />
            <label htmlFor="enabledCheck" className="text-sm font-medium text-text-main cursor-pointer">
              Monitoreo Activo
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border-base">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border-base rounded-lg text-sm text-text-muted hover:bg-bg-card-hover transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : target ? 'Actualizar' : 'Crear API Check'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
