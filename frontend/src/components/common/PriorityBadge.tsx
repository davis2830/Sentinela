import React from 'react';
import type { IncidentPriority } from '../../types/incidents';
import { Flame, AlertTriangle, Clock, ArrowDown } from 'lucide-react';

interface PriorityBadgeProps {
  priority: IncidentPriority | string;
  className?: string;
}

export default function PriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
  const normPriority = (priority || 'medium').toLowerCase();

  let styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30';
  let Icon = Clock;

  switch (normPriority) {
    case 'critical':
      styles = 'bg-accent-red/10 text-accent-red border-accent-red/30';
      Icon = Flame;
      break;
    case 'high':
      styles = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      Icon = AlertTriangle;
      break;
    case 'medium':
      styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30';
      Icon = Clock;
      break;
    case 'low':
      styles = 'bg-accent-blue/10 text-accent-blue border-accent-blue/30';
      Icon = ArrowDown;
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold border tracking-wide uppercase ${styles} ${className}`}
    >
      <Icon size={13} className="shrink-0" />
      <span>{normPriority}</span>
    </span>
  );
}
