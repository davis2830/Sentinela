import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '../../services/platformApi';
import ModalSurface from '../common/ModalSurface';
import { NOCToolbar } from '../common/noc';
import { Building2, ChevronDown } from 'lucide-react';

type Account = {
  id: string;
  email: string;
  name: string;
  organization_id: string | null;
  organization_name: string | null;
  role: 'platform' | 'admin' | 'viewer';
  is_active: boolean;
  email_verified: boolean;
  mfa_enabled: boolean;
  last_login: string | null;
};
type Action = 'activate' | 'deactivate' | 'revoke_sessions' | 'make_admin' | 'make_viewer';
const labels: Record<Action, string> = {
  activate: 'Activar cuenta', deactivate: 'Desactivar cuenta', revoke_sessions: 'Cerrar sesiones web',
  make_admin: 'Asignar como administrador', make_viewer: 'Asignar como Viewer',
};
const outcomes: Record<Action, string> = {
  activate: 'Cuenta activada', deactivate: 'Cuenta desactivada', revoke_sessions: 'Sesiones web cerradas',
  make_admin: 'Rol de administrador asignado', make_viewer: 'Rol de Viewer asignado',
};
const roles = { platform: 'Superadmin', admin: 'Administrador', viewer: 'Viewer' };
const field = 'min-w-0 rounded-xl border border-border-base bg-bg-dark px-3 py-2 text-sm text-text-main';

export default function PlatformUsers({ operatorId, onOpenOrganization }: {
  operatorId: string; onOpenOrganization: (id: string) => void;
}) {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<{ account: Account; action: Action } | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const query = useQuery<{ users: Account[]; total: number; page_size: number }>({
    queryKey: ['platform-admin-users', operatorId, search, status, page],
    queryFn: async ({ signal }) => (await platformApi.get('platform-admin/users/', {
      params: { search, status: status || undefined, page }, signal,
    })).data.data,
  });
  const mutation = useMutation({
    mutationFn: ({ account, action }: { account: Account; action: Action }) =>
      platformApi.post(`platform-admin/users/${account.id}/action/`, { action, reason: reason.trim() }),
    onSuccess: (_, { account, action }) => {
      setNotice(`${outcomes[action]} para ${account.email}.`);
      setSelection(null);
      void client.invalidateQueries({ queryKey: ['platform-admin-users'] });
      void client.invalidateQueries({ queryKey: ['platform-admin-audit'] });
      void client.invalidateQueries({ queryKey: ['platform-admin-org-detail'] });
    },
  });
  function select(account: Account, action: Action) {
    mutation.reset();
    setReason('');
    setNotice('');
    setSelection({ account, action });
  }
  function close() {
    if (!mutation.isPending) setSelection(null);
  }
  const mutationError = mutation.error as { response?: { data?: { message?: string } } } | null;
  return <section className="space-y-4" aria-labelledby="platform-users-title">
    <h2 id="platform-users-title" className="text-xl font-semibold">Directorio de usuarios</h2>
    <NOCToolbar searchTerm={search} searchPlaceholder="Buscar por nombre, correo u organización"
      onSearchChange={value => { setSearch(value.slice(0, 254)); setPage(1); }}
      statusPills={[
        { id: '', label: 'Todos los estados', variant: 'all' },
        { id: 'active', label: 'Activas', variant: 'success' },
        { id: 'inactive', label: 'Desactivadas', variant: 'danger' },
      ]}
      selectedStatus={status} onStatusChange={value => { setStatus(value); setPage(1); }} />
    {notice && <p role="status" className="text-sm text-accent-green">{notice}</p>}
    {query.isPending && <p role="status">Cargando usuarios…</p>}
    {query.isError && <p role="alert">No se pudo cargar el directorio. <button onClick={() => void query.refetch()}>Reintentar</button></p>}
    {query.data && <>
      <div className="overflow-hidden rounded-2xl border border-border-base bg-bg-card">
        <table aria-label="Usuarios de la plataforma" role="table" className="block w-full text-left text-sm lg:table">
          <thead role="rowgroup" className="hidden lg:table-header-group">
            <tr role="row" className="border-b border-border-base bg-bg-dark text-xs text-text-muted">
              {['Usuario', 'Organización', 'Rol y estado', 'Seguridad', 'Último acceso', 'Acciones'].map(label =>
                <th key={label} scope="col" className="px-3 py-3 font-semibold">{label}</th>)}
            </tr>
          </thead>
          <tbody role="rowgroup" className="block divide-y divide-border-base lg:table-row-group">
            {query.data.users.map(account => {
              const actions: Action[] = ['revoke_sessions'];
              if (account.organization_id) actions.push(account.role === 'admin' ? 'make_viewer' : 'make_admin');
              actions.push(account.is_active ? 'deactivate' : 'activate');
              return <tr key={account.id} role="row"
                className="grid grid-cols-2 items-start gap-x-3 gap-y-2 px-3 py-3 hover:bg-bg-card-hover lg:table-row lg:p-0">
                <td role="cell" className="col-span-2 min-w-0 lg:max-w-64 lg:px-3 lg:py-3">
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg border border-accent-green/20 bg-accent-green/10 text-xs font-bold text-accent-green">
                      {(account.name || account.email).slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 break-words">
                      <p className="font-semibold">{account.name || account.email}</p>
                      {account.name && <p className="text-xs text-text-muted">{account.email}</p>}
                    </div>
                  </div>
                </td>
                <td role="cell" className="min-w-0 lg:max-w-52 lg:px-3 lg:py-3">
                  {account.organization_id ? <button type="button" className="inline-flex items-center gap-1.5 text-left text-xs text-accent-green hover:underline"
                    onClick={() => onOpenOrganization(account.organization_id!)}>
                    <Building2 size={14} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 break-words">{account.organization_name || 'Ver organización'}</span>
                  </button> : <span className="text-xs text-text-muted">Sin organización</span>}
                </td>
                <td role="cell" className="space-y-1 lg:px-3 lg:py-3">
                  <p className="text-xs font-medium">{roles[account.role]}</p>
                  <span className="ui-status" data-tone={account.is_active ? 'success' : 'danger'}>{account.is_active ? 'Activa' : 'Desactivada'}</span>
                </td>
                <td role="cell" className="space-y-1 text-xs lg:px-3 lg:py-3">
                  <p className="ui-tone" data-tone={account.email_verified ? 'success' : 'warning'}>{account.email_verified ? 'Correo confirmado' : 'Correo sin confirmar'}</p>
                  <p className="ui-tone" data-tone={account.mfa_enabled ? 'success' : 'muted'}>{account.mfa_enabled ? '2FA activo' : 'Sin 2FA'}</p>
                </td>
                <td role="cell" className="text-xs text-text-muted tabular-nums lg:px-3 lg:py-3">
                  <span className="block lg:hidden">Último acceso</span>
                  {account.last_login ? new Date(account.last_login).toLocaleString('es-GT') : 'Sin registro'}
                </td>
                <td role="cell" className="col-span-2 lg:px-3 lg:py-3">
                  {account.role !== 'platform' && <details name="platform-user-actions">
                    <summary aria-label={'Acciones de ' + account.email} className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-lg border border-border-base px-2.5 text-xs hover:bg-bg-dark">
                      Acciones <ChevronDown size={14} aria-hidden="true" />
                    </summary>
                    <div className="mt-1 grid gap-1 rounded-lg border border-border-base bg-bg-dark p-1">
                      {actions.map(action => <button key={action} type="button" onClick={() => select(account, action)}
                        className={'min-h-9 rounded px-2 text-left text-xs hover:bg-bg-card-hover ' + (action === 'deactivate' ? 'text-accent-red' : '')}>{labels[action]}</button>)}
                    </div>
                  </details>}
                </td>
              </tr>;
            })}
            {!query.data.users.length && <tr role="row" className="block lg:table-row"><td role="cell" colSpan={6} className="block p-4 text-text-muted lg:table-cell">No hay usuarios para estos filtros.</td></tr>}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-base px-3 py-2 text-xs text-text-muted">
          <span>{query.data.total} usuarios encontrados</span>
          <div className="flex items-center gap-2">
            <button type="button" className="min-h-9 rounded-lg border border-border-base px-2 disabled:opacity-40" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
            <span>Página {page}</span>
            <button type="button" className="min-h-9 rounded-lg border border-border-base px-2 disabled:opacity-40" disabled={page * query.data.page_size >= query.data.total} onClick={() => setPage(page + 1)}>Siguiente</button>
          </div>
        </div>
      </div>
    </>}
    {selection && createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <ModalSurface label={labels[selection.action]} onClose={close} className="w-full max-w-md rounded-2xl border border-border-base bg-bg-card p-6">
          <form className="space-y-4" onSubmit={event => { event.preventDefault(); mutation.mutate(selection); }}>
            <h3 className="text-lg font-semibold">{labels[selection.action]}</h3>
            <p className="break-all text-sm text-text-muted">{selection.account.email}</p>
            {selection.action === 'revoke_sessions' && <p className="text-sm text-text-muted">El usuario tendrá que iniciar sesión de nuevo. Sus tokens API conservarán sus permisos.</p>}
            {(selection.action === 'make_admin' || selection.action === 'make_viewer') && <p className="text-sm text-text-muted">El cambio se aplica en esta organización y cierra las sesiones web del usuario. Sus tokens API quedan sujetos al rol nuevo.</p>}
            <label className="block text-sm">Motivo para la auditoría
              <textarea className={field + ' mt-2 block w-full'} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} />
            </label>
            {mutation.isError && <p role="alert" className="text-sm text-accent-red">{mutationError?.response?.data?.message || 'No se pudo aplicar la acción. Verifica tu sesión y el motivo.'}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={close} disabled={mutation.isPending}>Cancelar</button>
              <button className="min-h-11 rounded-xl bg-accent-green px-4 font-semibold text-black disabled:opacity-50"
                disabled={reason.trim().length < 3 || mutation.isPending}>{mutation.isPending ? 'Aplicando…' : 'Confirmar'}</button>
            </div>
          </form>
        </ModalSurface>
      </div>, document.body)}
  </section>;
}
