import React, { useMemo } from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
}

export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const analysis = useMemo(() => {
    if (!password) {
      return {
        score: 0,
        label: 'Sin ingresar',
        color: 'bg-border-base',
        textColor: 'text-text-dim',
        hasMinLength: false,
        hasUpperLower: false,
        hasNumber: false,
        hasSpecial: false,
      };
    }

    const hasMinLength = password.length >= 8;
    const hasUpperLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    let score = 0;
    if (hasMinLength) score += 1;
    if (hasUpperLower) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecial) score += 1;

    let label = 'Muy Débil';
    let color = 'bg-accent-red';
    let textColor = 'text-accent-red';

    if (score === 2) {
      label = 'Regular';
      color = 'bg-accent-yellow';
      textColor = 'text-accent-yellow';
    } else if (score === 3) {
      label = 'Buena';
      color = 'bg-accent-blue';
      textColor = 'text-accent-blue';
    } else if (score === 4) {
      label = 'Excelente / Robusta';
      color = 'bg-accent-green';
      textColor = 'text-accent-green';
    }

    return {
      score,
      label,
      color,
      textColor,
      hasMinLength,
      hasUpperLower,
      hasNumber,
      hasSpecial,
    };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-2.5 pt-1 animate-in fade-in duration-200">
      {/* Segmented Strength Bar */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[11px] text-text-dim">Fuerza de la contraseña:</span>
        <span className={`text-[11px] font-semibold ${analysis.textColor}`}>
          {analysis.label}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-full rounded-full transition-all duration-300 ${
              analysis.score >= step ? analysis.color : 'bg-bg-dark border border-border-base'
            }`}
          />
        ))}
      </div>

      {/* Criteria Checklist */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-[11px]">
        <div className="flex items-center gap-1.5">
          {analysis.hasMinLength ? (
            <Check size={12} className="text-accent-green shrink-0" />
          ) : (
            <X size={12} className="text-text-dim shrink-0" />
          )}
          <span className={analysis.hasMinLength ? 'text-text-main' : 'text-text-dim'}>
            Mínimo 8 caracteres
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {analysis.hasUpperLower ? (
            <Check size={12} className="text-accent-green shrink-0" />
          ) : (
            <X size={12} className="text-text-dim shrink-0" />
          )}
          <span className={analysis.hasUpperLower ? 'text-text-main' : 'text-text-dim'}>
            Mayúsculas y minúsculas
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {analysis.hasNumber ? (
            <Check size={12} className="text-accent-green shrink-0" />
          ) : (
            <X size={12} className="text-text-dim shrink-0" />
          )}
          <span className={analysis.hasNumber ? 'text-text-main' : 'text-text-dim'}>
            Al menos un número
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {analysis.hasSpecial ? (
            <Check size={12} className="text-accent-green shrink-0" />
          ) : (
            <X size={12} className="text-text-dim shrink-0" />
          )}
          <span className={analysis.hasSpecial ? 'text-text-main' : 'text-text-dim'}>
            Símbolo especial (!@#$...)
          </span>
        </div>
      </div>
    </div>
  );
}
