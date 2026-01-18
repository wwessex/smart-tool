import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Sparkles, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WarningText, InputGlow } from './WarningBox';
import { ComboboxInput } from './ComboboxInput';
import { LLMChatButton } from './LLMChat';
import type { NowForm as NowFormType } from '@/types/smart-tool';

interface Suggestion {
  title: string;
  action?: string;
  help?: string;
}

export interface NowFormProps {
  form: NowFormType;
  onFormChange: (updates: Partial<NowFormType>) => void;
  today: string;
  dateWarning: string;
  barriers: string[];
  timescales: string[];
  recentNames: string[];
  suggestions: Suggestion[];
  suggestQuery: string;
  onSuggestQueryChange: (query: string) => void;
  onInsertSuggestion: (suggestion: Suggestion) => void;
  onAIDraft: () => void;
  showValidation: boolean;
  llmSystemPrompt: string;
  llmContext: string;
}

export const NowForm = memo(function NowForm({
  form,
  onFormChange,
  today,
  dateWarning,
  barriers,
  timescales,
  recentNames,
  suggestions,
  suggestQuery,
  onSuggestQueryChange,
  onInsertSuggestion,
  onAIDraft,
  showValidation,
  llmSystemPrompt,
  llmContext,
}: NowFormProps) {
  const getFieldClass = (isValid: boolean) => {
    if (!showValidation) return '';
    return isValid ? 'border-green-500/50' : 'border-destructive/60 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]';
  };

  return (
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
      {/* Date and Name Row */}
      <div className="flex flex-col sm:flex-row">
        <div className="space-y-2 shrink-0 mb-4 sm:mb-0 sm:mr-6" style={{ width: 'clamp(140px, 40%, 220px)' }}>
          <label htmlFor="meeting-date" className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            During our meeting on…
            <AnimatePresence>
              {dateWarning && (
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
            <InputGlow show={!!dateWarning} variant="warning" />
            <Input
              id="meeting-date"
              type="date"
              value={form.date}
              onChange={e => onFormChange({ date: e.target.value })}
              max={today}
              className={`${getFieldClass(!!form.date)} ${dateWarning ? 'border-amber-500 focus-visible:ring-amber-500' : ''}`}
              aria-describedby={dateWarning ? "date-warning" : undefined}
              aria-invalid={!!dateWarning}
            />
          </div>
          <WarningText show={!!dateWarning} variant="warning" id="date-warning">
            {dateWarning}
          </WarningText>
        </div>
        <div className="space-y-2 flex-1 min-w-0">
          <label htmlFor="participant-name" className="text-sm font-medium text-muted-foreground">Participant forename</label>
          <Input
            id="participant-name"
            value={form.forename}
            onChange={e => onFormChange({ forename: e.target.value })}
            placeholder="e.g. John"
            list="recent-names"
            autoComplete="off"
            className={getFieldClass(!!form.forename.trim())}
          />
          <datalist id="recent-names">
            {recentNames.map(n => <option key={n} value={n} />)}
          </datalist>
        </div>
      </div>

      {/* Barrier Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">What identified barrier needs to be addressed?</label>
        <ComboboxInput
          value={form.barrier}
          onChange={(value) => onFormChange({ barrier: value })}
          options={barriers}
          placeholder="Select or type your own…"
          emptyMessage="No barriers found."
          className={getFieldClass(!!form.barrier.trim())}
        />
        <p className="text-xs text-muted-foreground">Tip: you can type your own barrier if it isn't listed.</p>
      </div>

      {/* Advisor Assist */}
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
              initialContext={llmContext}
            />
            <Button size="sm" onClick={onAIDraft} className="bg-primary hover:bg-primary/90 shadow-md">
              <Sparkles className="w-3 h-3 mr-1" /> AI draft
            </Button>
          </div>
        </div>
        <Input
          value={suggestQuery}
          onChange={e => onSuggestQueryChange(e.target.value)}
          placeholder="Filter suggestions (optional)…"
          className="text-sm bg-background/80"
          aria-label="Filter action suggestions"
        />
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => onInsertSuggestion(s)}
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

      {/* Action Textarea */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">To address this, we have discussed that…</label>
        <Textarea
          value={form.action}
          onChange={e => onFormChange({ action: e.target.value })}
          placeholder="Start with the participant's name. Include what they will do, by when, and where if relevant."
          rows={4}
          spellCheck
          data-field="action"
          className={getFieldClass(!!form.action.trim())}
        />
      </div>

      {/* Responsible and Help Row */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Who is responsible?</label>
          <ComboboxInput
            value={form.responsible}
            onChange={(value) => onFormChange({ responsible: value })}
            options={['Participant', 'Advisor', 'I']}
            placeholder="Select or type…"
            emptyMessage="No options found."
            className={getFieldClass(!!form.responsible)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">This action will help…</label>
          <Input
            value={form.help}
            onChange={e => onFormChange({ help: e.target.value })}
            placeholder="How will it help?"
            className={getFieldClass(!!form.help.trim())}
          />
        </div>
      </div>

      {/* Timescale */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">This will be reviewed in…</label>
        <ComboboxInput
          value={form.timescale}
          onChange={(value) => onFormChange({ timescale: value })}
          options={timescales}
          placeholder="Select timescale…"
          emptyMessage="No timescales found."
          className={getFieldClass(!!form.timescale)}
          data-field="timescale"
        />
      </div>
    </motion.div>
  );
});
