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

  let styles = 'bg-gray-500/10 text-gray-400 border-gray-500/30 font-medium';
  let defaultLabel = normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '';

  switch (normalized) {
    case 'up':
    case 'pass':
    case 'valid':
    case 'active':
    case 'ok':
      styles = 'bg-accent-green/10 text-accent-green border-accent-green/30 font-semibold';
      if (normalized === 'valid') defaultLabel = 'Válido';
      if (normalized === 'active') defaultLabel = 'Activo';
      if (normalized === 'up') defaultLabel = 'Online';
      if (normalized === 'pass') defaultLabel = 'Pass';
      if (normalized === 'ok') defaultLabel = 'OK';
      break;

    case 'expiring':
      styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30 font-semibold';
      defaultLabel = 'Por expirar';
      break;

    case 'down':
    case 'fail':
    case 'expired':
    case 'invalid':
    case 'error':
      styles = 'bg-accent-red/10 text-accent-red border-accent-red/30 font-semibold';
      if (normalized === 'expired') defaultLabel = 'Expirado';
      if (normalized === 'invalid') defaultLabel = 'Inválido';
      if (normalized === 'down') defaultLabel = 'Caído';
      if (normalized === 'fail') defaultLabel = 'Fallo';
      if (normalized === 'error') defaultLabel = 'Error';
      break;

    case 'slow':
      styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30 font-semibold';
      defaultLabel = 'Lento';
      break;

    case 'open':
      styles = 'bg-accent-red/10 text-accent-red border-accent-red/30 font-semibold';
      defaultLabel = 'Abierto';
      break;

    case 'investigating':
      styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30 font-semibold';
      defaultLabel = 'Investigando';
      break;

    case 'identified':
      styles = 'bg-accent-blue/10 text-accent-blue border-accent-blue/30 font-semibold';
      defaultLabel = 'Identificado';
      break;

    case 'mitigated':
      styles = 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40 font-semibold';
      defaultLabel = 'Mitigado';
      break;

    case 'resolved':
      styles = 'bg-accent-green/10 text-accent-green border-accent-green/30 font-semibold';
      defaultLabel = 'Resuelto';
      break;

    case 'closed':
      styles = 'bg-bg-dark text-text-muted border-border-base font-semibold';
      defaultLabel = 'Cerrado';
      break;

    case 'inactive':
      styles = 'bg-gray-500/10 text-gray-400 border-gray-500/30 font-semibold';
      defaultLabel = 'Inactivo';
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles} ${className}`}
    >
      {label || defaultLabel}
    </span>
  );
}
