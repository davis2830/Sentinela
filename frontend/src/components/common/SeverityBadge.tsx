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

  switch (normSeverity) {
    case 'critical':
      styles = 'bg-accent-red/10 text-accent-red border-accent-red/30';
      Icon = AlertTriangle;
      break;
    case 'warning':
      styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30';
      Icon = AlertCircle;
      break;
    case 'info':
      styles = 'bg-accent-blue/10 text-accent-blue border-accent-blue/30';
      Icon = Info;
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold border tracking-wide uppercase ${styles} ${className}`}
    >
      <Icon size={13} className="shrink-0" />
      <span>{normSeverity}</span>
    </span>
  );
}
