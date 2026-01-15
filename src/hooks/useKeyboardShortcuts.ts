import { useEffect, useCallback } from 'react';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  category?: string;
}

export interface ShortcutGroup {
  category: string;
  shortcuts: { keys: string; description: string }[];
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], enabled: boolean = true) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                   target.tagName === 'TEXTAREA' || 
                   target.isContentEditable;
    
    for (const shortcut of shortcuts) {
      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatches = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey);
      const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatches = shortcut.alt ? event.altKey : !event.altKey;
      
      // Special case: allow "?" even in inputs for help
      const isHelpKey = shortcut.key === '?' && !shortcut.ctrl && !shortcut.shift;
      
      if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
        // Skip if in input unless it's a ctrl/meta combo or help key
        if (isInput && !shortcut.ctrl && !isHelpKey) continue;
        
        event.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export function formatShortcut(shortcut: ShortcutConfig): string {
  const parts: string[] = [];
  
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  
  if (shortcut.ctrl) parts.push(isMac ? '⌘' : 'Ctrl');
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  
  // Format special keys
  let key = shortcut.key;
  if (key === 'Enter') key = '↵';
  else if (key === ' ') key = 'Space';
  else key = key.toUpperCase();
  
  parts.push(key);
  
  return parts.join(isMac ? '' : '+');
}

export function groupShortcuts(shortcuts: ShortcutConfig[]): ShortcutGroup[] {
  const groups: Record<string, { keys: string; description: string }[]> = {};
  
  for (const shortcut of shortcuts) {
    const category = shortcut.category || 'General';
    if (!groups[category]) groups[category] = [];
    groups[category].push({
      keys: formatShortcut(shortcut),
      description: shortcut.description,
    });
  }
  
  return Object.entries(groups).map(([category, shortcuts]) => ({
    category,
    shortcuts,
  }));
}
