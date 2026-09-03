import React from 'react';
import type { AlertSeverity } from '../../types/alerts';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface SeverityBadgeProps {
  severity: AlertSeverity | string;
  className?: string;
}

export default function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  const normSeverity = (severity || 'info').toLowerCase();

  let styles = 'bg-accent-blue/10 text-accent-blue border-accent-blue/30';
  let Icon = Info;
  let label = 'Informativa';

  switch (normSeverity) {
    case 'critical':
      styles = 'bg-accent-red/10 text-accent-red border-accent-red/30';
      Icon = AlertTriangle;
      label = 'Crítica';
      break;
    case 'warning':
      styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30';
      Icon = AlertCircle;
      label = 'Advertencia';
      break;
    case 'info':
      styles = 'bg-accent-blue/10 text-accent-blue border-accent-blue/30';
      Icon = Info;
      label = 'Informativa';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles} ${className}`}
    >
      <Icon size={12} className="shrink-0" />
      <span>{label}</span>
    </span>
  );
}
