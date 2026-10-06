import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

type Invitation = { id: string; email: string; status: string; expires_at: string; reason: string;
  delivery?: { status: string; attempts: number } };
type Beta = { capacity: number; admissions_open: boolean; invitations: Invitation[] };
const labels: Record<string, string> = { invited: 'Invitada', pending_verification: 'Correo pendiente', active: 'Activa', suspended: 'Suspendida', revoked: 'Revocada', rejected: 'Rechazada' };

export default function BetaAdminPanel() {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [capacity, setCapacity] = useState(20);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, error, refetch } = useQuery<Beta>({ queryKey: ['beta-admin'],
    queryFn: async () => (await api.get('auth/beta/admin/')).data.data });
  const action = async (name: string, invitation_id?: string) => {
    setBusy(true); setMessage('');
    try {
      await api.post('auth/beta/admin/', { action: name, reason, email: name === 'invite' ? email : undefined,
        invitation_id, capacity: name === 'configure' ? capacity : undefined,
        admissions_open: name === 'configure' ? !data?.admissions_open : undefined });
      setMessage(name === 'invite' ? 'Invitación en cola. Comprueba su estado de envío.' : 'Cambio registrado.');
      void refetch();
    } catch (e: any) { setMessage(e.response?.data?.message || 'No se pudo completar la acción.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-border-base bg-bg-card p-5 space-y-4">
    <h2 className="font-semibold text-lg">Beta privada</h2>
    {error && <p role="alert">No pudimos consultar la beta. <button onClick={() => void refetch()}>Reintentar</button></p>}
    <p className="text-sm text-text-muted">{data ? `Admisiones ${data.admissions_open ? 'abiertas' : 'cerradas'} · ${data.capacity} cupos` : 'Consultando…'} · Free: 3 monitores / 5 minutos. Cerrar admisiones no suspende cuentas activas.</p>
    <div className="flex flex-wrap gap-3 items-end text-sm">
      <label>Motivo obligatorio<input value={reason} onChange={e => setReason(e.target.value)} className="block rounded-lg bg-bg-dark border border-border-base p-2" /></label>
      <label>Cupos<input type="number" min={1} max={100} value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="block w-20 rounded-lg bg-bg-dark border border-border-base p-2" /></label>
      <button disabled={busy || reason.trim().length < 3 || !data} onClick={() => void action('configure')} className="border border-border-base rounded-lg p-2 disabled:opacity-50">{data?.admissions_open ? 'Cerrar admisiones' : 'Abrir admisiones'}</button>
      <label>Correo de invitación<input type="email" value={email} onChange={e => setEmail(e.target.value)} className="block rounded-lg bg-bg-dark border border-border-base p-2" /></label>
      <button disabled={busy || !email || reason.trim().length < 3 || !data?.admissions_open} onClick={() => void action('invite')} className="bg-accent-green text-black rounded-lg p-2 disabled:opacity-50">Invitar</button>
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
    <ul className="divide-y divide-border-base">
      {data?.invitations.map(inv => <li key={inv.id} className="py-3 flex flex-wrap items-center gap-3 text-sm">
        <div className="min-w-0 flex-1"><p className="break-all font-medium">{inv.email}</p><p className="text-xs text-text-muted">{labels[inv.status] || inv.status} · {inv.delivery?.status || 'Sin envío'} · vence {new Date(inv.expires_at).toLocaleDateString()}</p></div>
        {(inv.status === 'invited' ? ['resend', 'revoke'] : inv.status === 'pending_verification' ? ['reject'] : inv.status === 'active' ? ['suspend'] : inv.status === 'suspended' ? ['resume'] : []).map(name =>
          <button key={name} disabled={busy || reason.trim().length < 3} onClick={() => void action(name, inv.id)} className="rounded-lg border border-border-base px-3 py-2 disabled:opacity-50">{{ resend: 'Reenviar', revoke: 'Revocar', reject: 'Rechazar', suspend: 'Suspender', resume: 'Reactivar' }[name]}</button>)}
      </li>)}
    </ul>
  </section>;
}
