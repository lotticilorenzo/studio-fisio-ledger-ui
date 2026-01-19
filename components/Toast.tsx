'use client';

import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
    showError: (message: string) => void;
    showSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto-dismiss after 4 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const showError = useCallback((message: string) => {
        showToast(message, 'error');
    }, [showToast]);

    const showSuccess = useCallback((message: string) => {
        showToast(message, 'success');
    }, [showToast]);

    const dismiss = (id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast, showError, showSuccess }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        onClick={() => dismiss(toast.id)}
                        className={`
              px-4 py-3 rounded-xl shadow-lg cursor-pointer
              transform transition-all duration-300 ease-out
              animate-slide-in
              ${toast.type === 'success'
                                ? 'bg-green-600 text-white border border-green-500'
                                : toast.type === 'error'
                                    ? 'bg-red-600 text-white border border-red-500'
                                    : 'bg-neutral-800 text-white border border-neutral-700'
                            }
            `}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-lg">
                                {toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠' : 'ℹ'}
                            </span>
                            <span className="text-sm font-medium">{toast.message}</span>
                        </div>
                    </div>
                ))}
            </div>

            <style jsx global>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        // Return no-op functions if used outside provider
        return {
            showToast: () => { },
            showError: () => { },
            showSuccess: () => { },
        };
    }
    return context;
}
