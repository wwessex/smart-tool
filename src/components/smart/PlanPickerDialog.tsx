import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { logDraftAnalytics } from '@/lib/draft-analytics';
import type { SMARTAction, SMARTPlan } from '@/hooks/useBrowserNativeLLM';
import type { Mode } from '@/hooks/useSmartForm';
import { Sparkles } from 'lucide-react';

export interface PlanPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planResult: SMARTPlan | null;
  setPlanResult: (plan: SMARTPlan | null) => void;
  mode: Mode;
  barrier: string;
  onSelectAction: (action: SMARTAction, selectedIndex?: number) => void;
  title?: string;
  description?: string;
  draftMode?: 'primary' | 'alternates';
  barrierType?: string | null;
}

export function PlanPickerDialog({
  open,
  onOpenChange,
  planResult,
  setPlanResult,
  mode,
  barrier,
  onSelectAction,
  title,
  description,
  draftMode = 'primary',
  barrierType,
}: PlanPickerDialogProps) {
  const draftSource =
    (planResult?.metadata as { source?: string } | undefined)?.source === 'template_fallback'
      ? 'template'
      : 'ai';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            {title || (mode === 'future' ? 'Choose an Outcome' : 'Choose a SMART Action')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {description || `The AI generated ${planResult?.actions.length || 0} ${mode === 'future' ? 'outcomes' : 'SMART actions'}. Select one to use.`}
          </p>
          {planResult?.actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => onSelectAction(action, idx)}
              className="w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm transition-all duration-200 text-left group space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-sm leading-snug">{action.action}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{action.effort_estimate}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Metric: {action.metric}</span>
                <span>·</span>
                <span>By: {action.deadline}</span>
              </div>
              <p className="text-xs text-muted-foreground">{action.first_step}</p>
            </button>
          ))}
          {planResult?.metadata && (
            <p className="text-xs text-muted-foreground pt-2 border-t">
              Generated in {Math.round(planResult.metadata.generation_time_ms)}ms
              {planResult.metadata.runtime && ` · ${planResult.metadata.runtime === 'desktop-helper' ? 'Desktop Accelerator' : planResult.metadata.runtime === 'browser' ? 'Browser AI' : 'Template fallback'}`}
              {planResult.metadata.runtime_backend && ` · ${planResult.metadata.runtime_backend}`}
              {planResult.metadata.generation_profile && ` · ${planResult.metadata.generation_profile}`}
              {planResult.metadata.repair_attempts > 0 && ` · ${planResult.metadata.repair_attempts} planner repair${planResult.metadata.repair_attempts === 1 ? '' : 's'}`}
              {planResult.metadata.model_id === 'template-only' && ' (template fallback)'}
            </p>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={() => {
              logDraftAnalytics({
                timestamp: new Date().toISOString(),
                signal: "rejected",
                barrier: mode === 'now' ? barrier : undefined,
                barrier_type: barrierType || undefined,
                actions_count: planResult?.actions.length,
                draft_mode: draftMode,
                source: draftSource,
                runtime: planResult?.metadata.runtime,
                runtime_backend: planResult?.metadata.runtime_backend,
              });
              onOpenChange(false);
              setPlanResult(null);
            }}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
