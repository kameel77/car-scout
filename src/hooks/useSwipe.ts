import React from 'react';

const SWIPE_THRESHOLD_PX = 50;
const MOVED_THRESHOLD_PX = 10;

interface SwipeHandlers {
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
}

export function useSwipe({ onSwipeLeft, onSwipeRight }: SwipeHandlers) {
    const startX = React.useRef<number | null>(null);
    const startY = React.useRef<number | null>(null);
    const swipedRef = React.useRef(false);

    const onTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
        swipedRef.current = false;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (startX.current === null || startY.current === null) return;
        const dx = e.touches[0].clientX - startX.current;
        const dy = e.touches[0].clientY - startY.current;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > MOVED_THRESHOLD_PX) {
            swipedRef.current = true;
        }
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        if (startX.current === null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        startX.current = null;
        startY.current = null;
        const wasSwipe = swipedRef.current;
        if (wasSwipe && Math.abs(dx) > SWIPE_THRESHOLD_PX) {
            if (dx > 0) onSwipeRight();
            else onSwipeLeft();
        }
    };

    const onClickCapture = (e: React.MouseEvent) => {
        if (swipedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            swipedRef.current = false;
        }
    };

    return { onTouchStart, onTouchMove, onTouchEnd, onClickCapture };
}
