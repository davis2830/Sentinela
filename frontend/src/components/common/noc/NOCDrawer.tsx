import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface NOCDrawerTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface NOCDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  statusBadge?: React.ReactNode;
  headerActions?: React.ReactNode;
  quickKpis?: React.ReactNode;
  tabs?: NOCDrawerTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  maxWidthClass?: string;
}

export default function NOCDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  statusBadge,
  headerActions,
  quickKpis,
  tabs,
  activeTab,
  onTabChange,
  children,
  footerActions,
  maxWidthClass = 'max-w-xl',
}: NOCDrawerProps) {
  // Close drawer on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} h-full bg-bg-card border-l border-border-base shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-250`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-6 border-b border-border-base shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 overflow-hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  className="text-lg font-bold text-text-main truncate font-sans"
                  title={title}
                >
                  {title}
                </h2>
                {statusBadge}
              </div>
              {subtitle && (
                <div className="text-xs text-text-muted font-mono truncate">
                  {subtitle}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg-dark rounded-full transition-colors"
                title="Cerrar panel"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Quick KPI Strip */}
          {quickKpis && (
            <div className="pt-2 border-t border-border-base/40">{quickKpis}</div>
          )}

          {/* Tab Navigation */}
          {tabs && tabs.length > 0 && onTabChange && (
            <div className="flex items-center gap-1 pt-2 border-t border-border-base/40 overflow-x-auto">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 font-sans ${
                      isActive
                        ? 'bg-accent-green/15 text-accent-green font-semibold border border-accent-green/30'
                        : 'text-text-muted hover:text-text-main hover:bg-bg-dark'
                    }`}
                  >
                    {tab.icon && <span className="shrink-0">{tab.icon}</span>}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">{children}</div>

        {/* Optional Footer Actions */}
        {footerActions && (
          <div className="p-4 border-t border-border-base bg-bg-card/95 shrink-0 flex items-center justify-end gap-2.5">
            {footerActions}
          </div>
        )}
      </div>
    </div>
  );
}
