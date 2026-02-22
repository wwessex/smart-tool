import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FeedbackRating = 'relevant' | 'not-relevant' | null;

interface ActionFeedbackProps {
  /** Whether an AI-generated action is currently displayed */
  visible: boolean;
  /** Current rating state */
  rating: FeedbackRating;
  /** Called when user clicks thumbs up / thumbs down */
  onRate: (rating: FeedbackRating) => void;
  /** Called when user clicks regenerate */
  onRegenerate: () => void;
  /** Whether a regeneration is in progress */
  isRegenerating?: boolean;
  className?: string;
}

export const ActionFeedback = memo(function ActionFeedback({
  visible,
  rating,
  onRate,
  onRegenerate,
  isRegenerating = false,
  className,
}: ActionFeedbackProps) {
  const [showThanks, setShowThanks] = useState(false);

  if (!visible) return null;

  const handleRate = (newRating: FeedbackRating) => {
    // Toggle off if clicking same rating
    const effectiveRating = rating === newRating ? null : newRating;
    onRate(effectiveRating);

    if (effectiveRating) {
      setShowThanks(true);
      setTimeout(() => setShowThanks(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'flex items-center gap-2 py-2',
        className,
      )}
    >
      <span className="text-xs text-muted-foreground mr-1">Was this relevant?</span>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleRate('relevant')}
        className={cn(
          'h-7 w-7 p-0 rounded-full',
          rating === 'relevant' && 'bg-green-500/15 text-green-600 hover:bg-green-500/20',
        )}
        aria-label="Mark as relevant"
        aria-pressed={rating === 'relevant'}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleRate('not-relevant')}
        className={cn(
          'h-7 w-7 p-0 rounded-full',
          rating === 'not-relevant' && 'bg-red-500/15 text-red-600 hover:bg-red-500/20',
        )}
        aria-label="Mark as not relevant"
        aria-pressed={rating === 'not-relevant'}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </Button>

      <div className="w-px h-4 bg-border mx-1" />

      <Button
        size="sm"
        variant="ghost"
        onClick={onRegenerate}
        disabled={isRegenerating}
        className="h-7 px-2 text-xs gap-1"
        aria-label="Regenerate action"
      >
        <RefreshCw className={cn('w-3.5 h-3.5', isRegenerating && 'animate-spin')} />
        Regenerate
      </Button>

      <AnimatePresence>
        {showThanks && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-muted-foreground ml-1"
          >
            Thanks!
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
