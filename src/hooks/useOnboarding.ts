const STORAGE_KEY = 'smartTool.onboardingComplete';

export function useOnboarding() {
  const resetOnboarding = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn(`localStorage remove failed for key "${STORAGE_KEY}":`, error);
    }
    window.location.reload();
  };

  const isOnboardingComplete = () => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  };

  return { resetOnboarding, isOnboardingComplete };
}
