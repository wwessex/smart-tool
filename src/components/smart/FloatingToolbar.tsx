import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Save, Trash2, Sparkles, Download, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SMART_TOOL_SHORTCUTS } from '@/lib/smart-tool-shortcuts';
import { formatShortcut, toAriaKeyShortcuts } from '@/hooks/useKeyboardShortcuts';

interface FloatingToolbarProps {
  onCopy: () => void;
  onSave: () => void;
  onClear: () => void;
  onAIDraft: () => void;
  onDownload: () => void;
  hasOutput: boolean;
  copied?: boolean;
  className?: string;
  /** Map of action IDs to formatted shortcut strings (e.g., { 'copy': 'Ctrl+Shift+C' }) */
  shortcutMap?: Record<string, string>;
}

export function FloatingToolbar({
  onCopy,
  onSave,
  onClear,
  onAIDraft,
  onDownload,
  hasOutput,
  copied,
  className,
  shortcutMap = {},
}: FloatingToolbarProps) {
  const actions = [
    {
      id: 'ai-draft',
      icon: Sparkles,
      label: 'AI Draft',
      onClick: onAIDraft,
      variant: 'default' as const,
      className: 'bg-primary hover:bg-primary/90 text-primary-foreground',
    },
    {
      id: 'copy',
      icon: copied ? Check : Copy,
      label: copied ? 'Copied!' : 'Copy',
      onClick: onCopy,
      disabled: !hasOutput,
      variant: 'secondary' as const,
      className: copied ? 'bg-green-500/20 text-green-600 hover:bg-green-500/30' : '',
    },
    {
      id: 'save',
      icon: Save,
      label: 'Save',
      onClick: onSave,
      disabled: !hasOutput,
      variant: 'secondary' as const,
    },
    {
      id: 'download',
      icon: Download,
      label: 'Download',
      onClick: onDownload,
      disabled: !hasOutput,
      variant: 'secondary' as const,
    },
    {
      id: 'clear',
      icon: Trash2,
      label: 'Clear',
      onClick: onClear,
      variant: 'ghost' as const,
      className: 'hover:bg-destructive/10 hover:text-destructive',
    },
  ];

  // Get shortcut for an action from the shortcutMap
  const getShortcut = (actionId: string): string | undefined => shortcutMap[actionId];

  return (
    <TooltipProvider delayDuration={300}>
      <motion.nav
        role="toolbar"
        aria-label="Action toolbar"
        className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
          "bg-card/95 backdrop-blur-xl border border-border/50 rounded-full shadow-lg",
          "px-2 py-2 flex items-center gap-1",
          className
        )}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300, delay: 0.5 }}
      >
        {actions.map((action, index) => (
          <Tooltip key={action.id}>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6 + index * 0.05 }}
              >
                <Button
                  variant={action.variant}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  aria-label={action.label}
	                  // CodeQL: avoid redundant replacement (e.g. replacing "Shift+" with itself)
	                  aria-keyshortcuts={getShortcut(action.id)?.replace('Ctrl+', 'Control+')}
                  className={cn(
                    "h-10 w-10 rounded-full p-0",
                    action.disabled && "opacity-50 cursor-not-allowed",
                    action.className
                  )}
                >
                  <action.icon className="w-4 h-4" aria-hidden="true" />
                  <span className="sr-only">{action.label}</span>
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="top" className="flex items-center gap-2">
              <span>{action.label}</span>
              {getShortcut(action.id) && (
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded font-mono">
                  {getShortcut(action.id)}
                </kbd>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </motion.nav>
    </TooltipProvider>
  );
}
