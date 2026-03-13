import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SUPPORTED_LANGUAGES } from '@/hooks/useTranslation';
import { SmartChecklist } from './SmartChecklist';
import { ActionFeedback } from './ActionFeedback';
import { DelightfulError } from './DelightfulError';
import { LanguageSelector } from './LanguageSelector';
import { cn } from '@/lib/utils';
import type { SmartCheck } from '@/lib/smart-checker';
import type { FeedbackRating } from './ActionFeedback';
import {
  Copy, Download, Languages, Loader2,
} from 'lucide-react';

export interface OutputPanelProps {
  output: string;
  setOutput: (v: string) => void;
  setOutputSource: (v: 'form' | 'ai' | 'manual') => void;
  setTranslatedOutput: (v: string | null) => void;
  translatedOutput: string | null;
  hasTranslation: boolean;
  hasOutput: boolean;
  copied: boolean;
  smartCheck: SmartCheck;
  participantLanguage: string;
  handleCopy: () => void;
  handleDownload: () => void;
  handleTranslate: () => void;
  handleLanguageChange: (lang: string) => void;
  translation: {
    isTranslating: boolean;
    canTranslate: boolean;
    error: string | null;
    isRTL: (lang: string) => boolean;
  };
  llm: {
    isReady: boolean;
    isGenerating: boolean;
    error: string | null;
    classifiedError: { title: string; message: string; retryable: boolean } | null;
    clearError: () => void;
  };
  showFeedbackUI: boolean;
  feedbackRating: FeedbackRating;
  handleFeedbackRate: (rating: FeedbackRating) => void;
  handleAIDraft: () => void;
  aiDrafting: boolean;
}

export function OutputPanel({
  output,
  setOutput,
  setOutputSource,
  setTranslatedOutput,
  translatedOutput,
  hasTranslation,
  hasOutput,
  copied,
  smartCheck,
  participantLanguage,
  handleCopy,
  handleDownload,
  handleTranslate,
  handleLanguageChange,
  translation,
  llm,
  showFeedbackUI,
  feedbackRating,
  handleFeedbackRate,
  handleAIDraft,
  aiDrafting,
}: OutputPanelProps) {
  return (
    <>
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
          value={participantLanguage}
          onChange={handleLanguageChange}
          disabled={translation.isTranslating || !translation.canTranslate}
        />
        {participantLanguage !== 'none' && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTranslate}
            disabled={!hasOutput || translation.isTranslating || !translation.canTranslate}
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
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="space-y-4"
        >
          {/* English output */}
          <div>
            {hasTranslation && <p id="output-label-en" className="text-xs font-medium text-muted-foreground mb-2">🇬🇧 ENGLISH</p>}
            <Textarea
              id="action-output"
              value={output}
              onChange={e => { setOutput(e.target.value); setOutputSource('manual'); setTranslatedOutput(null); }}
              placeholder="Generated action will appear here… You can also edit the text directly."
              aria-label="Generated SMART action text"
              aria-describedby={hasTranslation ? "output-label-en" : undefined}
              className={cn(
                "min-h-[120px] p-5 rounded-xl border-2 border-dashed border-border bg-muted/30 leading-relaxed resize-y",
                copied && "border-accent bg-accent/10 shadow-glow",
                !output && "text-muted-foreground"
              )}
            />
          </div>

          {/* Translated output */}
          {hasTranslation && participantLanguage !== 'none' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {SUPPORTED_LANGUAGES[participantLanguage]?.flag} {SUPPORTED_LANGUAGES[participantLanguage]?.nativeName?.toUpperCase()}
              </p>
              <Textarea
                id="action-output-translated"
                value={translatedOutput}
                readOnly
                lang={participantLanguage}
                aria-label={`Translated SMART action text in ${SUPPORTED_LANGUAGES[participantLanguage]?.nativeName || participantLanguage}`}
                dir={translation.isRTL(participantLanguage) ? 'rtl' : 'ltr'}
                className="min-h-[120px] p-5 rounded-xl border-2 border-primary/30 bg-primary/5 leading-relaxed whitespace-pre-wrap text-sm resize-y"
              />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {llm.error && (
        <DelightfulError
          variant="ai"
          title={llm.classifiedError?.title || "AI took a nap"}
          message={llm.classifiedError?.message || llm.error}
          onRetry={undefined}
          onDismiss={() => llm.clearError()}
        />
      )}

      {/* Action Feedback (shown after AI draft) */}
      <ActionFeedback
        visible={showFeedbackUI && hasOutput}
        rating={feedbackRating}
        onRate={handleFeedbackRate}
        onRegenerate={handleAIDraft}
        isRegenerating={aiDrafting || llm.isGenerating}
      />

      {/* SMART Checklist */}
      <SmartChecklist check={smartCheck} />
    </>
  );
}
