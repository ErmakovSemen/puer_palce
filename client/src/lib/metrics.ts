declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: any[]) => void;
  }
}

const YANDEX_METRIKA_ID = 111989121;

export const METRIKA_GOALS = {
  ceremonyBookingCtaClick: "ceremony_booking_cta_click",
  ceremonyBookingSubmitted: "ceremony_booking_submitted",
} as const;

export function trackEvent(goalName: string, params?: Record<string, any>) {
  try {
    if (typeof window !== 'undefined' && window.ym) {
      window.ym(YANDEX_METRIKA_ID, 'reachGoal', goalName, params);
    }
  } catch (error) {
    console.warn('Failed to track event:', goalName, error);
  }
}
