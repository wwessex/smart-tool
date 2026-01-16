import { motion } from 'framer-motion';

interface PulsingGlowProps {
  color?: 'amber' | 'red';
  className?: string;
}

const glowColors = {
  amber: 'rgba(245, 158, 11, 0.3)',
  red: 'rgba(239, 68, 68, 0.3)',
};

export function PulsingGlow({ color = 'amber', className = '' }: PulsingGlowProps) {
  const glowColor = glowColors[color];
  
  return (
    <motion.div
      className={`absolute inset-0 rounded-md pointer-events-none ${className}`}
      animate={{
        boxShadow: [
          `0 0 0 0 ${glowColor.replace('0.3', '0')}`,
          `0 0 8px 2px ${glowColor}`,
          `0 0 0 0 ${glowColor.replace('0.3', '0')}`,
        ],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}
