import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, KeyRound, LogIn, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import { platformApi, usePlatformSession } from '../../services/platformApi';

export default function PlatformLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, setSession } = usePlatformSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (challenge && !pending) codeInput.current?.focus(); }, [challenge, pending]);
  const profileURL = import.meta.env.PROD ? 'https://sentinel.gctechops.com/profile?tab=security' : '/profile?tab=security';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setPending(true);
    try {
      if (challenge) {
        const { data } = await platformApi.post('platform-admin/session/verify/', { challenge, code });
        const { token, expires_in, user } = data.data;
        setSession({ token, expiresAt: Date.now() + expires_in * 1000, user });
        navigate('/admin/platform', { replace: true });
      } else {
        const { data } = await platformApi.post('platform-admin/session/login/', { email, password });
        setChallenge(data.data.challenge);
        setPassword('');
        setShowPassword(false);
      }
    } catch (err) {
      const response = (err as { response?: { status?: number; data?: { message?: string } } }).response;
      setError(response?.status === 429
        ? 'Espera antes de volver a intentarlo. Si el código ya se usó, usa el siguiente de tu autenticador.'
        : response?.data?.message || 'No pudimos verificar tus credenciales.');
    } finally {
      setPending(false);
    }
  }

  if (session && session.expiresAt > Date.now()) return <Navigate to="/admin/platform" replace />;
  const inputClass = 'w-full bg-bg-dark border border-border-base focus:border-accent-green rounded-xl px-4 py-3.5 pl-11 text-base text-text-main placeholder:text-text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent-green/20 transition-all font-sans disabled:opacity-60';
  return <AuthLayout>
    <AuthCard title={challenge ? 'Verificación 2FA' : 'Acceso administrativo'} subtitle={challenge ? 'Ingresa los seis dígitos de tu aplicación autenticadora.' : 'Consola de plataforma de Sentinel. Acceso exclusivo para superadmins con 2FA.'}>
      {location.state?.expired && <p role="status" className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">La sesión administrativa terminó. Inicia sesión de nuevo con tu autenticador.</p>}
      {error && <div role="alert" className="mb-5 flex items-center gap-3 rounded-xl border border-accent-red/40 bg-accent-red/10 px-4 py-3 text-sm text-accent-red"><AlertCircle size={18} className="shrink-0" /><span>{error}</span></div>}
      <form className="space-y-5" onSubmit={submit} aria-busy={pending}>
        {challenge ? <>
          <div className="flex items-start gap-3 rounded-2xl border border-accent-blue/20 bg-accent-blue/5 p-4"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-accent-blue" /><p className="text-xs text-text-muted"><strong className="mb-1 block font-semibold text-text-main">Autenticación multifactor requerida</strong>Abre tu aplicación autenticadora para completar el acceso administrativo.</p></div>
          <div><label htmlFor="platform-code" className="mb-2 block text-center text-sm font-semibold text-text-muted">Código de autenticación</label><div className="group relative"><KeyRound size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent-green" />
            <input ref={codeInput} id="platform-code" type="text" className={inputClass+' text-center font-mono !text-xl tracking-[0.25em]'} value={code} onChange={event=>{setCode(event.target.value);setError('');}} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000 000" required disabled={pending} />
          </div></div>
        </> : <>
          <div><label htmlFor="platform-email" className="mb-1.5 block text-sm font-semibold text-text-muted">Correo administrativo</label><div className="group relative"><Mail size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent-green" />
            <input id="platform-email" className={inputClass} type="email" placeholder="usuario@dominio.com" value={email} onChange={event=>{setEmail(event.target.value);setError('');}} autoComplete="username" required disabled={pending} />
          </div></div>
          <div><label htmlFor="platform-password" className="mb-1.5 block text-sm font-semibold text-text-muted">Contraseña</label><div className="group relative"><Lock size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent-green" />
            <input id="platform-password" className={inputClass+' pr-14'} type={showPassword ? 'text' : 'password'} placeholder="••••••••••••" value={password} onChange={event=>{setPassword(event.target.value);setError('');}} autoComplete="current-password" required disabled={pending} />
            <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'} aria-pressed={showPassword} disabled={pending} onClick={()=>setShowPassword(value=>!value)} className="absolute right-2 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-lg text-text-dim transition-colors hover:text-text-main focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-green">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div></div>
        </>}
        <button type="submit" className="mt-2 flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-accent-green px-6 py-4 font-sans text-base font-bold text-black shadow-xl shadow-accent-green/20 transition-all duration-200 hover:bg-accent-green-glow disabled:cursor-not-allowed disabled:opacity-60" disabled={pending}>
          {pending ? <Loader2 size={20} className="animate-spin" /> : challenge ? <ShieldCheck size={20} /> : <LogIn size={20} />}
          {pending ? 'Verificando…' : challenge ? 'Entrar a la consola' : 'Continuar'}
        </button>
      </form>
      <div className="mt-7 border-t border-border-base/50 pt-5 text-center">
        {challenge ? <button type="button" disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 text-xs text-text-muted transition-colors hover:text-text-main" onClick={()=>{setChallenge('');setCode('');setError('');}}><ArrowLeft size={14} />Volver a introducir credenciales</button>
          : <a className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-green hover:underline" href={profileURL}>Configurar 2FA desde mi perfil</a>}
      </div>
    </AuthCard>
  </AuthLayout>;
}
