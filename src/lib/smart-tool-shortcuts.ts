export interface ShortcutDefinition {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  /**
   * Unique identifier for this shortcut.
   * Must match the action IDs used in FloatingToolbar (e.g. 'ai-draft', 'copy').
   */
  id?: string;
  description: string;
  category?: string;
}

export const SMART_TOOL_SHORTCUTS = {
  saveToHistory: {
    id: 'save',
    key: 'Enter',
    ctrl: true,
    description: 'Save to history',
    category: 'Actions',
  },
  aiDraft: {
    id: 'ai-draft',
    key: 'a',
    ctrl: true,
    alt: true,
    description: 'AI Draft',
    category: 'Actions',
  },
  copyOutput: {
    id: 'copy',
    key: 'c',
    ctrl: true,
    shift: true,
    description: 'Copy output',
    category: 'Actions',
  },
  clearForm: {
    id: 'clear',
    key: 'x',
    ctrl: true,
    shift: true,
    description: 'Clear form',
    category: 'Actions',
  },
  switchToNow: {
    // Safe cross-browser: Ctrl+Alt+B (Cmd+Option+B on macOS)
    key: 'b',
    ctrl: true,
    alt: true,
    description: 'Switch to Barrier Mode',
    category: 'Navigation',
  },
  switchToFuture: {
    // Safe cross-browser: Ctrl+Alt+T (Cmd+Option+T on macOS)
    key: 't',
    ctrl: true,
    alt: true,
    description: 'Switch to Task Based Mode',
    category: 'Navigation',
  },
  showShortcutsHelp: {
    key: '?',
    description: 'Show shortcuts help',
    category: 'Help',
  },
} as const satisfies Record<string, ShortcutDefinition>;
