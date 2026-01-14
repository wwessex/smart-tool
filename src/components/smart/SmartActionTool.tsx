import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSmartStorage, HistoryItem } from '@/hooks/useSmartStorage';
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
import { GUIDANCE } from '@/lib/smart-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Copy, Download, Trash2, History, Settings, HelpCircle, Edit, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const storage = useSmartStorage();
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
  const [showValidation, setShowValidation] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [settingsBarriers, setSettingsBarriers] = useState('');
  const [settingsTimescales, setSettingsTimescales] = useState('');

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
      return `Note: the spreadsheet flags a warning if this isn't today (${today}).`;
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

  // Auto-generate on form changes
  useEffect(() => {
    generateOutput(false);
  }, [nowForm, futureForm, mode]);

  const handleCopy = async () => {
    if (!output.trim()) {
      toast({ title: 'Nothing to copy', description: 'Generate an action first.', variant: 'destructive' });
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 400);
      toast({ title: 'Copied!', description: 'Action copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy manually.', variant: 'destructive' });
    }
  };

  const handleDownload = () => {
    if (!output.trim()) {
      toast({ title: 'Nothing to download', description: 'Generate an action first.', variant: 'destructive' });
      return;
    }
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-action-${mode}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (mode === 'now') {
      setNowForm({ date: today, forename: '', barrier: '', action: '', responsible: '', help: '', timescale: '' });
    } else {
      setFutureForm({ date: today, forename: '', task: '', outcome: '', timescale: '' });
    }
    setOutput('');
    setShowValidation(false);
    setSuggestQuery('');
  };

  const handleSave = () => {
    if (!output.trim()) {
      toast({ title: 'Nothing to save', description: 'Generate an action first.', variant: 'destructive' });
      return;
    }

    const forename = mode === 'now' ? nowForm.forename : futureForm.forename;
    storage.addRecentName(forename);

    const item: HistoryItem = {
      id: crypto.randomUUID(),
      mode,
      createdAt: new Date().toISOString(),
      text: output,
      meta: mode === 'now' 
        ? { date: nowForm.date, forename: nowForm.forename, barrier: nowForm.barrier, timescale: nowForm.timescale, action: nowForm.action, responsible: nowForm.responsible, help: nowForm.help }
        : { date: futureForm.date, forename: futureForm.forename, barrier: futureForm.task, timescale: futureForm.timescale, reason: futureForm.outcome }
    };

    storage.addToHistory(item);
    toast({ title: 'Saved!', description: 'Action saved to history.' });
  };

  const handleAIDraft = () => {
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
  };

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
    const targetISO = parseTimescaleToTargetISO(baseISO || today, timescale || '2 weeks');
    return { targetPretty: formatDDMMMYY(targetISO), n: 2 };
  }, [mode, nowForm.date, nowForm.timescale, futureForm.date, futureForm.timescale, today]);

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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        storage.importData(data);
        toast({ title: 'Imported', description: 'Data imported successfully.' });
      } catch {
        toast({ title: 'Import failed', description: 'Invalid file format.', variant: 'destructive' });
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-emerald-500 flex items-center justify-center text-white font-black text-lg">
              S
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight">SMART Action Support Tool</h1>
              <p className="text-xs text-muted-foreground">by William Wessex</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={guidanceOpen} onOpenChange={setGuidanceOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm"><HelpCircle className="w-4 h-4 mr-1" /> Guidance</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Guidance</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
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

            <Dialog open={settingsOpen} onOpenChange={(open) => {
              setSettingsOpen(open);
              if (open) {
                setSettingsBarriers(storage.barriers.join('\n'));
                setSettingsTimescales(storage.timescales.join('\n'));
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm"><Settings className="w-4 h-4 mr-1" /> Settings</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
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
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Panel - Form */}
          <div className="bg-card/50 backdrop-blur border rounded-2xl p-5 space-y-5">
            {/* Tabs */}
            <div className="flex gap-2">
              <Button
                variant={mode === 'now' ? 'default' : 'outline'}
                className={cn("rounded-full", mode === 'now' && "bg-violet-600 hover:bg-violet-700")}
                onClick={() => { setMode('now'); setShowValidation(false); }}
              >
                Barrier to action now
              </Button>
              <Button
                variant={mode === 'future' ? 'default' : 'outline'}
                className={cn("rounded-full", mode === 'future' && "bg-violet-600 hover:bg-violet-700")}
                onClick={() => { setMode('future'); setShowValidation(false); }}
              >
                Task-based
              </Button>
            </div>

            {mode === 'now' ? (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">During our meeting on…</label>
                    <Input
                      type="date"
                      value={nowForm.date}
                      onChange={e => setNowForm(prev => ({ ...prev, date: e.target.value }))}
                      max={today}
                      className={getFieldClass(!!nowForm.date)}
                    />
                    {nowDateWarning && <p className="text-xs text-amber-500">{nowDateWarning}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Participant forename</label>
                    <Input
                      value={nowForm.forename}
                      onChange={e => setNowForm(prev => ({ ...prev, forename: e.target.value }))}
                      placeholder="e.g. John"
                      list="recent-names"
                      className={getFieldClass(!!nowForm.forename.trim())}
                    />
                    <datalist id="recent-names">
                      {storage.recentNames.map(n => <option key={n} value={n} />)}
                    </datalist>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">What identified barrier needs to be addressed?</label>
                  <Input
                    value={nowForm.barrier}
                    onChange={e => setNowForm(prev => ({ ...prev, barrier: e.target.value }))}
                    placeholder="Select or type your own…"
                    list="barrier-list"
                    className={getFieldClass(!!nowForm.barrier.trim())}
                  />
                  <datalist id="barrier-list">
                    {storage.barriers.map(b => <option key={b} value={b} />)}
                  </datalist>
                  <p className="text-xs text-muted-foreground">Tip: you can type your own barrier if it isn't listed.</p>
                </div>

                {/* Advisor Assist */}
                <div className="border rounded-xl p-4 bg-background/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Advisor assist</span>
                    <Button size="sm" onClick={handleAIDraft} className="bg-violet-600 hover:bg-violet-700">
                      <Sparkles className="w-3 h-3 mr-1" /> AI draft
                    </Button>
                  </div>
                  <Input
                    value={suggestQuery}
                    onChange={e => setSuggestQuery(e.target.value)}
                    placeholder="Filter suggestions (optional)…"
                    className="text-sm"
                  />
                  {/* BUG FIX #3: Added proper styling for suggestion chips */}
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleInsertSuggestion(s)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-full border border-border bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <span>{s.title}</span>
                        <span className="text-xs opacity-70 px-2 py-0.5 rounded-full border">insert</span>
                      </button>
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
                    className={getFieldClass(!!nowForm.action.trim())}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Who is responsible?</label>
                    <Select value={nowForm.responsible} onValueChange={v => setNowForm(prev => ({ ...prev, responsible: v }))}>
                      <SelectTrigger className={getFieldClass(!!nowForm.responsible)}>
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Participant">Participant</SelectItem>
                        <SelectItem value="Advisor">Advisor</SelectItem>
                        <SelectItem value="I">I</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <Select value={nowForm.timescale} onValueChange={v => setNowForm(prev => ({ ...prev, timescale: v }))}>
                    <SelectTrigger className={getFieldClass(!!nowForm.timescale)}>
                      <SelectValue placeholder="Select timescale…" />
                    </SelectTrigger>
                    <SelectContent>
                      {storage.timescales.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Schedule a future task, event, or activity for the participant.</p>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Scheduled date</label>
                    <Input
                      type="date"
                      value={futureForm.date}
                      onChange={e => setFutureForm(prev => ({ ...prev, date: e.target.value }))}
                      min={today}
                      className={getFieldClass(!!futureForm.date && !futureDateError)}
                    />
                    {/* BUG FIX #1: Show error for past dates */}
                    {futureDateError && <p className="text-xs text-destructive">{futureDateError}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Participant forename</label>
                    <Input
                      value={futureForm.forename}
                      onChange={e => setFutureForm(prev => ({ ...prev, forename: e.target.value }))}
                      placeholder="e.g. John"
                      list="recent-names"
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
                <div className="border rounded-xl p-4 bg-background/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Advisor assist</span>
                    <Button size="sm" onClick={handleAIDraft} className="bg-violet-600 hover:bg-violet-700">
                      <Sparkles className="w-3 h-3 mr-1" /> AI draft
                    </Button>
                  </div>
                  {/* BUG FIX #3: Added proper styling for task-based suggestion buttons */}
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleInsertSuggestion(s)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-full border border-border bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <span>{s.title}</span>
                        <span className="text-xs opacity-70 px-2 py-0.5 rounded-full border">insert</span>
                      </button>
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
                    className={getFieldClass(!!futureForm.outcome.trim())}
                  />
                  <p className="text-xs text-muted-foreground">Describe what the participant will do or achieve. Use AI draft for suggestions.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">This will be reviewed in…</label>
                  <Select value={futureForm.timescale} onValueChange={v => setFutureForm(prev => ({ ...prev, timescale: v }))}>
                    <SelectTrigger className={getFieldClass(!!futureForm.timescale)}>
                      <SelectValue placeholder="Select timescale…" />
                    </SelectTrigger>
                    <SelectContent>
                      {storage.timescales.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => generateOutput(true)} className="bg-violet-600 hover:bg-violet-700">Generate action</Button>
              <Button variant="outline" onClick={handleClear}>Clear</Button>
              <div className="flex-1" />
              <Button variant="ghost" onClick={handleSave}><History className="w-4 h-4 mr-1" /> Save to history</Button>
            </div>
          </div>

          {/* Right Panel - Output & History */}
          <div className="bg-card/50 backdrop-blur border rounded-2xl p-5 space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-bold">Generated action</h2>
                <p className="text-xs text-muted-foreground">Proofread before pasting into ICONI.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCopy}><Copy className="w-4 h-4 mr-1" /> Copy</Button>
                <Button size="sm" variant="ghost" onClick={handleDownload}><Download className="w-4 h-4 mr-1" /> .txt</Button>
              </div>
            </div>

            <div className={cn(
              "min-h-[120px] p-4 rounded-xl border border-dashed bg-background/50 whitespace-pre-wrap leading-relaxed transition-colors",
              copied && "animate-pulse bg-green-500/10"
            )}>
              {output || <span className="text-muted-foreground">Generated action will appear here…</span>}
            </div>

            {/* History */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-bold">History</h2>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="ghost" onClick={handleExport}>Export</Button>
                  <label className="cursor-pointer">
                    <Button size="sm" variant="ghost" asChild><span>Import</span></Button>
                    <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
                  </label>
                  <Button size="sm" variant="destructive" onClick={() => {
                    storage.clearHistory();
                    toast({ title: 'Cleared', description: 'History cleared.' });
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Input
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search history…"
                className="text-sm"
              />

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {filteredHistory.length === 0 ? (
                  <div className="p-4 rounded-lg border text-sm text-muted-foreground">
                    {historySearch ? 'No matching items found.' : 'No saved items yet.'}
                  </div>
                ) : (
                  filteredHistory.map(h => (
                    <div key={h.id} className="p-3 rounded-lg border bg-background/50 space-y-2">
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{h.mode === 'now' ? 'Barrier to action' : 'Task-based'}</span>
                        <span>•</span>
                        <span>{new Date(h.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        {h.meta.forename && <><span>•</span><span>Name: {h.meta.forename}</span></>}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{h.text}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditHistory(h)}>
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          navigator.clipboard.writeText(h.text);
                          toast({ title: 'Copied!' });
                        }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => {
                          storage.deleteFromHistory(h.id);
                          toast({ title: 'Deleted' });
                        }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
