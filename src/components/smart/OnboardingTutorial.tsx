import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, Wand2, Keyboard, History, ChevronRight, X, CheckCircle2 } from 'lucide-react';

const STORAGE_KEY = 'smartTool.onboardingComplete';

interface TutorialStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: string; // CSS selector or area to highlight
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    icon: <Sparkles className="w-8 h-8 text-primary" />,
    title: 'Welcome to SMART Action Tool!',
    description: 'This tool helps you create effective, well-structured action plans. Let\'s take a quick tour of the key features.',
  },
  {
    id: 'guided-mode',
    icon: <Sparkles className="w-8 h-8 text-primary" />,
    title: 'Guided Mode',
    description: 'Click "Guided Mode" for a step-by-step wizard that walks you through creating an action. Perfect for beginners or when you want structured guidance.',
  },
  {
    id: 'ai-draft',
    icon: <Wand2 className="w-8 h-8 text-primary" />,
    title: 'AI Draft & Improve',
    description: 'Use "AI Draft" to automatically generate action text based on your inputs. The "Improve" button helps refine your actions to meet SMART criteria.',
  },
  {
    id: 'shortcuts',
    icon: <Keyboard className="w-8 h-8 text-primary" />,
    title: 'Keyboard Shortcuts',
    description: 'Press "?" anytime to see keyboard shortcuts. Use Ctrl+D for AI Draft, Ctrl+Enter to save, and more for faster workflows.',
  },
  {
    id: 'history',
    icon: <History className="w-8 h-8 text-primary" />,
    title: 'History & Insights',
    description: 'All saved actions are stored in History. The Insights tab shows analytics about your actions and patterns over time.',
  },
];

interface OnboardingTutorialProps {
  onComplete?: () => void;
}

export function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if onboarding has been completed
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Small delay to let the main UI render first
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
    onComplete?.();
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleSkip}
          />

          {/* Tutorial Modal */}
          <motion.div
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Skip button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                onClick={handleSkip}
              >
                <X className="w-4 h-4 mr-1" /> Skip
              </Button>

              {/* Progress dots */}
              <div className="flex justify-center gap-2 pt-6 pb-2">
                {TUTORIAL_STEPS.map((_, index) => (
                  <motion.div
                    key={index}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentStep 
                        ? 'w-6 bg-primary' 
                        : index < currentStep 
                        ? 'w-2 bg-primary/50' 
                        : 'w-2 bg-muted'
                    }`}
                    layoutId={`dot-${index}`}
                  />
                ))}
              </div>

              {/* Step content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id}
                  className="p-8 pt-4 text-center"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Icon */}
                  <motion.div
                    className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center"
                    initial={{ scale: 0.5, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 15, stiffness: 300, delay: 0.1 }}
                  >
                    {step.icon}
                  </motion.div>

                  {/* Title */}
                  <h2 className="text-xl font-bold mb-3 text-foreground">{step.title}</h2>

                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed mb-8">
                    {step.description}
                  </p>

                  {/* Navigation */}
                  <div className="flex justify-between items-center gap-3">
                    <Button
                      variant="ghost"
                      onClick={handleBack}
                      disabled={isFirstStep}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleNext}
                      className="flex-1 gap-2"
                    >
                      {isLastStep ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Get Started
                        </>
                      ) : (
                        <>
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Step counter */}
              <div className="px-8 pb-6 text-center">
                <span className="text-xs text-muted-foreground">
                  Step {currentStep + 1} of {TUTORIAL_STEPS.length}
                </span>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Hook to manually trigger onboarding
export function useOnboarding() {
  const resetOnboarding = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const isOnboardingComplete = () => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  };

  return { resetOnboarding, isOnboardingComplete };
}
