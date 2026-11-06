import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { platformApi, usePlatformSession } from '../../services/platformApi';

export default function PlatformLoginPage() {
  const navigate = useNavigate();
  const { session, setSession } = usePlatformSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
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
  const inputClass = 'block w-full rounded-xl border border-border-base bg-bg-dark px-4 py-3 text-text-main';
  return <main className="flex min-h-screen items-center justify-center bg-bg-dark p-4">
    <section className="w-full max-w-md space-y-5 rounded-3xl border border-border-base bg-bg-card p-6 sm:p-8">
      <ShieldCheck size={30} className="text-accent-green" aria-hidden="true" />
      <h1 className="text-2xl font-semibold">Acceso administrativo</h1>
      <p className="text-sm text-text-muted">{challenge ? 'Ingresa los seis dígitos de tu aplicación autenticadora.' : 'Consola de plataforma de Sentinel. Acceso exclusivo para superadmins con 2FA.'}</p>
      <form className="space-y-4" onSubmit={submit} aria-busy={pending}>
        {challenge ? <label className="block space-y-2 text-sm">
          <span>Código de autenticación</span>
          <input className={inputClass} value={code} onChange={event => setCode(event.target.value)}
            autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus />
        </label> : <>
          <label className="block space-y-2 text-sm"><span>Correo administrativo</span>
            <input className={inputClass} type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required />
          </label>
          <label className="block space-y-2 text-sm"><span>Contraseña</span>
            <input className={inputClass} type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
        </>}
        {error && <p role="alert" className="rounded-xl border border-accent-red/30 p-3 text-sm text-accent-red">{error}</p>}
        <button className="min-h-11 w-full rounded-xl bg-accent-green px-4 font-semibold text-black disabled:opacity-50" disabled={pending}>
          {pending ? 'Verificando…' : challenge ? 'Entrar a la consola' : 'Continuar'}
        </button>
      </form>
      {challenge
        ? <button disabled={pending} className="text-sm text-accent-green" onClick={() => { setChallenge(''); setCode(''); setError(''); }}>Volver a introducir credenciales</button>
        : <a className="inline-flex min-h-11 items-center text-sm text-accent-green" href={profileURL}>Configurar 2FA desde mi perfil</a>}
    </section>
  </main>;
}
