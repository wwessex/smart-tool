import { motion } from 'framer-motion';
import { Keyboard } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShortcutGroup } from '@/hooks/useKeyboardShortcuts';
import { cn } from '@/lib/utils';

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ShortcutGroup[];
}

export function ShortcutsHelp({ open, onOpenChange, groups }: ShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {groups.map((group, i) => (
            <motion.div
              key={group.category}
              className="space-y-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {group.category}
              </h4>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut, j) => (
                  <div
                    key={j}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className="px-2 py-1 text-xs font-mono rounded bg-background border shadow-sm">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}

          <div className="pt-2 text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">?</kbd> anytime to show this help
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
