import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { APICheckTarget, APICheckResult, APITestRequestResult } from '../../types/api_checks';
import StatusBadge from '../common/StatusBadge';
import { NOCDrawer } from '../common/noc';
import {
  RefreshCw,
  Pencil,
  Trash2,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  Code2,
  Settings,
  Loader2,
  Copy,
  Check,
  Zap,
  Terminal,
  AlertTriangle,
  FileCode,
} from 'lucide-react';

export interface APICheckDetailDrawerProps {
  target: APICheckTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onScan: (id: string) => Promise<any>;
  isScanning: boolean;
  onEdit: (target: APICheckTarget) => void;
  onDelete: (target: APICheckTarget) => void;
}

export default function APICheckDetailDrawer({
  target,
  isOpen,
  onClose,
  onScan,
  isScanning,
  onEdit,
  onDelete,
}: APICheckDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'results' | 'quick_test' | 'schema' | 'config'>('results');
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Quick Live Test State inside Drawer
  const [isTestingLive, setIsTestingLive] = useState(false);
  const [quickTestResult, setQuickTestResult] = useState<APITestRequestResult | null>(null);

  const { data: results, isLoading: isLoadingResults } = useQuery({
    queryKey: ['api-check-results', target?.id],
    queryFn: async () => {
      if (!target) return [];
      const response = await api.get(`api-checks/${target.id}/results/`);
      return (response.data?.data || []) as APICheckResult[];
    },
    enabled: !!target && isOpen,
    refetchInterval: 15000,
  });

  if (!target) return null;

  const handleCopyCurl = () => {
    let curl = `curl -X ${target.method} "${target.url}"`;
    if (target.request_headers) {
      Object.entries(target.request_headers).forEach(([k, v]) => {
        curl += ` \\\n  -H "${k}: ${v}"`;
      });
    }
    if (
      target.method !== 'GET' &&
      target.method !== 'HEAD' &&
      target.request_body &&
      Object.keys(target.request_body).length > 0
    ) {
      curl += ` \\\n  -d '${JSON.stringify(target.request_body)}'`;
    }
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleExecuteQuickTest = async () => {
    setIsTestingLive(true);
    setQuickTestResult(null);
    try {
      const response = await api.post('api-checks/test-request/', {
        url: target.url,
        method: target.method,
        headers: target.request_headers || {},
        body: target.request_body || {},
      });
      setQuickTestResult(response.data?.data as APITestRequestResult);
    } catch (err: any) {
      setQuickTestResult({
        success: false,
        status_code: null,
        response_time_ms: null,
        headers: {},
        body: null,
        is_json: false,
        size_bytes: 0,
        error: err.response?.data?.message || err.message || 'Error al conectar con el endpoint.',
      });
    } finally {
      setIsTestingLive(false);
    }
  };

  const quickKpis = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
        <div className="text-[11px] text-text-dim">Status Esperado</div>
        <div className="text-base font-bold font-mono text-accent-green mt-0.5">
          {target.expected_status}
        </div>
      </div>
      <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
        <div className="text-[11px] text-text-dim">Última Latencia</div>
        <div className="text-base font-bold font-mono text-text-main mt-0.5">
          {target.last_response_time_ms !== null && target.last_response_time_ms !== undefined
            ? `${Math.round(target.last_response_time_ms)} ms`
            : `${target.expected_response_time_ms} ms`}
        </div>
      </div>
      <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
        <div className="text-[11px] text-text-dim">Monitoreo</div>
        <div className="text-sm font-semibold mt-0.5">
          {target.enabled ? (
            <span className="text-accent-green">Activo</span>
          ) : (
            <span className="text-text-dim">Pausado</span>
          )}
        </div>
      </div>
      <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
        <div className="text-[11px] text-text-dim">Frecuencia</div>
        <div className="text-sm font-semibold font-mono text-accent-blue mt-0.5">
          Cada {target.check_interval || 60}s
        </div>
      </div>
    </div>
  );

  const headerActions = (
    <button
      type="button"
      onClick={() => onScan(target.id)}
      disabled={isScanning}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-full text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
      title="Ejecutar chequeo HTTP inmediato"
    >
      <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
      <span>{isScanning ? 'Ejecutando...' : 'Escanear Ahora'}</span>
    </button>
  );

  const footerActions = (
    <>
      <button
        type="button"
        onClick={() => onEdit(target)}
        className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors cursor-pointer"
      >
        <Pencil size={14} />
        Editar Configuración
      </button>
      <button
        type="button"
        onClick={() => onDelete(target)}
        className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors cursor-pointer"
      >
        <Trash2 size={14} />
        Eliminar Target
      </button>
    </>
  );

  const tabs = [
    { id: 'results', label: 'Historial & Métricas', icon: <Activity size={13} /> },
    { id: 'quick_test', label: 'Test en Vivo', icon: <Zap size={13} /> },
    { id: 'schema', label: 'Validación Schema', icon: <Code2 size={13} /> },
    { id: 'config', label: 'Configuración HTTP', icon: <Settings size={13} /> },
  ];

  return (
    <NOCDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={target.name}
      subtitle={
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-full text-[11px] font-bold font-mono">
            {target.method}
          </span>
          <span className="truncate">{target.url}</span>
          <a
            href={target.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-green hover:underline shrink-0"
            title="Abrir en pestaña nueva"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      }
      statusBadge={<StatusBadge status={target.last_status || 'desconocido'} />}
      headerActions={headerActions}
      quickKpis={quickKpis}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as any)}
      footerActions={footerActions}
      maxWidthClass="max-w-2xl"
    >
      {/* TAB 1: RESULTS HISTORY */}
      {activeTab === 'results' && (
        <div className="space-y-4 font-sans">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-muted">
              Últimas Verificaciones Ejecutadas por Celery
            </h3>
            <span className="text-[11px] text-text-dim">
              {results?.length || 0} registros
            </span>
          </div>

          {isLoadingResults ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-accent-green" size={28} />
            </div>
          ) : results && results.length > 0 ? (
            <div className="bg-bg-dark/80 border border-border-base rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-base text-text-dim text-xs bg-bg-card/50">
                      <th className="py-2.5 px-3.5">Hora</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3">HTTP</th>
                      <th className="py-2.5 px-3">Latencia</th>
                      <th className="py-2.5 px-3 text-center">JSON</th>
                      <th className="py-2.5 px-3 text-center">Schema</th>
                      <th className="py-2.5 px-3 text-center">Headers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-base/40 font-mono">
                    {results.map((res: APICheckResult) => (
                      <tr key={res.id} className="hover:bg-bg-card/60 transition-colors">
                        <td className="py-2.5 px-3.5 text-text-muted text-xs whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <Clock size={12} className="text-text-dim" />
                            {new Date(res.checked_at).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={res.status} />
                        </td>
                        <td className="py-2.5 px-3 font-bold text-text-main">
                          {res.http_status ?? 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-sky-400">
                          {res.response_time_ms !== null ? `${Math.round(res.response_time_ms)} ms` : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {res.json_valid === true ? (
                            <CheckCircle2 size={15} className="text-accent-green mx-auto" />
                          ) : res.json_valid === false ? (
                            <XCircle size={15} className="text-accent-red mx-auto" />
                          ) : (
                            <span className="text-text-dim text-xs">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {res.schema_valid === true ? (
                            <CheckCircle2 size={15} className="text-accent-green mx-auto" />
                          ) : res.schema_valid === false ? (
                            <XCircle size={15} className="text-accent-red mx-auto" />
                          ) : (
                            <span className="text-text-dim text-xs">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {res.headers_valid === true ? (
                            <CheckCircle2 size={15} className="text-accent-green mx-auto" />
                          ) : res.headers_valid === false ? (
                            <XCircle size={15} className="text-accent-red mx-auto" />
                          ) : (
                            <span className="text-text-dim text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-bg-dark/50 border border-border-base rounded-2xl p-8 text-center">
              <p className="text-text-dim text-xs">
                No hay ejecuciones registradas para esta API todavía.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: QUICK TEST IN DRAWER */}
      {activeTab === 'quick_test' && (
        <div className="space-y-4 font-sans">
          <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <Zap size={14} className="text-accent-yellow" />
                  Prueba de Ejecución Inmediata
                </h4>
                <p className="text-[11px] text-text-dim mt-0.5">
                  Dispara una petición HTTP directa contra el endpoint sin esperar el ciclo Celery.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExecuteQuickTest}
                disabled={isTestingLive}
                className="px-4 py-2 bg-accent-green text-black font-semibold rounded-full text-xs flex items-center gap-1.5 hover:bg-accent-green/90 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isTestingLive ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Conectando...</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    <span>Lanzar Petición</span>
                  </>
                )}
              </button>
            </div>

            {quickTestResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs animate-in fade-in duration-200 ${
                  quickTestResult.success
                    ? 'bg-accent-green/10 border-accent-green/30'
                    : 'bg-accent-red/10 border-accent-red/30'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-border-base/50">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-main">Status:</span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                        quickTestResult.status_code && quickTestResult.status_code < 400
                          ? 'bg-accent-green/20 text-accent-green'
                          : 'bg-accent-red/20 text-accent-red'
                      }`}
                    >
                      HTTP {quickTestResult.status_code ?? 'N/A'}
                    </span>
                  </div>
                  {quickTestResult.response_time_ms !== null && (
                    <span className="font-mono text-text-muted text-[11px]">
                      Latencia: {quickTestResult.response_time_ms} ms
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-1">
                  <div className="text-[11px] text-text-dim font-mono">Payload de Respuesta:</div>
                  <pre className="p-3 bg-bg-dark rounded-xl border border-border-base/60 font-mono text-[11px] text-text-main max-h-48 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                    {quickTestResult.success
                      ? typeof quickTestResult.body === 'object'
                        ? JSON.stringify(quickTestResult.body, null, 2)
                        : String(quickTestResult.body || 'Sin cuerpo de respuesta.')
                      : quickTestResult.error}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SCHEMA VALIDATION */}
      {activeTab === 'schema' && (
        <div className="space-y-4 font-sans">
          <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
              <Code2 size={14} className="text-accent-green" />
              Campos y Tipos Requeridos en Respuesta JSON
            </h4>
            {target.expected_schema && Object.keys(target.expected_schema).length > 0 ? (
              <pre className="p-3.5 bg-bg-card border border-border-base rounded-xl text-xs font-mono text-accent-green overflow-x-auto leading-relaxed">
                {JSON.stringify(target.expected_schema, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-text-dim">
                No se ha configurado validación estricta de JSON Schema para este endpoint.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: HTTP CONFIG & CURL REPRODUCTION */}
      {activeTab === 'config' && (
        <div className="space-y-4 font-sans">
          <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3 text-xs font-mono">
            <div className="flex justify-between border-b border-border-base/40 pb-2">
              <span className="text-text-dim font-sans font-medium">Método HTTP:</span>
              <span className="font-bold text-accent-blue">{target.method}</span>
            </div>
            <div className="flex justify-between border-b border-border-base/40 pb-2">
              <span className="text-text-dim font-sans font-medium">URL Completa:</span>
              <span className="font-bold text-text-main truncate max-w-[280px]">
                {target.url}
              </span>
            </div>
            <div className="flex justify-between border-b border-border-base/40 pb-2">
              <span className="text-text-dim font-sans font-medium">Código Esperado:</span>
              <span className="font-bold text-accent-green">{target.expected_status}</span>
            </div>
            <div className="flex justify-between border-b border-border-base/40 pb-2">
              <span className="text-text-dim font-sans font-medium">Latencia Máxima:</span>
              <span className="font-bold text-text-main">
                {target.expected_response_time_ms} ms
              </span>
            </div>
            <div className="flex justify-between border-b border-border-base/40 pb-2">
              <span className="text-text-dim font-sans font-medium">Frecuencia Chequeo:</span>
              <span className="font-bold text-text-main">
                Cada {target.check_interval || 60} segundos
              </span>
            </div>
          </div>

          {/* cURL Reproduction Box */}
          <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted flex items-center gap-1.5 font-sans">
                <Terminal size={14} className="text-accent-green" />
                Comando cURL Reproducible
              </span>
              <button
                type="button"
                onClick={handleCopyCurl}
                className="flex items-center gap-1 text-xs text-accent-green hover:underline font-semibold cursor-pointer font-sans"
              >
                {copiedCurl ? (
                  <>
                    <Check size={13} />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copiar cURL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-bg-card border border-border-base/60 rounded-xl text-xs font-mono text-text-muted overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              curl -X {target.method} "{target.url}"
              {target.request_headers &&
                Object.entries(target.request_headers).map(
                  ([k, v]) => ` \\\n  -H "${k}: ${v}"`
                )}
            </pre>
          </div>
        </div>
      )}
    </NOCDrawer>
  );
}
