import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

type WarningVariant = 'warning' | 'error' | 'info';

interface WarningBoxProps {
  children: ReactNode;
  variant?: WarningVariant;
  title?: string;
  icon?: ReactNode;
  show?: boolean;
  className?: string;
  pulse?: boolean;
}

const variantStyles: Record<WarningVariant, { bg: string; border: string; text: string; glow: string }> = {
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-600',
    glow: 'rgba(245, 158, 11, 0.3)',
  },
  error: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    text: 'text-destructive',
    glow: 'rgba(239, 68, 68, 0.3)',
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-600',
    glow: 'rgba(59, 130, 246, 0.3)',
  },
};

const defaultIcons: Record<WarningVariant, ReactNode> = {
  warning: <AlertTriangle className="w-4 h-4 shrink-0" />,
  error: <AlertCircle className="w-4 h-4 shrink-0" />,
  info: <Info className="w-4 h-4 shrink-0" />,
};

export function WarningBox({
  children,
  variant = 'warning',
  title,
  icon,
  show = true,
  className = '',
  pulse = true,
}: WarningBoxProps) {
  const styles = variantStyles[variant];
  const displayIcon = icon ?? defaultIcons[variant];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`relative flex items-start gap-2 p-3 rounded-lg ${styles.bg} border ${styles.border} ${className}`}
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: undefined }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.2 }}
          role="alert"
        >
          {pulse && (
            <motion.div
              className="absolute inset-0 rounded-lg pointer-events-none"
              animate={{
                boxShadow: [
                  `0 0 0 0 ${styles.glow.replace('0.3', '0')}`,
                  `0 0 8px 2px ${styles.glow}`,
                  `0 0 0 0 ${styles.glow.replace('0.3', '0')}`,
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <motion.span
            className={`mt-0.5 ${styles.text}`}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {displayIcon}
          </motion.span>
          <div className="flex-1 min-w-0">
            {title && (
              <p className={`font-medium text-sm ${styles.text}`}>{title}</p>
            )}
            <div className={`text-xs ${styles.text.replace('600', '700')}`}>
              {children}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface WarningTextProps {
  children: ReactNode;
  variant?: WarningVariant;
  show?: boolean;
  className?: string;
}

export function WarningText({
  children,
  variant = 'warning',
  show = true,
  className = '',
}: WarningTextProps) {
  const styles = variantStyles[variant];
  const icon = defaultIcons[variant];

  return (
    <AnimatePresence>
      {show && (
        <motion.p
          className={`text-xs ${styles.text} flex items-center gap-1 ${className}`}
          role="alert"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
        >
          <motion.span
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {icon}
          </motion.span>
          {children}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

interface InputGlowProps {
  show: boolean;
  variant?: WarningVariant;
}

export function InputGlow({ show, variant = 'warning' }: InputGlowProps) {
  const styles = variantStyles[variant];

  if (!show) return null;

  return (
    <motion.div
      className="absolute inset-0 rounded-md pointer-events-none"
      animate={{
        boxShadow: [
          `0 0 0 0 ${styles.glow.replace('0.3', '0')}`,
          `0 0 8px 2px ${styles.glow}`,
          `0 0 0 0 ${styles.glow.replace('0.3', '0')}`,
        ],
      }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
