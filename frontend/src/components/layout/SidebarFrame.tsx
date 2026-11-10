import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';

export type SidebarEntry = { to: string; label: string; icon: LucideIcon; active?: boolean };
export type SidebarGroup = { id: string; title: string; icon: LucideIcon; items: SidebarEntry[]; defaultOpen?: boolean };
export type SidebarSection = { label: string; items?: SidebarEntry[]; groups?: SidebarGroup[] };

/** Visual navigation only: each workspace supplies its own identity, destinations and state. */
export default function SidebarFrame({ sections, collapsed, onToggle, onNavigate, className = '', footer = 'Consola Sentinel' }: {
  sections: SidebarSection[]; collapsed: boolean; onToggle: () => void; onNavigate?: () => void; className?: string; footer?: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const activeGroup = sections.flatMap(section => section.groups || []).find(group => group.items.some(item => item.active))?.id;
  useEffect(() => { if (activeGroup) setOpen(previous => ({ ...previous, [activeGroup]: true })); }, [activeGroup]);
  function entry(item: SidebarEntry, nested = false) {
    const Icon = item.icon;
    return <Link key={item.to} to={item.to} onClick={onNavigate} title={item.label} aria-label={item.label} aria-current={item.active ? 'page' : undefined}
      className={`flex min-h-11 items-center rounded-lg border-l-2 font-medium transition-colors ${nested ? 'text-xs' : 'text-sm'} ${collapsed ? 'justify-center px-0' : nested ? 'gap-2.5 px-2.5' : 'gap-3 px-3'} ${item.active ? 'border-accent-green bg-bg-card text-accent-green' : 'border-transparent text-text-muted hover:bg-bg-card-hover hover:text-text-main'}`}>
      <Icon size={nested ? 15 : 19} className="shrink-0" aria-hidden="true" />{!collapsed && <span>{item.label}</span>}
    </Link>;
  }
  return <aside aria-label="Navegación de Sentinel" className={`flex h-full shrink-0 flex-col justify-between overflow-y-auto overflow-x-hidden border-r border-border-base bg-bg-dark ${collapsed ? 'w-20 p-3' : 'w-64 p-4'} ${className}`}>
    <div className="space-y-5">
      <div className={`flex items-center border-b border-border-base/50 pb-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && <span className="text-xs font-mono font-bold tracking-wider text-text-dim">NAVEGACIÓN</span>}
        <button type="button" title={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'} aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'} onClick={onToggle} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border-base bg-bg-card text-text-muted hover:text-text-main">{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
      </div>
      {sections.map(section => <section key={section.label} aria-label={section.label} className="space-y-2">
        {!collapsed && <h2 className="px-2 text-xs font-mono font-semibold uppercase text-text-dim">{section.label}</h2>}
        <div className="space-y-1">{section.items?.map(item => entry(item))}</div>
        {section.groups?.map(group => {
          const Icon = group.icon;
          const expanded = open[group.id] ?? group.defaultOpen ?? false;
          return collapsed ? <div key={group.id} className="space-y-1 border-t border-border-base/40 pt-2">{group.items.map(item => entry(item))}</div> : <div key={group.id}>
            <button type="button" aria-expanded={expanded} aria-controls={'sidebar-'+group.id} onClick={() => setOpen(previous => ({...previous, [group.id]: !expanded}))} className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold ${group.items.some(item => item.active) ? 'bg-accent-green/5 text-accent-green' : 'text-text-muted hover:bg-bg-card'}`}>
              <span className="flex items-center gap-2.5"><Icon size={16} aria-hidden="true" />{group.title}</span><span className="flex items-center gap-1.5"><span className="rounded-full border border-border-base px-1.5 text-xs">{group.items.length}</span><ChevronDown size={14} className={expanded ? 'rotate-180' : ''} /></span>
            </button>
            {expanded && <div id={'sidebar-'+group.id} className="ml-4 mt-1 space-y-1 border-l border-border-base/60 pl-3">{group.items.map(item => entry(item, true))}</div>}
          </div>;
        })}
      </section>)}
    </div>
    <div className="mt-5 border-t border-border-base/50 px-2 pt-3 text-xs font-mono text-text-dim">{collapsed ? <span title={footer}>S</span> : footer}</div>
  </aside>;
}
