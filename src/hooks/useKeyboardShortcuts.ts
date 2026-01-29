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
  /** Unique identifier for the shortcut, used for UI components to look up formatted shortcuts */
  id?: string;
}

export interface ShortcutGroup {
  category: string;
  shortcuts: { keys: string; description: string }[];
}

export type ShortcutLike = Pick<ShortcutConfig, 'key' | 'ctrl' | 'shift' | 'alt'>;

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], enabled: boolean = true) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                   target.tagName === 'TEXTAREA' || 
                   target.isContentEditable;
    
    // Also check if we're inside a combobox/command menu (cmdk) which uses role="combobox"
    const isCombobox = target.closest('[role="combobox"]') !== null ||
                       target.closest('[cmdk-root]') !== null ||
                       target.closest('[data-radix-popper-content-wrapper]') !== null;
    
    for (const shortcut of shortcuts) {
      const isQuestionMark = shortcut.key === '?' && !shortcut.ctrl && !shortcut.alt;
      const keyMatches = isQuestionMark
        ? event.key === '?' || event.key === '/'
        : event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatches = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey);
      // Special case: allow "?" regardless of whether Shift is required on the user's keyboard layout
      const shiftMatches = shortcut.shift ? event.shiftKey : (isQuestionMark ? true : !event.shiftKey);
      const altMatches = shortcut.alt ? event.altKey : !event.altKey;
      
      // Special case: allow "?" even in inputs for help
      const isHelpKey = shortcut.key === '?' && !shortcut.ctrl && !shortcut.alt;
      
      if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
        // Skip if in input/combobox unless it's a ctrl/meta combo or help key
        if ((isInput || isCombobox) && !shortcut.ctrl && !isHelpKey) continue;
        
        // Extra safety: if ctrl is required but not pressed, skip
        if (shortcut.ctrl && !(event.ctrlKey || event.metaKey)) continue;
        
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

export function formatShortcut(shortcut: ShortcutLike): string {
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

export function toAriaKeyShortcuts(shortcut: ShortcutLike): string | undefined {
  const normalizeKey = (key: string) => {
    if (key === ' ') return 'Space';
    if (key.length === 1) return key.toUpperCase();
    return key;
  };

  const build = (primaryModifier?: 'Control' | 'Meta') => {
    const parts: string[] = [];
    if (primaryModifier) parts.push(primaryModifier);
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(normalizeKey(shortcut.key));
    return parts.join('+');
  };

  // Our handler treats ctrl as "Ctrl OR Meta" (Cmd on macOS).
  if (shortcut.ctrl) return `${build('Control')} ${build('Meta')}`;
  return build();
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

/**
 * Creates a lookup map from action IDs to formatted shortcut strings.
 * This allows UI components to display consistent shortcut hints.
 */
export function createShortcutMap(shortcuts: ShortcutConfig[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const shortcut of shortcuts) {
    if (shortcut.id) {
      map[shortcut.id] = formatShortcut(shortcut);
    }
  }
  return map;
}
