import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Key, User, UserCircle, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import { useAuthStore } from '../../store/authStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (password !== confirmPassword) {
      setLocalError('Las contrasenas no coinciden');
      return;
    }

    if (password.length < 8) {
      setLocalError('La contrasena debe tener al menos 8 caracteres');
      return;
    }

    const success = await register(email, password, firstName, lastName);
    if (success) {
      navigate('/dashboard');
    }
  };

  const displayError = localError || error;

  return (
    <AuthLayout>
      <h2 className="text-center text-2xl font-bold mt-8 mb-8">Crear Cuenta en Sentinel</h2>

      {displayError && (
        <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
          <AlertCircle size={18} />
          {displayError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <input
                type="text"
                placeholder="Nombre"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="input-base pl-11"
              />
            </div>
          </div>
          <div>
            <div className="relative">
              <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <input
                type="text"
                placeholder="Apellido"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="input-base pl-11"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError();
                setLocalError('');
              }}
              required
              className="input-base pl-11"
            />
          </div>
        </div>

        <div>
          <div className="relative">
            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="password"
              placeholder="Contrasena (min 8 caracteres)"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
                setLocalError('');
              }}
              required
              className="input-base pl-11"
            />
          </div>
        </div>

        <div>
          <div className="relative">
            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="password"
              placeholder="Confirmar contrasena"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setLocalError('');
              }}
              required
              className="input-base pl-11"
            />
          </div>
        </div>

        <button type="submit" disabled={isLoading} className="btn-secondary mt-2">
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Registrando...
            </>
          ) : (
            <>
              <UserPlus size={18} />
              Crear Cuenta
            </>
          )}
        </button>
      </form>

      <p className="text-center mt-6 text-text-muted text-sm">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="text-accent-green hover:underline">
          Inicia sesion aqui
        </Link>
      </p>
    </AuthLayout>
  );
}