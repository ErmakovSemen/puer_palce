/**
 * Примеры использования аналитики в React компонентах
 * 
 * Копируйте и адаптируйте под свои нужды
 */

import { useEffect } from "react";
import { useAbTesting } from "@/hooks/use-ab-testing";
import { 
  trackEvent, 
  trackPageView, 
  trackProductView,
  trackAddToCart,
  trackOrderCompleted 
} from "@/lib/analytics";
import {
  trackEventWithExperiments,
  trackExperimentEvent,
  trackExperimentImpression,
  trackExperimentConversion,
  createExperimentTracker
} from "@/lib/analytics-ab-helpers";

// ============================================
// Пример 1: Автоматическое отслеживание просмотров страницы
// ============================================

export function HomePage() {
  useEffect(() => {
    // Отслеживаем просмотр главной страницы
    trackPageView("/");
  }, []);

  return <div>...</div>;
}

// ============================================
// Пример 2: Отслеживание взаимодействия с товаром
// ============================================

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    pricePerGram: number;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  // Отслеживаем просмотр при монтировании компонента
  useEffect(() => {
    trackProductView(product.id, product.name);
  }, [product.id, product.name]);

  const handleAddToCart = (quantity: number) => {
    // Отслеживаем добавление в корзину
    trackAddToCart(product.id, product.name, quantity);
    
    // ... остальная логика добавления
  };

  return (
    <div>
      <h3>{product.name}</h3>
      <button onClick={() => handleAddToCart(50)}>
        Добавить 50г
      </button>
    </div>
  );
}

// ============================================
// Пример 3: A/B тест кнопки оформления заказа
// ============================================

export function CheckoutButton() {
  const { getTestVariant } = useAbTesting();
  const variant = getTestVariant("checkout-button-test");

  // Отслеживаем показ варианта
  useEffect(() => {
    if (variant) {
      trackExperimentImpression("checkout-button-test", variant, {
        page: window.location.pathname
      });
    }
  }, [variant]);

  const handleClick = () => {
    // Отслеживаем клик с данными эксперимента
    trackExperimentEvent("checkout_button_clicked", "checkout-button-test", variant, {
      properties: {
        button_text: variant?.config.text || "Оформить",
        button_color: variant?.config.color || "blue"
      }
    });

    // ... логика оформления
  };

  return (
    <button 
      style={{ 
        background: variant?.config.color || "blue",
        color: "white" 
      }}
      onClick={handleClick}
    >
      {variant?.config.text || "Оформить заказ"}
    </button>
  );
}

// ============================================
// Пример 4: Ценовой A/B тест
// ============================================

export function ProductPrice({ product }: ProductCardProps) {
  const { applyPriceMultiplier, getTestVariant } = useAbTesting();
  const priceVariant = getTestVariant("pricing-test");
  
  const originalPrice = product.pricePerGram;
  const displayPrice = applyPriceMultiplier(originalPrice, "pricing-test");
  const multiplier = priceVariant?.config.price_multy || 1;

  // Отслеживаем показ цены с мультипликатором
  useEffect(() => {
    trackEvent("price_shown", {
      experimentKey: "pricing-test",
      experimentVariant: priceVariant?.variantId,
      properties: {
        product_id: product.id,
        original_price: originalPrice,
        display_price: displayPrice,
        multiplier: multiplier,
        discount_pct: (1 - multiplier) * 100
      }
    });
  }, [product.id, displayPrice]);

  return (
    <div>
      {multiplier !== 1 && (
        <span style={{ textDecoration: "line-through", color: "gray" }}>
          {originalPrice}₽
        </span>
      )}
      <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
        {displayPrice}₽
      </span>
    </div>
  );
}

// ============================================
// Пример 5: Отслеживание завершения заказа
// ============================================

export function OrderSuccessPage({ orderId, total }: { orderId: number; total: number }) {
  const { getAllTestAssignments } = useAbTesting();

  useEffect(() => {
    // Отслеживаем завершение заказа со ВСЕМИ активными экспериментами
    trackEventWithExperiments("order_completed", getAllTestAssignments(), {
      properties: {
        order_id: orderId,
        order_total: total
      },
      immediate: true // Отправляем немедленно для критических событий
    });
  }, [orderId, total]);

  return <div>Спасибо за заказ!</div>;
}

// ============================================
// Пример 6: Воронка оформления заказа
// ============================================

export function CheckoutFlow() {
  const { getAllTestAssignments } = useAbTesting();
  const assignments = getAllTestAssignments();

  // Шаг 1: Начало оформления
  const handleCheckoutStart = (cartTotal: number) => {
    trackEventWithExperiments("checkout_started", assignments, {
      properties: {
        cart_total: cartTotal,
        items_count: 3
      }
    });
  };

  // Шаг 2: Заполнение формы
  const handleFormFilled = () => {
    trackEventWithExperiments("checkout_form_filled", assignments);
  };

  // Шаг 3: Подтверждение
  const handleConfirm = () => {
    trackEventWithExperiments("checkout_confirmed", assignments, {
      immediate: true
    });
  };

  return <div>...</div>;
}

// ============================================
// Пример 7: Использование createExperimentTracker (продвинутый)
// ============================================

export function HeroBanner() {
  const { getTestVariant } = useAbTesting();
  
  // Создаём трекер для конкретного эксперимента
  const tracker = createExperimentTracker(
    "hero-banner-design",
    () => getTestVariant("hero-banner-design")
  );

  // Отслеживаем показ при монтировании
  useEffect(() => {
    tracker.trackImpression({ 
      page: "/",
      position: "top" 
    });
  }, []);

  const handleCTAClick = () => {
    tracker.trackEvent("hero_cta_clicked", {
      cta_text: "Купить сейчас"
    });
  };

  const variant = tracker.getVariant();

  return (
    <div style={{ 
      background: variant?.config.background || "#fff",
      layout: variant?.config.layout || "horizontal"
    }}>
      <h1>{variant?.config.title || "Добро пожаловать"}</h1>
      <button onClick={handleCTAClick}>
        {variant?.config.ctaText || "Купить сейчас"}
      </button>
    </div>
  );
}

// ============================================
// Пример 8: Отслеживание ошибок
// ============================================

export function PaymentForm() {
  const handlePaymentError = (error: Error) => {
    trackEvent("payment_error", {
      properties: {
        error_type: error.name,
        error_message: error.message,
        timestamp: new Date().toISOString()
      },
      immediate: true
    });
  };

  return <div>...</div>;
}

// ============================================
// Пример 9: Отслеживание поиска
// ============================================

export function SearchBar() {
  const handleSearch = async (query: string) => {
    const results = await searchProducts(query);
    
    trackEvent("search_performed", {
      properties: {
        query: query,
        results_count: results.length,
        has_results: results.length > 0
      }
    });
  };

  return <input onBlur={(e) => handleSearch(e.target.value)} />;
}

// ============================================
// Пример 10: Квиз с A/B тестом
// ============================================

export function TeaQuiz() {
  const { getTestVariant } = useAbTesting();
  const quizVariant = getTestVariant("quiz-design-test");

  useEffect(() => {
    trackExperimentEvent("quiz_started", "quiz-design-test", quizVariant);
  }, []);

  const handleQuizComplete = (recommendedTea: string) => {
    // Конверсия - пользователь завершил квиз
    trackExperimentConversion("quiz-design-test", quizVariant, {
      recommended_tea: recommendedTea,
      questions_answered: 5
    });
  };

  return <div>...</div>;
}

// ============================================
// Пример 11: Отслеживание лояльности
// ============================================

export function LoyaltyBadge({ user }: { user: { xp: number } }) {
  const oldLevel = getPreviousLevel(user.xp);
  const newLevel = getCurrentLevel(user.xp);

  useEffect(() => {
    // Отслеживаем повышение уровня
    if (newLevel > oldLevel) {
      trackEvent("loyalty_level_up", {
        properties: {
          old_level: oldLevel,
          new_level: newLevel,
          xp: user.xp
        },
        immediate: true
      });
    }
  }, [user.xp]);

  return <div>Уровень: {newLevel}</div>;
}

// ============================================
// Пример 12: Таргетированный A/B тест (только для VIP)
// ============================================

export function VIPPromotion({ user }: { user: { id: string; xp: number } }) {
  const { getTestVariant } = useAbTesting();
  const vipPromoVariant = getTestVariant("vip-promo-test");
  
  // Эксперимент настроен только для VIP (в experiments.target_user_ids)
  if (!vipPromoVariant) {
    return null; // Обычным пользователям не показываем
  }

  useEffect(() => {
    trackExperimentImpression("vip-promo-test", vipPromoVariant, {
      user_level: user.xp >= 15000 ? "master" : "expert"
    });
  }, [vipPromoVariant]);

  return (
    <div className="vip-banner">
      {vipPromoVariant.config.message}
    </div>
  );
}

// ============================================
// Вспомогательные функции
// ============================================

function searchProducts(query: string) {
  // Mock функция поиска
  return [];
}

function getPreviousLevel(xp: number): number {
  // Логика определения предыдущего уровня
  return 1;
}

function getCurrentLevel(xp: number): number {
  if (xp >= 15000) return 4;
  if (xp >= 7000) return 3;
  if (xp >= 3000) return 2;
  return 1;
}
