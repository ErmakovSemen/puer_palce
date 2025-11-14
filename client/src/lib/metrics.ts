declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: any[]) => void;
  }
}

const YANDEX_METRIKA_ID = 104973108;

export function trackEvent(goalName: string, params?: Record<string, any>) {
  try {
    if (typeof window !== 'undefined' && window.ym) {
      window.ym(YANDEX_METRIKA_ID, 'reachGoal', goalName, params);
    }
  } catch (error) {
    console.warn('Failed to track event:', goalName, error);
  }
}
