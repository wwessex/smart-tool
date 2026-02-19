import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { FileText, History, Search, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyVariant = 'history' | 'search' | 'output' | 'generic';

interface EmptyStateProps {
  variant?: EmptyVariant;
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const defaultContent: Record<EmptyVariant, { icon: ReactNode; title: string; description: string }> = {
  history: {
    icon: <History className="w-8 h-8" />,
    title: 'No saved actions yet',
    description: 'Generate and save actions to build your history. Your past work will appear here.',
  },
  search: {
    icon: <Search className="w-8 h-8" />,
    title: 'No matching items',
    description: 'Try adjusting your search terms or clearing the filter to see all results.',
  },
  output: {
    icon: <FileText className="w-8 h-8" />,
    title: 'Ready to create',
    description: 'Fill in the form and click "Generate action" to get started.',
  },
  generic: {
    icon: <Inbox className="w-8 h-8" />,
    title: 'Nothing here yet',
    description: 'Content will appear here once available.',
  },
};

export function EmptyState({
  variant = 'generic',
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const defaults = defaultContent[variant];

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-border/60 text-center",
        className
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="text-muted-foreground/50 mb-3"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {icon ?? defaults.icon}
      </motion.div>
      <motion.h3
        className="text-sm font-medium text-foreground mb-1"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {title ?? defaults.title}
      </motion.h3>
      <motion.p
        className="text-xs text-muted-foreground max-w-[260px]"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {description ?? defaults.description}
      </motion.p>
      {action && (
        <motion.div
          className="mt-4"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
