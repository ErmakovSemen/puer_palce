export interface LoyaltyLevel {
  level: number;
  name: string;
  minXP: number;
  maxXP: number | null;
  discount: number;
  color: string;
  benefits: string[];
}

export const LOYALTY_LEVELS: LoyaltyLevel[] = [
  {
    level: 1,
    name: "Новичок",
    minXP: 0,
    maxXP: 2999,
    discount: 0,
    color: "#6B7280", // gray
    benefits: ["Доступ к базовому каталогу"],
  },
  {
    level: 2,
    name: "Ценитель",
    minXP: 3000,
    maxXP: 6999,
    discount: 5,
    color: "#059669", // green
    benefits: ["Скидка 5% на все покупки", "Доступ к базовому каталогу"],
  },
  {
    level: 3,
    name: "Чайный мастер",
    minXP: 7000,
    maxXP: 14999,
    discount: 10,
    color: "#7C3AED", // purple
    benefits: [
      "Скидка 10% на все покупки",
      "Персональный чат с консультациями",
      "Приглашения на закрытые чайные вечеринки",
      "Возможность запросить любой чай",
    ],
  },
  {
    level: 4,
    name: "Чайный Гуру",
    minXP: 15000,
    maxXP: null,
    discount: 15,
    color: "#DC2626", // red
    benefits: [
      "Скидка 15% на все покупки",
      "Все привилегии уровня 3",
      "Приоритетное обслуживание",
      "Эксклюзивные предложения",
    ],
  },
];

export function getLoyaltyLevel(xp: number): LoyaltyLevel {
  for (let i = LOYALTY_LEVELS.length - 1; i >= 0; i--) {
    const level = LOYALTY_LEVELS[i];
    if (xp >= level.minXP) {
      return level;
    }
  }
  return LOYALTY_LEVELS[0];
}

export function getLoyaltyDiscount(xp: number): number {
  const level = getLoyaltyLevel(xp);
  return level.discount;
}

export interface LoyaltyProgress {
  currentLevel: LoyaltyLevel;
  currentXP: number;
  nextLevel: LoyaltyLevel | null;
  xpToNextLevel: number;
  progressPercentage: number;
}

export function getLoyaltyProgress(xp: number): LoyaltyProgress {
  const currentLevel = getLoyaltyLevel(xp);
  const currentLevelIndex = LOYALTY_LEVELS.findIndex(
    (level) => level.level === currentLevel.level
  );
  const nextLevel =
    currentLevelIndex < LOYALTY_LEVELS.length - 1
      ? LOYALTY_LEVELS[currentLevelIndex + 1]
      : null;

  let xpToNextLevel = 0;
  let progressPercentage = 100;

  if (nextLevel) {
    const xpInCurrentLevel = xp - currentLevel.minXP;
    const xpRequiredForNextLevel = nextLevel.minXP - currentLevel.minXP;
    xpToNextLevel = nextLevel.minXP - xp;
    progressPercentage = (xpInCurrentLevel / xpRequiredForNextLevel) * 100;
  }

  return {
    currentLevel,
    currentXP: xp,
    nextLevel,
    xpToNextLevel,
    progressPercentage,
  };
}
