import { useEffect, useState } from 'react';
import { api } from '../services/api';

export function useConfigurationDiagnostic() {
  const [notice, setNotice] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) setRetryAt(0);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const isLimit = (error: any) => String(error?.response?.data?.errors?.code || '').startsWith('DIAGNOSTIC_');
  const run = async (endpoint: string, payload: Record<string, unknown>) => {
    setNotice('');
    const method = String(payload.http_method || payload.method || 'GET').toUpperCase();
    const http = endpoint.includes('api-checks/') || endpoint.includes('monitoring/') && ['http','https','api'].includes(String(payload.target_type || 'http'));
    if (http && !['GET','HEAD'].includes(method)) {
      if (!window.confirm(`Esta prueba enviará una solicitud ${method} y puede modificar datos en el servicio remoto. ¿Quieres ejecutarla?`)) {
        setNotice('Prueba cancelada. Puedes seguir configurando o guardar el monitor.');
        throw { response: {data:{errors:{code:'DIAGNOSTIC_CANCELLED'}}} };
      }
      payload = {...payload, confirm_side_effects:true};
    }
    try {
      const response = await api.post(endpoint,payload);
      const metadata = response.data?.diagnostic;
      setRetryAt(0);
      if (metadata?.checked_at) {
        const time = new Date(metadata.checked_at).toLocaleTimeString();
        setNotice(metadata.cached ? `Resultado reciente reutilizado, comprobado a las ${time}. No se realizó otra conexión.` : `Configuración probada a las ${time}. Esta prueba no activa el monitoreo.`);
      }
      return response;
    } catch (error: any) {
      if (isLimit(error)) {
        setNotice(error.response.data.message);
        const seconds = Number(error.response.data.errors.retry_after_seconds);
        if (Number.isFinite(seconds) && seconds > 0) {setRetryAt(Date.now()+seconds*1000);setNow(Date.now());}
      }
      throw error;
    }
  };
  return {run,isLimit,notice,remaining};
}
