import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function ScanFeedback() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const show = (event: Event) => setMessage((event as CustomEvent<string>).detail);
    window.addEventListener('sentinel:scan-feedback', show);
    return () => window.removeEventListener('sentinel:scan-feedback', show);
  }, []);
  if (!message) return null;
  return <div role="status" className="fixed bottom-5 right-5 left-5 sm:left-auto sm:max-w-lg z-[100] rounded-xl border border-amber-400/30 bg-bg-card px-4 py-3 shadow-xl text-sm text-text-main flex items-start gap-3">
    <p className="flex-1">{message}</p>
    <button type="button" aria-label="Cerrar aviso de comprobación" onClick={() => setMessage('')}><X size={18} /></button>
  </div>;
}
