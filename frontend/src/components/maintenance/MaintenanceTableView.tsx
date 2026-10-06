import React from 'react';
import type { MaintenanceWindow } from '../../types';
import CompactResourceList from '../common/CompactResourceList';
interface MaintenanceTableViewProps {
  windows: MaintenanceWindow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onSelect: (window: MaintenanceWindow) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
}
export function MaintenanceTableView(props: MaintenanceTableViewProps) {
return <CompactResourceList items={props.windows} selectedIds={props.selectedIds} onToggleSelect={(i,e)=>props.onToggleSelect(i.id)} onSelectAll={props.onSelectAll} onOpen={props.onSelect} title={i=>i.title} subtitle={i=>i.description} status={i=>i.status} metadata={i=>`${new Date(i.start_time).toLocaleString()} · ${i.duration_minutes} min`} actions={i=>i.status==='scheduled'?[{label:'Iniciar',onClick:()=>props.onStart(i.id)}]:i.status==='in_progress'?[{label:'Completar',onClick:()=>props.onComplete(i.id)}]:[]} />;
}
