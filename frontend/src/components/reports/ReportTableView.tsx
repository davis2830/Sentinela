import React from 'react';
import type { ReportItem, ReportType } from '../../types/reports';
import CompactResourceList from '../common/CompactResourceList';
interface ReportTableViewProps {
  reports: ReportItem[];
  selectedIds: string[];
  onToggleSelect: (report: ReportItem) => void;
  onSelectAllToggle: () => void;
  onSelectReport: (report: ReportItem) => void;
  onDelete: (report: ReportItem) => void;
  onExportCSV: (reportId: string, e?: React.MouseEvent) => void;
  onExportPDF: (reportId: string, e?: React.MouseEvent) => void;
}
export default function ReportTableView(props: ReportTableViewProps) {
  return <CompactResourceList
    items={props.reports} selectedIds={props.selectedIds}
    onToggleSelect={item=>props.onToggleSelect(item)} onSelectAll={props.onSelectAllToggle}
    onOpen={props.onSelectReport} title={item=>item.title} subtitle={item=>item.report_type}
    status={item=>item.status}
    metadata={item=>item.generated_at ? `Generado ${new Date(item.generated_at).toLocaleString()}` : 'Sin generación terminada'}
    actions={item=>[
      ...(item.status === 'completed' ? [
        {label:'Exportar CSV',readOnly:true,onClick:(event:React.MouseEvent)=>props.onExportCSV(item.id,event)},
        {label:'Exportar PDF',readOnly:true,onClick:(event:React.MouseEvent)=>props.onExportPDF(item.id,event)},
      ] : []),
      {label:'Eliminar',onClick:()=>props.onDelete(item)},
    ]}
  />;
}
