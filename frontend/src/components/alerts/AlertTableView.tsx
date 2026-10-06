import React from 'react';
import type { Alert } from '../../types/alerts';
import CompactResourceList from '../common/CompactResourceList';
export interface AlertTableViewProps {
  alerts: Alert[];
  selectedIds: string[];
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onSelectAll: () => void;
  onSelectAlert: (alert: Alert) => void;
  onSnooze: (alert: Alert, e: React.MouseEvent) => void;
  onCreateIncident: (id: string, e: React.MouseEvent) => void;
  onAcknowledge: (id: string, e: React.MouseEvent) => void;
  onResolve: (id: string, e: React.MouseEvent) => void;
  isCreatingIncident?: boolean;
}
export default function AlertTableView(props: AlertTableViewProps) {
  return <CompactResourceList
    items={props.alerts} selectedIds={props.selectedIds}
    onToggleSelect={(item,event)=>props.onToggleSelect(item.id,event)} onSelectAll={props.onSelectAll}
    onOpen={props.onSelectAlert} title={item=>item.title} subtitle={item=>item.message}
    status={item=>item.status} metadata={item=>`${item.severity} · ${new Date(item.triggered_at).toLocaleString()}`}
    actions={item=>item.status === 'resolved' ? [] : [
      ...(item.status === 'active' ? [{label:'Reconocer',onClick:(event:React.MouseEvent)=>props.onAcknowledge(item.id,event)}] : []),
      {label:'Resolver',onClick:event=>props.onResolve(item.id,event)},
      {label:'Posponer',onClick:event=>props.onSnooze(item,event)},
      ...(!item.incident_id ? [{label:'Crear incidente',onClick:(event:React.MouseEvent)=>{if(!props.isCreatingIncident)props.onCreateIncident(item.id,event)}}] : []),
    ]}
  />;
}
