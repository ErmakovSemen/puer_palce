declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: any[]) => void;
  }
}

const YANDEX_METRIKA_ID = 111989121;
const SETS_METRIKA_ID = 112106160;

export const METRIKA_GOALS = {
  ceremonyBookingCtaClick: "ceremony_booking_cta_click",
  ceremonyBookingSubmitted: "ceremony_booking_submitted",
  ceremonyMessengerClick: "ceremony_messenger_click",
  setsLandingViewed: "sets_landing_view",
  setsHeroCtaClick: "sets_hero_cta_click",
  setsCtaClick: "sets_cta_click",
  setsAddedToCart: "sets_added_to_cart",
  setsOrderSubmitted: "sets_order_submitted",
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

export function trackSetsEvent(goalName: string, params?: Record<string, any>) {
  try {
    if (typeof window !== 'undefined' && window.ym) {
      window.ym(YANDEX_METRIKA_ID, 'reachGoal', goalName, params);
      window.ym(SETS_METRIKA_ID, 'reachGoal', goalName, params);
    }
  } catch (error) {
    console.warn('Failed to track sets event:', goalName, error);
  }
}
