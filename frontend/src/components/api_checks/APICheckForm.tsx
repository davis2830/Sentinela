import React, { useState, useEffect } from 'react';
import type { APICheckTarget, CreateAPICheckTargetData, HTTPMethod } from '../../types/api_checks';
import { X, Loader2, Plug, Code2, KeyRound, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [requestHeadersJson, setRequestHeadersJson] = useState<string>('');
  const [requestBodyJson, setRequestBodyJson] = useState<string>('');
  const [expectedSchemaJson, setExpectedSchemaJson] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (target) {
      setName(target.name);
      setUrl(target.url);
      setMethod(target.method);
      setExpectedStatus(target.expected_status);
      setExpectedTimeMs(target.expected_response_time_ms);
      setEnabled(target.enabled);
      setRequestHeadersJson(
        target.request_headers && Object.keys(target.request_headers).length > 0
          ? JSON.stringify(target.request_headers, null, 2)
          : ''
      );
      setRequestBodyJson(
        target.request_body && Object.keys(target.request_body).length > 0
          ? JSON.stringify(target.request_body, null, 2)
          : ''
      );
      setExpectedSchemaJson(
        target.expected_schema && Object.keys(target.expected_schema).length > 0
          ? JSON.stringify(target.expected_schema, null, 2)
          : ''
      );
      if (
        (target.request_headers && Object.keys(target.request_headers).length > 0) ||
        (target.request_body && Object.keys(target.request_body).length > 0) ||
        (target.expected_schema && Object.keys(target.expected_schema).length > 0)
      ) {
        setShowAdvanced(true);
      }
    } else {
      setName('');
      setUrl('');
      setMethod('GET');
      setExpectedStatus(200);
      setExpectedTimeMs(2000);
      setEnabled(true);
      setRequestHeadersJson('');
      setRequestBodyJson('');
      setExpectedSchemaJson('');
      setShowAdvanced(false);
    }
  }, [target]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJsonError(null);
    if (!name.trim() || !url.trim()) return;

    let parsedHeaders: Record<string, string> = {};
    let parsedBody: Record<string, any> = {};
    let parsedSchema: Record<string, any> = {};

    try {
      if (requestHeadersJson.trim()) {
        parsedHeaders = JSON.parse(requestHeadersJson);
      }
    } catch {
      setJsonError('El campo "Headers de Petición" no contiene un formato JSON válido.');
      return;
    }

    try {
      if (requestBodyJson.trim()) {
        parsedBody = JSON.parse(requestBodyJson);
      }
    } catch {
      setJsonError('El campo "Cuerpo de Petición (Body)" no contiene un formato JSON válido.');
      return;
    }

    try {
      if (expectedSchemaJson.trim()) {
        parsedSchema = JSON.parse(expectedSchemaJson);
      }
    } catch {
      setJsonError('El campo "Esquema Esperado" no contiene un formato JSON válido.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        url: url.trim(),
        method,
        expected_status: Number(expectedStatus),
        expected_response_time_ms: Number(expectedTimeMs),
        enabled,
        request_headers: parsedHeaders,
        request_body: parsedBody,
        expected_schema: parsedSchema,
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
        className="bg-bg-card border border-border-base rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
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

        {jsonError && (
          <div className="mb-4 p-3 bg-accent-red/10 border border-accent-red/30 rounded-lg text-accent-red text-xs font-mono">
            ⚠️ {jsonError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-text-muted mb-1.5">
              Nombre del Servicio API
            </label>
            <input
              type="text"
              required
              placeholder="ej. Service Health Check"
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
                step={1}
                value={expectedTimeMs}
                onChange={(e) => setExpectedTimeMs(Number(e.target.value))}
                className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
              />
            </div>
          </div>

          {/* Advanced Section Toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs font-mono text-accent-green hover:underline focus:outline-none"
            >
              <KeyRound size={14} />
              <span>{showAdvanced ? 'Ocultar Opciones de Autenticación & JSON Body' : 'Configurar Autenticación (Headers), Body & JSON Schema'}</span>
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t border-border-base/60 animate-in fade-in duration-150">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono uppercase text-text-muted flex items-center gap-1.5">
                    <KeyRound size={13} className="text-accent-blue" />
                    Headers de Petición (Request Headers - JSON)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setRequestHeadersJson('{\n  "Authorization": "Bearer YOUR_JWT_TOKEN",\n  "Content-Type": "application/json"\n}')
                    }
                    className="text-[11px] font-mono text-accent-blue hover:underline"
                  >
                    + Plantilla Auth Bearer
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder='ej. { "Authorization": "Bearer secret_token", "X-API-Key": "12345" }'
                  value={requestHeadersJson}
                  onChange={(e) => setRequestHeadersJson(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-text-muted mb-1.5 flex items-center gap-1.5">
                  <Code2 size={13} className="text-accent-green" />
                  Cuerpo de Petición (Request Body - JSON)
                </label>
                <textarea
                  rows={3}
                  placeholder='ej. { "title": "Test Check", "body": "Ejemplo" }'
                  value={requestBodyJson}
                  onChange={(e) => setRequestBodyJson(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-text-muted mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-accent-yellow" />
                  Esquema Esperado (Response JSON Schema - Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder='ej. { "status": "string", "count": "integer" }'
                  value={expectedSchemaJson}
                  onChange={(e) => setExpectedSchemaJson(e.target.value)}
                  className="w-full bg-bg-dark border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
                />
              </div>
            </div>
          )}

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
