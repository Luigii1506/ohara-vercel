"use client";

import { useEffect, useState, ReactNode, useCallback, useRef } from "react";

// Global counter to track open drawers/modals
let openDrawerCount = 0;

export const lockBodyScroll = () => {
  openDrawerCount++;
  if (openDrawerCount === 1) {
    document.body.style.overflow = "hidden";
  }
};

export const unlockBodyScroll = () => {
  openDrawerCount = Math.max(0, openDrawerCount - 1);
  if (openDrawerCount === 0) {
    document.body.style.overflow = "";
  }
};

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
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 1024;
    }
    return true;
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wasOpenRef = useRef(false);
  const dragStartRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isAtTopRef = useRef(true);

  useEffect(() => {
    if (isOpen) {
      // Opening: render first, then animate in after a small delay
      setShouldRender(true);
      // Use timeout to ensure DOM is painted before animation starts
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      if (!wasOpenRef.current) {
        lockBodyScroll();
        wasOpenRef.current = true;
      }
    } else {
      // Closing: animate out first, then unmount
      setIsVisible(false);
      timeoutRef.current = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      if (wasOpenRef.current) {
        unlockBodyScroll();
        wasOpenRef.current = false;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpen]);

  // Cleanup on unmount if drawer was open
  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (wasOpenRef.current) {
        unlockBodyScroll();
      }
    };
  }, []);

  const handleBackdropClick = useCallback(() => {
    if (preventClose) return;
    onClose();
  }, [preventClose, onClose]);

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (preventClose) return;
      dragStartRef.current = event.clientY;
      setIsDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [preventClose]
  );

  const handleDragMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || dragStartRef.current === null) return;
      const delta = event.clientY - dragStartRef.current;
      setDragOffset(delta > 0 ? delta : 0);
    },
    [isDragging]
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    const shouldClose = dragOffset > 70;
    setIsDragging(false);
    dragStartRef.current = null;
    setDragOffset(0);
    if (shouldClose && !preventClose) {
      onClose();
    }
  }, [dragOffset, isDragging, onClose, preventClose]);

  // Touch handlers for overscroll-to-dismiss behavior
  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (preventClose || !isMobileViewport) return;
      const scrollContainer = contentRef.current;
      // Check if we're at the top of scroll
      isAtTopRef.current = !scrollContainer || scrollContainer.scrollTop <= 0;
      touchStartYRef.current = event.touches[0].clientY;
    },
    [preventClose, isMobileViewport]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (preventClose || !isMobileViewport || touchStartYRef.current === null) return;

      const scrollContainer = contentRef.current;
      const currentY = event.touches[0].clientY;
      const deltaY = currentY - touchStartYRef.current;

      // Only trigger drag if:
      // 1. We started at the top of scroll
      // 2. User is pulling down (deltaY > 0)
      // 3. We're currently at top or already dragging
      const isCurrentlyAtTop = !scrollContainer || scrollContainer.scrollTop <= 0;

      if (isAtTopRef.current && deltaY > 0 && isCurrentlyAtTop) {
        // Prevent default scroll and start dragging
        event.preventDefault();
        setIsDragging(true);
        // Apply resistance to make it feel more natural
        const resistance = 0.7;
        setDragOffset(deltaY * resistance);
      }
    },
    [preventClose, isMobileViewport]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isMobileViewport) return;
    touchStartYRef.current = null;

    if (isDragging) {
      const shouldClose = dragOffset > 60;
      setIsDragging(false);
      setDragOffset(0);
      if (shouldClose && !preventClose) {
        onClose();
      }
    }
  }, [dragOffset, isDragging, onClose, preventClose, isMobileViewport]);

  const drawerTransform = isVisible
    ? `translateY(${dragOffset}px)`
    : "translateY(100%)";
  const drawerStyle = isMobileViewport ? { transform: drawerTransform } : {};

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
          onPointerDown={handleBackdropClick}
        />

        {/* Drawer / Modal */}
        <div
          className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center pointer-events-none"
        >
          <div
            ref={drawerRef}
            className={`w-full overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl ${
              isDragging ? "transition-none" : "transition-all duration-300"
            } ease-out lg:max-h-[85vh] lg:${desktopMaxWidth} lg:rounded-3xl ${
              isVisible
                ? "translate-y-0 lg:translate-y-0 lg:scale-100 lg:opacity-100"
                : "translate-y-full lg:translate-y-0 lg:scale-95 lg:opacity-0"
            } ${isVisible ? "pointer-events-auto" : "pointer-events-none"}`}
            style={{
              maxHeight: `min(${maxHeight}, 90vh)`,
              ...drawerStyle,
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {/* Handle - mobile only */}
            {showHandle && (
              <div
                className="flex justify-center py-3 lg:hidden"
                onPointerDown={handleDragStart}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
                style={{ touchAction: "none" }}
              >
                <div className="h-1.5 w-12 rounded-full bg-slate-300" />
              </div>
            )}

            {/* Content wrapper with ref for scroll detection */}
            <div ref={contentRef} className="overflow-y-auto h-full">
              {children}
            </div>
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
        onPointerDown={handleBackdropClick}
      />

      {/* Drawer */}
      <div
        className="fixed inset-0 z-50 flex items-end pointer-events-none"
      >
        <div
          ref={drawerRef}
          className={`w-full overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl ${
            isDragging ? "transition-none" : "transition-all duration-300"
          } ease-out ${
            isVisible ? "translate-y-0" : "translate-y-full"
          } ${isVisible ? "pointer-events-auto" : "pointer-events-none"}`}
          style={{ maxHeight, ...drawerStyle }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {/* Handle for mobile */}
          {showHandle && (
            <div
              className="flex justify-center py-3"
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
              style={{ touchAction: "none" }}
            >
              <div className="h-1.5 w-12 rounded-full bg-slate-300" />
            </div>
          )}

          {/* Content wrapper with ref for scroll detection */}
          <div ref={contentRef} className="overflow-y-auto h-full">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

export default BaseDrawer;
