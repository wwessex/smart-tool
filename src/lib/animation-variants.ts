/**
 * Shared Framer Motion animation variants and transition configs.
 */

/** Fade in with upward slide — used on page-level containers (Privacy, Terms). */
export const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

/** Stagger children on mount. */
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

/** Slide in from the left; exit to the right. */
export const slideInLeft = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 24 },
};

/** Slide in from the right; exit to the left. */
export const slideInRight = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

/** Snappy spring for interactive elements. */
export const springTransition = { type: "spring" as const, damping: 22, stiffness: 260 };

/** Softer spring for panels / larger surfaces. */
export const softSpring = { type: "spring" as const, damping: 28, stiffness: 200 };
