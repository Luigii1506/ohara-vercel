import React, { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimatedCardProps {
  children: React.ReactNode;
  index: number;
  cardKey: string;
}

const AnimatedCard = memo(({ children, index, cardKey }: AnimatedCardProps) => {
  return (
    <motion.div
      key={cardKey}
      layout
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
          type: "spring",
          stiffness: 300,
          damping: 24,
          delay: index * 0.015, // Efecto cascada sutil
        }
      }}
      exit={{
        opacity: 0,
        scale: 0.8,
        y: -20,
        transition: {
          duration: 0.2,
          ease: "easeInOut"
        }
      }}
      whileHover={{
        scale: 1.03,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
      className="will-change-transform"
    >
      {children}
    </motion.div>
  );
});

AnimatedCard.displayName = "AnimatedCard";

export default AnimatedCard;