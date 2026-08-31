import React, { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { triggerHaptic } from '../lib/haptics';
import { cn } from '../lib/utils';

export interface SwipeableContainerProps {
  currentIndex: number;
  onIndexChange: (newIndex: number) => void;
  children: React.ReactNode[];
  swipeThreshold?: number;
  swipeVelocity?: number;
  enableHaptics?: boolean;
  className?: string;
}

/**
 * SwipeableContainer - Container allowing tab/screen swapping via touch swipe gestures
 * (swipe left/right) with spring animations and haptic feedback like native mobile apps.
 */
export const SwipeableContainer: React.FC<SwipeableContainerProps> = ({
  currentIndex,
  onIndexChange,
  children,
  swipeThreshold = 50,
  swipeVelocity = 250,
  enableHaptics = true,
  className,
}) => {
  const [direction, setDirection] = useState<1 | -1>(1);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    const totalItems = React.Children.count(children);

    if (offset.x < -swipeThreshold || velocity.x < -swipeVelocity) {
      // Swiped left -> Next tab/view
      if (currentIndex < totalItems - 1) {
        setDirection(1);
        if (enableHaptics) triggerHaptic('light');
        onIndexChange(currentIndex + 1);
      }
    } else if (offset.x > swipeThreshold || velocity.x > swipeVelocity) {
      // Swiped right -> Previous tab/view
      if (currentIndex > 0) {
        setDirection(-1);
        if (enableHaptics) triggerHaptic('light');
        onIndexChange(currentIndex - 1);
      }
    }
  };

  const childrenArray = React.Children.toArray(children);
  const currentChild = childrenArray[currentIndex];

  return (
    <div className={cn('relative w-full h-full overflow-hidden touch-pan-y', className)}>
      <AnimatePresence initial={false} mode="wait" custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          initial={{ opacity: 0, x: direction * 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -40 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          drag="x"
          dragDirectionLock
          dragElastic={0.2}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          className="w-full h-full"
        >
          {currentChild}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SwipeableContainer;
