import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function NotFoundPage() {
  const authenticated = useAuthStore(s => s.isAuthenticated);
  return <main className="min-h-[70vh] flex items-center justify-center p-6 text-text-main">
    <section className="w-full max-w-lg rounded-2xl border border-border-base bg-bg-card p-8 space-y-4">
      <p className="text-accent-cyan">404</p>
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p>Esta dirección no existe. Puedes volver al inicio y buscar el módulo que necesitas.</p>
      <Link className="inline-block rounded-xl bg-accent-green px-4 py-2 text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-cyan" to={authenticated ? '/dashboard' : '/login'}>Volver al inicio</Link>
    </section>
  </main>;
}
