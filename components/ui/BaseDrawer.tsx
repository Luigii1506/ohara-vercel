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
      return window.innerWidth < 768;
    }
    return true;
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wasOpenRef = useRef(false);
  const dragStartRef = useRef<number | null>(null);
  const pointerCanDragRef = useRef(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const activeScrollRef = useRef<HTMLElement | null>(null);
  const lastDragDeltaRef = useRef(0);
  const [touchBindKey, setTouchBindKey] = useState(0);

  const findScrollableParent = useCallback((node: HTMLElement | null) => {
    if (typeof window === "undefined") return contentRef.current;
    let current = node;
    while (current && current !== drawerRef.current) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      const canScroll =
        (overflowY === "auto" || overflowY === "scroll") &&
        current.scrollHeight > current.clientHeight;
      if (canScroll) return current;
      current = current.parentElement;
    }
    return contentRef.current;
  }, []);

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
      setIsMobileViewport(window.innerWidth < 768);
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
      if (preventClose || event.pointerType === "touch") return;
      const scrollContainer = contentRef.current;
      pointerCanDragRef.current =
        !scrollContainer || scrollContainer.scrollTop <= 0;
      dragStartRef.current = event.clientY;
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

  const handleDragMovePending = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isDragging || dragStartRef.current === null) return;
      if (!pointerCanDragRef.current) return;
      const delta = event.clientY - dragStartRef.current;
      if (delta <= 8) return;
      setIsDragging(true);
      setDragOffset(delta);
    },
    [isDragging]
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging) {
      dragStartRef.current = null;
      pointerCanDragRef.current = false;
      return;
    }
    const shouldClose = dragOffset > 70;
    setIsDragging(false);
    dragStartRef.current = null;
    pointerCanDragRef.current = false;
    setDragOffset(0);
    if (shouldClose && !preventClose) {
      onClose();
    }
  }, [dragOffset, isDragging, onClose, preventClose]);

  // Touch handlers for overscroll-to-dismiss behavior
  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (preventClose || !isMobileViewport) return;
      const target = event.target as HTMLElement | null;
      const scrollContainer =
        findScrollableParent(target) ?? contentRef.current;
      activeScrollRef.current = scrollContainer;
      touchStartYRef.current = event.touches[0].clientY;
      lastDragDeltaRef.current = 0;
    },
    [preventClose, isMobileViewport, findScrollableParent]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (
        preventClose ||
        !isMobileViewport ||
        touchStartYRef.current === null
      ) {
        return;
      }

      const scrollContainer = activeScrollRef.current ?? contentRef.current;
      const currentY = event.touches[0].clientY;
      const deltaY = currentY - touchStartYRef.current;
      const canScroll =
        !!scrollContainer &&
        scrollContainer.scrollHeight > scrollContainer.clientHeight;
      const isCurrentlyAtTop =
        !scrollContainer || scrollContainer.scrollTop <= 0;

      if (isDragging) {
        if (deltaY <= 0) {
          setIsDragging(false);
          setDragOffset(0);
          lastDragDeltaRef.current = 0;
          touchStartYRef.current = currentY;
          return;
        }
        event.preventDefault();
        const resistance = 0.7;
        const nextOffset = Math.max(0, deltaY * resistance);
        setDragOffset(nextOffset);
        lastDragDeltaRef.current = deltaY;
        return;
      }

      if (canScroll && !isCurrentlyAtTop) {
        touchStartYRef.current = currentY;
        return;
      }

      if (isCurrentlyAtTop && deltaY > 8) {
        event.preventDefault();
        setIsDragging(true);
        const resistance = 0.7;
        const nextOffset = Math.max(0, deltaY * resistance);
        setDragOffset(nextOffset);
        lastDragDeltaRef.current = deltaY;
      }
    },
    [preventClose, isMobileViewport, isDragging]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isMobileViewport) return;
    touchStartYRef.current = null;
    activeScrollRef.current = null;

    if (isDragging) {
      const shouldClose = dragOffset > 60;
      setIsDragging(false);
      setDragOffset(0);
      if (shouldClose && !preventClose) {
        onClose();
      }
    }
  }, [dragOffset, isDragging, onClose, preventClose, isMobileViewport]);

  useEffect(() => {
    if (!shouldRender) return;
    const target = contentRef.current ?? drawerRef.current;
    if (!target) {
      const retry = setTimeout(() => {
        setTouchBindKey((prev) => prev + 1);
      }, 50);
      return () => clearTimeout(retry);
    }
    const onStart = (event: TouchEvent) => handleTouchStart(event);
    const onMove = (event: TouchEvent) => handleTouchMove(event);
    const onEnd = () => handleTouchEnd();
    target.addEventListener("touchstart", onStart, { passive: true });
    target.addEventListener("touchmove", onMove, { passive: false });
    target.addEventListener("touchend", onEnd, { passive: true });
    target.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      target.removeEventListener("touchstart", onStart);
      target.removeEventListener("touchmove", onMove);
      target.removeEventListener("touchend", onEnd);
      target.removeEventListener("touchcancel", onEnd);
    };
  }, [
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    shouldRender,
    touchBindKey,
  ]);

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
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center pointer-events-none">
          <div
            ref={drawerRef}
            className={`w-full overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl ${
              isDragging ? "transition-none" : "transition-all duration-300"
            } ease-out md:max-h-[85vh] md:${desktopMaxWidth} md:rounded-3xl ${
              isVisible
                ? "translate-y-0 md:translate-y-0 md:scale-100 md:opacity-100"
                : "translate-y-full md:translate-y-0 md:scale-95 md:opacity-0"
            } ${isVisible ? "pointer-events-auto" : "pointer-events-none"}`}
            style={{
              maxHeight: `min(${maxHeight}, 90vh)`,
              ...drawerStyle,
            }}
            onPointerDown={handleDragStart}
            onPointerMove={(event) => {
              handleDragMovePending(event);
              handleDragMove(event);
            }}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            {/* Handle - mobile only */}
            {showHandle && (
              <div className="flex justify-center py-3 lg:hidden">
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
      <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
        <div
          ref={drawerRef}
          className={`w-full overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl ${
            isDragging ? "transition-none" : "transition-all duration-300"
          } ease-out ${isVisible ? "translate-y-0" : "translate-y-full"} ${
            isVisible ? "pointer-events-auto" : "pointer-events-none"
          }`}
          style={{ maxHeight, ...drawerStyle }}
          onPointerDown={handleDragStart}
          onPointerMove={(event) => {
            handleDragMovePending(event);
            handleDragMove(event);
          }}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          {/* Handle for mobile */}
          {showHandle && (
            <div className="flex justify-center py-3">
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
