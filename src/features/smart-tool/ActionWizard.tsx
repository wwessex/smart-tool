import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Check, Sparkles, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ComboboxInput } from "@/components/smart/ComboboxInput";
import { cn } from "@/lib/utils";

interface WizardStep {
  id: string;
  title: string;
  question: string;
  field: string;
  placeholder: string;
  hint: string;
  type: "input" | "textarea" | "combobox";
  options?: string[];
  required?: boolean;
  canAIDraft?: boolean; // Whether AI Draft is available for this step
}

interface ActionWizardProps {
  mode: "now" | "future";
  barriers: string[];
  timescales: string[];
  recentNames: string[];
  onComplete: (data: Record<string, string>) => void;
  onCancel: () => void;
  onAIDraft?: (field: string, context: Record<string, string>) => Promise<string>;
  isAIDrafting?: boolean;
}

const NOW_STEPS: WizardStep[] = [
  {
    id: "forename",
    title: "Who?",
    question: "What is the participant's first name?",
    field: "forename",
    placeholder: "e.g. John",
    hint: "This helps personalize the action",
    type: "input",
    required: true,
  },
  {
    id: "barrier",
    title: "What barrier?",
    question: "What barrier to work are we addressing?",
    field: "barrier",
    placeholder: "Select or type a barrier...",
    hint: "Choose from common barriers or type your own",
    type: "combobox",
    required: true,
  },
  {
    id: "action",
    title: "What action?",
    question: "What specific action will they take?",
    field: "action",
    placeholder:
      "e.g. John will update his CV with recent experience and submit 3 applications to warehouse roles by Friday",
    hint: "Be specific: include who, what, where, and when",
    type: "textarea",
    required: true,
    canAIDraft: true,
  },
  {
    id: "responsible",
    title: "Who helps?",
    question: "Who is responsible for supporting this action?",
    field: "responsible",
    placeholder: "Select responsible person...",
    hint: "Who will help ensure this happens?",
    type: "combobox",
    options: ["Participant", "Advisor", "I"],
    required: true,
  },
  {
    id: "help",
    title: "How does it help?",
    question: "How will this action help with their employment goal?",
    field: "help",
    placeholder: "e.g. get shortlisted for interviews",
    hint: "Explain the benefit or expected outcome",
    type: "input",
    required: true,
    canAIDraft: true,
  },
  {
    id: "timescale",
    title: "Review when?",
    question: "When will this action be reviewed?",
    field: "timescale",
    placeholder: "Select timescale...",
    hint: "Set a specific review period",
    type: "combobox",
    required: true,
  },
];

const FUTURE_STEPS: WizardStep[] = [
  {
    id: "forename",
    title: "Who?",
    question: "What is the participant's first name?",
    field: "forename",
    placeholder: "e.g. John",
    hint: "This helps personalize the action",
    type: "input",
    required: true,
  },
  {
    id: "task",
    title: "What activity?",
    question: "What activity, event, or task will they complete?",
    field: "task",
    placeholder: "e.g. Christmas Job Fair at Twickenham Stadium",
    hint: "Describe the specific activity or event",
    type: "textarea",
    required: true,
  },
  {
    id: "outcome",
    title: "Expected outcome?",
    question: "What is the expected outcome or result?",
    field: "outcome",
    placeholder:
      "e.g. will speak with employers about warehouse roles and collect contact details",
    hint: "What will they achieve or learn?",
    type: "textarea",
    required: true,
    canAIDraft: true,
  },
  {
    id: "timescale",
    title: "Review when?",
    question: "When will this be reviewed?",
    field: "timescale",
    placeholder: "Select timescale...",
    hint: "Set a specific review period",
    type: "combobox",
    required: true,
  },
];

export function ActionWizard({
  mode,
  barriers,
  timescales,
  recentNames,
  onComplete,
  onCancel,
  onAIDraft,
  isAIDrafting,
}: ActionWizardProps) {
  const steps = mode === "now" ? NOW_STEPS : FUTURE_STEPS;
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [drafting, setDrafting] = useState(false);

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const currentValue = formData[step.field] || "";
  const isValid = !step.required || currentValue.trim().length > 0;

  const getOptions = useCallback(
    (step: WizardStep) => {
      if (step.options) return step.options;
      if (step.field === "barrier") return barriers;
      if (step.field === "timescale") return timescales;
      if (step.field === "forename") return recentNames;
      return [];
    },
    [barriers, timescales, recentNames],
  );

  // Check if AI Draft is available for current step
  const canDraft = step.canAIDraft && onAIDraft && !drafting && !isAIDrafting;
  const hasPrerequisites =
    step.field === "action"
      ? !!(formData.forename?.trim() && formData.barrier?.trim())
      : step.field === "help"
        ? !!formData.action?.trim()
        : step.field === "outcome"
          ? !!(formData.forename?.trim() && formData.task?.trim())
          : true;

  const handleAIDraft = useCallback(async () => {
    if (!onAIDraft || drafting) return;
    setDrafting(true);
    try {
      const result = await onAIDraft(step.field, formData);
      if (result) {
        setFormData((prev) => ({ ...prev, [step.field]: result }));
      }
    } finally {
      setDrafting(false);
    }
  }, [onAIDraft, step.field, formData, drafting]);

  const handleNext = () => {
    if (!isValid) return;
    if (isLastStep) {
      onComplete(formData);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, [step.field]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && step.type !== "textarea") {
      e.preventDefault();
      handleNext();
    }
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-semibold">Guided Mode</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" /> Exit
        </Button>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Step {currentStep + 1} of {steps.length}
          </span>
          <span>{step.title}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          className="space-y-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">{step.question}</h3>
                <p className="text-sm text-muted-foreground">{step.hint}</p>
              </div>
              {step.canAIDraft && onAIDraft && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAIDraft}
                  disabled={!hasPrerequisites || drafting || isAIDrafting}
                  className="shrink-0 gap-1.5 border-primary/30 hover:bg-primary/10"
                >
                  {drafting || isAIDrafting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Drafting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      AI Draft
                    </>
                  )}
                </Button>
              )}
            </div>
            {step.canAIDraft && !hasPrerequisites && (
              <p className="text-xs text-amber-500">
                {step.field === "action" &&
                  "Fill in forename and barrier first to use AI Draft"}
                {step.field === "help" && "Fill in the action first to use AI Draft"}
                {step.field === "outcome" &&
                  "Fill in forename and task first to use AI Draft"}
              </p>
            )}
          </div>

          {step.type === "input" && (
            <Input
              value={currentValue}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={step.placeholder}
              autoFocus
              className="text-lg py-6"
              list={step.field === "forename" ? "recent-names-wizard" : undefined}
            />
          )}

          {step.type === "textarea" && (
            <Textarea
              value={currentValue}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={step.placeholder}
              autoFocus
              rows={4}
              className="text-base"
            />
          )}

          {step.type === "combobox" && (
            <ComboboxInput
              value={currentValue}
              onChange={handleChange}
              options={getOptions(step)}
              placeholder={step.placeholder}
              emptyMessage="No options found. Type your own."
              className="text-base"
            />
          )}

          {/* Datalist for forename */}
          {step.field === "forename" && recentNames.length > 0 && (
            <datalist id="recent-names-wizard">
              {recentNames.map((name, i) => (
                <option key={i} value={name} />
              ))}
            </datalist>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={isFirstStep}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!isValid}
          className={cn("gap-2", isLastStep && "bg-green-600 hover:bg-green-700")}
        >
          {isLastStep ? (
            <>
              <Check className="w-4 h-4" /> Complete
            </>
          ) : (
            <>
              Next <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>

      {/* Preview of filled data */}
      {Object.keys(formData).length > 0 && (
        <motion.div
          className="p-3 rounded-lg bg-muted/50 border"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
        >
          <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(formData)
              .filter(([_, v]) => v)
              .map(([key, value]) => (
                <span
                  key={key}
                  className="text-xs px-2 py-1 rounded bg-primary/10 text-primary"
                >
                  {key}: {value.slice(0, 20)}
                  {value.length > 20 ? "..." : ""}
                </span>
              ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

