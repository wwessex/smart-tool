import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Check, X, ArrowRight, Loader2, AlertCircle, RefreshCw, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SmartCheck } from '@/lib/smart-checker';
import { IMPROVE_PROMPT } from '@/lib/smart-prompts';
import { cn } from '@/lib/utils';
import { WarningBox } from './WarningBox';
import { DelightfulError } from './DelightfulError';
import { useAIConsent } from '@/hooks/useAIConsent';

interface LocalLLMHandle {
  isReady: boolean;
  isGenerating: boolean;
  error: string | null;
  clearError: () => void;
  abort: () => void;
  generate: (userMessage: string, systemPrompt?: string, configType?: string) => Promise<string>;
}

interface AIImproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalAction: string;
  barrier: string;
  forename: string;
  smartCheck: SmartCheck;
  onApply: (improvedAction: string) => void;
  llm: LocalLLMHandle;
}

interface ImproveResult {
  improved: string;
  explanation: string;
  changes: string[];
}

export function AIImproveDialog({
  open,
  onOpenChange,
  originalAction,
  barrier,
  forename,
  smartCheck,
  onApply,
  llm,
}: AIImproveDialogProps) {
  const { isGenerating, abort, error: llmError, clearError, generate, isReady } = llm;
  const hasConsent = useAIConsent();

  const [result, setResult] = useState<ImproveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = error ?? llmError;

  const unmetCriteria = [
    !smartCheck.specific.met && 'Specific',
    !smartCheck.measurable.met && 'Measurable',
    !smartCheck.achievable.met && 'Achievable',
    !smartCheck.relevant.met && 'Relevant',
    !smartCheck.timeBound.met && 'Time-bound',
  ].filter(Boolean).join(', ');

  const handleImprove = useCallback(async () => {
    if (!hasConsent) {
      setError('AI consent required to improve actions.');
      return;
    }
    clearError();
    setError(null);
    setResult(null);

    const prompt = IMPROVE_PROMPT
      .replace('{action}', originalAction)
      .replace('{barrier}', barrier || 'Not specified')
      .replace('{forename}', forename || 'Participant')
      .replace('{score}', String(smartCheck.overallScore))
      .replace('{unmetCriteria}', unmetCriteria || 'None');

    try {
      const fullResponse = await generate(prompt, undefined, 'improve');

      // Parse JSON response
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setResult({
          improved: parsed.improved || '',
          explanation: parsed.explanation || '',
          changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to improve action');
    }
  }, [originalAction, barrier, forename, smartCheck.overallScore, unmetCriteria, clearError, hasConsent]);

  const handleDismissError = useCallback(() => {
    setError(null);
    clearError();
  }, [clearError]);

  const handleApply = () => {
    if (result?.improved) {
      onApply(result.improved);
      onOpenChange(false);
      setResult(null);
    }
  };

  const handleClose = () => {
    if (isGenerating) abort();
    onOpenChange(false);
    setResult(null);
    setError(null);
    clearError();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            AI Improve Action
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Original Action */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Original Action</h4>
            <div className="p-3 rounded-lg bg-muted/50 border text-sm whitespace-pre-wrap">
              {originalAction || 'No action text provided'}
            </div>
            <div className="flex gap-2 text-xs">
              <span className={cn(
                "px-2 py-0.5 rounded-full",
                smartCheck.overallScore >= 4 ? "bg-green-500/10 text-green-600" :
                smartCheck.overallScore >= 3 ? "bg-amber-500/10 text-amber-600" :
                "bg-destructive/10 text-destructive"
              )}>
                Score: {smartCheck.overallScore}/5
              </span>
              {unmetCriteria && (
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Needs: {unmetCriteria}
                </span>
              )}
            </div>
          </div>

          {/* Consent Warning */}
          {!hasConsent && (
            <WarningBox variant="warning" title="AI Consent Required">
              <p className="text-sm">
                Enable AI features in <strong>Settings → Privacy & Data</strong> to use this feature.
              </p>
            </WarningBox>
          )}

          {/* Generate Button */}
          {!result && !isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 py-4"
            >
              <Button 
                onClick={handleImprove} 
                size="lg" 
                className="gap-2"
                disabled={!hasConsent}
              >
                <Wand2 className="w-4 h-4" />
                Generate Improvement
              </Button>
              {!hasConsent && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  AI consent required
                </p>
              )}
            </motion.div>
          )}

          {/* Loading State */}
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              className="flex flex-col items-center gap-3 py-6"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="w-8 h-8 text-primary" />
              </motion.div>
              <motion.p
                className="text-sm text-muted-foreground"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                Analyzing and improving your action...
              </motion.p>
              <Button variant="outline" size="sm" onClick={abort}>
                Cancel
              </Button>
            </motion.div>
          )}

          {/* Error State */}
          {errorMessage && (
            <DelightfulError
              variant="ai"
              title="Failed to improve action"
              message={errorMessage}
              onRetry={handleImprove}
              onDismiss={handleDismissError}
            />
          )}

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", damping: 22, stiffness: 260 }}
                className="space-y-4"
              >
                {/* Improved Action */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2 text-green-600">
                    <Check className="w-4 h-4" />
                    Improved Action
                  </h4>
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm whitespace-pre-wrap">
                    {result.improved}
                  </div>
                </div>

                {/* Explanation */}
                {result.explanation && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Why it's better</h4>
                    <p className="text-sm text-muted-foreground">{result.explanation}</p>
                  </div>
                )}

                {/* Changes Made */}
                {result.changes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Changes Made</h4>
                    <ul className="space-y-1">
                      {result.changes.map((change, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <ArrowRight className="w-3 h-3 text-primary shrink-0 mt-1" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Regenerate */}
                <div className="flex justify-center">
                  <Button variant="ghost" size="sm" onClick={handleImprove}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          {result && (
            <Button onClick={handleApply} className="gap-2">
              <Check className="w-4 h-4" /> Apply Improvement
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
