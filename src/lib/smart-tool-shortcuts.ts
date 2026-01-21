export interface ShortcutDefinition {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category?: string;
}

export const SMART_TOOL_SHORTCUTS = {
  saveToHistory: {
    key: 'Enter',
    ctrl: true,
    description: 'Save to history',
    category: 'Actions',
  },
  aiDraft: {
    key: 'd',
    ctrl: true,
    description: 'AI Draft',
    category: 'Actions',
  },
  copyOutput: {
    key: 'c',
    ctrl: true,
    shift: true,
    description: 'Copy output',
    category: 'Actions',
  },
  clearForm: {
    key: 'x',
    ctrl: true,
    shift: true,
    description: 'Clear form',
    category: 'Actions',
  },
  switchToNow: {
    key: '1',
    ctrl: true,
    description: 'Switch to Now mode',
    category: 'Navigation',
  },
  switchToFuture: {
    key: '2',
    ctrl: true,
    description: 'Switch to Task Based Mode',
    category: 'Navigation',
  },
  showShortcutsHelp: {
    key: '?',
    description: 'Show shortcuts help',
    category: 'Help',
  },
} as const satisfies Record<string, ShortcutDefinition>;

