'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = `${Date.now()}-${Math.random()}`;

    setToasts((prev) => {
      const newToasts = [...prev, { id, message, type }];
      // Keep only the last 3 toasts
      if (newToasts.length > 3) {
        newToasts.shift();
      }
      return newToasts;
    });

    // Auto-dismiss after 3.5 seconds
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, toasts }}>
      {children}
      <ToastContainer toasts={toasts} setToasts={setToasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastContainerProps {
  toasts: Toast[];
  setToasts: (toasts: Toast[]) => void;
}

function ToastContainer({ toasts, setToasts }: ToastContainerProps) {
  const getToastColors = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          textColor: 'rgb(34, 197, 94)',
          borderColor: 'rgba(34, 197, 94, 0.3)',
        };
      case 'error':
        return {
          textColor: 'rgb(239, 68, 68)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
        };
      case 'info':
        return {
          textColor: 'var(--muted)',
          borderColor: 'var(--border)',
        };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 50,
      }}
    >
      <style>{`
        @keyframes slideUpFadeIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(16px);
          }
        }

        .toast-enter {
          animation: slideUpFadeIn 0.3s ease-out;
        }

        .toast-exit {
          animation: fadeOut 0.3s ease-out;
        }
      `}</style>

      {toasts.map((toast) => {
        const colors = getToastColors(toast.type);
        return (
          <div
            key={toast.id}
            className="toast-enter"
            style={{
              width: '280px',
              padding: '12px 16px',
              backgroundColor: 'var(--card)',
              border: `2px solid ${colors.borderColor}`,
              borderLeft: `4px solid ${colors.borderColor}`,
              borderRadius: 'var(--radius)',
              color: colors.textColor,
              fontSize: '0.95rem',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
