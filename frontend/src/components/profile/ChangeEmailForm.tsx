import { useState } from 'react';
import { api } from '../../services/api';

export default function ChangeEmailForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return <section className="mt-4 space-y-3 text-sm">
    <h3 className="font-semibold">Cambiar correo con confirmación</h3>
    <p className="text-xs text-text-muted">El correo actual seguirá vigente hasta confirmar el nuevo. Después se cerrarán tus sesiones y tokens API.</p>
    <label className="block">Nuevo correo<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="block w-full rounded-lg bg-bg-dark border border-border-base px-3 py-2" /></label>
    <label className="block">Contraseña actual<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="block w-full rounded-lg bg-bg-dark border border-border-base px-3 py-2" /></label>
    <button type="button" disabled={busy || !email || !password} className="rounded-lg border border-border-base px-3 py-2 disabled:opacity-50" onClick={async () => {
      setBusy(true); setMessage('');
      try {
        const r = await api.post('auth/email/change/', { email, password });
        setMessage(r.data.data.message); setPassword('');
      } catch (e: any) { setMessage(e.response?.data?.message || 'No pudimos solicitar el cambio.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Enviando…' : 'Enviar confirmación'}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
