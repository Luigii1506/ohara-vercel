"use client";

import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import { Check, Plus, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info" | "collection";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showCollectionToast: (quantity: number, isNew?: boolean) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

// Individual toast component
const ToastItem: React.FC<{
  toast: Toast;
  onRemove: (id: string) => void;
}> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Start exit animation before removal
    const exitTimer = setTimeout(() => {
      setIsLeaving(true);
    }, (toast.duration || 2000) - 300);

    // Remove after duration
    const removeTimer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 2000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, toast.duration, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <Check className="w-4 h-4" />;
      case "error":
        return <AlertCircle className="w-4 h-4" />;
      case "info":
        return <Info className="w-4 h-4" />;
      case "collection":
        return <Plus className="w-4 h-4" />;
      default:
        return <Check className="w-4 h-4" />;
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case "success":
        return "bg-emerald-500 text-white";
      case "error":
        return "bg-red-500 text-white";
      case "info":
        return "bg-slate-700 text-white";
      case "collection":
        return "bg-emerald-500 text-white";
      default:
        return "bg-slate-800 text-white";
    }
  };

  // Collection toast - ultra minimal
  if (toast.type === "collection") {
    return (
      <div
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg
          transition-all duration-300 ease-out
          ${getStyles()}
          ${isVisible && !isLeaving
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-95"
          }
        `}
      >
        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
          <Check className="w-3 h-3" />
        </div>
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    );
  }

  // Standard toast
  return (
    <div
      className={`
        flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg
        transition-all duration-300 ease-out backdrop-blur-sm
        ${getStyles()}
        ${isVisible && !isLeaving
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-4 scale-95"
        }
      `}
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
};

// Toast container
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "success", duration = 2000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
    },
    []
  );

  const showCollectionToast = useCallback(
    (quantity: number, isNew = false) => {
      const message = isNew ? "+1" : `+1 (${quantity})`;
      showToast(message, "collection", 1500);
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, showCollectionToast }}>
      {children}
      {/* Toast container - bottom center, mobile optimized */}
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 pointer-events-none"
        style={{ maxWidth: "calc(100vw - 32px)" }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
