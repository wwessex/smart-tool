import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, Wand2, Keyboard, History, ChevronRight, X, CheckCircle2 } from 'lucide-react';

const STORAGE_KEY = 'smartTool.onboardingComplete';

/**
 * Safely write to localStorage, catching quota errors and blocked storage.
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`localStorage write failed for key "${key}":`, error);
    return false;
  }
}

/**
 * Safely remove from localStorage, catching any errors.
 */
function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`localStorage remove failed for key "${key}":`, error);
    return false;
  }
}

interface TutorialStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  targetSelector?: string; // Data attribute selector to highlight
  position?: 'center' | 'top' | 'bottom'; // Where to position the modal
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    icon: <Sparkles className="w-8 h-8 text-primary" />,
    title: 'Welcome to SMART Action Tool!',
    description: 'This tool helps you create effective, well-structured action plans. Let\'s take a quick tour of the key features.',
    position: 'center',
  },
  {
    id: 'guided-mode',
    icon: <Sparkles className="w-8 h-8 text-primary" />,
    title: 'Guided Mode',
    description: 'Click "Guided Mode" for a step-by-step wizard that walks you through creating an action. Perfect for beginners or when you want structured guidance.',
    targetSelector: '[data-tutorial="guided-mode"]',
    position: 'bottom',
  },
  {
    id: 'ai-draft',
    icon: <Wand2 className="w-8 h-8 text-primary" />,
    title: 'AI Draft & Improve',
    description: 'Use "AI Draft" to automatically generate action text based on your inputs. The AI assists with crafting effective SMART actions.',
    targetSelector: '[data-tutorial="ai-assist"]',
    position: 'bottom',
  },
  {
    id: 'shortcuts',
    icon: <Keyboard className="w-8 h-8 text-primary" />,
    title: 'Keyboard Shortcuts',
    description: 'Press "?" anytime to see keyboard shortcuts. Use Ctrl+D for AI Draft, Ctrl+Enter to save, and more for faster workflows.',
    targetSelector: '[data-tutorial="shortcuts"]',
    position: 'bottom',
  },
  {
    id: 'history',
    icon: <History className="w-8 h-8 text-primary" />,
    title: 'History & Insights',
    description: 'All saved actions are stored in History. The Insights tab shows analytics about your actions and patterns over time.',
    targetSelector: '[data-tutorial="history"]',
    position: 'top',
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingTutorialProps {
  onComplete?: () => void;
}

export function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  // Calculate spotlight position for current step
  const updateSpotlight = useCallback(() => {
    if (!step.targetSelector) {
      setSpotlightRect(null);
      return;
    }

    const element = document.querySelector(step.targetSelector);
    if (element) {
      const rect = element.getBoundingClientRect();
      const padding = 8; // Add some padding around the element
      setSpotlightRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    } else {
      setSpotlightRect(null);
    }
  }, [step.targetSelector]);

  useEffect(() => {
    // Check if onboarding has been completed
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Small delay to let the main UI render first
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Update spotlight when step changes or window resizes
  useEffect(() => {
    if (!isOpen) return;
    
    // Small delay to let animations complete
    const timer = setTimeout(updateSpotlight, 100);
    
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight);
    };
  }, [isOpen, currentStep, updateSpotlight]);

  const handleComplete = () => {
    safeSetItem(STORAGE_KEY, 'true');
    setIsOpen(false);
    setSpotlightRect(null);
    onComplete?.();
  };

  const handleSkip = () => {
    safeSetItem(STORAGE_KEY, 'true');
    setIsOpen(false);
    setSpotlightRect(null);
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

  // Calculate modal position based on spotlight
  const getModalStyle = (): React.CSSProperties => {
    if (!spotlightRect || step.position === 'center') {
      return {};
    }

    const modalWidth = 400;
    const modalHeight = 320;
    const margin = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top: number;
    let left: number;

    // Center horizontally relative to spotlight
    left = spotlightRect.left + spotlightRect.width / 2 - modalWidth / 2;
    
    // Clamp to viewport
    left = Math.max(margin, Math.min(left, viewportWidth - modalWidth - margin));

    if (step.position === 'bottom') {
      // Position below the spotlight
      top = spotlightRect.top + spotlightRect.height + margin;
      // If it would go off screen, position above instead
      if (top + modalHeight > viewportHeight - margin) {
        top = spotlightRect.top - modalHeight - margin;
      }
    } else {
      // Position above the spotlight
      top = spotlightRect.top - modalHeight - margin;
      // If it would go off screen, position below instead
      if (top < margin) {
        top = spotlightRect.top + spotlightRect.height + margin;
      }
    }

    // Final clamp
    top = Math.max(margin, Math.min(top, viewportHeight - modalHeight - margin));

    return {
      position: 'fixed' as const,
      top,
      left,
      transform: 'none',
    };
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Dark overlay with spotlight cutout */}
          <motion.div
            className="fixed inset-0 z-[100] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <svg className="w-full h-full">
              <defs>
                <mask id="spotlight-mask">
                  {/* White = visible, Black = hidden */}
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  {spotlightRect && (
                    <motion.rect
                      initial={{ opacity: 0 }}
                      animate={{ 
                        x: spotlightRect.left,
                        y: spotlightRect.top,
                        width: spotlightRect.width,
                        height: spotlightRect.height,
                        opacity: 1,
                      }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      rx="12"
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect 
                x="0" 
                y="0" 
                width="100%" 
                height="100%" 
                fill="rgba(0, 0, 0, 0.75)"
                mask="url(#spotlight-mask)"
              />
            </svg>
          </motion.div>

          {/* Spotlight ring effect */}
          {spotlightRect && (
            <motion.div
              className="fixed z-[100] pointer-events-none rounded-xl ring-4 ring-primary ring-offset-2 ring-offset-transparent"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ 
                opacity: 1,
                scale: 1,
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{
                boxShadow: '0 0 0 4px hsl(var(--primary) / 0.3), 0 0 30px hsl(var(--primary) / 0.4)',
              }}
            />
          )}

          {/* Clickable backdrop to skip */}
          <div 
            className="fixed inset-0 z-[101] cursor-pointer"
            onClick={handleSkip}
          />

          {/* Tutorial Modal */}
          <motion.div
            className={`fixed z-[102] ${!spotlightRect || step.position === 'center' ? 'inset-0 flex items-center justify-center p-4' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={spotlightRect && step.position !== 'center' ? getModalStyle() : undefined}
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
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground z-10"
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
                  />
                ))}
              </div>

              {/* Step content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id}
                  className="p-6 pt-4 text-center"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Icon */}
                  <motion.div
                    className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center"
                    initial={{ scale: 0.5, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 15, stiffness: 300, delay: 0.1 }}
                  >
                    {step.icon}
                  </motion.div>

                  {/* Title */}
                  <h2 className="text-lg font-bold mb-2 text-foreground">{step.title}</h2>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {step.description}
                  </p>

                  {/* Navigation */}
                  <div className="flex justify-between items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBack}
                      disabled={isFirstStep}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      size="sm"
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

                  {/* Step counter */}
                  <p className="text-xs text-muted-foreground mt-4">
                    Step {currentStep + 1} of {TUTORIAL_STEPS.length}
                  </p>
                </motion.div>
              </AnimatePresence>
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
    safeRemoveItem(STORAGE_KEY);
    window.location.reload();
  };

  const isOnboardingComplete = () => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  };

  return { resetOnboarding, isOnboardingComplete };
}
