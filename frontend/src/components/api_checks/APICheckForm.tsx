import React, { useState, useEffect } from 'react';
import type { APICheckTarget, CreateAPICheckTargetData, HTTPMethod } from '../../types/api_checks';
import {
  X,
  Loader2,
  Plug,
  Code2,
  CheckCircle2,
  Lock,
  User,
  Key,
  Plus,
  Trash2,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';

interface APICheckFormProps {
  target?: APICheckTarget | null;
  onSubmit: (data: CreateAPICheckTargetData) => Promise<void>;
  onClose: () => void;
}

type AuthType = 'none' | 'basic' | 'bearer' | 'apikey';
type BodyMode = 'kv' | 'raw';
type SchemaMode = 'builder' | 'raw';

const HTTP_METHODS: HTTPMethod[] = ['GET', 'POST', 'PUT', 'PATCH'];

interface KeyValuePair {
  key: string;
  value: string;
}

interface SchemaFieldPair {
  field: string;
  type: 'string' | 'integer' | 'float' | 'boolean' | 'list' | 'dict';
}

export default function APICheckForm({ target, onSubmit, onClose }: APICheckFormProps) {
  const [activeTab, setActiveTab] = useState<'auth' | 'body' | 'schema'>('auth');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState<HTTPMethod>('GET');
  const [expectedStatus, setExpectedStatus] = useState<number>(200);
  const [expectedTimeMs, setExpectedTimeMs] = useState<number>(2000);
  const [checkInterval, setCheckInterval] = useState<number>(60);
  const [enabled, setEnabled] = useState<boolean>(true);

  // Authentication states
  const [authType, setAuthType] = useState<AuthType>('none');
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [apiKeyHeader, setApiKeyHeader] = useState('X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState('');

  // Body states
  const [bodyMode, setBodyMode] = useState<BodyMode>('kv');
  const [bodyPairs, setBodyPairs] = useState<KeyValuePair[]>([{ key: '', value: '' }]);
  const [requestBodyJson, setRequestBodyJson] = useState('');

  // Schema states
  const [schemaMode, setSchemaMode] = useState<SchemaMode>('builder');
  const [schemaFields, setSchemaFields] = useState<SchemaFieldPair[]>([
    { field: '', type: 'string' },
  ]);
  const [expectedSchemaJson, setExpectedSchemaJson] = useState('');

  const [jsonError, setJsonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (target) {
      setName(target.name);
      setUrl(target.url);
      setMethod(target.method);
      setExpectedStatus(target.expected_status);
      setExpectedTimeMs(target.expected_response_time_ms);
      setCheckInterval(target.check_interval || 60);
      setEnabled(target.enabled);

      // Parse headers for Auth detection
      const headers = target.request_headers || {};
      if (headers['Authorization']) {
        const authHeader = headers['Authorization'];
        if (authHeader.startsWith('Bearer ')) {
          setAuthType('bearer');
          setAuthToken(authHeader.replace('Bearer ', ''));
        } else if (authHeader.startsWith('Basic ')) {
          setAuthType('basic');
          try {
            const decoded = atob(authHeader.replace('Basic ', ''));
            const [u, p] = decoded.split(':');
            setAuthUser(u || '');
            setAuthPass(p || '');
          } catch {
            setAuthUser('');
            setAuthPass('');
          }
        }
      } else {
        const apiKeyEntry = Object.entries(headers).find(([k]) => k.toLowerCase().includes('api'));
        if (apiKeyEntry) {
          setAuthType('apikey');
          setApiKeyHeader(apiKeyEntry[0]);
          setApiKeyValue(apiKeyEntry[1]);
        } else {
          setAuthType('none');
        }
      }

      // Parse body
      const body = target.request_body || {};
      if (Object.keys(body).length > 0) {
        const pairs = Object.entries(body).map(([key, value]) => ({
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        }));
        setBodyPairs(pairs.length > 0 ? pairs : [{ key: '', value: '' }]);
        setRequestBodyJson(JSON.stringify(body, null, 2));
      } else {
        setBodyPairs([{ key: '', value: '' }]);
        setRequestBodyJson('');
      }

      // Parse schema
      const schema = target.expected_schema || {};
      if (Object.keys(schema).length > 0) {
        const fields = Object.entries(schema).map(([field, type]) => ({
          field,
          type: (type as any) || 'string',
        }));
        setSchemaFields(fields.length > 0 ? fields : [{ field: '', type: 'string' }]);
        setExpectedSchemaJson(JSON.stringify(schema, null, 2));
      } else {
        setSchemaFields([{ field: '', type: 'string' }]);
        setExpectedSchemaJson('');
      }
    } else {
      setName('');
      setUrl('');
      setMethod('GET');
      setExpectedStatus(200);
      setExpectedTimeMs(2000);
      setEnabled(true);
      setAuthType('none');
      setAuthUser('');
      setAuthPass('');
      setAuthToken('');
      setApiKeyHeader('X-API-Key');
      setApiKeyValue('');
      setBodyMode('kv');
      setBodyPairs([{ key: '', value: '' }]);
      setRequestBodyJson('');
      setSchemaMode('builder');
      setSchemaFields([{ field: '', type: 'string' }]);
      setExpectedSchemaJson('');
    }
  }, [target]);

  // Body Pair handlers
  const addBodyPair = () => setBodyPairs([...bodyPairs, { key: '', value: '' }]);
  const removeBodyPair = (index: number) => setBodyPairs(bodyPairs.filter((_, i) => i !== index));
  const updateBodyPair = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...bodyPairs];
    updated[index][field] = val;
    setBodyPairs(updated);
  };

  // Schema Field handlers
  const addSchemaField = () => setSchemaFields([...schemaFields, { field: '', type: 'string' }]);
  const removeSchemaField = (index: number) => setSchemaFields(schemaFields.filter((_, i) => i !== index));
  const updateSchemaField = (index: number, key: 'field' | 'type', val: any) => {
    const updated = [...schemaFields];
    updated[index][key] = val;
    setSchemaFields(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJsonError(null);
    if (!name.trim() || !url.trim()) return;

    // 1. Build Headers
    const headers: Record<string, string> = {};
    if (authType === 'basic' && authUser.trim()) {
      const token = btoa(`${authUser.trim()}:${authPass}`);
      headers['Authorization'] = `Basic ${token}`;
    } else if (authType === 'bearer' && authToken.trim()) {
      headers['Authorization'] = `Bearer ${authToken.trim()}`;
    } else if (authType === 'apikey' && apiKeyHeader.trim() && apiKeyValue.trim()) {
      headers[apiKeyHeader.trim()] = apiKeyValue.trim();
    }

    // 2. Build Request Body
    let body: Record<string, any> = {};
    if (method !== 'GET') {
      if (bodyMode === 'kv') {
        bodyPairs.forEach((pair) => {
          if (pair.key.trim()) {
            let parsedVal: any = pair.value.trim();
            if (parsedVal === 'true') parsedVal = true;
            else if (parsedVal === 'false') parsedVal = false;
            else if (!isNaN(Number(parsedVal)) && parsedVal !== '') parsedVal = Number(parsedVal);
            body[pair.key.trim()] = parsedVal;
          }
        });
      } else if (requestBodyJson.trim()) {
        try {
          body = JSON.parse(requestBodyJson);
        } catch {
          setJsonError('El campo "Cuerpo de Petición (Body JSON)" no contiene un formato JSON válido.');
          return;
        }
      }
    }

    // 3. Build Expected Schema
    let schema: Record<string, string> = {};
    if (schemaMode === 'builder') {
      schemaFields.forEach((item) => {
        if (item.field.trim()) {
          schema[item.field.trim()] = item.type;
        }
      });
    } else if (expectedSchemaJson.trim()) {
      try {
        schema = JSON.parse(expectedSchemaJson);
      } catch {
        setJsonError('El campo "Esquema Esperado JSON" no contiene un formato JSON válido.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        url: url.trim(),
        method,
        expected_status: Number(expectedStatus),
        expected_response_time_ms: Number(expectedTimeMs),
        check_interval: Number(checkInterval),
        enabled,
        request_headers: headers,
        request_body: body,
        expected_schema: schema,
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
        className="bg-bg-card border border-border-base rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 border-b border-border-base pb-4">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
            <Plug size={22} className="text-accent-green" />
            {target ? 'Editar API Check Target' : 'Nuevo API Check Target'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors">
            <X size={20} />
          </button>
        </div>

        {jsonError && (
          <div className="mb-4 p-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-xs flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{jsonError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Main Config */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Nombre del Servicio API
              </label>
              <input
                type="text"
                required
                placeholder="ej. Service Health / Users Endpoint"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Método HTTP
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HTTPMethod)}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono font-bold"
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              URL del Endpoint
            </label>
            <input
              type="url"
              required
              placeholder="ej. https://api.miempresa.com/v1/health"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-bg-dark border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent-green font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Status Esperado
              </label>
              <input
                type="number"
                required
                min={100}
                max={599}
                value={expectedStatus}
                onChange={(e) => setExpectedStatus(Number(e.target.value))}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
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
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                Intervalo Monitoreo
              </label>
              <select
                value={checkInterval}
                onChange={(e) => setCheckInterval(Number(e.target.value))}
                className="w-full bg-bg-dark border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-accent-green font-mono font-bold"
              >
                <option value={30}>Cada 30 Seg</option>
                <option value={60}>Cada 1 Min (60s)</option>
                <option value={300}>Cada 5 Min (300s)</option>
                <option value={600}>Cada 10 Min (600s)</option>
                <option value={900}>Cada 15 Min (900s)</option>
                <option value={1800}>Cada 30 Min (1800s)</option>
                <option value={3600}>Cada 1 Hora (3600s)</option>
              </select>
            </div>
          </div>

          {/* Easy Config Tabs Header */}
          <div className="pt-3 border-t border-border-base">
            <div className="flex items-center gap-2 border-b border-border-base mb-4">
              <button
                type="button"
                onClick={() => setActiveTab('auth')}
                className={`px-4 py-2 text-xs font-mono font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'auth'
                    ? 'border-accent-green text-accent-green'
                    : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <Lock size={14} />
                <span>Autenticación</span>
                {authType !== 'none' && <CheckCircle2 size={12} className="text-accent-green" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('body')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'body'
                    ? 'border-accent-green text-accent-green'
                    : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <Code2 size={14} />
                Cuerpo (Body)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('schema')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'schema'
                    ? 'border-accent-green text-accent-green'
                    : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <CheckCircle2 size={14} />
                Validación Respuesta (Schema)
              </button>
            </div>

            {/* TAB 1: AUTHENTICATION */}
            {activeTab === 'auth' && (
              <div className="bg-bg-dark/60 border border-border-base rounded-xl p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-2">
                    Tipo de Autenticación
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthType('none')}
                      className={`px-3 py-2 text-xs font-mono rounded-lg border transition-all ${
                        authType === 'none'
                          ? 'bg-accent-green/10 border-accent-green text-accent-green font-bold'
                          : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
                      }`}
                    >
                      Ninguna
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthType('basic')}
                      className={`px-3 py-2 text-xs font-mono rounded-lg border transition-all ${
                        authType === 'basic'
                          ? 'bg-accent-green/10 border-accent-green text-accent-green font-bold'
                          : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
                      }`}
                    >
                      Basic Auth (User/Pass)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthType('bearer')}
                      className={`px-3 py-2 text-xs font-mono rounded-lg border transition-all ${
                        authType === 'bearer'
                          ? 'bg-accent-green/10 border-accent-green text-accent-green font-bold'
                          : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
                      }`}
                    >
                      Bearer Token (JWT)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthType('apikey')}
                      className={`px-3 py-2 text-xs font-mono rounded-lg border transition-all ${
                        authType === 'apikey'
                          ? 'bg-accent-green/10 border-accent-green text-accent-green font-bold'
                          : 'bg-bg-dark border-border-base text-text-muted hover:text-text-main'
                      }`}
                    >
                      API Key (Header)
                    </button>
                  </div>
                </div>

                {authType === 'basic' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-in fade-in">
                    <div>
                      <label className="block text-xs font-mono text-text-muted mb-1 flex items-center gap-1">
                        <User size={13} className="text-accent-blue" />
                        Usuario
                      </label>
                      <input
                        type="text"
                        placeholder="ej. admin"
                        value={authUser}
                        onChange={(e) => setAuthUser(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-accent-green"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-text-muted mb-1 flex items-center gap-1">
                        <Key size={13} className="text-accent-blue" />
                        Contraseña
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={authPass}
                        onChange={(e) => setAuthPass(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-accent-green"
                      />
                    </div>
                  </div>
                )}

                {authType === 'bearer' && (
                  <div className="pt-2 animate-in fade-in">
                    <label className="block text-xs font-mono text-text-muted mb-1 flex items-center gap-1">
                      <KeyRound size={13} className="text-accent-green" />
                      Token JWT / Bearer Secret
                    </label>
                    <input
                      type="text"
                      placeholder="ej. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      className="w-full bg-bg-card border border-border-base rounded-lg px-3 py-2 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                    />
                  </div>
                )}

                {authType === 'apikey' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-in fade-in">
                    <div>
                      <label className="block text-xs font-mono text-text-muted mb-1">
                        Nombre del Header API Key
                      </label>
                      <input
                        type="text"
                        placeholder="ej. X-API-Key"
                        value={apiKeyHeader}
                        onChange={(e) => setApiKeyHeader(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-lg px-3 py-2 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-text-muted mb-1">
                        Valor de la Clave
                      </label>
                      <input
                        type="text"
                        placeholder="ej. secret_key_12345"
                        value={apiKeyValue}
                        onChange={(e) => setApiKeyValue(e.target.value)}
                        className="w-full bg-bg-card border border-border-base rounded-lg px-3 py-2 text-sm text-text-main font-mono focus:outline-none focus:border-accent-green"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: REQUEST BODY */}
            {activeTab === 'body' && (
              <div className="bg-bg-dark/60 border border-border-base rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-border-base pb-3">
                  <span className="text-xs text-text-muted font-semibold">
                    Modo de Ingreso del Cuerpo
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBodyMode('kv')}
                      className={`px-2.5 py-1 text-xs font-mono rounded ${
                        bodyMode === 'kv'
                          ? 'bg-accent-green text-black font-bold'
                          : 'bg-bg-dark text-text-muted hover:text-text-main'
                      }`}
                    >
                      Pares Clave-Valor (Fácil)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBodyMode('raw')}
                      className={`px-2.5 py-1 text-xs font-mono rounded ${
                        bodyMode === 'raw'
                          ? 'bg-accent-green text-black font-bold'
                          : 'bg-bg-dark text-text-muted hover:text-text-main'
                      }`}
                    >
                      JSON Crudo (Avanzado)
                    </button>
                  </div>
                </div>

                {bodyMode === 'kv' ? (
                  <div className="space-y-2">
                    {bodyPairs.map((pair, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Clave (ej. title)"
                          value={pair.key}
                          onChange={(e) => updateBodyPair(idx, 'key', e.target.value)}
                          className="flex-1 bg-bg-card border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                        />
                        <input
                          type="text"
                          placeholder="Valor (ej. Test)"
                          value={pair.value}
                          onChange={(e) => updateBodyPair(idx, 'value', e.target.value)}
                          className="flex-1 bg-bg-card border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                        />
                        {bodyPairs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBodyPair(idx)}
                            className="p-2 text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addBodyPair}
                      className="flex items-center gap-1.5 text-xs font-mono text-accent-green hover:underline pt-2"
                    >
                      <Plus size={14} />
                      + Agregar Campo al Body
                    </button>
                  </div>
                ) : (
                  <div>
                    <textarea
                      rows={4}
                      placeholder='{\n  "title": "Ejemplo",\n  "count": 1\n}'
                      value={requestBodyJson}
                      onChange={(e) => setRequestBodyJson(e.target.value)}
                      className="w-full bg-bg-card border border-border-base rounded-lg p-3 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: RESPONSE SCHEMA */}
            {activeTab === 'schema' && (
              <div className="bg-bg-dark/60 border border-border-base rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-border-base pb-3">
                  <span className="text-xs text-text-muted font-semibold">
                    Campos Esperados en la Respuesta JSON
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSchemaMode('builder')}
                      className={`px-2.5 py-1 text-xs font-mono rounded ${
                        schemaMode === 'builder'
                          ? 'bg-accent-green text-black font-bold'
                          : 'bg-bg-dark text-text-muted hover:text-text-main'
                      }`}
                    >
                      Selector (Fácil)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchemaMode('raw')}
                      className={`px-2.5 py-1 text-xs font-mono rounded ${
                        schemaMode === 'raw'
                          ? 'bg-accent-green text-black font-bold'
                          : 'bg-bg-dark text-text-muted hover:text-text-main'
                      }`}
                    >
                      JSON Schema (Avanzado)
                    </button>
                  </div>
                </div>

                {schemaMode === 'builder' ? (
                  <div className="space-y-2">
                    {schemaFields.map((sf, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Nombre del Campo (ej. status)"
                          value={sf.field}
                          onChange={(e) => updateSchemaField(idx, 'field', e.target.value)}
                          className="flex-1 bg-bg-card border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                        />
                        <select
                          value={sf.type}
                          onChange={(e) => updateSchemaField(idx, 'type', e.target.value)}
                          className="w-40 bg-bg-card border border-border-base rounded-lg px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green font-bold"
                        >
                          <option value="string">Texto (string)</option>
                          <option value="integer font-bold">Entero (integer)</option>
                          <option value="float">Decimal (float)</option>
                          <option value="boolean">Booleano (boolean)</option>
                          <option value="list">Lista (array)</option>
                          <option value="dict">Objeto (dict)</option>
                        </select>
                        {schemaFields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSchemaField(idx)}
                            className="p-2 text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addSchemaField}
                      className="flex items-center gap-1.5 text-xs font-mono text-accent-green hover:underline pt-2"
                    >
                      <Plus size={14} />
                      + Agregar Campo a Validar
                    </button>
                  </div>
                ) : (
                  <div>
                    <textarea
                      rows={4}
                      placeholder='{\n  "status": "string",\n  "id": "integer"\n}'
                      value={expectedSchemaJson}
                      onChange={(e) => setExpectedSchemaJson(e.target.value)}
                      className="w-full bg-bg-card border border-border-base rounded-lg p-3 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                    />
                  </div>
                )}
              </div>
            )}
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
              className="flex-1 py-2.5 border border-border-base rounded-full text-sm text-text-muted hover:bg-bg-dark transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-accent-green text-black font-semibold rounded-full text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : target ? 'Actualizar' : 'Crear API Check'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
