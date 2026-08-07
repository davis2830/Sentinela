import React from 'react';

export type StatusType =
  | 'up'
  | 'down'
  | 'expiring'
  | 'expired'
  | 'valid'
  | 'invalid'
  | 'slow'
  | 'error'
  | 'active'
  | 'inactive';

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  className?: string;
}

export default function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const normalized = (status || '').toString().toLowerCase();

  let styles = 'bg-gray-500/10 text-gray-400 border-gray-500/30';
  let defaultLabel = normalized.toUpperCase();

  switch (normalized) {
    case 'up':
    case 'valid':
    case 'active':
      styles = 'bg-accent-green/10 text-accent-green border-accent-green/30';
      if (normalized === 'valid') defaultLabel = 'VÁLIDO';
      if (normalized === 'active') defaultLabel = 'ACTIVO';
      if (normalized === 'up') defaultLabel = 'UP';
      break;

    case 'expiring':
      styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30';
      defaultLabel = 'POR EXPIRAR';
      break;

    case 'down':
    case 'expired':
    case 'invalid':
    case 'error':
      styles = 'bg-accent-red/10 text-accent-red border-accent-red/30';
      if (normalized === 'expired') defaultLabel = 'EXPIRADO';
      if (normalized === 'invalid') defaultLabel = 'INVÁLIDO';
      if (normalized === 'down') defaultLabel = 'DOWN';
      if (normalized === 'error') defaultLabel = 'ERROR';
      break;

    case 'slow':
      styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30';
      defaultLabel = 'LENTO';
      break;

    case 'inactive':
      styles = 'bg-gray-500/10 text-gray-400 border-gray-500/30';
      defaultLabel = 'INACTIVO';
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-medium border uppercase tracking-wider ${styles} ${className}`}
    >
      {label || defaultLabel}
    </span>
  );
}
