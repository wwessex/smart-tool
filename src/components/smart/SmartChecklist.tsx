import { useState, useEffect, useRef, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, Info, Target, BarChart3, ThumbsUp, Link2, Clock, AlertTriangle, Lightbulb, Wrench, Loader2, Sparkles } from 'lucide-react';
import { SmartCheck, getSmartLabel, getSmartColor, getImprovementPriority } from '@/lib/smart-checker';
import { SmartScoreDetails } from './SmartScoreDetails';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SmartChecklistProps {
  check: SmartCheck;
  className?: string;
  actionText?: string;
  onFixCriterion?: (criterion: 'specific' | 'measurable' | 'achievable' | 'relevant' | 'timeBound', suggestion: string) => void;
  fixingCriterion?: string | null;
}

const CRITERIA_CONFIG = [
  { key: 'specific', label: 'Specific', icon: Target, letter: 'S' },
  { key: 'measurable', label: 'Measurable', icon: BarChart3, letter: 'M' },
  { key: 'achievable', label: 'Achievable', icon: ThumbsUp, letter: 'A' },
  { key: 'relevant', label: 'Relevant', icon: Link2, letter: 'R' },
  { key: 'timeBound', label: 'Time-bound', icon: Clock, letter: 'T' },
] as const;

// Confetti particle component - using forwardRef to avoid React ref warning
const ConfettiParticle = forwardRef<HTMLDivElement, { delay: number; x: number }>(
  ({ delay, x }, ref) => (
    <motion.div
      ref={ref}
      className="absolute w-1.5 h-1.5 rounded-full bg-green-500"
      initial={{ opacity: 1, y: 0, x: x, scale: 1 }}
      animate={{ 
        opacity: [1, 1, 0],
        y: [-5, -25, -35],
        x: [x, x + (Math.random() - 0.5) * 20, x + (Math.random() - 0.5) * 30],
        scale: [1, 1.2, 0.5]
      }}
      transition={{ duration: 0.8, delay, ease: "easeOut" }}
    />
  )
);
ConfettiParticle.displayName = 'ConfettiParticle';

export function SmartChecklist({ check, className, actionText = '', onFixCriterion, fixingCriterion }: SmartChecklistProps) {
  const improvementPriorities = getImprovementPriority(check);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [celebratingCriteria, setCelebratingCriteria] = useState<Set<string>>(new Set());
  const prevCheckRef = useRef<SmartCheck | null>(null);
  
  // Track when criteria change from unmet to met (after AI fix)
  useEffect(() => {
    if (prevCheckRef.current) {
      const newCelebrations = new Set<string>();
      CRITERIA_CONFIG.forEach(({ key }) => {
        const wasMet = prevCheckRef.current?.[key]?.met;
        const isMet = check[key]?.met;
        // Criterion just became met
        if (!wasMet && isMet) {
          newCelebrations.add(key);
        }
      });
      
      if (newCelebrations.size > 0) {
        setCelebratingCriteria(newCelebrations);
        // Clear celebration after animation - with cleanup
        const timeout = setTimeout(() => setCelebratingCriteria(new Set()), 1500);
        prevCheckRef.current = check;
        return () => clearTimeout(timeout);
      }
    }
    prevCheckRef.current = check;
  }, [check]);
  
  return (
    <>
    <SmartScoreDetails
      open={detailsOpen}
      onOpenChange={setDetailsOpen}
      check={check}
      actionText={actionText}
    />
    <TooltipProvider delayDuration={300}>
      <motion.div 
        className={cn(
          "rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 space-y-3",
          className
        )}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 id="smart-checklist-heading" className="font-semibold text-sm flex items-center gap-2">
            <span className="text-primary">SMART</span> Checklist
          </h3>
          <motion.button
            type="button"
            className={cn(
              "px-3 py-1 rounded-full text-sm font-bold cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all focus:outline-none focus:ring-2 focus:ring-primary",
              check.overallScore >= 4 ? "bg-green-500/10 text-green-600" :
              check.overallScore >= 3 ? "bg-amber-500/10 text-amber-600" :
              "bg-destructive/10 text-destructive"
            )}
            key={check.overallScore}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            onClick={() => setDetailsOpen(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={`SMART score: ${check.overallScore} out of 5, ${getSmartLabel(check.overallScore)}. Click for detailed analysis`}
          >
            {check.overallScore}/5 {getSmartLabel(check.overallScore)}
          </motion.button>
        </div>

        {/* Progress bar */}
        <div 
          className="h-2 bg-muted rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={check.overallScore}
          aria-valuemin={0}
          aria-valuemax={5}
          aria-label={`SMART score progress: ${check.overallScore} out of 5`}
        >
          <motion.div
            className={cn(
              "h-full rounded-full",
              check.overallScore >= 4 ? "bg-green-500" :
              check.overallScore >= 3 ? "bg-amber-500" :
              "bg-destructive"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${(check.overallScore / 5) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Semantic Warnings */}
        {check.warnings && check.warnings.length > 0 && (
          <motion.div 
            className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-1"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <div className="flex items-center gap-2 text-amber-600 font-medium text-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              Quality Warnings
            </div>
            {check.warnings.map((warning, i) => (
              <p key={i} className="text-xs text-amber-700">{warning}</p>
            ))}
          </motion.div>
        )}

        {/* Criteria list */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {CRITERIA_CONFIG.map(({ key, label, icon: Icon, letter }, index) => {
              const criterion = check[key];
              const isMet = criterion.met;
              const isCelebrating = celebratingCriteria.has(key);
              
              return (
                <motion.div
                  key={key}
                  className={cn(
                    "relative flex items-center gap-3 p-2 rounded-lg transition-colors overflow-hidden",
                    isMet ? "bg-green-500/5" : "bg-muted/50"
                  )}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {/* Celebration glow effect */}
                  {isCelebrating && (
                    <>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-green-500/20 via-green-400/30 to-green-500/20 rounded-lg"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ 
                          opacity: [0, 1, 1, 0],
                          scale: [0.8, 1, 1.02, 1]
                        }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-lg"
                        initial={{ boxShadow: "0 0 0 0 rgba(34, 197, 94, 0)" }}
                        animate={{ 
                          boxShadow: [
                            "0 0 0 0 rgba(34, 197, 94, 0)",
                            "0 0 20px 4px rgba(34, 197, 94, 0.4)",
                            "0 0 30px 8px rgba(34, 197, 94, 0.2)",
                            "0 0 0 0 rgba(34, 197, 94, 0)"
                          ]
                        }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      />
                      {/* Confetti particles */}
                      <div className="absolute left-4 top-1/2">
                        {[...Array(6)].map((_, i) => (
                          <ConfettiParticle key={i} delay={i * 0.05} x={(i - 2.5) * 8} />
                        ))}
                      </div>
                      {/* Sparkle icon */}
                      <motion.div
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        initial={{ opacity: 0, scale: 0, rotate: -30 }}
                        animate={{ 
                          opacity: [0, 1, 1, 0],
                          scale: [0, 1.2, 1, 0.8],
                          rotate: [-30, 0, 10, 0]
                        }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      >
                        <Sparkles className="w-5 h-5 text-green-500" />
                      </motion.div>
                    </>
                  )}
                  
                  {/* Status icon */}
                  <motion.div 
                    className={cn(
                      "relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      isMet 
                        ? criterion.confidence === 'high' ? "bg-green-500 text-white" : "bg-green-400 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                    animate={isCelebrating ? { scale: [1, 1.4, 1.1, 1], rotate: [0, -10, 10, 0] } : isMet ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    {isMet ? <Check className="w-3.5 h-3.5" /> : letter}
                  </motion.div>

                  {/* Label and reason */}
                  <div className="relative z-10 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-medium",
                        isMet ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {label}
                      </span>
                      {criterion.confidence === 'high' && isMet && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                          Strong
                        </span>
                      )}
                      {isCelebrating && (
                        <motion.span 
                          className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 font-bold"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
                        >
                          ✓ Fixed!
                        </motion.span>
                      )}
                    </div>
                    <p className={cn(
                      "text-xs truncate",
                      isMet ? "text-green-600" : "text-muted-foreground"
                    )}>
                      {criterion.reason}
                    </p>
                  </div>

                  {/* Fix button for unmet criteria */}
                  {!isMet && onFixCriterion && (criterion.suggestion || criterion.hint) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                          onClick={() => onFixCriterion(key, criterion.suggestion || criterion.hint || '')}
                          disabled={!!fixingCriterion}
                          aria-label={fixingCriterion === key 
                            ? `AI is fixing ${label} criterion` 
                            : `Fix ${label} criterion: ${criterion.suggestion || criterion.hint}`}
                          aria-busy={fixingCriterion === key}
                        >
                          {fixingCriterion === key ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                              <span>Fixing...</span>
                            </>
                          ) : (
                            <>
                              <Wrench className="w-3 h-3" aria-hidden="true" />
                              <span>Fix</span>
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[220px]">
                        <p className="text-xs">
                          {fixingCriterion === key 
                            ? 'AI is fixing this criterion...' 
                            : `Click to auto-fix: ${criterion.suggestion || criterion.hint}`}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Dynamic suggestion tooltip - only show if no Fix button */}
                  {criterion.suggestion && !isMet && !onFixCriterion && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          type="button"
                          className="p-1 hover:bg-primary/10 rounded-md transition-colors group"
                          aria-label={`Suggestion for ${label}: ${criterion.suggestion}`}
                        >
                          <Lightbulb className="w-4 h-4 text-primary group-hover:text-primary" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[220px] bg-primary text-primary-foreground">
                        <p className="text-xs font-medium">{criterion.suggestion}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {/* Fallback hint tooltip - only show if no Fix button */}
                  {criterion.hint && !criterion.suggestion && !isMet && !onFixCriterion && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          type="button"
                          className="p-1 hover:bg-muted rounded-md transition-colors"
                          aria-label={`Hint for ${label}: ${criterion.hint}`}
                        >
                          <Info className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[200px]">
                        <p className="text-xs">{criterion.hint}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Improvement priorities - dynamic guidance */}
        {check.overallScore < 5 && check.overallScore > 0 && improvementPriorities.length > 0 && (
          <motion.div 
            className="pt-2 border-t border-border/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Next steps to improve:</p>
                <div className="flex flex-wrap gap-1">
                  {improvementPriorities.slice(0, 3).map((priority, i) => (
                    <span 
                      key={i}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full",
                        i === 0 ? "bg-primary/10 text-primary font-medium" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {i === 0 && "→ "}{priority}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {check.overallScore === 0 && (
          <motion.div 
            className="pt-2 border-t border-border/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p>Generate an action to see SMART analysis.</p>
            </div>
          </motion.div>
        )}

        {/* Celebration for perfect score */}
        {check.overallScore === 5 && (
          <motion.div 
            className="pt-2 border-t border-border/50"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
              <Check className="w-4 h-4" />
              Perfect! This is a fully SMART action.
              {check.warnings && check.warnings.length > 0 && (
                <span className="text-amber-600 font-normal">
                  (Review warnings above)
                </span>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </TooltipProvider>
    </>
  );
}
