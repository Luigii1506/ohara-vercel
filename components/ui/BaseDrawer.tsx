"use client";

import { useEffect, useState, ReactNode, useCallback, useRef } from "react";

interface BaseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: string;
  /** Prevent closing (e.g., during loading states) */
  preventClose?: boolean;
  /** Show the handle bar at top (default: true) */
  showHandle?: boolean;
  /** Use modal style on desktop (centered with scale animation) */
  desktopModal?: boolean;
  /** Max width when using desktopModal (default: "max-w-4xl") */
  desktopMaxWidth?: string;
}

const BaseDrawer: React.FC<BaseDrawerProps> = ({
  isOpen,
  onClose,
  children,
  maxHeight = "92vh",
  preventClose = false,
  showHandle = true,
  desktopModal = false,
  desktopMaxWidth = "max-w-4xl",
}) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Opening: render first, then animate in after a small delay
      setShouldRender(true);
      // Use timeout to ensure DOM is painted before animation starts
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      document.body.style.overflow = "hidden";
    } else {
      // Closing: animate out first, then unmount
      setIsVisible(false);
      timeoutRef.current = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      document.body.style.overflow = "unset";
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback(() => {
    if (preventClose) return;
    onClose();
  }, [preventClose, onClose]);

  if (!shouldRender) return null;

  // Desktop modal variant (centered with scale animation)
  if (desktopModal) {
    return (
      <>
        {/* Backdrop */}
        <div
          className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={handleBackdropClick}
        />

        {/* Drawer / Modal */}
        <div
          className={`fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center ${
            isVisible ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <div
            className={`w-full overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out lg:max-h-[85vh] lg:${desktopMaxWidth} lg:rounded-3xl ${
              isVisible
                ? "translate-y-0 lg:translate-y-0 lg:scale-100 lg:opacity-100"
                : "translate-y-full lg:translate-y-0 lg:scale-95 lg:opacity-0"
            }`}
            style={{ maxHeight: `min(${maxHeight}, 90vh)` }}
          >
            {/* Handle - mobile only */}
            {showHandle && (
              <div className="flex justify-center py-3 lg:hidden">
                <div className="h-1.5 w-12 rounded-full bg-slate-300" />
              </div>
            )}

            {/* Content */}
            {children}
          </div>
        </div>
      </>
    );
  }

  // Default mobile drawer variant
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleBackdropClick}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-0 z-50 flex items-end ${
          isVisible ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`w-full overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out ${
            isVisible ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ maxHeight }}
        >
          {/* Handle for mobile */}
          {showHandle && (
            <div className="flex justify-center py-3">
              <div className="h-1.5 w-12 rounded-full bg-slate-300" />
            </div>
          )}

          {/* Content */}
          {children}
        </div>
      </div>
    </>
  );
};

export default BaseDrawer;
