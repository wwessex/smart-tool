import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check, Sparkles, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ComboboxInput } from './ComboboxInput';
import { cn } from '@/lib/utils';

interface WizardStep {
  id: string;
  title: string;
  question: string;
  field: string;
  placeholder?: string;
  hint?: string;
  type: 'input' | 'textarea' | 'combobox';
  required?: boolean;
  options?: string[];
}

const RESPONSIBLE_OPTIONS: string[] = [
  'Participant',
  'Advisor',
  'Both',
  'Employer',
  'Training provider',
  'Other',
];

const NOW_STEPS: WizardStep[] = [
  {
    id: 'forename',
    title: 'Participant',
    question: "What is the participant's first name?",
    field: 'forename',
    placeholder: 'e.g. John',
    hint: 'This helps personalise the action',
    type: 'combobox',
    required: true,
  },
  {
    id: 'barrier',
    title: 'Barrier',
    question: 'Which barrier to work are you addressing?',
    field: 'barrier',
    placeholder: 'Select or type a barrier…',
    hint: 'Keep it short and specific',
    type: 'combobox',
    required: true,
  },
  {
    id: 'action',
    title: 'Action',
    question: 'What action will the participant take?',
    field: 'action',
    placeholder: 'e.g. Apply for 3 warehouse roles on Indeed',
    hint: 'Start with a verb. Keep it measurable.',
    type: 'textarea',
    required: true,
  },
  {
    id: 'responsible',
    title: 'Responsibility',
    question: 'Who is responsible for completing it?',
    field: 'responsible',
    placeholder: 'Select or type who is responsible…',
    hint: 'Clarity prevents missed actions',
    type: 'combobox',
    options: RESPONSIBLE_OPTIONS,
    required: true,
  },
  {
    id: 'help',
    title: 'Support',
    question: 'What support will be provided?',
    field: 'help',
    placeholder: 'e.g. Advisor will review CV and share 3 vacancy links',
    hint: 'Be practical and specific',
    type: 'textarea',
    required: false,
  },
  {
    id: 'timescale',
    title: 'Time',
    question: 'What is the timescale?',
    field: 'timescale',
    placeholder: 'Select or type a timescale…',
    hint: 'A short deadline boosts follow-through',
    type: 'combobox',
    required: true,
  },
];

const FUTURE_STEPS: WizardStep[] = [
  {
    id: 'forename',
    title: 'Participant',
    question: "What is the participant's first name?",
    field: 'forename',
    placeholder: 'e.g. John',
    hint: 'This helps personalise the action',
    type: 'combobox',
    required: true,
  },
  {
    id: 'task',
    title: 'Task',
    question: 'What task will the participant complete?',
    field: 'task',
    placeholder: 'e.g. Update CV to include recent experience',
    hint: 'Make it clear and actionable',
    type: 'textarea',
    required: true,
  },
  {
    id: 'responsible',
    title: 'Responsibility',
    question: 'Who is responsible for completing it?',
    field: 'responsible',
    placeholder: 'Select or type who is responsible…',
    hint: 'Clarity prevents missed actions',
    type: 'combobox',
    options: RESPONSIBLE_OPTIONS,
    required: true,
  },
  {
    id: 'outcome',
    title: 'Outcome',
    question: 'What outcome are we aiming for?',
    field: 'outcome',
    placeholder: 'e.g. Ready to apply for 5 roles this week',
    hint: 'The result you want to see',
    type: 'textarea',
    required: true,
  },
  {
    id: 'timescale',
    title: 'Time',
    question: 'What is the timescale?',
    field: 'timescale',
    placeholder: 'Select or type a timescale…',
    hint: 'A short deadline boosts follow-through',
    type: 'combobox',
    required: true,
  },
];

interface ActionWizardProps {
  mode: 'now' | 'future';
  barriers: string[];
  timescales: string[];
  recentNames: string[];
  onComplete: (data: Record<string, string>) => void;
  onCancel: () => void;
  onAIDraft?: (field: string, context: Record<string, string>) => Promise<string>;
  isAIDrafting?: boolean;
  isLLMReady?: boolean;
}

export function ActionWizard({
  mode,
  barriers,
  timescales,
  recentNames,
  onComplete,
  onCancel,
  onAIDraft,
  isAIDrafting,
  isLLMReady,
}: ActionWizardProps) {
  const steps = mode === 'now' ? NOW_STEPS : FUTURE_STEPS;

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [drafting, setDrafting] = useState(false);

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const currentValue = formData[step.field] || '';
  const isValid = !step.required || currentValue.trim().length > 0;

  const getOptions = useCallback(
    (s: WizardStep) => {
      if (s.options) return s.options;
      if (s.field === 'barrier') return barriers;
      if (s.field === 'timescale') return timescales;
      if (s.field === 'forename') return recentNames;
      return [];
    },
    [barriers, timescales, recentNames]
  );

  const handleNext = () => {
    if (!isValid) return;
    if (isLastStep) {
      onComplete(formData);
      return;
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (!isFirstStep) setCurrentStep((prev) => prev - 1);
  };

  const handleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, [step.field]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && step.type !== 'textarea') {
      e.preventDefault();
      handleNext();
    }
  };

  const canAIDraft = Boolean(onAIDraft) && (step.type === 'textarea' || step.type === 'input');

  const handleAIDraft = async () => {
    if (!onAIDraft) return;
    setDrafting(true);
    try {
      const draft = await onAIDraft(step.field, formData);
      if (draft?.trim()) {
        setFormData((prev) => ({ ...prev, [step.field]: draft }));
      }
    } finally {
      setDrafting(false);
    }
  };

  const inputId = `wizard-${step.field}`;
  const hintId = step.hint ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-5">
      {/* Top row: stepper + close */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {steps.map((s, i) => {
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStep(i)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs",
                    "border backdrop-blur-xl transition-all",
                    isActive
                      ? "bg-white/14 border-white/30 text-foreground shadow-sm"
                      : isDone
                      ? "bg-white/10 border-white/20 text-foreground/90"
                      : "bg-white/6 border-white/15 text-muted-foreground hover:text-foreground hover:bg-white/10"
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span
                    className={cn(
                      "grid place-items-center w-5 h-5 rounded-full text-[11px] font-semibold",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isDone
                        ? "bg-white/18 text-foreground"
                        : "bg-white/10 text-muted-foreground"
                    )}
                    aria-hidden="true"
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  <span className="truncate">{s.title}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Close wizard"
          className="rounded-xl"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Step card */}
      <motion.section
        className={cn(
          "glass-subpanel rounded-2xl p-5 sm:p-6",
          "border border-white/20 shadow-sm"
        )}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
              {step.question}
            </h2>
            {step.hint && (
              <p id={hintId} className="text-sm text-muted-foreground">
                {step.hint}
              </p>
            )}
          </div>

          <div className="space-y-2" onKeyDown={handleKeyDown}>
            <label htmlFor={inputId} className="sr-only">
              {step.title}
            </label>

            {step.type === 'combobox' ? (
              <ComboboxInput
                value={currentValue}
                onChange={handleChange}
                placeholder={step.placeholder}
                options={getOptions(step)}
                ariaLabel={step.title}
              />
            ) : step.type === 'textarea' ? (
              <Textarea
                id={inputId}
                value={currentValue}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={step.placeholder}
                aria-describedby={hintId}
                aria-invalid={step.required && !isValid}
              />
            ) : (
              <Input
                id={inputId}
                value={currentValue}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={step.placeholder}
                aria-describedby={hintId}
                aria-invalid={step.required && !isValid}
              />
            )}

            {/* AI helper */}
            {canAIDraft && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {isLLMReady ? "Local AI ready" : "AI helper"}
                  </span>
                  {isLLMReady && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/15">
                      Enhanced
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAIDraft}
                  disabled={drafting || isAIDrafting}
                  className="rounded-xl"
                >
                  {drafting || isAIDrafting ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                  )}
                  Suggest
                </Button>
              </div>
            )}

            {/* Validation message */}
            <AnimatePresence>
              {step.required && !isValid && (
                <motion.p
                  className="text-sm text-destructive"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  This field is required to continue.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.section>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={handleBack}
          disabled={isFirstStep}
          className="rounded-xl"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          Back
        </Button>

        <Button
          type="button"
          onClick={handleNext}
          disabled={!isValid}
          className="rounded-xl"
        >
          {isLastStep ? (
            <>
              <Check className="w-4 h-4" aria-hidden="true" />
              Finish
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
