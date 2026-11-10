import { useState } from 'react';
import { ArrowRight, Building2, Users, TrendingUp, DollarSign, CircleAlert, Clock3, PauseCircle, Server, Activity } from 'lucide-react';
import { NOCKpiCard } from '../common/noc';
import type { PlatformStats } from '../../types/platform_admin';
import OrganizationDistribution, { subscriptionStates } from './OrganizationDistribution';
import { ActionButton } from './PlatformUI';

export default function PlatformSummary({ stats, onOpenDirectory }: {
  stats: PlatformStats; onOpenDirectory: (plan: string, status: string, expiring?: boolean) => void;
}) {
  const [distribution, setDistribution] = useState<'plan' | 'status'>('plan');
  const attention = [
    { id:'past_due', label:'Pago pendiente', count:stats.organizations.by_status.past_due ?? 0, icon:CircleAlert, hint:'Estado de suscripción; no confirma un cobro.', tone:'danger' },
    { id:'trialing', label:'Pruebas por vencer', count:stats.organizations.trial_expiring_7d ?? 0, icon:Clock3, hint:'Vencen durante los próximos 7 días.', tone:'warning' },
    { id:'suspended', label:'Organizaciones suspendidas', count:stats.organizations.by_status.suspended ?? 0, icon:PauseCircle, hint:'Suscripciones suspendidas que puedes revisar.', tone:'muted' },
  ];
  return <div className="space-y-5">
    <section aria-labelledby="platform-attention-title" className="platform-section">
      <div className="mb-3 flex items-baseline justify-between gap-3"><h2 id="platform-attention-title" className="text-base font-semibold">Requiere atención</h2><span className="text-xs text-text-muted">Suscripciones de clientes</span></div>
      <div className="grid gap-4 md:grid-cols-3">{attention.map(({ id, label, count, icon: Icon, hint, tone }) => <div key={id} className="min-w-0 border-t border-border-base pt-3">
        <div className="flex items-center gap-2 text-sm text-text-muted"><Icon size={16} aria-hidden="true" /><span>{label}</span></div>
        <div className="mt-1 flex items-baseline gap-2"><strong className="text-3xl font-semibold tabular-nums ui-tone" data-tone={count > 0 ? tone : 'muted'}>{count}</strong><span className="text-xs text-text-muted">{count === 1 ? 'organización' : 'organizaciones'}</span></div>
        {count > 0 ? <ActionButton tone="tertiary" className="mt-1 !px-0 text-accent-green" onClick={() => onOpenDirectory('all', id, id === 'trialing')}>Ver {count} {count === 1 ? 'organización' : 'organizaciones'}{id === 'past_due' ? ' con pago pendiente' : id === 'trialing' ? ' con prueba por vencer' : ' suspendidas'}<ArrowRight size={15} aria-hidden="true" /></ActionButton> : <p className="mt-3 text-sm text-text-muted">Sin pendientes en este criterio</p>}
        <p className="mt-1 text-xs text-text-muted">{hint}</p>
      </div>)}</div>
    </section>

    <section aria-label="Indicadores comerciales" className="platform-metric-strip">
      <NOCKpiCard compact title="Organizaciones" icon={<Building2 size={15} />} value={stats.organizations.total} subtitle="Clientes registrados" />
      <NOCKpiCard compact title="Usuarios" icon={<Users size={15} />} value={stats.infrastructure.total_users} subtitle="Cuentas de clientes" />
      <NOCKpiCard compact title="Altas en 30 días" icon={<TrendingUp size={15} />} value={stats.organizations.recent_signups_30d} subtitle="Organizaciones nuevas" />
      <NOCKpiCard compact title="MRR estimado" icon={<DollarSign size={15} />} value={'$' + stats.financials.mrr_usd.toLocaleString('es-GT')} valueSuffix="USD" footer={<details><summary className="cursor-pointer">Ver cálculo y ARR</summary><p className="mt-2">Estimación de suscripciones activas y con pago pendiente; no representa ingresos cobrados. ARR: ${stats.financials.arr_usd.toLocaleString('es-GT')} USD. {stats.financials.quoted_organizations} bajo cotización.</p></details>} />
    </section>

    <section aria-labelledby="platform-distribution-title" className="platform-section">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="platform-distribution-title" className="text-base font-semibold">Distribución de clientes</h2><div aria-label="Distribución por" className="flex gap-1">{(['plan','status'] as const).map(id => <ActionButton key={id} tone="tertiary" aria-pressed={distribution === id} className={distribution === id ? 'bg-bg-card-hover text-accent-green' : 'text-text-muted'} onClick={() => setDistribution(id)}>{id === 'plan' ? 'Por plan' : 'Por estado'}</ActionButton>)}</div></div>
      <OrganizationDistribution embedded title={distribution === 'plan' ? 'Organizaciones por plan' : 'Estado de las suscripciones'}
        rows={distribution === 'plan' ? [{id:'free',label:'Free'},{id:'pro',label:'Pro'},{id:'business',label:'Business'},{id:'enterprise',label:'Enterprise'}] : subscriptionStates}
        counts={distribution === 'plan' ? stats.organizations.by_plan : stats.organizations.by_status} total={stats.organizations.total}
        onSelect={id => onOpenDirectory(distribution === 'plan' ? id : 'all', distribution === 'status' ? id : 'all')} />
    </section>

    <section aria-labelledby="platform-capacity-title" className="border-t border-border-base pt-4">
      <h2 id="platform-capacity-title" className="text-sm font-semibold">Capacidad de monitoreo</h2>
      <dl className="mt-3 grid gap-4 sm:grid-cols-2">
        <div><dt className="flex items-center gap-2 text-xs text-text-muted"><Activity size={15} />Monitores habilitados / registrados</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{stats.infrastructure.active_targets} / {stats.infrastructure.total_targets}</dd><p className="text-xs text-text-muted">Uptime y Latencia</p></div>
        <div><dt className="flex items-center gap-2 text-xs text-text-muted"><Server size={15} />Agentes conectados / registrados</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{stats.infrastructure.total_probes === 0 ? 'Sin agentes registrados' : stats.infrastructure.online_probes + ' / ' + stats.infrastructure.total_probes}</dd></div>
      </dl>
    </section>
  </div>;
}
