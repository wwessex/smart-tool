import { useState, useCallback, useMemo, useEffect, memo, lazy, Suspense, useRef } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { useSmartStorage, HistoryItem, ActionTemplate } from '@/hooks/useSmartStorage';
import { useTranslation, SUPPORTED_LANGUAGES } from '@/hooks/useTranslation';
import { useCloudAI } from '@/hooks/useCloudAI';
import { useAIConsent } from '@/hooks/useAIConsent';
import { 
  todayISO, 
  buildNowOutput, 
  buildFutureOutput,
  aiDraftNow,
  aiDraftFuture,
  getSuggestionList,
  getTaskSuggestions,
  resolvePlaceholders,
  parseTimescaleToTargetISO,
  formatDDMMMYY
} from '@/lib/smart-utils';
import { checkSmart, SmartCheck } from '@/lib/smart-checker';
import { SmartChecklist } from './SmartChecklist';
import { TemplateLibrary } from './TemplateLibrary';
import { LLMChatButton } from './LLMChat';
import { ActionWizard } from './ActionWizard';
import { AIImproveDialog } from './AIImproveDialog';
import { ShortcutsHelp } from './ShortcutsHelp';
import { OnboardingTutorial, useOnboarding } from './OnboardingTutorial';

// Lazy load HistoryInsights as it uses recharts which is a heavy dependency
const HistoryInsights = lazy(() => import('./HistoryInsights').then(module => ({ default: module.HistoryInsights })));

// Skeleton loader for lazy-loaded components
const InsightsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-20 rounded-xl bg-muted" />
      ))}
    </div>
    <div className="h-48 rounded-xl bg-muted" />
  </div>
);
import { FloatingToolbar } from './FloatingToolbar';
import { Footer } from './Footer';
import { ManageConsentDialog, getStoredConsent } from './CookieConsent';
import { LanguageSelector } from './LanguageSelector';
import { WarningBox, WarningText, InputGlow } from './WarningBox';
import { useKeyboardShortcuts, groupShortcuts, ShortcutConfig } from '@/hooks/useKeyboardShortcuts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FIX_CRITERION_PROMPT, CRITERION_GUIDANCE } from '@/lib/smart-prompts';

// Zod schemas for import validation
const HistoryItemMetaSchema = z.object({
  date: z.string().max(50),
  forename: z.string().max(100),
  barrier: z.string().max(200),
  timescale: z.string().max(50),
  action: z.string().max(2000).optional(),
  responsible: z.string().max(100).optional(),
  help: z.string().max(2000).optional(),
  reason: z.string().max(2000).optional()
});

const HistoryItemSchema = z.object({
  id: z.string().max(100),
  mode: z.enum(['now', 'future']),
  createdAt: z.string().max(50),
  text: z.string().max(5000),
  meta: HistoryItemMetaSchema
});

const ImportSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  history: z.array(HistoryItemSchema).max(100).optional(),
  barriers: z.array(z.string().max(200)).max(50).optional(),
  timescales: z.array(z.string().max(50)).max(20).optional()
});

type ValidatedImport = z.infer<typeof ImportSchema>;

import { GUIDANCE } from '@/lib/smart-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Copy, Download, Trash2, History, Settings, HelpCircle, Edit, Sparkles, Sun, Moon, Monitor, ChevronDown, ChevronUp, Bot, AlertTriangle, ShieldCheck, Wand2, Keyboard, BarChart3, Shield, FileDown, Clock, Languages, Loader2, RefreshCw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ComboboxInput } from './ComboboxInput';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const slideInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
};

const slideInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

type Mode = 'now' | 'future';

interface NowForm {
  date: string;
  forename: string;
  barrier: string;
  action: string;
  responsible: string;
  help: string;
  timescale: string;
}

interface FutureForm {
  date: string;
  forename: string;
  task: string;
  outcome: string;
  timescale: string;
}

export function SmartActionTool() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const storage = useSmartStorage();
  const translation = useTranslation();
  const cloudAI = useCloudAI();
const aiHasConsent = useAIConsent();
  const today = todayISO();

  const [mode, setMode] = useState<Mode>('now');
  const [nowForm, setNowForm] = useState<NowForm>({
    date: today,
    forename: '',
    barrier: '',
    action: '',
    responsible: '',
    help: '',
    timescale: ''
  });
  const [futureForm, setFutureForm] = useState<FutureForm>({
    date: today,
    forename: '',
    task: '',
    outcome: '',
    timescale: ''
  });
  const [output, setOutput] = useState('');
  const [outputSource, setOutputSource] = useState<'form' | 'ai' | 'manual'>('form');
  const [translatedOutput, setTranslatedOutput] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [settingsBarriers, setSettingsBarriers] = useState('');
  const [settingsTimescales, setSettingsTimescales] = useState('');
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [wizardMode, setWizardMode] = useState(false);
  const [improveDialogOpen, setImproveDialogOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState<'history' | 'insights'>('history');
  const [privacySettingsOpen, setPrivacySettingsOpen] = useState(false);
  const [fixingCriterion, setFixingCriterion] = useState<string | null>(null);
  const [lastFixAttempt, setLastFixAttempt] = useState<{
    criterion: 'specific' | 'measurable' | 'achievable' | 'relevant' | 'timeBound';
    suggestion: string;
  } | null>(null);

  // Detect landscape orientation
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerHeight < 600 && window.innerWidth > window.innerHeight);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // GDPR: Auto-cleanup old history items on load
  useEffect(() => {
    let isMounted = true;
    
    // Defer cleanup check to avoid blocking initial render
    const timeoutId = setTimeout(() => {
      if (isMounted && storage.shouldRunCleanup()) {
        const { deletedCount } = storage.cleanupOldHistory();
        if (isMounted && deletedCount > 0) {
          toast({
            title: 'Data retention cleanup',
            description: `${deletedCount} action${deletedCount === 1 ? '' : 's'} older than ${storage.retentionDays} days ${deletedCount === 1 ? 'was' : 'were'} automatically removed.`,
          });
        }
      }
    }, 100);
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  // Only run once on mount - storage methods are stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // BUG FIX #1: Validate future date - must be today or later
  const futureDateError = useMemo(() => {
    if (!futureForm.date) return '';
    if (futureForm.date < today) {
      return 'Date must be today or in the future for task-based actions.';
    }
    return '';
  }, [futureForm.date, today]);

  const nowDateWarning = useMemo(() => {
    if (!nowForm.date) return '';
    if (nowForm.date !== today) {
      return `This date differs from today. Actions recorded for past or future dates may need additional context.`;
    }
    return '';
  }, [nowForm.date, today]);

  const validateNow = useCallback((): boolean => {
    return !!(
      nowForm.date &&
      nowForm.forename.trim() &&
      nowForm.barrier.trim() &&
      nowForm.action.trim() &&
      nowForm.responsible &&
      nowForm.help.trim() &&
      nowForm.timescale
    );
  }, [nowForm]);

  // BUG FIX #1: Add date validation to validateFuture
  const validateFuture = useCallback((): boolean => {
    return !!(
      futureForm.date &&
      futureForm.date >= today && // Must be today or future
      futureForm.forename.trim() &&
      futureForm.task.trim() &&
      futureForm.outcome.trim() &&
      futureForm.timescale
    );
  }, [futureForm, today]);

  const generateOutput = useCallback((force = false) => {
    if (force) setShowValidation(true);
    
    const isValid = mode === 'now' ? validateNow() : validateFuture();
    
    if (!isValid) {
      if (force) {
        setOutput('Please complete all fields to generate an action.');
        toast({ title: 'Missing fields', description: 'Please complete all required fields.', variant: 'destructive' });
      } else {
        setOutput('');
      }
      return;
    }

    if (mode === 'now') {
      const text = buildNowOutput(
        nowForm.date,
        nowForm.forename.trim(),
        nowForm.barrier.trim(),
        nowForm.action.trim(),
        nowForm.responsible,
        nowForm.help.trim(),
        nowForm.timescale
      );
      setOutput(text);
    } else {
      const text = buildFutureOutput(
        futureForm.date,
        futureForm.forename.trim(),
        futureForm.task.trim(),
        futureForm.outcome.trim(),
        futureForm.timescale
      );
      setOutput(text);
    }
  }, [mode, nowForm, futureForm, validateNow, validateFuture, toast]);

  // Auto-generate on form changes (skip when output was set by AI fix)
  useEffect(() => {
    // Only regenerate if output came from form, not from AI fix or manual edit
    if (outputSource === 'ai') {
      // Reset to form source so future form edits will regenerate
      setOutputSource('form');
      return;
    }
    if (outputSource === 'manual') {
      return; // Don't overwrite manual edits until form changes
    }
    generateOutput(false);
  }, [nowForm, futureForm, mode, outputSource, generateOutput]);

  const handleCopy = useCallback(async () => {
    if (!output.trim()) {
      toast({ title: 'Nothing to copy', description: 'Generate an action first.', variant: 'destructive' });
      return;
    }
    try {
      // Build combined text with translation if available
      let textToCopy = output;
      if (translatedOutput && storage.participantLanguage !== 'none') {
        const langInfo = SUPPORTED_LANGUAGES[storage.participantLanguage];
        textToCopy = `=== ENGLISH ===\n${output}\n\n=== ${langInfo?.nativeName?.toUpperCase() || storage.participantLanguage.toUpperCase()} ===\n${translatedOutput}`;
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 400);
      toast({ title: 'Copied!', description: translatedOutput ? 'Both versions copied to clipboard.' : 'Action copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy manually.', variant: 'destructive' });
    }
  }, [output, translatedOutput, storage.participantLanguage, toast]);

  const handleDownload = useCallback(() => {
    if (!output.trim()) {
      toast({ title: 'Nothing to download', description: 'Generate an action first.', variant: 'destructive' });
      return;
    }
    // Build combined text with translation if available
    let textToDownload = output;
    if (translatedOutput && storage.participantLanguage !== 'none') {
      const langInfo = SUPPORTED_LANGUAGES[storage.participantLanguage];
      textToDownload = `=== ENGLISH ===\n${output}\n\n=== ${langInfo?.nativeName?.toUpperCase() || storage.participantLanguage.toUpperCase()} ===\n${translatedOutput}`;
    }
    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-action-${mode}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [output, translatedOutput, storage.participantLanguage, mode, toast]);

  const handleClear = useCallback(() => {
    if (mode === 'now') {
      setNowForm({ date: today, forename: '', barrier: '', action: '', responsible: '', help: '', timescale: '' });
    } else {
      setFutureForm({ date: today, forename: '', task: '', outcome: '', timescale: '' });
    }
    setOutput('');
    setOutputSource('form');
    setTranslatedOutput(null);
    translation.clearTranslation();
    setShowValidation(false);
    setSuggestQuery('');
  }, [mode, today, translation]);

  // Handle translation
  const handleTranslate = useCallback(async () => {
    if (!output.trim()) return;
    if (storage.participantLanguage === 'none') {
      setTranslatedOutput(null);
      return;
    }
    
    const result = await translation.translate(output, storage.participantLanguage);
    if (result) {
      setTranslatedOutput(result.translated);
      toast({ 
        title: 'Translated!', 
        description: `Action translated to ${result.languageName}.` 
      });
    }
  }, [output, storage.participantLanguage, translation, toast]);

  // Handle language change
  const handleLanguageChange = useCallback((language: string) => {
    storage.updateParticipantLanguage(language);
    if (language === 'none') {
      setTranslatedOutput(null);
      translation.clearTranslation();
    }
  }, [storage, translation]);

  const handleSave = useCallback(() => {
    if (!output.trim()) {
      toast({ title: 'Nothing to save', description: 'Generate an action first.', variant: 'destructive' });
      return;
    }

    // Check minimum score enforcement
    if (storage.minScoreEnabled && smartCheck.overallScore < storage.minScoreThreshold) {
      toast({ 
        title: 'SMART score too low', 
        description: `This action scores ${smartCheck.overallScore}/5 but the minimum is ${storage.minScoreThreshold}/5. Improve the action or disable score enforcement in Settings.`,
        variant: 'destructive'
      });
      return;
    }

    const forename = mode === 'now' ? nowForm.forename : futureForm.forename;
    storage.addRecentName(forename);

    const baseMeta = mode === 'now' 
      ? { date: nowForm.date, forename: nowForm.forename, barrier: nowForm.barrier, timescale: nowForm.timescale, action: nowForm.action, responsible: nowForm.responsible, help: nowForm.help }
      : { date: futureForm.date, forename: futureForm.forename, barrier: futureForm.task, timescale: futureForm.timescale, reason: futureForm.outcome };

    // Include translation in history if available
    const item: HistoryItem = {
      id: crypto.randomUUID(),
      mode,
      createdAt: new Date().toISOString(),
      text: output,
      meta: {
        ...baseMeta,
        ...(translatedOutput && storage.participantLanguage !== 'none' ? {
          translatedText: translatedOutput,
          translationLanguage: storage.participantLanguage
        } : {})
      }
    };

    storage.addToHistory(item);
    toast({ title: 'Saved!', description: translatedOutput ? 'Action with translation saved to history.' : 'Action saved to history.' });
  }, [output, storage, smartCheck.overallScore, mode, nowForm, futureForm, translatedOutput, toast]);

  const handleAIDraft = useCallback(() => {
    if (mode === 'now') {
      if (!nowForm.forename.trim() || !nowForm.barrier.trim()) {
        toast({ title: 'Missing info', description: 'Add a forename and barrier first.', variant: 'destructive' });
        return;
      }
      let timescale = nowForm.timescale;
      if (!timescale) {
        timescale = '2 weeks';
        setNowForm(prev => ({ ...prev, timescale }));
      }
      const { action, help } = aiDraftNow(
        nowForm.barrier, 
        nowForm.forename, 
        nowForm.responsible, 
        timescale, 
        nowForm.date,
        suggestQuery
      );
      setNowForm(prev => ({ ...prev, action, help }));
      toast({ title: 'Draft inserted', description: 'AI draft added. Edit as needed.' });
    } else {
      if (!futureForm.forename.trim() || !futureForm.task.trim()) {
        toast({ title: 'Missing info', description: 'Add a forename and task first.', variant: 'destructive' });
        return;
      }
      const outcome = aiDraftFuture(futureForm.task, futureForm.forename);
      setFutureForm(prev => ({ ...prev, outcome }));
      toast({ title: 'Draft inserted', description: 'AI draft added. Edit as needed.' });
    }
  }, [mode, nowForm, futureForm, suggestQuery, toast]);

  const handleEditHistory = (item: HistoryItem) => {
    setMode(item.mode);
    if (item.mode === 'now') {
      setNowForm({
        date: item.meta.date || today,
        forename: item.meta.forename || '',
        barrier: item.meta.barrier || '',
        action: item.meta.action || '',
        responsible: item.meta.responsible || '',
        help: item.meta.help || '',
        timescale: item.meta.timescale || ''
      });
    } else {
      setFutureForm({
        date: item.meta.date || today,
        forename: item.meta.forename || '',
        task: item.meta.barrier || '',
        outcome: item.meta.reason || '',
        timescale: item.meta.timescale || ''
      });
    }
    setOutput(item.text || '');
    setShowValidation(false);
    toast({ title: 'Loaded', description: 'Edit and regenerate as needed.' });
  };

  const suggestions = useMemo(() => {
    if (mode === 'now') {
      const list = getSuggestionList(nowForm.barrier);
      const q = suggestQuery.toLowerCase();
      if (!q) return list.slice(0, 14);
      return list.filter(s => 
        s.title.toLowerCase().includes(q) ||
        s.action.toLowerCase().includes(q) ||
        s.help.toLowerCase().includes(q)
      ).slice(0, 14);
    } else {
      return getTaskSuggestions(futureForm.task);
    }
  }, [mode, nowForm.barrier, futureForm.task, suggestQuery]);

  const targetCtx = useMemo(() => {
    const baseISO = mode === 'now' ? nowForm.date : futureForm.date;
    const timescale = mode === 'now' ? nowForm.timescale : futureForm.timescale;
    const forename = mode === 'now' ? nowForm.forename : futureForm.forename;
    const targetISO = parseTimescaleToTargetISO(baseISO || today, timescale || '2 weeks');
    return { targetPretty: formatDDMMMYY(targetISO), n: 2, forename: forename.trim() };
  }, [mode, nowForm.date, nowForm.timescale, nowForm.forename, futureForm.date, futureForm.timescale, futureForm.forename, today]);

  const handleInsertSuggestion = (suggestion: { title: string; action?: string; help?: string; outcome?: string }) => {
    if (mode === 'now' && suggestion.action) {
      const action = resolvePlaceholders(suggestion.action, targetCtx);
      const help = resolvePlaceholders(suggestion.help || '', targetCtx);
      setNowForm(prev => ({
        ...prev,
        action: prev.action.trim() ? prev.action.trimEnd() + '\n' + action : action,
        help: help && !prev.help.trim() ? help : prev.help
      }));
      toast({ title: 'Inserted', description: 'Suggestion added.' });
    } else if (mode === 'future' && suggestion.outcome) {
      if (!futureForm.forename.trim()) {
        toast({ title: 'Enter forename first', description: 'Add the participant\'s forename.', variant: 'destructive' });
        return;
      }
      const outcome = suggestion.outcome.replace(/\[Name\]/g, futureForm.forename);
      setFutureForm(prev => ({ ...prev, outcome }));
      toast({ title: 'Inserted', description: 'Suggestion added.' });
    }
  };

  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase();
    if (!q) return storage.history;
    return storage.history.filter(h =>
      h.text.toLowerCase().includes(q) ||
      h.meta.forename?.toLowerCase().includes(q) ||
      h.meta.barrier?.toLowerCase().includes(q)
    );
  }, [storage.history, historySearch]);

  // Debounce output for SMART checking to avoid running on every keystroke
  const debouncedOutput = useDebounce(output, 150);
  
  // SMART Check - auto-detect elements with debounced input for performance
  const smartCheck = useMemo((): SmartCheck => {
    if (!debouncedOutput.trim()) {
      return {
        specific: { met: false, confidence: 'low', reason: 'Generate an action first' },
        measurable: { met: false, confidence: 'low', reason: 'Add dates or quantities' },
        achievable: { met: false, confidence: 'low', reason: 'Show agreement' },
        relevant: { met: false, confidence: 'low', reason: 'Link to barrier' },
        timeBound: { met: false, confidence: 'low', reason: 'Add review date' },
        overallScore: 0,
        warnings: [],
      };
    }
    
    const meta = mode === 'now' 
      ? { forename: nowForm.forename, barrier: nowForm.barrier, timescale: nowForm.timescale, date: nowForm.date }
      : { forename: futureForm.forename, barrier: futureForm.task, timescale: futureForm.timescale, date: futureForm.date };
    
    return checkSmart(debouncedOutput, meta);
  }, [debouncedOutput, mode, nowForm.forename, nowForm.barrier, nowForm.timescale, nowForm.date, futureForm.forename, futureForm.task, futureForm.timescale, futureForm.date]);

  // Handle template insertion
  const handleInsertTemplate = useCallback((template: ActionTemplate) => {
    if (template.mode === 'now') {
      setNowForm(prev => ({
        ...prev,
        barrier: template.barrier || prev.barrier,
        action: template.action || prev.action,
        responsible: template.responsible || prev.responsible,
        help: template.help || prev.help,
      }));
    } else {
      setFutureForm(prev => ({
        ...prev,
        task: template.task || prev.task,
        outcome: template.outcome || prev.outcome,
      }));
    }
  }, []);

  // Build context for LLM chat based on current form inputs
  const buildLLMContext = useCallback(() => {
    if (mode === 'now') {
      const parts: string[] = [];
      if (nowForm.forename) parts.push(`Participant: ${nowForm.forename}`);
      if (nowForm.barrier) parts.push(`Barrier to work: ${nowForm.barrier}`);
      if (nowForm.action) parts.push(`Current action: ${nowForm.action}`);
      if (nowForm.responsible) parts.push(`Responsible person: ${nowForm.responsible}`);
      if (nowForm.help) parts.push(`Help/support: ${nowForm.help}`);
      if (nowForm.timescale) parts.push(`Review in: ${nowForm.timescale}`);
      return parts.length > 0 
        ? `Help me improve this SMART action for employment support:\n\n${parts.join('\n')}\n\nHow can I make this more specific, measurable, and actionable?`
        : 'Help me create a SMART action for employment support. The action should address a barrier to work.';
    } else {
      const parts: string[] = [];
      if (futureForm.forename) parts.push(`Participant: ${futureForm.forename}`);
      if (futureForm.task) parts.push(`Activity/event: ${futureForm.task}`);
      if (futureForm.outcome) parts.push(`Expected outcome: ${futureForm.outcome}`);
      if (futureForm.timescale) parts.push(`Review in: ${futureForm.timescale}`);
      return parts.length > 0 
        ? `Help me improve this task-based SMART action:\n\n${parts.join('\n')}\n\nHow can I make this more specific and measurable?`
        : 'Help me create a task-based SMART action for a future activity or event.';
    }
  }, [mode, nowForm, futureForm]);

  const llmSystemPrompt = `You are a SMART action writing assistant for employment advisors. Help create Specific, Measurable, Achievable, Relevant, and Time-bound actions.

Key principles:
- Actions should address barriers to employment
- Include specific dates and review periods  
- Identify who is responsible for each step
- Focus on what the participant will DO, not just learn
- Be concise and actionable

When given context about a participant, provide suggestions to improve their SMART action.`;

  const handleExport = () => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), history: storage.history, barriers: storage.barriers, timescales: storage.timescales };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-action-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Data exported successfully.' });
  };

  // Handle wizard completion
  const handleWizardComplete = useCallback((data: Record<string, string>) => {
    if (mode === 'now') {
      setNowForm(prev => ({
        ...prev,
        forename: data.forename || prev.forename,
        barrier: data.barrier || prev.barrier,
        action: data.action || prev.action,
        responsible: data.responsible || prev.responsible,
        help: data.help || prev.help,
        timescale: data.timescale || prev.timescale,
      }));
    } else {
      setFutureForm(prev => ({
        ...prev,
        forename: data.forename || prev.forename,
        task: data.task || prev.task,
        outcome: data.outcome || prev.outcome,
        timescale: data.timescale || prev.timescale,
      }));
    }
    setWizardMode(false);
    toast({ title: 'Wizard complete', description: 'Form populated. Review and generate your action.' });
  }, [mode, toast]);

  // Handle wizard AI draft - provides field-specific AI drafts within the wizard
  const handleWizardAIDraft = useCallback(async (field: string, context: Record<string, string>): Promise<string> => {
    if (mode === 'now') {
      const timescale = context.timescale || '2 weeks';
      if (field === 'action' || field === 'help') {
        const { action, help } = aiDraftNow(
          context.barrier || '', 
          context.forename || '', 
          context.responsible || 'Advisor',
          timescale,
          nowForm.date
        );
        return field === 'action' ? action : help;
      }
    } else {
      if (field === 'outcome') {
        return aiDraftFuture(context.task || '', context.forename || '');
      }
    }
    return '';
  }, [mode, nowForm.date]);

  // Handle AI improve apply
  const handleApplyImprovement = useCallback((improvedAction: string) => {
    if (mode === 'now') {
      setNowForm(prev => ({ ...prev, action: improvedAction }));
    } else {
      setFutureForm(prev => ({ ...prev, outcome: improvedAction }));
    }
    toast({ title: 'Improvement applied', description: 'The improved text has been applied to your form.' });
  }, [mode, toast]);

  // Handle fix criterion from SMART checklist - uses AI to fix the specific criterion
  const handleFixCriterion = useCallback(async (criterion: 'specific' | 'measurable' | 'achievable' | 'relevant' | 'timeBound', suggestion: string) => {
    // Check if we have output to fix
    if (!output.trim()) {
      toast({ 
        title: 'No action to fix', 
        description: 'Generate an action first before using AI fix.',
        variant: 'destructive'
      });
      return;
    }

    // Check AI consent
    if (!cloudAI.hasConsent) {
      toast({ 
        title: 'AI consent required', 
        description: 'Please accept AI cookies in privacy settings to use this feature.',
        variant: 'destructive'
      });
      return;
    }

    cloudAI.clearError();
    setLastFixAttempt({ criterion, suggestion });
    setFixingCriterion(criterion);
    
    const criterionLabel = criterion.charAt(0).toUpperCase() + criterion.slice(1);
    const forename = mode === 'now' ? nowForm.forename : futureForm.forename;
    const barrier = mode === 'now' ? nowForm.barrier : futureForm.task;
    
    // Build the prompt
    const prompt = FIX_CRITERION_PROMPT
      .replace(/{criterion}/g, criterionLabel)
      .replace('{action}', output)
      .replace('{barrier}', barrier || 'Not specified')
      .replace('{forename}', forename || 'Participant')
      .replace('{criterionGuidance}', CRITERION_GUIDANCE[criterion] || '');

    try {
      let fullResponse = '';
      for await (const chunk of cloudAI.chat([{ role: 'user', content: prompt }])) {
        fullResponse += chunk;
      }

      // Parse JSON response
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const fixedAction = parsed.fixed || '';
        const whatChanged = parsed.whatChanged || `Fixed ${criterionLabel} criterion`;
        
        if (fixedAction) {
          // Mark output as coming from AI to prevent auto-regeneration
          setOutputSource('ai');
          
          // Only update the output directly - don't update form fields
          // because buildNowOutput/buildFutureOutput would reconstruct 
          // the text differently. The fixed text IS the complete output.
          setOutput(fixedAction);
          
          // Clear any existing translation as the text changed
          setTranslatedOutput(null);
          
          toast({ 
            title: `${criterionLabel} fixed!`, 
            description: whatChanged,
            duration: 4000
          });
        } else {
          throw new Error('Empty response from AI');
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Fix criterion error:', err);
      toast({ 
        title: 'Fix failed', 
        description: err instanceof Error ? err.message : 'Failed to fix criterion. Try again.',
        variant: 'destructive'
      });
    } finally {
      setFixingCriterion(null);
    }
  }, [output, mode, nowForm, futureForm, cloudAI, toast]);

  const handleRetryFix = useCallback(() => {
    if (!lastFixAttempt) return;
    handleFixCriterion(lastFixAttempt.criterion, lastFixAttempt.suggestion);
  }, [lastFixAttempt, handleFixCriterion]);

  // Keyboard shortcuts configuration
  const shortcuts: ShortcutConfig[] = useMemo(() => [
    { key: 'Enter', ctrl: true, action: handleSave, description: 'Save to history', category: 'Actions' },
    { key: 'd', ctrl: true, action: handleAIDraft, description: 'AI Draft', category: 'Actions' },
    { key: 'c', ctrl: true, shift: true, action: handleCopy, description: 'Copy output', category: 'Actions' },
    { key: 'x', ctrl: true, shift: true, action: handleClear, description: 'Clear form', category: 'Actions' },
    { key: '1', ctrl: true, action: () => { setMode('now'); setShowValidation(false); }, description: 'Switch to Now mode', category: 'Navigation' },
    { key: '2', ctrl: true, action: () => { setMode('future'); setShowValidation(false); }, description: 'Switch to Future mode', category: 'Navigation' },
    { key: '?', action: () => setShortcutsHelpOpen(true), description: 'Show shortcuts help', category: 'Help' },
  ], [handleSave, handleAIDraft, handleCopy, handleClear]);

  useKeyboardShortcuts(shortcuts, true);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // File size check (max 2MB)
    const MAX_FILE_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: 'Maximum file size is 2MB.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rawData = JSON.parse(String(reader.result || '{}'));
        // Validate against schema
        const validated = ImportSchema.parse(rawData);
        // Cast to expected import type after validation
        storage.importData({
          history: validated.history as HistoryItem[] | undefined,
          barriers: validated.barriers,
          timescales: validated.timescales
        });
        toast({ title: 'Imported', description: 'Data imported successfully.' });
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast({ title: 'Invalid data', description: 'Import file contains invalid or malformed data.', variant: 'destructive' });
        } else {
          toast({ title: 'Import failed', description: 'Invalid file format.', variant: 'destructive' });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getFieldClass = (isValid: boolean) => {
    if (!showValidation) return '';
    return isValid ? 'border-green-500/50' : 'border-destructive/60 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]';
  };

  return (
    <>
      {/* Onboarding Tutorial for first-time users */}
      <OnboardingTutorial />

      {/* Subtle gradient overlay */}
      <motion.div 
        className="fixed inset-0 gradient-subtle opacity-50 pointer-events-none z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 1 }}
      />
      
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-50 backdrop-blur-xl bg-background/90 border-b border-border shadow-sm"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className={cn(
          "max-w-7xl mx-auto px-2 sm:px-4 flex items-center justify-between transition-all duration-200 overflow-hidden",
          isLandscape && headerCollapsed ? "py-1" : isLandscape ? "py-2" : "py-3 sm:py-4"
        )}>
          <motion.div 
            className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div 
              className={cn(
                "rounded-xl gradient-primary flex items-center justify-center text-white font-black shadow-glow transition-all duration-200 flex-shrink-0",
                isLandscape && headerCollapsed ? "w-7 h-7 text-sm" : isLandscape ? "w-8 h-8 text-base" : "w-9 h-9 sm:w-11 sm:h-11 text-lg sm:text-xl"
              )}
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              S
            </motion.div>
            <AnimatePresence mode="wait">
              {!(isLandscape && headerCollapsed) && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden min-w-0"
                >
                  <h1 className={cn(
                    "font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate",
                    isLandscape ? "text-base" : "text-sm sm:text-xl"
                  )}>
                    <span className="hidden xs:inline">SMART Action Support Tool</span>
                    <span className="xs:hidden">SMART Tool</span>
                  </h1>
                  {!isLandscape && <p className="text-xs text-muted-foreground hidden sm:block">by William Wessex</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          <div className="flex gap-0.5 sm:gap-1 items-center flex-shrink-0">
            {/* Collapse toggle - only show in landscape */}
            {isLandscape && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setHeaderCollapsed(!headerCollapsed)}
                aria-label={headerCollapsed ? "Expand header" : "Collapse header"}
                className="px-1.5 sm:px-2 h-8"
              >
                {headerCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Toggle theme" className="px-1.5 sm:px-2 h-8">
                  {theme === 'dark' ? <Moon className="w-4 h-4" /> : theme === 'light' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="w-4 h-4 mr-2" /> Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="w-4 h-4 mr-2" /> Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="w-4 h-4 mr-2" /> System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Dialog open={guidanceOpen} onOpenChange={setGuidanceOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="px-1.5 sm:px-2 h-8">
                  <HelpCircle className="w-4 h-4" />
                  <span className="ml-1 hidden sm:inline">Guidance</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0">
                  <DialogTitle>Guidance</DialogTitle>
                </DialogHeader>
                <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                  {GUIDANCE.map((g, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-card">
                      <h3 className="font-bold mb-2">{g.title}</h3>
                      {Array.isArray(g.body) ? (
                        <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
                          {g.body.map((item, j) => <li key={j}>{item}</li>)}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">{g.body}</p>
                      )}
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            <Button 
              data-tutorial="shortcuts"
              variant="ghost" 
              size="sm" 
              className="px-1.5 sm:px-2 h-8" 
              onClick={() => setShortcutsHelpOpen(true)}
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </Button>

            <Dialog open={settingsOpen} onOpenChange={(open) => {
              setSettingsOpen(open);
              if (open) {
                setSettingsBarriers(storage.barriers.join('\n'));
                setSettingsTimescales(storage.timescales.join('\n'));
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="px-1.5 sm:px-2 h-8">
                  <Settings className="w-4 h-4" />
                  <span className="ml-1 hidden sm:inline">Settings</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0">
                  <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border bg-card space-y-3">
                    <h3 className="font-bold">Barriers list</h3>
                    <p className="text-xs text-muted-foreground">One per line. Users can still type custom barriers.</p>
                    <Textarea 
                      value={settingsBarriers} 
                      onChange={e => setSettingsBarriers(e.target.value)}
                      className="font-mono text-sm min-h-[200px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        storage.resetBarriers();
                        setSettingsBarriers(storage.barriers.join('\n'));
                        toast({ title: 'Reset', description: 'Barriers reset to default.' });
                      }}>Reset</Button>
                      <Button size="sm" onClick={() => {
                        const list = settingsBarriers.split('\n').map(s => s.trim()).filter(Boolean);
                        if (!list.length) {
                          toast({ title: 'Error', description: 'Barriers list cannot be empty.', variant: 'destructive' });
                          return;
                        }
                        storage.updateBarriers(Array.from(new Set(list)));
                        toast({ title: 'Saved', description: 'Barriers updated.' });
                      }}>Save</Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border bg-card space-y-3">
                    <h3 className="font-bold">Timescales</h3>
                    <p className="text-xs text-muted-foreground">One per line.</p>
                    <Textarea 
                      value={settingsTimescales} 
                      onChange={e => setSettingsTimescales(e.target.value)}
                      className="font-mono text-sm min-h-[200px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        storage.resetTimescales();
                        setSettingsTimescales(storage.timescales.join('\n'));
                        toast({ title: 'Reset', description: 'Timescales reset to default.' });
                      }}>Reset</Button>
                      <Button size="sm" onClick={() => {
                        const list = settingsTimescales.split('\n').map(s => s.trim()).filter(Boolean);
                        if (!list.length) {
                          toast({ title: 'Error', description: 'Timescales list cannot be empty.', variant: 'destructive' });
                          return;
                        }
                        storage.updateTimescales(Array.from(new Set(list)));
                        toast({ title: 'Saved', description: 'Timescales updated.' });
                      }}>Save</Button>
                      </div>
                    </div>
                  </div>
                
                  {/* Quality Enforcement Section */}
                  <div className="p-4 rounded-lg border bg-card space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                      <h3 className="font-bold">Quality Enforcement</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Prevent saving actions that don't meet SMART quality standards.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={storage.minScoreEnabled} 
                          onChange={e => storage.updateMinScoreEnabled(e.target.checked)}
                          className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium">Enforce minimum SMART score</span>
                      </label>
                      
                      {storage.minScoreEnabled && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Minimum score:</span>
                          <Select 
                            value={String(storage.minScoreThreshold)} 
                            onValueChange={v => storage.updateMinScoreThreshold(parseInt(v, 10))}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3">3/5</SelectItem>
                              <SelectItem value="4">4/5</SelectItem>
                              <SelectItem value="5">5/5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    
                    <WarningBox show={storage.minScoreEnabled} variant="warning">
                      Actions with a SMART score below {storage.minScoreThreshold}/5 cannot be saved to history. 
                      This encourages higher quality action writing.
                    </WarningBox>
                  </div>

                  {/* Wizard Mode Toggle */}
                  <div className="p-4 rounded-lg border bg-card space-y-4">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-primary" />
                      <h3 className="font-bold">Guided Wizard Mode</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Step-by-step guided form that walks you through creating a SMART action.
                    </p>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={wizardMode} 
                        onChange={e => setWizardMode(e.target.checked)}
                        className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium">Enable guided wizard mode</span>
                    </label>
                  </div>

                  {/* Tutorial Reset */}
                  <div className="p-4 rounded-lg border bg-card space-y-4">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-primary" />
                      <h3 className="font-bold">Tutorial</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Replay the onboarding tutorial to learn about key features.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        localStorage.removeItem('smartTool.onboardingComplete');
                        setSettingsOpen(false);
                        window.location.reload();
                      }}
                      className="gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Replay Tutorial
                    </Button>
                  </div>

                  {/* Data Retention Section */}
                  <div className="p-4 rounded-lg border bg-card space-y-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      <h3 className="font-bold">Data Retention</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Automatically delete old history items to comply with data minimisation principles.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={storage.retentionEnabled} 
                          onChange={e => storage.updateRetentionEnabled(e.target.checked)}
                          className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium">Auto-delete old actions</span>
                      </label>
                      
                      {storage.retentionEnabled && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Keep for:</span>
                          <Select 
                            value={String(storage.retentionDays)} 
                            onValueChange={v => storage.updateRetentionDays(parseInt(v, 10))}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">30 days</SelectItem>
                              <SelectItem value="60">60 days</SelectItem>
                              <SelectItem value="90">90 days</SelectItem>
                              <SelectItem value="180">180 days</SelectItem>
                              <SelectItem value="365">1 year</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    
                    {storage.retentionEnabled && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          Actions older than {storage.retentionDays} days will be automatically deleted when you open the app. 
                          You currently have {storage.history.length} action{storage.history.length === 1 ? '' : 's'} in history.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Privacy & Data Section - GDPR Compliance */}
                  <div className="p-4 rounded-lg border bg-card space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" />
                        <h3 className="font-bold">Privacy & Data</h3>
                      </div>
                      {/* AI Consent Status Badge */}
                      <div className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                        aiHasConsent
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      )}>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          aiHasConsent ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                        AI: {aiHasConsent ? "Enabled" : "Disabled"}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Manage your data and privacy preferences in accordance with UK GDPR.
                    </p>
                    
                    <div className="grid gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const data = storage.exportAllData();
                          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `smart-action-data-${new Date().toISOString().slice(0, 10)}.json`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                          toast({ title: 'Data exported', description: 'Your data has been downloaded.' });
                        }}
                        className="gap-2 justify-start"
                      >
                        <FileDown className="w-4 h-4" />
                        Export All My Data
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setPrivacySettingsOpen(true)}
                        className="gap-2 justify-start"
                      >
                        <Shield className="w-4 h-4" />
                        Manage Cookie Preferences
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete all your data? This cannot be undone.')) {
                            storage.deleteAllData();
                            toast({ title: 'Data deleted', description: 'All your data has been removed.' });
                            window.location.reload();
                          }
                        }}
                        className="gap-2 justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete All My Data
                      </Button>
                    </div>
                    
                    <a 
                      href="#/privacy" 
                      className="text-xs text-primary hover:underline block mt-2"
                      onClick={() => setSettingsOpen(false)}
                    >
                      View Privacy Policy →
                    </a>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.header>

      {/* Shortcuts Help Dialog */}
      <ShortcutsHelp 
        open={shortcutsHelpOpen} 
        onOpenChange={setShortcutsHelpOpen} 
        groups={groupShortcuts(shortcuts)} 
      />

      {/* AI Improve Dialog */}
      <AIImproveDialog
        open={improveDialogOpen}
        onOpenChange={setImproveDialogOpen}
        originalAction={output}
        barrier={mode === 'now' ? nowForm.barrier : futureForm.task}
        forename={mode === 'now' ? nowForm.forename : futureForm.forename}
        smartCheck={smartCheck}
        onApply={handleApplyImprovement}
      />

      <main className="relative max-w-7xl mx-auto px-4 py-8">
        <motion.div 
          className="grid lg:grid-cols-2 gap-8"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* Left Panel - Form or Wizard */}
          <motion.div 
            className="bg-card border border-border/50 rounded-2xl p-6 space-y-6 shadow-soft"
            variants={slideInLeft}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {wizardMode ? (
              <ActionWizard
                mode={mode}
                barriers={storage.barriers}
                timescales={storage.timescales}
                recentNames={storage.recentNames}
                onComplete={handleWizardComplete}
                onCancel={() => setWizardMode(false)}
                onAIDraft={handleWizardAIDraft}
              />
            ) : (
            <>
            {/* Header with Guided Mode button */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Create Action</h2>
              <Button
                data-tutorial="guided-mode"
                variant="outline"
                size="sm"
                onClick={() => setWizardMode(true)}
                className="gap-2 border-primary/40 hover:bg-primary/10 hover:border-primary"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                Guided Mode
              </Button>
            </div>

            {/* Tabs */}
            <div 
              className="flex gap-2 p-1 bg-muted rounded-full relative"
              role="tablist"
              aria-label="Action type selection"
            >
              <motion.div
                className="absolute inset-y-1 rounded-full bg-primary shadow-md"
                layoutId="activeTab"
                style={{ width: 'calc(50% - 4px)' }}
                animate={{ x: mode === 'now' ? 4 : 'calc(100% + 4px)' }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                aria-hidden="true"
              />
              <Button
                variant="ghost"
                role="tab"
                aria-selected={mode === 'now'}
                aria-controls="now-form-panel"
                id="now-tab"
                className={cn(
                  "flex-1 rounded-full transition-colors duration-200 relative z-10",
                  mode === 'now' && "text-primary-foreground hover:bg-transparent"
                )}
                onClick={() => { setMode('now'); setShowValidation(false); }}
              >
                Barrier to action now
              </Button>
              <Button
                variant="ghost"
                role="tab"
                aria-selected={mode === 'future'}
                aria-controls="future-form-panel"
                id="future-tab"
                className={cn(
                  "flex-1 rounded-full transition-colors duration-200 relative z-10",
                  mode === 'future' && "text-primary-foreground hover:bg-transparent"
                )}
                onClick={() => { setMode('future'); setShowValidation(false); }}
              >
                Task-based
              </Button>
            </div>

            <AnimatePresence mode="wait">
            {mode === 'now' ? (
              <motion.div 
                key="now-form"
                id="now-form-panel"
                role="tabpanel"
                aria-labelledby="now-tab"
                className="space-y-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="space-y-2 shrink-0 mb-4 sm:mb-0 sm:mr-6" style={{ width: 'clamp(140px, 40%, 220px)' }}>
                    <label htmlFor="meeting-date" className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      During our meeting on…
                      <AnimatePresence>
                        {nowDateWarning && (
                          <motion.span
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: [1, 1.2, 1], rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </label>
                    <div className="relative">
                      <InputGlow show={!!nowDateWarning} variant="warning" />
                      <Input
                        id="meeting-date"
                        type="date"
                        value={nowForm.date}
                        onChange={e => setNowForm(prev => ({ ...prev, date: e.target.value }))}
                        max={today}
                        className={`${getFieldClass(!!nowForm.date)} ${nowDateWarning ? 'border-amber-500 focus-visible:ring-amber-500' : ''}`}
                        aria-describedby={nowDateWarning ? "date-warning" : undefined}
                        aria-invalid={!!nowDateWarning}
                      />
                    </div>
                    <WarningText show={!!nowDateWarning} variant="warning" id="date-warning">
                      {nowDateWarning}
                    </WarningText>
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <label htmlFor="participant-name" className="text-sm font-medium text-muted-foreground">Participant forename</label>
                    <Input
                      id="participant-name"
                      value={nowForm.forename}
                      onChange={e => setNowForm(prev => ({ ...prev, forename: e.target.value }))}
                      placeholder="e.g. John"
                      list="recent-names"
                      autoComplete="off"
                      className={getFieldClass(!!nowForm.forename.trim())}
                    />
                    <datalist id="recent-names">
                      {storage.recentNames.map(n => <option key={n} value={n} />)}
                    </datalist>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">What identified barrier needs to be addressed?</label>
                  <ComboboxInput
                    value={nowForm.barrier}
                    onChange={(value) => setNowForm(prev => ({ ...prev, barrier: value }))}
                    options={storage.barriers}
                    placeholder="Select or type your own…"
                    emptyMessage="No barriers found."
                    className={getFieldClass(!!nowForm.barrier.trim())}
                  />
                  <p className="text-xs text-muted-foreground">Tip: you can type your own barrier if it isn't listed.</p>
                </div>

                <div data-tutorial="ai-assist" className="border border-primary/20 rounded-xl p-4 gradient-subtle space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Advisor assist
                    </span>
                    <div className="flex gap-2">
                      <LLMChatButton
                        trigger={
                          <Button size="sm" variant="outline" className="border-primary/30 hover:bg-primary/10">
                            <Bot className="w-3 h-3 mr-1" /> AI Chat
                          </Button>
                        }
                        systemPrompt={llmSystemPrompt}
                        initialContext={buildLLMContext()}
                      />
                      <Button size="sm" onClick={handleAIDraft} className="bg-primary hover:bg-primary/90 shadow-md">
                        <Sparkles className="w-3 h-3 mr-1" /> AI draft
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={suggestQuery}
                    onChange={e => setSuggestQuery(e.target.value)}
                    placeholder="Filter suggestions (optional)…"
                    className="text-sm bg-background/80"
                    aria-label="Filter action suggestions"
                  />
                  {/* BUG FIX #3: Added proper styling for suggestion chips */}
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <motion.button
                        key={i}
                        type="button"
                        onClick={() => handleInsertSuggestion(s)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-full border border-primary/30 bg-background hover:bg-primary/10 hover:border-primary/50 transition-colors"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <span>{s.title}</span>
                        <span className="text-xs text-primary px-2 py-0.5 rounded-full bg-primary/10">insert</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">To address this, we have discussed that…</label>
                  <Textarea
                    value={nowForm.action}
                    onChange={e => setNowForm(prev => ({ ...prev, action: e.target.value }))}
                    placeholder="Start with the participant's name. Include what they will do, by when, and where if relevant."
                    rows={4}
                    spellCheck
                    data-field="action"
                    className={getFieldClass(!!nowForm.action.trim())}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Who is responsible?</label>
                    <ComboboxInput
                      value={nowForm.responsible}
                      onChange={(value) => setNowForm(prev => ({ ...prev, responsible: value }))}
                      options={['Participant', 'Advisor', 'I']}
                      placeholder="Select or type…"
                      emptyMessage="No options found."
                      className={getFieldClass(!!nowForm.responsible)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">This action will help…</label>
                    <Input
                      value={nowForm.help}
                      onChange={e => setNowForm(prev => ({ ...prev, help: e.target.value }))}
                      placeholder="How will it help?"
                      className={getFieldClass(!!nowForm.help.trim())}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">This will be reviewed in…</label>
                  <ComboboxInput
                    value={nowForm.timescale}
                    onChange={(value) => setNowForm(prev => ({ ...prev, timescale: value }))}
                    options={storage.timescales}
                    placeholder="Select timescale…"
                    emptyMessage="No timescales found."
                    className={getFieldClass(!!nowForm.timescale)}
                    data-field="timescale"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="future-form"
                id="future-form-panel"
                role="tabpanel"
                aria-labelledby="future-tab"
                className="space-y-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-sm text-muted-foreground">Schedule a future task, event, or activity for the participant.</p>
                
                <div className="flex flex-col sm:flex-row">
                  <div className="space-y-2 shrink-0 mb-4 sm:mb-0 sm:mr-6" style={{ width: 'clamp(140px, 40%, 220px)' }}>
                    <label htmlFor="scheduled-date" className="text-sm font-medium text-muted-foreground">Scheduled date</label>
                    <div className="relative">
                      <InputGlow show={!!futureDateError} variant="error" />
                      <Input
                        id="scheduled-date"
                        type="date"
                        value={futureForm.date}
                        onChange={e => setFutureForm(prev => ({ ...prev, date: e.target.value }))}
                        min={today}
                        className={`${getFieldClass(!!futureForm.date && !futureDateError)} ${futureDateError ? 'border-destructive' : ''}`}
                        aria-describedby={futureDateError ? "future-date-error" : undefined}
                        aria-invalid={!!futureDateError}
                      />
                    </div>
                    {/* BUG FIX #1: Show error for past dates */}
                    <WarningText show={!!futureDateError} variant="error" id="future-date-error">
                      {futureDateError}
                    </WarningText>
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <label htmlFor="future-participant-name" className="text-sm font-medium text-muted-foreground">Participant forename</label>
                    <Input
                      id="future-participant-name"
                      value={futureForm.forename}
                      onChange={e => setFutureForm(prev => ({ ...prev, forename: e.target.value }))}
                      placeholder="e.g. John"
                      list="recent-names"
                      autoComplete="off"
                      className={getFieldClass(!!futureForm.forename.trim())}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Activity or event</label>
                  <Textarea
                    value={futureForm.task}
                    onChange={e => setFutureForm(prev => ({ ...prev, task: e.target.value }))}
                    placeholder="e.g. Christmas Job Fair at Twickenham Stadium"
                    rows={2}
                    spellCheck
                    className={getFieldClass(!!futureForm.task.trim())}
                  />
                  <p className="text-xs text-muted-foreground">Describe the task, event, or activity they will attend.</p>
                </div>

                {/* Advisor Assist - Task-based */}
                <div className="border border-primary/20 rounded-xl p-4 gradient-subtle space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Advisor assist
                    </span>
                    <div className="flex gap-2">
                      <LLMChatButton
                        trigger={
                          <Button size="sm" variant="outline" className="border-primary/30 hover:bg-primary/10">
                            <Bot className="w-3 h-3 mr-1" /> AI Chat
                          </Button>
                        }
                        systemPrompt={llmSystemPrompt}
                        initialContext={buildLLMContext()}
                      />
                      <Button size="sm" onClick={handleAIDraft} className="bg-primary hover:bg-primary/90 shadow-md">
                        <Sparkles className="w-3 h-3 mr-1" /> AI draft
                      </Button>
                    </div>
                  </div>
                  {/* BUG FIX #3: Added proper styling for task-based suggestion buttons */}
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <motion.button
                        key={i}
                        type="button"
                        onClick={() => handleInsertSuggestion(s)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-full border border-primary/30 bg-background hover:bg-primary/10 hover:border-primary/50 transition-colors"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <span>{s.title}</span>
                        <span className="text-xs text-primary px-2 py-0.5 rounded-full bg-primary/10">insert</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">What will happen / expected outcome?</label>
                  <Textarea
                    value={futureForm.outcome}
                    onChange={e => setFutureForm(prev => ({ ...prev, outcome: e.target.value }))}
                    placeholder="e.g. will speak with employers about warehouse roles and collect contact details"
                    rows={4}
                    spellCheck
                    data-field="outcome"
                    className={getFieldClass(!!futureForm.outcome.trim())}
                  />
                  <p className="text-xs text-muted-foreground">Describe what the participant will do or achieve. Use AI draft for suggestions.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">This will be reviewed in…</label>
                  <ComboboxInput
                    value={futureForm.timescale}
                    onChange={(value) => setFutureForm(prev => ({ ...prev, timescale: value }))}
                    options={storage.timescales}
                    placeholder="Select timescale…"
                    emptyMessage="No timescales found."
                    className={getFieldClass(!!futureForm.timescale)}
                    data-field="timescale"
                  />
                </div>
              </motion.div>
            )}
            </AnimatePresence>

            {/* Actions */}
              {/* Actions */}
              <motion.div 
                className="flex flex-wrap gap-3 pt-4 border-t border-border/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button onClick={() => generateOutput(true)} className="bg-primary hover:bg-primary/90 shadow-md">
                    Generate action
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="outline" onClick={handleClear}>Clear</Button>
                </motion.div>
                {output.trim() && smartCheck.overallScore < 5 && (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                      variant="outline" 
                      onClick={() => setImproveDialogOpen(true)}
                      className="border-primary/30 hover:bg-primary/10"
                    >
                      <Wand2 className="w-4 h-4 mr-1" /> Improve
                    </Button>
                  </motion.div>
                )}
                <div className="flex-1" />
                <TemplateLibrary
                templates={storage.templates}
                onSaveTemplate={storage.addTemplate}
                onDeleteTemplate={storage.deleteTemplate}
                onInsertTemplate={handleInsertTemplate}
                currentMode={mode}
                currentForm={mode === 'now' 
                  ? { barrier: nowForm.barrier, action: nowForm.action, responsible: nowForm.responsible, help: nowForm.help }
                  : { task: futureForm.task, outcome: futureForm.outcome }
                }
              />
            </motion.div>
            
              {/* Save to history - separate row */}
              <motion.div 
                className="flex items-center justify-end gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                {/* Score warning indicator */}
                {storage.minScoreEnabled && output.trim() && smartCheck.overallScore < storage.minScoreThreshold && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 px-3 py-1.5 rounded-full">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Score {smartCheck.overallScore}/{storage.minScoreThreshold} required</span>
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  onClick={handleSave}
                  disabled={storage.minScoreEnabled && output.trim() !== '' && smartCheck.overallScore < storage.minScoreThreshold}
                  className={cn(
                    storage.minScoreEnabled && output.trim() && smartCheck.overallScore < storage.minScoreThreshold && "opacity-50"
                  )}
                >
                  <History className="w-4 h-4 mr-1" /> Save to history
                </Button>
              </motion.div>
            </>
            )}
          </motion.div>

          {/* Right Panel - Output & History */}
          <motion.div 
            className="bg-card border border-border/50 rounded-2xl p-6 space-y-6 shadow-soft"
            variants={slideInRight}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
          >
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-bold text-lg">Generated action</h2>
                <p className="text-xs text-muted-foreground">Proofread before pasting into important documents.</p>
              </div>
              <div className="flex gap-2">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="sm" onClick={handleCopy} className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm">
                    <Copy className="w-4 h-4 mr-1" /> Copy
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="sm" variant="outline" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-1" /> .txt
                  </Button>
                </motion.div>
              </div>
            </div>

            {/* Language selector and translate button */}
            <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-muted/30 border border-border/50">
              <LanguageSelector 
                value={storage.participantLanguage} 
                onChange={handleLanguageChange}
                disabled={translation.isTranslating}
              />
              {storage.participantLanguage !== 'none' && output.trim() && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleTranslate}
                  disabled={translation.isTranslating}
                  className="border-primary/30 hover:bg-primary/10"
                >
                  {translation.isTranslating ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Translating...</>
                  ) : (
                    <><Languages className="w-4 h-4 mr-1" /> Translate</>
                  )}
                </Button>
              )}
              {translation.error && (
                <span className="text-xs text-destructive">{translation.error}</span>
              )}
            </div>

            <AnimatePresence mode="wait">
              <motion.div 
                key="output-container"
                initial={{ opacity: 0.5, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* English output */}
                <div>
                  {translatedOutput && <p id="output-label-en" className="text-xs font-medium text-muted-foreground mb-2">🇬🇧 ENGLISH</p>}
                  <Textarea
                    id="action-output"
                    value={output}
                    onChange={e => { setOutput(e.target.value); setOutputSource('manual'); setTranslatedOutput(null); }}
                    placeholder="Generated action will appear here… You can also edit the text directly."
                    aria-label="Generated SMART action text"
                    aria-describedby={translatedOutput ? "output-label-en" : undefined}
                    className={cn(
                      "min-h-[120px] p-5 rounded-xl border-2 border-dashed border-border bg-muted/30 leading-relaxed resize-y",
                      copied && "border-accent bg-accent/10 shadow-glow",
                      !output && "text-muted-foreground"
                    )}
                  />
                </div>
                
                {/* Translated output */}
                {translatedOutput && storage.participantLanguage !== 'none' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {SUPPORTED_LANGUAGES[storage.participantLanguage]?.flag} {SUPPORTED_LANGUAGES[storage.participantLanguage]?.nativeName?.toUpperCase()}
                    </p>
                    <div className="p-5 rounded-xl border-2 border-primary/30 bg-primary/5 leading-relaxed whitespace-pre-wrap text-sm">
                      {translatedOutput}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            {cloudAI.error && (
              <WarningBox variant="error" title="AI request failed">
                <div className="space-y-2">
                  <p>{cloudAI.error}</p>
                  <div className="flex flex-wrap gap-2">
                    {lastFixAttempt && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRetryFix}
                        disabled={!!fixingCriterion}
                        className="bg-background text-foreground"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry AI fix
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => cloudAI.clearError()} className="text-foreground">
                      Dismiss
                    </Button>
                  </div>
                </div>
              </WarningBox>
            )}

            {/* SMART Checklist */}
            <SmartChecklist check={smartCheck} onFixCriterion={handleFixCriterion} fixingCriterion={fixingCriterion} />

            {/* History with Tabs */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-bold text-lg">History</h2>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={handleExport}>Export</Button>
                  <label className="cursor-pointer">
                    <Button size="sm" variant="outline" asChild><span>Import</span></Button>
                    <input 
                      type="file" 
                      accept="application/json" 
                      className="hidden" 
                      onChange={handleImport}
                      aria-label="Import history from JSON file"
                    />
                  </label>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => {
                      storage.clearHistory();
                      toast({ title: 'Cleared', description: 'History cleared.' });
                    }}
                    aria-label="Clear all history"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">Clear history</span>
                  </Button>
                </div>
              </div>

              <Tabs data-tutorial="history" value={historyTab} onValueChange={(v) => setHistoryTab(v as 'history' | 'insights')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="history" className="flex items-center gap-2">
                    <History className="w-4 h-4" /> History
                  </TabsTrigger>
                  <TabsTrigger value="insights" className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Insights
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="history" className="mt-4 space-y-4">
                  <Input
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    placeholder="Search history…"
                    className="text-sm"
                    aria-label="Search history"
                    type="search"
                  />

                  <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                    {filteredHistory.length === 0 ? (
                      <div className="p-6 rounded-xl border-2 border-dashed text-sm text-muted-foreground text-center">
                        {historySearch ? 'No matching items found.' : 'No saved items yet. Generate and save actions to build your history.'}
                      </div>
                    ) : (
                      <ul role="list" aria-label="Saved actions history">
                        {filteredHistory.map((h, index) => (
                          <li 
                            key={h.id} 
                            className="p-4 rounded-xl border border-border/50 bg-muted/30 space-y-3 hover:border-primary/30 transition-colors animate-slide-in mb-3 last:mb-0"
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full font-medium",
                                h.mode === 'now' ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
                              )}>
                                {h.mode === 'now' ? 'Barrier to action' : 'Task-based'}
                              </span>
                              <span className="text-muted-foreground">
                                {new Date(h.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                              {h.meta.forename && (
                                <span className="text-muted-foreground">• {h.meta.forename}</span>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{h.text}</p>
                            <div className="flex gap-2" role="group" aria-label="Action buttons">
                              <Button size="sm" variant="outline" onClick={() => handleEditHistory(h)} aria-label={`Edit action for ${h.meta.forename || 'participant'}`}>
                                <Edit className="w-3 h-3 mr-1" aria-hidden="true" /> Edit
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => {
                                navigator.clipboard.writeText(h.text);
                                toast({ title: 'Copied!' });
                              }} aria-label="Copy action text">
                                <Copy className="w-3 h-3" aria-hidden="true" />
                                <span className="sr-only">Copy</span>
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => {
                                storage.deleteFromHistory(h.id);
                                toast({ title: 'Deleted' });
                              }} aria-label={`Delete action for ${h.meta.forename || 'participant'}`}>
                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="insights" className="mt-4">
                  <Suspense fallback={<InsightsSkeleton />}>
                    <HistoryInsights history={storage.history} />
                  </Suspense>
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Floating Action Toolbar */}
      <FloatingToolbar
        onCopy={handleCopy}
        onSave={handleSave}
        onClear={handleClear}
        onAIDraft={handleAIDraft}
        onDownload={handleDownload}
        hasOutput={!!output.trim()}
        copied={copied}
      />

      {/* Footer */}
      <Footer onOpenPrivacySettings={() => setPrivacySettingsOpen(true)} />

      {/* Privacy Settings Dialog */}
      <ManageConsentDialog 
        open={privacySettingsOpen} 
        onOpenChange={setPrivacySettingsOpen} 
      />
    </>
  );
}
