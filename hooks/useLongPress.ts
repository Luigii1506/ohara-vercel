import { useCallback, useRef, useState } from "react";

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
  shouldPreventDefault?: boolean;
}

interface UseLongPressReturn {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  isLongPressing: boolean;
}

/**
 * Hook for detecting long press gestures
 * - Long press (hold ~400ms) triggers onLongPress
 * - Quick tap triggers onClick
 * - Prevents default context menu on mobile
 */
export function useLongPress({
  onLongPress,
  onClick,
  delay = 400,
  shouldPreventDefault = true,
}: UseLongPressOptions): UseLongPressReturn {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isLongPressTriggered = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const moveThreshold = 10; // pixels

  const start = useCallback(
    (x: number, y: number) => {
      startPos.current = { x, y };
      isLongPressTriggered.current = false;

      timeoutRef.current = setTimeout(() => {
        isLongPressTriggered.current = true;
        setIsLongPressing(true);
        onLongPress();
        // Haptic feedback on mobile (if available)
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, delay);
    },
    [onLongPress, delay]
  );

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    setIsLongPressing(false);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      start(touch.clientX, touch.clientY);
    },
    [start]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (shouldPreventDefault && isLongPressTriggered.current) {
        e.preventDefault();
      }
      clear();
    },
    [clear, shouldPreventDefault]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - startPos.current.x);
      const deltaY = Math.abs(touch.clientY - startPos.current.y);

      // Cancel if moved too much (user is scrolling)
      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        clear();
      }
    },
    [clear]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left click for long press
      if (e.button !== 0) return;
      start(e.clientX, e.clientY);
    },
    [start]
  );

  const onMouseUp = useCallback(() => {
    clear();
  }, [clear]);

  const onMouseLeave = useCallback(() => {
    clear();
  }, [clear]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // If long press was triggered, don't trigger click
      if (isLongPressTriggered.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onClick?.();
    },
    [onClick]
  );

  return {
    onTouchStart,
    onTouchEnd,
    onTouchMove,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onClick: handleClick,
    isLongPressing,
  };
}

export default useLongPress;
