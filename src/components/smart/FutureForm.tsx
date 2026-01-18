import { memo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WarningText, InputGlow } from './WarningBox';
import { ComboboxInput } from './ComboboxInput';
import { LLMChatButton } from './LLMChat';
import type { FutureForm as FutureFormType } from '@/types/smart-tool';

interface Suggestion {
  title: string;
  outcome?: string;
}

export interface FutureFormProps {
  form: FutureFormType;
  onFormChange: (updates: Partial<FutureFormType>) => void;
  today: string;
  dateError: string;
  timescales: string[];
  recentNames: string[];
  suggestions: Suggestion[];
  onInsertSuggestion: (suggestion: Suggestion) => void;
  onAIDraft: () => void;
  showValidation: boolean;
  llmSystemPrompt: string;
  llmContext: string;
}

export const FutureForm = memo(function FutureForm({
  form,
  onFormChange,
  today,
  dateError,
  timescales,
  recentNames,
  suggestions,
  onInsertSuggestion,
  onAIDraft,
  showValidation,
  llmSystemPrompt,
  llmContext,
}: FutureFormProps) {
  const getFieldClass = (isValid: boolean) => {
    if (!showValidation) return '';
    return isValid ? 'border-green-500/50' : 'border-destructive/60 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]';
  };

  return (
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
      
      {/* Date and Name Row */}
      <div className="flex flex-col sm:flex-row">
        <div className="space-y-2 shrink-0 mb-4 sm:mb-0 sm:mr-6" style={{ width: 'clamp(140px, 40%, 220px)' }}>
          <label htmlFor="scheduled-date" className="text-sm font-medium text-muted-foreground">Scheduled date</label>
          <div className="relative">
            <InputGlow show={!!dateError} variant="error" />
            <Input
              id="scheduled-date"
              type="date"
              value={form.date}
              onChange={e => onFormChange({ date: e.target.value })}
              min={today}
              className={`${getFieldClass(!!form.date && !dateError)} ${dateError ? 'border-destructive' : ''}`}
              aria-describedby={dateError ? "future-date-error" : undefined}
              aria-invalid={!!dateError}
            />
          </div>
          <WarningText show={!!dateError} variant="error" id="future-date-error">
            {dateError}
          </WarningText>
        </div>
        <div className="space-y-2 flex-1 min-w-0">
          <label htmlFor="future-participant-name" className="text-sm font-medium text-muted-foreground">Participant forename</label>
          <Input
            id="future-participant-name"
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

      {/* Task Description */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Activity or event</label>
        <Textarea
          value={form.task}
          onChange={e => onFormChange({ task: e.target.value })}
          placeholder="e.g. Christmas Job Fair at Twickenham Stadium"
          rows={2}
          spellCheck
          className={getFieldClass(!!form.task.trim())}
        />
        <p className="text-xs text-muted-foreground">Describe the task, event, or activity they will attend.</p>
      </div>

      {/* Advisor Assist */}
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
              initialContext={llmContext}
            />
            <Button size="sm" onClick={onAIDraft} className="bg-primary hover:bg-primary/90 shadow-md">
              <Sparkles className="w-3 h-3 mr-1" /> AI draft
            </Button>
          </div>
        </div>
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

      {/* Outcome Textarea */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">What will happen / expected outcome?</label>
        <Textarea
          value={form.outcome}
          onChange={e => onFormChange({ outcome: e.target.value })}
          placeholder="e.g. will speak with employers about warehouse roles and collect contact details"
          rows={4}
          spellCheck
          data-field="outcome"
          className={getFieldClass(!!form.outcome.trim())}
        />
        <p className="text-xs text-muted-foreground">Describe what the participant will do or achieve. Use AI draft for suggestions.</p>
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
