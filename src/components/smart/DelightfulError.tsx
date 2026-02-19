import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, WifiOff, Bug, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ErrorVariant = 'network' | 'ai' | 'generic' | 'permission';

interface DelightfulErrorProps {
  variant?: ErrorVariant;
  title?: string;
  message?: string;
  icon?: ReactNode;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const errorContent: Record<ErrorVariant, { icon: ReactNode; title: string; message: string }> = {
  network: {
    icon: <WifiOff className="w-6 h-6" />,
    title: 'Connection hiccup',
    message: "Looks like we lost the signal. Check your connection and let's try again.",
  },
  ai: {
    icon: <Bug className="w-6 h-6" />,
    title: 'AI took a nap',
    message: "The AI model hit a snag. This sometimes happens - a quick retry usually sorts it out.",
  },
  generic: {
    icon: <AlertCircle className="w-6 h-6" />,
    title: 'Something went sideways',
    message: "An unexpected error occurred. Don't worry - your data is safe.",
  },
  permission: {
    icon: <ShieldAlert className="w-6 h-6" />,
    title: 'Permission needed',
    message: "We need your permission to continue. Check your browser settings and try again.",
  },
};

export function DelightfulError({
  variant = 'generic',
  title,
  message,
  icon,
  onRetry,
  onDismiss,
  className,
}: DelightfulErrorProps) {
  const defaults = errorContent[variant];

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-xl border border-destructive/20 bg-destructive/5 p-5",
        className
      )}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Subtle animated background pulse */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-destructive/5 via-destructive/10 to-destructive/5 pointer-events-none"
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        style={{ backgroundSize: '200% 100%' }}
      />

      <div className="relative flex items-start gap-3">
        <motion.div
          className="text-destructive shrink-0 mt-0.5"
          initial={{ rotate: -10 }}
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {icon ?? defaults.icon}
        </motion.div>
        <div className="flex-1 min-w-0">
          <motion.h4
            className="text-sm font-semibold text-destructive mb-1"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {title ?? defaults.title}
          </motion.h4>
          <motion.p
            className="text-xs text-destructive/80 leading-relaxed"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {message ?? defaults.message}
          </motion.p>
          {(onRetry || onDismiss) && (
            <motion.div
              className="flex items-center gap-2 mt-3"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Try again
                </Button>
              )}
              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDismiss}
                  className="h-7 text-xs text-destructive/70 hover:text-destructive"
                >
                  Dismiss
                </Button>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
