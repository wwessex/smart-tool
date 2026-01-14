import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, Info, Target, BarChart3, ThumbsUp, Link2, Clock } from 'lucide-react';
import { SmartCheck, getSmartLabel, getSmartColor } from '@/lib/smart-checker';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SmartChecklistProps {
  check: SmartCheck;
  className?: string;
}

const CRITERIA_CONFIG = [
  { key: 'specific', label: 'Specific', icon: Target, letter: 'S' },
  { key: 'measurable', label: 'Measurable', icon: BarChart3, letter: 'M' },
  { key: 'achievable', label: 'Achievable', icon: ThumbsUp, letter: 'A' },
  { key: 'relevant', label: 'Relevant', icon: Link2, letter: 'R' },
  { key: 'timeBound', label: 'Time-bound', icon: Clock, letter: 'T' },
] as const;

export function SmartChecklist({ check, className }: SmartChecklistProps) {
  return (
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
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <span className="text-primary">SMART</span> Checklist
          </h3>
          <motion.div 
            className={cn(
              "px-3 py-1 rounded-full text-sm font-bold",
              check.overallScore >= 4 ? "bg-green-500/10 text-green-600" :
              check.overallScore >= 3 ? "bg-amber-500/10 text-amber-600" :
              "bg-destructive/10 text-destructive"
            )}
            key={check.overallScore}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            {check.overallScore}/5 {getSmartLabel(check.overallScore)}
          </motion.div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
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

        {/* Criteria list */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {CRITERIA_CONFIG.map(({ key, label, icon: Icon, letter }, index) => {
              const criterion = check[key];
              const isMet = criterion.met;
              
              return (
                <motion.div
                  key={key}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg transition-colors",
                    isMet ? "bg-green-500/5" : "bg-muted/50"
                  )}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {/* Status icon */}
                  <motion.div 
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      isMet 
                        ? criterion.confidence === 'high' ? "bg-green-500 text-white" : "bg-green-400 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                    animate={isMet ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    {isMet ? <Check className="w-3.5 h-3.5" /> : letter}
                  </motion.div>

                  {/* Label and reason */}
                  <div className="flex-1 min-w-0">
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
                    </div>
                    <p className={cn(
                      "text-xs truncate",
                      isMet ? "text-green-600" : "text-muted-foreground"
                    )}>
                      {criterion.reason}
                    </p>
                  </div>

                  {/* Hint tooltip */}
                  {criterion.hint && !isMet && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1 hover:bg-muted rounded-md transition-colors">
                          <Info className="w-4 h-4 text-muted-foreground" />
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

        {/* Missing elements summary */}
        {check.overallScore < 5 && (
          <motion.div 
            className="pt-2 border-t border-border/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p>
                {check.overallScore === 4 && "Almost there! Add the missing element for a complete SMART action."}
                {check.overallScore === 3 && "Good progress! Focus on the amber items to improve."}
                {check.overallScore < 3 && "Tip: Start with who will do what, add a deadline, and link to the barrier."}
              </p>
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
            </div>
          </motion.div>
        )}
      </motion.div>
    </TooltipProvider>
  );
}
