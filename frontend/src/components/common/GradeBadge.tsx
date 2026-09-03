import React from 'react';
import type { SecurityGrade } from '../../types/security_headers';

interface GradeBadgeProps {
  grade: SecurityGrade | string | null;
  score?: number | null;
  className?: string;
}

export default function GradeBadge({ grade, score, className = '' }: GradeBadgeProps) {
  const normGrade = (grade || '-').toString().toUpperCase().trim();

  let styles = 'bg-gray-500/10 text-gray-400 border-gray-500/30';

  switch (normGrade) {
    case 'A+':
    case 'A':
      styles = 'bg-accent-green/10 text-accent-green border-accent-green/30';
      break;
    case 'B':
      styles = 'bg-accent-blue/10 text-accent-blue border-accent-blue/30';
      break;
    case 'C':
      styles = 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30';
      break;
    case 'D':
      styles = 'bg-accent-purple/10 text-accent-purple border-accent-purple/30';
      break;
    case 'F':
      styles = 'bg-accent-red/10 text-accent-red border-accent-red/30';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold border ${styles} ${className}`}
    >
      <span>Grado {normGrade}</span>
      {score !== undefined && score !== null && (
        <span className="opacity-75 font-normal">({score} pts)</span>
      )}
    </span>
  );
}
