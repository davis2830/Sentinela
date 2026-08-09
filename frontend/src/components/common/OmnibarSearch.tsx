import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
  Search,
  X,
  Zap,
  Lock,
  Globe,
  Plug,
  Bell,
  AlertTriangle,
  FileText,
  Loader2,
  ChevronRight,
} from 'lucide-react';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  url: string;
}

interface OmnibarSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OmnibarSearch({ isOpen, onClose }: OmnibarSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get(`monitoring/search/?q=${encodeURIComponent(query.trim())}`);
        setResults(response.data?.data || []);
      } catch (err) {
        console.error('Omnibar search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelectResult = (url: string) => {
    onClose();
    navigate(url);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Uptime & Servidores':
        return <Zap size={16} className="text-accent-green" />;
      case 'Certificados SSL':
        return <Lock size={16} className="text-accent-yellow" />;
      case 'Registros DNS':
        return <Globe size={16} className="text-accent-blue" />;
      case 'API Endpoints':
        return <Plug size={16} className="text-accent-purple" />;
      case 'Smart Alerts':
        return <Bell size={16} className="text-accent-red" />;
      case 'Incidentes':
        return <AlertTriangle size={16} className="text-accent-red" />;
      default:
        return <FileText size={16} className="text-text-muted" />;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-start justify-center z-50 pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border-base rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-base bg-bg-dark">
          <Search size={18} className="text-accent-green shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar servidores, certificados SSL, registros DNS, APIs, alertas, incidentes... (Esc para cerrar)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-text-main placeholder:text-text-dim focus:outline-none font-mono"
          />
          {loading ? (
            <Loader2 size={18} className="animate-spin text-accent-green shrink-0" />
          ) : query ? (
            <button onClick={() => setQuery('')} className="text-text-dim hover:text-text-main">
              <X size={16} />
            </button>
          ) : (
            <span className="text-[10px] font-mono text-text-dim border border-border-base px-1.5 py-0.5 rounded uppercase">
              Ctrl K
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {results.length > 0 ? (
            <div className="space-y-1">
              {results.map((item) => (
                <div
                  key={`${item.category}-${item.id}`}
                  onClick={() => handleSelectResult(item.url)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-bg-dark border border-transparent hover:border-border-base cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-bg-dark border border-border-base group-hover:border-accent-green/50">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-text-main group-hover:text-accent-green transition-colors">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-text-muted font-mono">{item.subtitle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-text-dim uppercase bg-bg-dark px-2 py-0.5 rounded border border-border-base">
                      {item.category}
                    </span>
                    <ChevronRight size={14} className="text-text-dim group-hover:text-accent-green transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          ) : query.length >= 2 && !loading ? (
            <div className="py-8 text-center text-xs font-mono text-text-dim">
              No se encontraron resultados para &quot;{query}&quot;.
            </div>
          ) : (
            <div className="py-8 text-center text-xs font-mono text-text-dim">
              Escribe al menos 2 caracteres para buscar en la plataforma Sentinela.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
