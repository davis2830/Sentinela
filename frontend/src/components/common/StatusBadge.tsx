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
    case 'pass':
    case 'valid':
    case 'active':
    case 'ok':
      styles = 'bg-accent-green/10 text-accent-green border-accent-green/30 font-bold';
      if (normalized === 'valid') defaultLabel = 'VÁLIDO';
      if (normalized === 'active') defaultLabel = 'ACTIVO';
      if (normalized === 'up') defaultLabel = 'UP';
      if (normalized === 'pass') defaultLabel = 'PASS';
      if (normalized === 'ok') defaultLabel = 'OK';
      break;

    case 'expiring':
      styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30 font-bold';
      defaultLabel = 'POR EXPIRAR';
      break;

    case 'down':
    case 'fail':
    case 'expired':
    case 'invalid':
    case 'error':
      styles = 'bg-accent-red/10 text-accent-red border-accent-red/30 font-bold';
      if (normalized === 'expired') defaultLabel = 'EXPIRADO';
      if (normalized === 'invalid') defaultLabel = 'INVÁLIDO';
      if (normalized === 'down') defaultLabel = 'DOWN';
      if (normalized === 'fail') defaultLabel = 'FAIL';
      if (normalized === 'error') defaultLabel = 'ERROR';
      break;

    case 'slow':
      styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30 font-bold';
      defaultLabel = 'SLOW';
      break;

    case 'open':
      styles = 'bg-accent-red/10 text-accent-red border-accent-red/30 font-bold';
      defaultLabel = 'ABIERTO';
      break;

    case 'investigating':
      styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30 font-bold';
      defaultLabel = 'INVESTIGANDO';
      break;

    case 'identified':
      styles = 'bg-accent-blue/10 text-accent-blue border-accent-blue/30 font-bold';
      defaultLabel = 'IDENTIFICADO';
      break;

    case 'mitigated':
      styles = 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40 font-bold';
      defaultLabel = 'MITIGADO';
      break;

    case 'resolved':
      styles = 'bg-accent-green/10 text-accent-green border-accent-green/30 font-bold';
      defaultLabel = 'RESUELTO';
      break;

    case 'closed':
      styles = 'bg-bg-dark text-text-muted border-border-base font-bold';
      defaultLabel = 'CERRADO';
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
