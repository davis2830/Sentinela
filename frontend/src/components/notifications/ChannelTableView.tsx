import React from 'react';
import type { NotificationChannel, ChannelType } from '../../types/notifications';
import CompactResourceList from '../common/CompactResourceList';
interface ChannelTableViewProps {
  channels: NotificationChannel[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onOpenEdit: (channel: NotificationChannel) => void;
  onOpenDelete: (channel: NotificationChannel) => void;
  onInspect: (channel: NotificationChannel) => void;
  onTestChannel: (channel: NotificationChannel) => Promise<void>;
  onToggleEnable: (channel: NotificationChannel) => Promise<void>;
  testingChannelId: string | null;
}
export default function ChannelTableView(props: ChannelTableViewProps) {
return <CompactResourceList items={props.channels} selectedIds={props.selectedIds} onToggleSelect={(i,e)=>props.onToggleSelect(i.id)} onSelectAll={props.onSelectAll} onOpen={props.onInspect} title={i=>i.name} subtitle={i=>i.description} status={i=>i.enabled?'Activo':'Pausado'} metadata={i=>`${i.channel_type} · Severidad ${i.min_severity}`} actions={i=> [{label:'Editar',onClick:()=>props.onOpenEdit(i)},{label:'Probar canal',onClick:()=>{void props.onTestChannel(i)}},{label:i.enabled?'Pausar':'Activar',onClick:()=>{void props.onToggleEnable(i)}},{label:'Eliminar',onClick:()=>props.onOpenDelete(i)}]} />;
}
