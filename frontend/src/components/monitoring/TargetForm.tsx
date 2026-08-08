import React, { useState } from 'react';
import { X, Loader2, Settings2 } from 'lucide-react';
import type { MonitoringTarget, CreateTargetData } from '../../types/monitoring';

interface TargetFormProps {
  target: MonitoringTarget | null;
  onSubmit: (data: CreateTargetData) => Promise<void>;
  onClose: () => void;
}

const targetTypes = [
  { value: 'http', label: 'HTTP', placeholder: 'http://example.com', example: 'http://mi-servidor.com' },
  { value: 'https', label: 'HTTPS', placeholder: 'https://example.com', example: 'https://mi-api.com' },
  { value: 'tcp', label: 'TCP', placeholder: 'host:puerto', example: '192.168.1.1:8080' },
  { value: 'dns', label: 'DNS', placeholder: 'dominio.com', example: 'midominio.com' },
  { value: 'api', label: 'API', placeholder: 'https://api.example.com/endpoint', example: 'https://api.miservicio.com/health' },
  { value: 'ssl', label: 'SSL', placeholder: 'dominio.com', example: 'midominio.com' },
] as const;

export default function TargetForm({ target, onSubmit, onClose }: TargetFormProps) {
  const [name, setName] = useState(target?.name || '');
  const [targetType, setTargetType] = useState<CreateTargetData['target_type']>(target?.target_type || 'http');
  const [endpoint, setEndpoint] = useState(target?.endpoint || '');
  const [interval, setInterval] = useState(target?.interval || 60);
  const [enabled, setEnabled] = useState(target?.enabled ?? true);

  // Advanced fields
  const [httpMethod, setHttpMethod] = useState(target?.http_method || 'GET');
  const [expectedStatus, setExpectedStatus] = useState(target?.expected_status || 200);
  const [maxLatencyMs, setMaxLatencyMs] = useState(target?.max_latency_ms || 2000);
  const [headersJson, setHeadersJson] = useState(
    target?.custom_headers ? JSON.stringify(target.custom_headers, null, 2) : ''
  );
  const [requestBody, setRequestBody] = useState(target?.request_body || '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentType = targetTypes.find(t => t.value === targetType) || targetTypes[0];
  const isHttpType = targetType === 'http' || targetType === 'https' || targetType === 'api';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (targetType === 'tcp' && !endpoint.includes(':')) {
      setError('Para TCP usa el formato host:puerto (ej: 192.168.1.1:8080)');
      return;
    }

    if (isHttpType && !endpoint.startsWith('http')) {
      setError(`Para ${targetType.toUpperCase()} el endpoint debe empezar con http:// o https://`);
      return;
    }

    if ((targetType === 'dns' || targetType === 'ssl') && endpoint.includes('://')) {
      setError(`Para ${targetType.toUpperCase()} usa solo el dominio sin http:// (ej: midominio.com)`);
      return;
    }

    let parsedHeaders: Record<string, string> = {};
    if (headersJson.trim()) {
      try {
        parsedHeaders = JSON.parse(headersJson);
      } catch {
        setError('El formato de Encabezados (JSON) no es válido.');
        return;
      }
    }

    setLoading(true);
    try {
      await onSubmit({
        name,
        target_type: targetType,
        endpoint,
        interval,
        enabled,
        http_method: httpMethod,
        expected_status: Number(expectedStatus),
        max_latency_ms: Number(maxLatencyMs),
        custom_headers: parsedHeaders,
        request_body: requestBody,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar el target');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-bg-card border border-border-base rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{target ? 'Editar Target' : 'Nuevo Target'}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-accent-red/10 border border-accent-red/50 text-accent-red px-4 py-2 rounded-lg text-sm font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-mono uppercase text-text-muted mb-1 block">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Mi API de Produccion"
              className="input-base"
            />
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-text-muted mb-1 block">Tipo</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as CreateTargetData['target_type'])}
              className="input-base cursor-pointer bg-[#090D11] text-text-main"
            >
              {targetTypes.map((t) => (
                <option key={t.value} value={t.value} className="bg-[#090D11] text-text-main py-1">
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-text-muted mb-1 block">Endpoint / URL</label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              required
              placeholder={currentType.placeholder}
              className="input-base font-mono text-sm"
            />
            <p className="text-xs text-text-dim mt-1 font-mono">
              Ejemplo: <span className="text-accent-green">{currentType.example}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono uppercase text-text-muted mb-1 block">Intervalo (seg)</label>
              <input
                type="number"
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                min={10}
                required
                className="input-base font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-text-muted mb-1 block">Habilitado</label>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`w-full py-2.5 rounded-lg border text-xs font-mono uppercase font-bold transition-colors ${
                  enabled
                    ? 'bg-accent-green/10 border-accent-green text-accent-green'
                    : 'bg-white/5 border-border-base text-text-muted'
                }`}
              >
                {enabled ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          </div>

          {/* Advanced HTTP Settings Toggle */}
          {isHttpType && (
            <div className="pt-2 border-t border-border-base/50">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs font-mono text-accent-green hover:underline flex items-center gap-1 font-semibold"
              >
                <Settings2 size={14} />
                {showAdvanced ? 'Ocultar Opciones Avanzadas HTTP' : 'Ver Opciones Avanzadas HTTP'}
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 bg-bg-dark/60 p-4 border border-border-base rounded-xl font-mono text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block uppercase text-text-muted mb-1">Método HTTP</label>
                      <select
                        value={httpMethod}
                        onChange={(e) => setHttpMethod(e.target.value)}
                        className="w-full bg-bg-dark border border-border-base rounded-lg p-2 text-text-main"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="HEAD">HEAD</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>

                    <div>
                      <label className="block uppercase text-text-muted mb-1">Status Esperado</label>
                      <input
                        type="number"
                        value={expectedStatus}
                        onChange={(e) => setExpectedStatus(Number(e.target.value))}
                        className="w-full bg-bg-dark border border-border-base rounded-lg p-2 text-text-main"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block uppercase text-text-muted mb-1">Max Latencia Tolerada (ms)</label>
                    <input
                      type="number"
                      value={maxLatencyMs}
                      onChange={(e) => setMaxLatencyMs(Number(e.target.value))}
                      className="w-full bg-bg-dark border border-border-base rounded-lg p-2 text-text-main"
                    />
                  </div>

                  <div>
                    <label className="block uppercase text-text-muted mb-1">Encabezados Custom (JSON)</label>
                    <textarea
                      rows={3}
                      placeholder='{ "Authorization": "Bearer token123" }'
                      value={headersJson}
                      onChange={(e) => setHeadersJson(e.target.value)}
                      className="w-full bg-bg-dark border border-border-base rounded-lg p-2 text-text-main"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border-base rounded-lg text-sm text-text-muted hover:bg-bg-card-hover transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 btn-secondary flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}