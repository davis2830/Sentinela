import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ShieldCheck, Lock, Building, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [invData, setInvData] = useState<{
    email: string;
    organization_name: string;
    first_name: string;
    last_name: string;
    role: string;
  } | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMsg('El enlace de invitación no contiene un token válido.');
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        const response = await api.get(`organizations/invitations/validate/?token=${encodeURIComponent(token)}`);
        setInvData(response.data?.data);
      } catch (err: any) {
        setErrorMsg(err.response?.data?.message || err.response?.data?.detail || 'El enlace de invitación es inválido o ha expirado.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (password.length < 8) {
      setSubmitError('La contraseña debe contener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('organizations/invitations/accept/', {
        token,
        password,
      });

      navigate('/login', {
        state: {
          message: '¡Cuenta activada con éxito! Ya puedes iniciar sesión con tu correo y nueva contraseña.',
        },
      });
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || err.response?.data?.detail || 'Error al activar la cuenta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark flex flex-col justify-center items-center p-4 font-sans text-text-main">
      {/* Brand Header */}
      <div className="flex items-center gap-3 font-mono font-bold text-2xl mb-8">
        <span className="text-accent-green">//</span>
        <span>sentinel</span>
      </div>

      <div className="bg-bg-card border border-border-base rounded-2xl w-full max-w-md p-8 shadow-2xl space-y-6">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-accent-green" />
            <p className="text-xs font-mono text-text-muted">Validando enlace de invitación seguro...</p>
          </div>
        ) : errorMsg ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 bg-accent-red/10 border border-accent-red/30 rounded-full flex items-center justify-center mx-auto text-accent-red">
              <AlertCircle size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-main">Enlace no disponible</h2>
              <p className="text-xs text-text-muted mt-1 font-mono">{errorMsg}</p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2 bg-bg-dark border border-border-base rounded-xl text-xs font-mono hover:text-accent-green transition-colors"
            >
              Ir a Iniciar Sesión
            </button>
          </div>
        ) : (
          <div>
            <div className="text-center space-y-2 mb-6">
              <div className="w-12 h-12 bg-accent-green/10 border border-accent-green/30 rounded-full flex items-center justify-center mx-auto text-accent-green">
                <ShieldCheck size={24} />
              </div>
              <h2 className="text-xl font-bold text-text-main">Aceptar Invitación</h2>
              <p className="text-xs text-text-muted">
                Has sido invitado a unirte a la organización
              </p>

              <div className="mt-3 p-3 bg-bg-dark border border-border-base rounded-xl text-left font-mono space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-accent-green">
                  <Building size={14} />
                  {invData?.organization_name}
                </div>
                <div className="text-xs text-text-muted">
                  Correo: <span className="text-text-main">{invData?.email}</span>
                </div>
                <div className="text-xs text-text-muted">
                  Rol: <span className="text-accent-blue font-semibold capitalize">{invData?.role}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Definir Contraseña Personal
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3 text-text-dim" />
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl pl-9 pr-4 py-2.5 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3 text-text-dim" />
                  <input
                    type="password"
                    required
                    placeholder="Repite tu contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-bg-dark border border-border-base rounded-xl pl-9 pr-4 py-2.5 text-xs font-mono text-text-main focus:outline-none focus:border-accent-green"
                  />
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-xs font-mono">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-accent-green text-black font-semibold text-sm rounded-full hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Activar Cuenta e Ingresar
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
