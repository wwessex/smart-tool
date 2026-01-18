import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Download, Languages, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { WarningBox } from './WarningBox';
import { SmartChecklist } from './SmartChecklist';
import { LanguageSelector } from './LanguageSelector';
import { SUPPORTED_LANGUAGES } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { SmartCheck } from '@/lib/smart-checker';

export interface OutputPanelProps {
  output: string;
  onOutputChange: (value: string) => void;
  translatedOutput: string | null;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  // Translation
  participantLanguage: string;
  onLanguageChange: (language: string) => void;
  isTranslating: boolean;
  translationError: string | null;
  onTranslate: () => void;
  // SMART Check
  smartCheck: SmartCheck;
  onFixCriterion: (criterion: 'specific' | 'measurable' | 'achievable' | 'relevant' | 'timeBound', suggestion: string) => void;
  fixingCriterion: string | null;
  // AI Error handling
  aiError: string | null;
  onClearAIError: () => void;
  lastFixAttempt: { criterion: string; suggestion: string } | null;
  onRetryFix: () => void;
}

export const OutputPanel = memo(function OutputPanel({
  output,
  onOutputChange,
  translatedOutput,
  copied,
  onCopy,
  onDownload,
  participantLanguage,
  onLanguageChange,
  isTranslating,
  translationError,
  onTranslate,
  smartCheck,
  onFixCriterion,
  fixingCriterion,
  aiError,
  onClearAIError,
  lastFixAttempt,
  onRetryFix,
}: OutputPanelProps) {
  return (
    <div className="space-y-6">
      {/* Header with Copy/Download buttons */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-lg">Generated action</h2>
          <p className="text-xs text-muted-foreground">Proofread before pasting into important documents.</p>
        </div>
        <div className="flex gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button size="sm" onClick={onCopy} className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm">
              <Copy className="w-4 h-4 mr-1" /> Copy
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button size="sm" variant="outline" onClick={onDownload}>
              <Download className="w-4 h-4 mr-1" /> .txt
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Language selector and translate button */}
      <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-muted/30 border border-border/50">
        <LanguageSelector 
          value={participantLanguage} 
          onChange={onLanguageChange}
          disabled={isTranslating}
        />
        {participantLanguage !== 'none' && output.trim() && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={onTranslate}
            disabled={isTranslating}
            className="border-primary/30 hover:bg-primary/10"
          >
            {isTranslating ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Translating...</>
            ) : (
              <><Languages className="w-4 h-4 mr-1" /> Translate</>
            )}
          </Button>
        )}
        {translationError && (
          <span className="text-xs text-destructive">{translationError}</span>
        )}
      </div>

      {/* Output Textarea */}
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
              onChange={e => onOutputChange(e.target.value)}
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
          {translatedOutput && participantLanguage !== 'none' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {SUPPORTED_LANGUAGES[participantLanguage]?.flag} {SUPPORTED_LANGUAGES[participantLanguage]?.nativeName?.toUpperCase()}
              </p>
              <div className="p-5 rounded-xl border-2 border-primary/30 bg-primary/5 leading-relaxed whitespace-pre-wrap text-sm">
                {translatedOutput}
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* AI Error */}
      {aiError && (
        <WarningBox variant="error" title="AI request failed">
          <div className="space-y-2">
            <p>{aiError}</p>
            <div className="flex flex-wrap gap-2">
              {lastFixAttempt && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetryFix}
                  disabled={!!fixingCriterion}
                  className="bg-background text-foreground"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry AI fix
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onClearAIError} className="text-foreground">
                Dismiss
              </Button>
            </div>
          </div>
        </WarningBox>
      )}

      {/* SMART Checklist */}
      <SmartChecklist check={smartCheck} onFixCriterion={onFixCriterion} fixingCriterion={fixingCriterion} />
    </div>
  );
});
