/**
 * Конфигурация моно-лендинга.
 *
 * Страница одна, версия выбирается по адресу: /l/ceremony, /l/tea, /l/gift.
 * Под каждое рекламное объявление — свой вариант с своим оффером и формой.
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │ ЗАПОЛНИТЬ РЕАЛЬНЫМИ ДАННЫМИ (отмечено // TODO):              │
 * │ часы работы, цена и длительность церемонии.                  │
 * └──────────────────────────────────────────────────────────────┘
 */

export type LandingVariant = "ceremony" | "tea" | "gift";

export const LANDING_VARIANTS: LandingVariant[] = ["ceremony", "tea", "gift"];

export function resolveVariant(value?: string | null): LandingVariant {
  return LANDING_VARIANTS.includes(value as LandingVariant) ? (value as LandingVariant) : "ceremony";
}

/** Контакты и адрес чайной — общие для всех вариантов лендинга. */
export const venue = {
  name: "Пуэр Паб",
  city: "Электросталь",
  address: "проспект Ленина, 40/8",
  addressHint: "Спуск по лестнице слева от ресторана «Пекин»",
  phone: "+7 966 736-40-77",
  phoneHref: "tel:+79667364077",
  email: "SimonErmak@yandex.ru",
  telegram: "@puerpub",
  telegramHref: "https://t.me/puerpub",
  vk: "vk.ru/puerpab",
  vkHref: "https://vk.ru/puerpab",
  mapsHref: "https://yandex.ru/maps/org/puer_pab/4433170848/",
  mapsEmbed:
    "https://yandex.ru/map-widget/v1/?ll=38.513699%2C55.774811&mode=search&text=%D0%BF%D1%83%D1%8D%D1%80%20%D0%BF%D0%B0%D0%B1&z=16",
  /** TODO: подтвердить точный график. Используется и для бейджа «сейчас открыто». */
  hours: {
    label: "Ежедневно",
    open: "12:00",
    close: "22:00",
  },
} as const;

export interface RitualStep {
  numeral: string;
  title: string;
  duration: string;
  text: string;
  /** Цвет настоя в чаше — от светлого к глубокому. */
  liquor: string;
}

export interface DetailTile {
  label: string;
  value: string;
  hint?: string;
}

export interface LandingConfig {
  variant: LandingVariant;
  maxGuests: number;
  seoTitle: string;
  seoDescription: string;
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    lead: string;
    bullets: string[];
    primaryCta: string;
    secondaryCta: string;
  };
  ritual: {
    eyebrow: string;
    title: string;
    lead: string;
    steps: RitualStep[];
  } | null;
  details: DetailTile[];
  form: {
    eyebrow: string;
    title: string;
    lead: string;
    submit: string;
    successTitle: string;
    successText: string;
    showGuests: boolean;
    showDate: boolean;
  };
}

const ceremony: LandingConfig = {
  variant: "ceremony",
  maxGuests: 4,
  seoTitle: "Чайная церемония в Электростали — Пуэр Паб",
  seoDescription:
    "Камерная чайная церемония в «Пуэр Паб»: до 4 гостей, 950 ₽ за компанию, чай включён. Электросталь, проспект Ленина, 40/8.",
  hero: {
    eyebrow: "Чайная «Пуэр Паб» · Электросталь",
    title: "Чайная церемония",
    titleAccent: "для своих",
    lead: "Камерный вечер за чайным столом: мастер ведёт, чай включён, опыт не нужен.",
    bullets: ["950 ₽ за компанию", "до 4 гостей", "≈ 1 час", "центр Электростали"],
    primaryCta: "Записаться",
    secondaryCta: "Как добраться",
  },
  ritual: {
    eyebrow: "Почему стоит прийти",
    title: "Чайный вечер без сложных правил",
    lead: "Коротко о том, что важно перед записью.",
    steps: [
      {
        numeral: "一",
        title: "Опыт не нужен",
        duration: "мастер ведёт",
        text: "Не нужно знать сорта, термины и правила. Просто приходите.",
        liquor: "#E8C979",
      },
      {
        numeral: "二",
        title: "Камерно",
        duration: "до 4 гостей",
        text: "Подходит для свидания, встречи с друзьями или спокойного вечера.",
        liquor: "#D9A24A",
      },
      {
        numeral: "三",
        title: "Чай включён",
        duration: "950 ₽",
        text: "Цена за всю компанию. Без доплат за стол и базовый чай.",
        liquor: "#B9702C",
      },
      {
        numeral: "四",
        title: "Можно выбрать настроение",
        duration: "поможем",
        text: "Бодрее, спокойнее, мягче или плотнее — подберём чай на месте.",
        liquor: "#8C4420",
      },
    ],
  },
  details: [
    { label: "Длительность", value: "≈ 1 час", hint: "Можно задержаться дольше" }, // TODO: подтвердить
    { label: "Гостей за столом", value: "до 4", hint: "Больше — напишите нам" },
    { label: "Стоимость", value: "950 ₽", hint: "За всю компанию, чай включён" },
    { label: "Опыт", value: "Не нужен", hint: "Мастер ведёт всю церемонию" },
  ],
  form: {
    eyebrow: "Запись",
    title: "Забронировать вечер",
    lead: "Оставьте номер — подтвердим время звонком или в Telegram.",
    submit: "Записаться на церемонию",
    successTitle: "Записали",
    successText: "Мы перезвоним по указанному номеру и подтвердим время. Если удобнее в переписке — напишите нам в Telegram.",
    showGuests: true,
    showDate: true,
  },
};

/** Заготовка: включим, когда будет отдельное объявление на чай. */
const tea: LandingConfig = {
  ...ceremony,
  variant: "tea",
  maxGuests: 1,
  seoTitle: "Купить китайский чай в Электростали — Пуэр Паб",
  seoDescription: "Пуэры, улуны, красный и белый чай в чайной «Пуэр Паб». Электросталь, проспект Ленина, 40/8.",
  hero: {
    ...ceremony.hero,
    eyebrow: "Чайная «Пуэр Паб» · Электросталь",
    title: "Чай",
    titleAccent: "на развес",
    lead: "Пуэры, улуны, красный и белый чай. Дадим попробовать перед покупкой и расскажем, как заваривать дома.",
    bullets: ["можно попробовать", "подберём по вкусу", "чай на развес", "посуда и подарки"],
    primaryCta: "Оставить заявку",
  },
  ritual: null,
  form: {
    ...ceremony.form,
    title: "Подобрать чай",
    lead: "Оставьте номер — спросим про вкусы и соберём подборку к вашему приходу.",
    submit: "Оставить заявку",
    showGuests: false,
    showDate: false,
  },
};

/** Заготовка: включим, когда будет отдельное объявление на подарочные наборы. */
const gift: LandingConfig = {
  ...ceremony,
  variant: "gift",
  maxGuests: 1,
  seoTitle: "Подарочный чайный набор — Пуэр Паб, Электросталь",
  seoDescription: "Подарочные наборы чая и посуды в чайной «Пуэр Паб». Электросталь, проспект Ленина, 40/8.",
  hero: {
    ...ceremony.hero,
    title: "Подарочный",
    titleAccent: "набор",
    lead: "Соберём набор под повод и бюджет: чай, посуда, упаковка. Можно добавить сертификат на церемонию.",
    bullets: ["под повод", "под бюджет", "чай + посуда", "сертификат на церемонию"],
    primaryCta: "Собрать набор",
  },
  ritual: null,
  form: {
    ...ceremony.form,
    title: "Собрать набор",
    lead: "Оставьте номер — уточним повод и бюджет, пришлём варианты.",
    submit: "Собрать набор",
    showGuests: false,
    showDate: false,
  },
};

export const landingConfigs: Record<LandingVariant, LandingConfig> = { ceremony, tea, gift };
