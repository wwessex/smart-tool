import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Save, Trash2, Sparkles, Download, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SMART_TOOL_SHORTCUTS } from '@/lib/smart-tool-shortcuts';
import { formatShortcut } from '@/hooks/useKeyboardShortcuts';

interface FloatingToolbarProps {
  onCopy: () => void;
  onSave: () => void;
  onClear: () => void;
  onAIDraft: () => void;
  onDownload: () => void;
  hasOutput: boolean;
  copied?: boolean;
  shortcutMap?: Record<string, string>;
  className?: string;
}

/**
 * Primary CTA toolbar
 * - AI Draft is a clear, labelled primary action
 * - Secondary actions remain icon buttons
 * - Mobile-friendly: full-width, sticky, safe-area aware
 */
export function FloatingToolbar({
  onCopy,
  onSave,
  onClear,
  onAIDraft,
  onDownload,
  hasOutput,
  copied,
  className,
}: FloatingToolbarProps) {
  const getShortcut = (id: string) => {
    const raw = SMART_TOOL_SHORTCUTS[id as keyof typeof SMART_TOOL_SHORTCUTS];
    return raw ? formatShortcut(raw) : undefined;
  };

  const actions = [
    {
      id: 'copy',
      icon: copied ? Check : Copy,
      label: copied ? 'Copied!' : 'Copy',
      onClick: onCopy,
      disabled: !hasOutput,
      variant: 'secondary' as const,
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
      disabled: false,
      variant: 'ghost' as const,
    },
  ];

  return (
    <TooltipProvider delayDuration={250}>
      <motion.nav
        role="toolbar"
        aria-label="Action toolbar"
        className={cn(
          "fixed left-1/2 -translate-x-1/2 z-50",
          "bottom-4 sm:bottom-6",
          "w-[calc(100%-1.25rem)] sm:w-auto",
          "glass-panel border-white/25 rounded-2xl shadow-lg",
          "px-2 py-2 flex items-center gap-2",
          "backdrop-blur-2xl",
          className
        )}
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 24, stiffness: 320, delay: 0.25 }}
      >
        {/* Primary CTA */}
        <Button
          onClick={onAIDraft}
          variant="default"
          size="lg"
          aria-label="AI Draft"
          aria-keyshortcuts={getShortcut('ai-draft')?.replace('Ctrl+', 'Control+')}
          className={cn(
            "rounded-2xl",
            "shadow-md hover:shadow-lg",
            "px-5 sm:px-6",
            "gap-2"
          )}
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span className="font-semibold">AI Draft</span>
        </Button>

        {/* Secondary actions */}
        <div className="flex items-center gap-1">
          {actions.map((action, index) => (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.35 + index * 0.04 }}
                >
                  <Button
                    variant={action.variant}
                    size="icon"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    aria-label={action.label}
                    aria-keyshortcuts={getShortcut(action.id)?.replace('Ctrl+', 'Control+')}
                    className={cn(
                      "rounded-xl",
                      action.disabled && "opacity-50 cursor-not-allowed"
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
        </div>
      </motion.nav>
    </TooltipProvider>
  );
}
