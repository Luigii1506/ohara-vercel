import { useMemo } from "react";
import { FolderDimensions } from "@/components/folder/types";

interface WindowSize {
  width: number;
  height: number;
}

export const useFolderDimensions = (
  rows: number,
  columns: number,
  windowSize: WindowSize,
  isEditingMode: boolean = false
): FolderDimensions => {
  return useMemo(() => {
    const viewport = {
      width: windowSize.width,
      height: windowSize.height,
    };

    const isMobile = viewport.width < 768;

    // Constants for the algorithm
    const BINDER_ASPECT_RATIO = 1.478; // 1055/713.7 from original
    const CARD_ASPECT_RATIO = 1.4; // Height/Width ratio for cards
    const MOBILE_MARGIN = 20; // Total margin to achieve 370px on 390px screen
    const DESKTOP_MARGIN = 140; // Total margin on desktop (increased more to make cards smaller)
    const SPINE_WIDTH = 8; // Width of binder spine
    const MOBILE_PAGE_PADDING = 28; // Padding to achieve 114px cards (370-342=28)
    const DESKTOP_PAGE_PADDING = 56; // Padding inside each page (increased more to make cards smaller)

    // Calculate available space
    const availableWidth =
      viewport.width - (isMobile ? MOBILE_MARGIN : DESKTOP_MARGIN);
    const availableHeight =
      viewport.height - (isMobile ? MOBILE_MARGIN : DESKTOP_MARGIN);

    // Calculate binder size - prioritize width on mobile
    let binderWidth, binderHeight;

    if (isMobile) {
      // Mobile: Use almost all available width
      binderWidth = availableWidth;

      // Mobile uses single page, so don't use binder aspect ratio
      // Calculate height based on card requirements and grid
      const tempPageWidth = binderWidth - MOBILE_PAGE_PADDING;
      const tempGap = 0; // No gap on mobile
      const tempCardWidth = tempPageWidth / columns;
      const tempCardHeight = tempCardWidth * CARD_ASPECT_RATIO;
      const tempTotalHeight = tempCardHeight * rows + MOBILE_PAGE_PADDING;

      binderHeight = tempTotalHeight;

      // If height is too much, adjust by available height
      if (binderHeight > availableHeight) {
        binderHeight = availableHeight;
      }
    } else {
      // Desktop: Use original algorithm adapted for single page in editing mode
      if (isEditingMode) {
        // For editing mode (add-cards), use single page calculation
        const binderWidthByWidth = availableWidth;
        const binderHeightByWidth = binderWidthByWidth / BINDER_ASPECT_RATIO;

        const binderHeightByHeight = availableHeight;
        const binderWidthByHeight = binderHeightByHeight * BINDER_ASPECT_RATIO;

        if (binderHeightByWidth <= availableHeight) {
          binderWidth = binderWidthByWidth;
          binderHeight = binderHeightByWidth;
        } else {
          binderWidth = binderWidthByHeight;
          binderHeight = binderHeightByHeight;
        }
      } else {
        // For viewing mode (page.tsx), use dual page calculation
        const binderWidthByWidth = availableWidth;
        const binderHeightByWidth = binderWidthByWidth / BINDER_ASPECT_RATIO;

        const binderHeightByHeight = availableHeight;
        const binderWidthByHeight = binderHeightByHeight * BINDER_ASPECT_RATIO;

        if (binderHeightByWidth <= availableHeight) {
          binderWidth = binderWidthByWidth;
          binderHeight = binderHeightByWidth;
        } else {
          binderWidth = binderWidthByHeight;
          binderHeight = binderHeightByHeight;
        }
      }
    }

    // Calculate dimensions for each page
    const pagesCount = isMobile ? 1 : isEditingMode ? 1 : 2;

    // Real padding from FolderPage.tsx - considering hole positions
    // pl-10 pr-6 = 40px + 24px = 64px for odd pages
    // pl-3 pr-12 = 12px + 48px = 60px for even pages
    // py-6 = 24px + 24px = 48px for both
    const ACTUAL_HORIZONTAL_PADDING = isMobile ? 28 : 64; // Use higher padding for safety
    const ACTUAL_VERTICAL_PADDING = isMobile ? 28 : 48;

    const pageWidth = isMobile
      ? binderWidth - MOBILE_PAGE_PADDING
      : isEditingMode
      ? binderWidth - ACTUAL_HORIZONTAL_PADDING
      : (binderWidth - SPINE_WIDTH) / 2 - ACTUAL_HORIZONTAL_PADDING;
    const pageHeight =
      binderHeight - (isMobile ? MOBILE_PAGE_PADDING : ACTUAL_VERTICAL_PADDING);

    // Dynamic gap calculation
    const gap = isMobile ? 0 : 6; // Fixed 6px gap for desktop

    // Calculate card dimensions based on available space
    const totalGapWidth = (columns - 1) * gap;
    const totalGapHeight = (rows - 1) * gap;

    // No additional buffer needed since we're using real padding values
    const availableCardWidth = pageWidth - totalGapWidth;
    const availableCardHeight = pageHeight - totalGapHeight;

    // Calculate card size by width constraint
    const cardWidthByWidth = availableCardWidth / columns;
    const cardHeightByWidth = cardWidthByWidth * CARD_ASPECT_RATIO;

    // Calculate card size by height constraint
    const cardHeightByHeight = availableCardHeight / rows;
    const cardWidthByHeight = cardHeightByHeight / CARD_ASPECT_RATIO;

    // Use the smaller option (what fits better) with additional safety margin
    let cardWidth, cardHeight;
    if (cardHeightByWidth * rows + totalGapHeight <= availableCardHeight) {
      cardWidth = cardWidthByWidth;
      cardHeight = cardHeightByWidth;
    } else {
      cardWidth = cardWidthByHeight;
      cardHeight = cardHeightByHeight;
    }

    // Apply a small reduction to ensure cards fit comfortably
    cardWidth = cardWidth * 0.96; // 4% reduction for safety
    cardHeight = cardHeight * 0.96; // 4% reduction for safety

    // Ensure minimum sizes for usability
    cardWidth = Math.max(cardWidth, 30);
    cardHeight = Math.max(cardHeight, 42);

    // Final binder dimensions
    let finalBinderWidth, finalBinderHeight;

    if (isMobile) {
      // Mobile: Keep the desired width, don't recalculate
      finalBinderWidth = binderWidth;
      finalBinderHeight = binderHeight;
    } else {
      // Desktop: Recalculate to prevent empty space using real padding
      const actualPageWidth =
        columns * cardWidth + totalGapWidth + ACTUAL_HORIZONTAL_PADDING;
      const actualPageHeight =
        rows * cardHeight + totalGapHeight + ACTUAL_VERTICAL_PADDING;

      if (isEditingMode) {
        // For single page view, we don't multiply by 2 and don't add SPINE_WIDTH
        finalBinderWidth = actualPageWidth;
        finalBinderHeight = actualPageHeight;
      } else {
        // For dual page view
        finalBinderWidth = actualPageWidth * 2 + SPINE_WIDTH;
        finalBinderHeight = actualPageHeight;
      }
    }

    return {
      binderWidth: finalBinderWidth,
      binderHeight: finalBinderHeight,
      cardWidth,
      cardHeight,
      gap,
      isMobile,
      showSinglePage: isMobile || isEditingMode, // Force single page in editing mode
    };
  }, [rows, columns, windowSize.width, windowSize.height, isEditingMode]);
};
