import { useState } from 'react';
import type { AlertRule } from '../../types/alerts';
import CompactResourceList from '../common/CompactResourceList';
import { NOCDrawer } from '../common/noc';

export interface AlertRuleTableViewProps {
  rules: AlertRule[];
  onEdit: (rule: AlertRule) => void;
  onDelete: (rule: AlertRule) => void;
  onSnooze: (rule: AlertRule) => void;
}
export default function AlertRuleTableView(props: AlertRuleTableViewProps) {
  const [selected, setSelected] = useState<AlertRule | null>(null);
  return <>
    <CompactResourceList items={props.rules} selectedIds={[]} selectable={false}
      onToggleSelect={()=>{}} onSelectAll={()=>{}} onOpen={setSelected}
      title={rule=>rule.name} subtitle={rule=>rule.condition} status={rule=>rule.enabled ? 'Activa' : 'Pausada'}
      metadata={rule=>`${rule.target_type} · ${rule.severity} · Umbral ${rule.threshold}`}
      actions={rule=>[
        {label:'Editar',onClick:()=>props.onEdit(rule)},
        {label:'Posponer',onClick:()=>props.onSnooze(rule)},
        {label:'Eliminar',onClick:()=>props.onDelete(rule)},
      ]}
    />
    <NOCDrawer isOpen={Boolean(selected)} onClose={()=>setSelected(null)} title={selected?.name ?? 'Regla'} subtitle={selected?.condition}>
      {selected && <dl className="space-y-3 text-sm">
        <div><dt className="text-text-muted">Estado</dt><dd>{selected.enabled?'Activa':'Pausada'}</dd></div>
        <div><dt className="text-text-muted">Módulo</dt><dd>{selected.target_type}</dd></div>
        <div><dt className="text-text-muted">Severidad</dt><dd>{selected.severity}</dd></div>
        <div><dt className="text-text-muted">Umbral</dt><dd>{selected.threshold}</dd></div>
        <div><dt className="text-text-muted">Cooldown de alertas</dt><dd>{selected.cooldown_minutes ?? '—'} min</dd></div>
      </dl>}
    </NOCDrawer>
  </>;
}
