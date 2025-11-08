import React, { memo } from "react";

interface AnimatedCardProps {
  children: React.ReactNode;
  index: number;
  cardKey: string;
}

const AnimatedCard = memo(({ children, index, cardKey }: AnimatedCardProps) => {
  return (
    <div
      key={cardKey}
      className="animate-fade-in will-change-transform hover:scale-[1.03] active:scale-[0.98] transition-transform duration-200"
      style={{
        animationDelay: `${index * 15}ms`
      }}
    >
      {children}
    </div>
  );
});

AnimatedCard.displayName = "AnimatedCard";

export default AnimatedCard;