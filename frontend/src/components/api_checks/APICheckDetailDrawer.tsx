import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { APICheckTarget, APICheckResult } from '../../types/api_checks';
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
  const [activeTab, setActiveTab] = useState<'results' | 'schema' | 'config'>('results');

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

  const quickKpis = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
        <div className="text-[11px] text-text-dim">Status Esperado</div>
        <div className="text-base font-bold font-mono text-accent-green mt-0.5">
          {target.expected_status}
        </div>
      </div>
      <div className="bg-bg-dark/80 border border-border-base/70 rounded-xl p-2.5">
        <div className="text-[11px] text-text-dim">Max Latencia</div>
        <div className="text-base font-bold font-mono text-text-main mt-0.5">
          {target.expected_response_time_ms} ms
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
        <div className="text-[11px] text-text-dim">Intervalo</div>
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
      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-black rounded-full text-xs font-semibold transition-all disabled:opacity-50"
      title="Ejecutar chequeo HTTP inmediato"
    >
      <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
      <span>{isScanning ? 'Ejecutando...' : 'Escanear'}</span>
    </button>
  );

  const footerActions = (
    <>
      <button
        type="button"
        onClick={() => onEdit(target)}
        className="flex items-center gap-1.5 px-4 py-2 border border-border-base text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full text-xs font-semibold transition-colors"
      >
        <Pencil size={14} />
        Editar Configuración
      </button>
      <button
        type="button"
        onClick={() => onDelete(target)}
        className="flex items-center gap-1.5 px-4 py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-white rounded-full text-xs font-semibold transition-colors"
      >
        <Trash2 size={14} />
        Eliminar Target
      </button>
    </>
  );

  const tabs = [
    { id: 'results', label: 'Historial & Métricas', icon: <Activity size={13} /> },
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
          <span className="px-2.5 py-0.5 bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded-full text-[11px] font-semibold">
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
              Últimas Verificaciones Ejecutadas
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
                      <th className="py-2.5 px-3.5">Fecha</th>
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
                          {res.response_time_ms !== null ? `${res.response_time_ms} ms` : 'N/A'}
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

      {/* TAB 2: SCHEMA VALIDATION */}
      {activeTab === 'schema' && (
        <div className="space-y-4 font-sans">
          <div className="bg-bg-dark/80 border border-border-base rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-semibold text-text-muted">
              Regla de Validación JSON Schema
            </h4>
            {target.expected_schema ? (
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

      {/* TAB 3: HTTP CONFIG */}
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
            <div className="flex justify-between">
              <span className="text-text-dim font-sans font-medium">Frecuencia Chequeo:</span>
              <span className="font-bold text-text-main">
                Cada {target.check_interval || 60} segundos
              </span>
            </div>
          </div>
        </div>
      )}
    </NOCDrawer>
  );
}
