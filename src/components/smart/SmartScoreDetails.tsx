import { motion } from 'framer-motion';
import { Target, BarChart3, ThumbsUp, Link2, Clock, AlertTriangle, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SmartCheck, getSmartLabel } from '@/lib/smart-checker';
import { highlightSmartElements, getMatchesByType, HIGHLIGHT_COLORS, HIGHLIGHT_LABELS, HighlightType } from '@/lib/smart-highlighter';
import { cn } from '@/lib/utils';

interface SmartScoreDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  check: SmartCheck;
  actionText: string;
}

const CRITERIA_ICONS: Record<string, typeof Target> = {
  specific: Target,
  measurable: BarChart3,
  achievable: ThumbsUp,
  relevant: Link2,
  timebound: Clock,
  weak: AlertTriangle,
};

const CRITERIA_ORDER: (keyof SmartCheck)[] = ['specific', 'measurable', 'achievable', 'relevant', 'timeBound'];

export function SmartScoreDetails({ open, onOpenChange, check, actionText }: SmartScoreDetailsProps) {
  const segments = highlightSmartElements(actionText);
  const matchesByType = getMatchesByType(actionText);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>SMART Score Details</span>
            <motion.div 
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-bold",
                check.overallScore >= 4 ? "bg-green-500/10 text-green-600" :
                check.overallScore >= 3 ? "bg-amber-500/10 text-amber-600" :
                "bg-destructive/10 text-destructive"
              )}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
            >
              {check.overallScore}/5 {getSmartLabel(check.overallScore)}
            </motion.div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Highlighted Text */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Action Analysis</h4>
            <div className="p-4 rounded-lg bg-muted/30 border text-sm leading-relaxed">
              {segments.map((segment, i) => (
                <span
                  key={i}
                  className={cn(
                    segment.type !== 'normal' && 'px-1 py-0.5 rounded mx-0.5',
                    segment.type !== 'normal' && HIGHLIGHT_COLORS[segment.type].bg,
                    segment.type !== 'normal' && HIGHLIGHT_COLORS[segment.type].text,
                    segment.type === 'weak' && 'underline decoration-wavy decoration-red-400'
                  )}
                  title={segment.type !== 'normal' ? HIGHLIGHT_LABELS[segment.type as Exclude<HighlightType, 'normal'>] : undefined}
                >
                  {segment.text}
                </span>
              ))}
              {!actionText && (
                <span className="text-muted-foreground italic">No action text to analyze</span>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Legend</h4>
            <div className="flex flex-wrap gap-2">
              {(['specific', 'measurable', 'achievable', 'relevant', 'timebound', 'weak'] as const).map(type => {
                const colors = HIGHLIGHT_COLORS[type];
                return (
                  <span
                    key={type}
                    className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      colors.bg,
                      colors.text,
                      type === 'weak' && 'underline decoration-wavy'
                    )}
                  >
                    {HIGHLIGHT_LABELS[type]}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Criteria Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Criteria Breakdown</h4>
            <div className="space-y-2">
              {CRITERIA_ORDER.map(key => {
                const criterion = check[key];
                if (typeof criterion !== 'object' || !('met' in criterion)) return null;
                
                const Icon = CRITERIA_ICONS[key === 'timeBound' ? 'timebound' : key] || Target;
                const highlightKey = key === 'timeBound' ? 'timebound' : key;
                const matches = matchesByType[highlightKey as Exclude<HighlightType, 'normal' | 'weak'>] || [];
                const colors = HIGHLIGHT_COLORS[highlightKey as HighlightType];

                return (
                  <motion.div
                    key={key}
                    className={cn(
                      "p-3 rounded-lg border",
                      criterion.met ? "bg-green-500/5 border-green-500/20" : "bg-muted/50 border-border"
                    )}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        criterion.met ? "bg-green-500 text-white" : "bg-muted"
                      )}>
                        {criterion.met ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm capitalize">
                            {key === 'timeBound' ? 'Time-bound' : key}
                          </span>
                          {criterion.confidence === 'high' && criterion.met && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                              Strong
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{criterion.reason}</p>
                        
                        {/* Matched elements */}
                        {matches.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {matches.slice(0, 5).map((match, i) => (
                              <span
                                key={i}
                                className={cn("text-[10px] px-1.5 py-0.5 rounded", colors.bg, colors.text)}
                              >
                                {match}
                              </span>
                            ))}
                            {matches.length > 5 && (
                              <span className="text-[10px] text-muted-foreground">+{matches.length - 5} more</span>
                            )}
                          </div>
                        )}
                        
                        {/* Suggestion */}
                        {!criterion.met && criterion.suggestion && (
                          <p className="text-xs text-primary pt-1">💡 {criterion.suggestion}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Weak Language */}
          {matchesByType.weak.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                Weak Language Detected
              </h4>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex flex-wrap gap-2">
                  {matchesByType.weak.map((word, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-700"
                    >
                      "{word}"
                    </span>
                  ))}
                </div>
                <p className="text-xs text-amber-700 mt-2">
                  Replace with stronger commitment language like "will", "agrees to", or "commits to"
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
