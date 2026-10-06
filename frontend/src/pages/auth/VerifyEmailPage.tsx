import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Clock3, Loader2, Mail, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import Turnstile from '../../components/auth/Turnstile';
import { api } from '../../services/api';

type VerificationStatus = { status: string; delivery_status: string; retry_after_seconds?: number };

export default function VerifyEmailPage() {
  const location = useLocation();
  const isConfirmation = location.pathname === '/verify-email';
  const [token, setToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') || '');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [invalidLink, setInvalidLink] = useState(false);
  const [status, setStatus] = useState('pending_verification');
  const [delivery, setDelivery] = useState('unknown');
  const [wait, setWait] = useState(0);
  const [siteKey, setSiteKey] = useState('');
  const [configReady, setConfigReady] = useState(false);
  const [statusReady, setStatusReady] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [captchaEpoch, setCaptchaEpoch] = useState(0);
  const session = sessionStorage.getItem('sentinel:registration-session') || '';

  useEffect(() => {
    const incoming = new URLSearchParams(location.hash.slice(1)).get('token');
    if (incoming) { setToken(incoming); setInvalidLink(false); setError(''); setDone(false); }
    // Remove the secret without overwriting React Router's history metadata.
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, [location.key, location.hash]);

  useEffect(() => {
    let active = true;
    api.get('auth/beta/config/').then(r => {
      if (active) { setSiteKey(r.data.data.turnstile_site_key || ''); setConfigReady(true); }
    }).catch(() => { if (active) setError('No pudimos cargar la verificación de seguridad. Recarga esta página.'); });
    return () => { active = false; };
  }, []);

  const applyStatus = (data: VerificationStatus) => {
    setStatus(data.status); setDelivery(data.delivery_status); setStatusReady(true);
    setWait(Math.max(0, data.retry_after_seconds ?? 0));
  };
  useEffect(() => {
    if (isConfirmation || !session) return;
    let active = true;
    let polls = 0;
    let timer: number | undefined;
    const refresh = async () => {
      try {
        const r = await api.post('auth/beta/status/', { token: session });
        if (!active) return;
        applyStatus(r.data.data);
        // Bounded polling of a queued message, not indefinite requests after SMTP acceptance.
        if (r.data.data.delivery_status === 'queued' && ++polls < 12) timer = window.setTimeout(refresh, 5000);
      } catch {
        if (active) setError('No pudimos consultar el envío. Recarga esta página para revisar su estado.');
      }
    };
    void refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, [isConfirmation, session, captchaEpoch]);

  useEffect(() => {
    const timer = window.setInterval(() => setWait(v => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const submit = async () => {
    if (busy || (isConfirmation && !token)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      // The verification link is proof; only resend requires Turnstile.
      const payload = isConfirmation ? { token } : { token: session, turnstile_token: captcha };
      const r = await api.post(`auth/beta/${isConfirmation ? 'verify' : 'resend'}/`, payload);
      setMessage(r.data.data.message || 'Solicitud recibida.');
      if (isConfirmation) {
        setDone(true);
        sessionStorage.removeItem('sentinel:registration-session');
        localStorage.setItem('sentinel_launch_onboarding', 'true');
      } else { setWait(r.data.data.retry_after_seconds || 60); setDelivery('queued'); }
    } catch (e: any) {
      const data = e.response?.data;
      setError(data?.message || data?.detail || (data?.token
        ? 'Este enlace está incompleto. Abre el botón del correo más reciente o solicita un enlace nuevo.'
        : !e.response ? 'No pudimos conectar con Sentinel. Comprueba tu conexión e intenta nuevamente.'
        : 'No pudimos completar la solicitud. Intenta nuevamente.'));
      if (isConfirmation && e.response?.status === 400) setInvalidLink(true);
      if (e.response?.status === 429) setWait(Number(e.response.headers?.['retry-after']) || 60);
    } finally {
      setBusy(false);
      if (!isConfirmation) { setCaptcha(''); setCaptchaEpoch(v => v + 1); }
    }
  };

  const invalid = ['revoked', 'rejected', 'suspended', 'expired'].includes(status);
  const verified = done || status === 'active';
  const missingLink = isConfirmation && !token;
  const needsNewLink = missingLink || invalidLink;
  const deliveryText = !session ? 'Inicia sesión con tu cuenta pendiente para solicitar un nuevo enlace.'
    : !statusReady ? 'Consultando el estado del correo…'
    : invalid ? 'Tu invitación ya no está disponible. Contacta al administrador.'
    : delivery === 'failed' ? 'No pudimos enviar el correo. Puedes solicitar otro enlace o contactar al administrador.'
    : delivery === 'sent' ? 'El servidor de correo aceptó el mensaje. Revisa tu bandeja de entrada y spam; puede tardar unos minutos.'
    : delivery === 'expired' ? 'El enlace anterior venció. Solicita uno nuevo.'
    : delivery === 'queued' ? 'Tu correo está en cola. Estamos esperando la confirmación del servidor de correo.'
    : 'No hay un envío confirmado. Puedes solicitar un nuevo enlace con el botón de abajo.';
  const disabled = busy || invalid || (isConfirmation ? needsNewLink || wait > 0
    : !session || !configReady || !statusReady || wait > 0 || (!!siteKey && !captcha));
  const Icon = verified ? CheckCircle2 : needsNewLink ? TriangleAlert : Mail;

  return <AuthLayout>
    <section className="relative w-full overflow-hidden rounded-3xl border border-border-base bg-bg-card shadow-2xl" aria-labelledby="verification-title">
      <div className="h-1 bg-gradient-to-r from-accent-green/10 via-accent-green to-accent-green/10" />
      <div className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-text-muted">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-green/20 bg-accent-green/5 px-3 py-1.5 text-accent-green"><ShieldCheck size={14} /> Acceso seguro</span>
          <span>Sentinel · GCTechOps</span>
        </div>
        <ol aria-label="Progreso de tu cuenta" className="flex items-start justify-between gap-2 text-xs text-text-muted">
          {['Registro', 'Verificar correo', 'Primer monitor'].map((label, index) => <li key={label} className="flex-1 space-y-2" aria-current={index === (verified ? 2 : 1) ? 'step' : undefined}>
            <div className={`h-1 rounded-full ${index === 0 || verified ? 'bg-accent-green' : index === 1 ? 'bg-accent-green opacity-50' : 'bg-border-base'}`} />
            <span className="flex items-center gap-1.5">{(index === 0 || (index === 1 && verified)) && <Check size={12} />} {label}</span>
          </li>)}
        </ol>
        <div>
          <div className={`mb-4 inline-flex rounded-2xl border p-3 ${needsNewLink ? 'border-amber-500/25 bg-amber-500/10 text-amber-400' : 'border-accent-green/20 bg-accent-green/10 text-accent-green'}`}><Icon size={28} strokeWidth={1.6} /></div>
          <h1 id="verification-title" className="text-2xl font-semibold tracking-tight">{verified ? 'Correo confirmado' : isConfirmation ? 'Confirma tu correo' : 'Revisa tu correo'}</h1>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">{verified ? 'Tu cuenta está lista. Inicia sesión para configurar tu primer monitor.'
            : missingLink ? 'Esta página no tiene un enlace de verificación. Abre el botón del correo más reciente; recargar esta página no recupera el enlace.'
            : isConfirmation ? 'Estás a un paso de continuar. Confirma que este correo te pertenece para habilitar tu cuenta.'
            : 'Tu cuenta está pendiente de verificación. Iniciar sesión no envía otro correo ni activa el monitoreo.'}</p>
        </div>
        {!isConfirmation && !verified && <div aria-live="polite" className="flex gap-3 rounded-2xl border border-border-base bg-bg-dark/50 p-4 text-sm leading-relaxed text-text-muted">
          {delivery === 'queued' || !statusReady ? <Clock3 size={18} className="mt-0.5 shrink-0 text-accent-green" /> : <Mail size={18} className="mt-0.5 shrink-0 text-accent-green" />}
          <p>{deliveryText}</p>
        </div>}
        {error && <div role="alert" className="flex gap-3 rounded-xl border border-accent-red/25 bg-accent-red/5 p-4 text-sm leading-relaxed text-accent-red"><TriangleAlert size={18} className="shrink-0 mt-0.5" /><p>{error}</p></div>}
        {message && !verified && <p role="status" className="text-sm text-accent-green">{message}</p>}
        {!verified && <div className="space-y-4">
          {!isConfirmation && session && !invalid && <Turnstile key={captchaEpoch} siteKey={siteKey} action="resend" onToken={setCaptcha} />}
          {needsNewLink ? <Link to={session ? '/check-email' : '/login'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-green px-4 py-3 text-sm font-semibold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-green">Solicitar otro enlace <ArrowRight size={16} /></Link>
            : <button onClick={submit} disabled={disabled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-green px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-accent-green/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-green">
              {busy ? <Loader2 size={17} className="animate-spin" /> : isConfirmation ? <ShieldCheck size={17} /> : <RefreshCw size={17} />}
              {busy ? 'Procesando…' : isConfirmation ? wait > 0 ? `Intentar en ${wait} s` : 'Confirmar correo' : wait > 0 ? `Reenviar en ${wait} s` : 'Reenviar correo'}
            </button>}
          <p className="text-xs leading-relaxed text-text-muted">Usa siempre el correo más reciente. Al reenviar, los enlaces anteriores dejan de funcionar. El enlace de confirmación vence en 30 minutos.</p>
        </div>}
        <Link to="/login" className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-green ${verified ? 'bg-accent-green text-black' : 'text-text-muted hover:text-text-main'}`}>Ir a iniciar sesión <ArrowRight size={16} /></Link>
        <div className="flex items-start gap-2 border-t border-border-base pt-4 text-xs leading-relaxed text-text-muted"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent-green" /><p>La verificación protege tu cuenta. Sentinel nunca te pedirá tu contraseña por correo.</p></div>
      </div>
    </section>
  </AuthLayout>;
}
