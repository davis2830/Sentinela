import React from 'react';
import type { Incident } from '../../types/incidents';
import CompactResourceList from '../common/CompactResourceList';
export interface IncidentTableViewProps {
  incidents: Incident[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onRowClick: (incident: Incident) => void;
  onEdit: (e: React.MouseEvent, incident: Incident) => void;
  onDelete: (e: React.MouseEvent, incident: Incident) => void;
}
export default function IncidentTableView(props: IncidentTableViewProps) {
return <CompactResourceList items={props.incidents} selectedIds={props.selectedIds} onToggleSelect={(i,e)=>props.onToggleSelect(i.id)} onSelectAll={props.onSelectAll} onOpen={props.onRowClick} title={i=>i.title} subtitle={i=>i.impacted_service} status={i=>i.status} metadata={i=>`${i.priority} · ${i.alerts_count} alertas · ${new Date(i.opened_at).toLocaleString()}`} actions={i=>[{label:'Editar',onClick:e=>props.onEdit(e,i)},{label:'Eliminar',onClick:e=>props.onDelete(e,i)}]} />;
}
