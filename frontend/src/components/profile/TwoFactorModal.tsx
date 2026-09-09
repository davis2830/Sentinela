import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  X,
  Copy,
  Check,
  Download,
  Loader2,
  AlertCircle,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  setupData: {
    secret: string;
    qr_code: string;
    provisioning_uri: string;
  } | null;
  onVerify: (code: string) => Promise<string[] | null>;
  isVerifying: boolean;
}

export default function TwoFactorModal({
  isOpen,
  onClose,
  setupData,
  onVerify,
  isVerifying,
}: TwoFactorModalProps) {
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  if (!isOpen) return null;

  const handleCopySecret = () => {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  const handleCopyCodes = () => {
    if (!backupCodes) return;
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2500);
  };

  const handleDownloadCodes = () => {
    if (!backupCodes) return;
    const content = `SENTINEL - CÓDIGOS DE RECUPERACIÓN DE EMERGENCIA (2FA)\n` +
      `Generados el: ${new Date().toISOString()}\n\n` +
      `Cada código es de un solo uso en caso de perder acceso a tu app autenticadora:\n\n` +
      backupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
      `\n\nGuarda este archivo en un gestor de contraseñas seguro o almacenamiento cifrado.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sentinel-2fa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setErrorMsg(null);
    try {
      const generatedBackupCodes = await onVerify(code.trim());
      if (generatedBackupCodes && generatedBackupCodes.length > 0) {
        setBackupCodes(generatedBackupCodes);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Código incorrecto. Inténtalo nuevamente.');
    }
  };

  const handleClose = () => {
    setCode('');
    setErrorMsg(null);
    setBackupCodes(null);
    onClose();
  };

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative font-sans">
        {/* Header */}
        <div className="p-6 border-b border-border-base flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-green/10 text-accent-green border border-accent-green/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-main">
                {backupCodes ? 'Códigos de Recuperación de Emergencia' : 'Configurar Autenticación en Dos Pasos'}
              </h3>
              <p className="text-xs text-text-dim mt-0.5">
                {backupCodes ? 'Paso final: Respaldo de seguridad' : 'Vincula tu app autenticadora TOTP'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-text-dim hover:text-text-main p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-accent-red/10 border border-accent-red/30 text-accent-red text-xs flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!backupCodes ? (
            /* STEP 1: Scan QR & Enter 6-digit Code */
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="text-xs text-text-muted">
                1. Abre tu aplicación de autenticación (<strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, <strong>1Password</strong> o <strong>Authy</strong>) y escanea el siguiente código QR:
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-border-base w-fit mx-auto shadow-inner">
                {setupData?.qr_code ? (
                  <img
                    src={setupData.qr_code}
                    alt="Código QR TOTP"
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-text-dim">
                    <Loader2 className="animate-spin" size={24} />
                  </div>
                )}
              </div>

              {/* Manual Secret Key */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-text-dim mb-1 font-mono">
                  <span>¿No puedes escanear el código? Clave secreta manual:</span>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="text-accent-green hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSecret ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedSecret ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-bg-dark border border-border-base text-xs font-mono text-center text-accent-blue tracking-wider select-all">
                  {setupData?.secret || '••••••••••••••••'}
                </div>
              </div>

              {/* Verification Code Input */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-text-muted mb-2 text-center">
                  2. Ingresa el código de 6 dígitos que muestra tu app:
                </label>
                <div className="relative group max-w-xs mx-auto">
                  <KeyRound
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent-green transition-colors"
                    size={18}
                  />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="000 000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    className="w-full bg-bg-dark border border-border-base focus:border-accent-green rounded-xl px-4 py-3 pl-11 text-center font-mono text-xl tracking-[0.3em] text-text-main placeholder:text-text-dim/40 focus:outline-none focus:ring-2 focus:ring-accent-green/20 transition-all"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-border-base flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || code.length < 6}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-black font-bold rounded-xl text-xs hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 disabled:opacity-50 cursor-pointer"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Activar 2FA</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: Display Generated Backup Codes */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-xl bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs flex items-center gap-2.5">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>¡Autenticación en dos pasos activada exitosamente!</span>
              </div>

              <p className="text-xs text-text-muted">
                Guarda estos <strong>10 códigos de respaldo de un solo uso</strong>. Si pierdes tu teléfono móvil o el acceso a tu aplicación de autenticación, podrás ingresar con cualquiera de ellos:
              </p>

              <div className="grid grid-cols-2 gap-2.5 p-4 bg-bg-dark border border-border-base rounded-2xl font-mono text-xs text-text-main text-center">
                {backupCodes.map((codeItem, index) => (
                  <div
                    key={index}
                    className="p-2 rounded-lg bg-white/5 border border-border-base/50 text-accent-green tracking-wider select-all"
                  >
                    {codeItem}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyCodes}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-text-main bg-white/5 border border-border-base hover:bg-white/10 transition-colors"
                >
                  {copiedCodes ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
                  <span>{copiedCodes ? 'Códigos Copiados' : 'Copiar Códigos'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCodes}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-accent-green bg-accent-green/10 border border-accent-green/30 hover:bg-accent-green/20 transition-colors"
                >
                  <Download size={14} />
                  <span>Descargar .txt</span>
                </button>
              </div>

              <div className="pt-4 border-t border-border-base flex justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-accent-green text-black font-bold rounded-xl text-xs hover:bg-accent-green/90 transition-all shadow-md shadow-accent-green/20 cursor-pointer"
                >
                  He guardado mis códigos &bull; Finalizar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
