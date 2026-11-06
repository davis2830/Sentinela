import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import Turnstile from '../../components/auth/Turnstile';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function PasswordRecoveryPage({ reset = false }: { reset?: boolean }) {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState('');
  const [epoch, setEpoch] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const emailField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname);
    if (!reset) api.get('auth/beta/config/').then(r => setSiteKey(r.data.data.turnstile_site_key))
      .catch(() => setError('No pudimos cargar la protección del formulario. Recarga para reintentar.'));
  }, [reset]);
  function validateEmail() {
    const value = email.trim();
    const message = !value ? 'Escribe tu correo electrónico.'
      : !emailField.current?.validity.valid || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? 'Escribe un correo válido, por ejemplo nombre@empresa.com.' : '';
    setEmailError(message);
    return !message;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!reset && !validateEmail()) { emailField.current?.focus(); return; }
    if (reset && password !== confirmation) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    try {
      const response = await api.post(reset ? 'auth/password/reset/' : 'auth/password/recovery/',
        reset ? { token, password } : { email: email.trim(), turnstile_token: captcha });
      if (response.data?.success !== true) throw new Error('Unconfirmed recovery response');
      setDone(true); setPassword(''); setConfirmation('');
      if (reset) {
        await useAuthStore.getState().logout();
        useAuthStore.getState().cancel2FA();
      }
    } catch (err: any) {
      const data = err.response?.data;
      const details = data?.errors?.password || data?.errors?.email || data?.password || data?.email;
      setError(err.response?.status === 429 ? 'Alcanzaste el límite de intentos. Espera antes de solicitar otro enlace o vuelve a intentarlo más tarde.'
        : (Array.isArray(details) ? details.join(' ') : '') || data?.message || 'No pudimos completar la solicitud. Intenta nuevamente.');
      setCaptcha(''); setEpoch(value => value + 1);
    } finally { setBusy(false); }
  }
  const field = 'block w-full min-h-12 rounded-xl border border-border-base bg-bg-dark px-3.5 py-3 text-sm text-text-main placeholder:text-text-dim';
  const title = done ? (reset ? 'Contraseña cambiada correctamente' : 'Revisa tu correo')
    : reset ? 'Elige una nueva contraseña' : 'Recupera tu acceso';
  const Icon = done ? CheckCircle2 : reset ? KeyRound : Mail;
  return <AuthLayout>
    <section className="w-full rounded-3xl border border-border-base bg-bg-card p-7 sm:p-9" aria-labelledby="recovery-title">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-accent-green/30 bg-accent-green/10 text-accent-green" aria-hidden="true"><Icon size={25} /></div>
      <h1 id="recovery-title" className="text-2xl font-bold leading-tight text-text-main">{title}</h1>
      {!done && <p className="mt-3 text-sm leading-relaxed text-text-muted">{reset
        ? 'Crea una contraseña única para proteger tu cuenta. El enlace vence en una hora y solo se puede usar una vez.'
        : 'Escribe el correo de tu cuenta para solicitar un enlace de recuperación.'}</p>}

      {done ? <div role="status" className="mt-5 rounded-2xl border border-accent-green/25 bg-accent-green/5 p-4 text-sm leading-relaxed text-text-main">
        <p>{reset ? 'Tu contraseña se actualizó correctamente. Inicia sesión nuevamente con tu nueva contraseña.'
          : 'Si hay una cuenta habilitada con ese correo, procesaremos un enlace de recuperación. Revisa tu bandeja de entrada y la carpeta de spam.'}</p>
        {reset && <p className="mt-2 text-text-muted">Si usas verificación en dos pasos, seguirás necesitándola.</p>}
      </div> : <>
        {error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-accent-red/30 bg-accent-red/5 p-4 text-sm text-text-main">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-accent-red" aria-hidden="true" />
          <div><p className="font-semibold">{reset ? 'No pudimos cambiar tu contraseña' : 'No pudimos procesar la solicitud'}</p><p className="mt-1 leading-relaxed">{error}</p></div>
        </div>}
        {reset && !token ? <p role="alert" className="my-5 rounded-xl border border-accent-yellow/30 bg-accent-yellow/5 p-4 text-sm text-text-main">Este enlace está incompleto. Solicita uno nuevo para cambiar tu contraseña.</p>
          : <form onSubmit={submit} noValidate={!reset} className="mt-6 space-y-5" aria-busy={busy}>
            {reset ? <>
              <div className="space-y-2">
                <label htmlFor="recovery-password" className="block text-sm font-medium text-text-main">Nueva contraseña</label>
                <input id="recovery-password" className={field} type="password" autoComplete="new-password" aria-describedby="password-help" minLength={8} maxLength={256} required value={password} onChange={e => setPassword(e.target.value)} />
                <p id="password-help" className="text-xs leading-relaxed text-text-muted">Usa al menos 8 caracteres. Evita contraseñas comunes y datos personales.</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="recovery-confirmation" className="block text-sm font-medium text-text-main">Confirmar contraseña</label>
                <input id="recovery-confirmation" className={field} type="password" autoComplete="new-password" maxLength={256} required value={confirmation} onChange={e => setConfirmation(e.target.value)} />
              </div>
            </> : <>
              <div className="space-y-2">
                <label htmlFor="recovery-email" className="block text-sm font-medium text-text-main">Correo electrónico</label>
                <input ref={emailField} id="recovery-email" className={field} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="nombre@empresa.com" maxLength={254} required value={email}
                  aria-invalid={!!emailError} aria-describedby={emailError ? 'recovery-email-error' : 'recovery-email-help'}
                  onBlur={() => { if (email) validateEmail(); }} onChange={e => { setEmail(e.target.value); setEmailError(''); }} />
                {emailError ? <p id="recovery-email-error" role="alert" className="text-xs leading-relaxed text-accent-red">{emailError}</p>
                  : <p id="recovery-email-help" className="text-xs leading-relaxed text-text-muted">Usa el correo con el que creaste tu cuenta.</p>}
              </div>
              {siteKey !== null && <Turnstile key={epoch} siteKey={siteKey} action="password_reset" onToken={setCaptcha} />}
            </>}
            <button className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-green px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-accent-green/90 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || (!reset && (siteKey === null || (!!siteKey && !captcha)))}>
              {busy ? 'Procesando…' : reset ? 'Guardar contraseña' : 'Solicitar enlace'}
            </button>
          </form>}
        {reset && <Link className="mt-3 flex min-h-11 items-center text-sm text-accent-green" to="/forgot-password">Solicitar otro enlace</Link>}
      </>}
      <Link className={done ? 'mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-green px-4 py-3 text-sm font-semibold text-black hover:bg-accent-green/90'
        : 'mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-accent-green hover:underline'} to="/login">
        {!done && <ArrowLeft size={16} aria-hidden="true" />}Volver a iniciar sesión
      </Link>
    </section>
  </AuthLayout>;
}
