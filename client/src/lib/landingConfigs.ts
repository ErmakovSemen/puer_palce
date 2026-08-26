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
  seoTitle: string;
  seoDescription: string;
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    lead: string;
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
  seoTitle: "Чайная церемония в Электростали — Пуэр Паб",
  seoDescription:
    "Гунфу-ча в чайной «Пуэр Паб»: два часа, семь проливов, разговор без спешки. Электросталь, проспект Ленина, 40/8. Запись онлайн.",
  hero: {
    eyebrow: "Чайная «Пуэр Паб» · Электросталь",
    title: "Чайная",
    titleAccent: "церемония",
    lead: "Два часа за низким столом, семь проливов одного чая и ни одного повода торопиться. Ведёт чайный мастер — приходить с опытом не нужно.",
    primaryCta: "Записаться",
    secondaryCta: "Как добраться",
  },
  ritual: {
    eyebrow: "Как это проходит",
    title: "Ритуал в пять действий",
    lead: "Ничего заучивать не нужно. Мастер ведёт, вы пьёте и задаёте вопросы.",
    steps: [
      {
        numeral: "一",
        title: "Знакомство",
        duration: "10 минут",
        text: "Садимся за чайный стол. Спрашиваем, что вы уже пробовали и чего хотите сегодня — бодрости, тишины или нового вкуса. Под это выбираем чай.",
        liquor: "#E8C979",
      },
      {
        numeral: "二",
        title: "Пробуждение листа",
        duration: "2 минуты",
        text: "Прогреваем посуду, отделяем лист от прессованного блина и обливаем кипятком. Первый настой сливаем — он будит чай и смывает пыль дороги.",
        liquor: "#D9A24A",
      },
      {
        numeral: "三",
        title: "Проливы",
        duration: "около часа",
        text: "Семь-десять коротких проливов: первые по пять секунд, поздние — по полминуты. Один и тот же лист каждый раз отдаёт новый вкус. Это и есть церемония.",
        liquor: "#B9702C",
      },
      {
        numeral: "四",
        title: "Тишина",
        duration: "между проливами",
        text: "Говорить не обязательно. У чая есть послевкусие, и в чайной принято дать ему дозвучать, прежде чем наливать следующую пиалу.",
        liquor: "#8C4420",
      },
      {
        numeral: "五",
        title: "Чай с собой",
        duration: "на прощание",
        text: "Понравившийся чай можно забрать домой и заварить его так же — мастер расскажет, сколько граммов, какая вода и сколько держать.",
        liquor: "#5E2A14",
      },
    ],
  },
  details: [
    { label: "Длительность", value: "≈ 2 часа", hint: "Можно задержаться дольше" }, // TODO: подтвердить
    { label: "Гостей за столом", value: "до 4", hint: "Больше — напишите нам" },
    { label: "Стоимость", value: "950 ₽", hint: "За всю компанию, чай включён" },
    { label: "Опыт", value: "Не нужен", hint: "Мастер ведёт всю церемонию" },
  ],
  form: {
    eyebrow: "Запись",
    title: "Занять место за столом",
    lead: "Оставьте номер — перезвоним, подтвердим время и подберём чай под ваш вечер.",
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
  seoTitle: "Купить китайский чай в Электростали — Пуэр Паб",
  seoDescription: "Пуэры, улуны, красный и белый чай в чайной «Пуэр Паб». Электросталь, проспект Ленина, 40/8.",
  hero: {
    ...ceremony.hero,
    eyebrow: "Чайная «Пуэр Паб» · Электросталь",
    title: "Чай",
    titleAccent: "на развес",
    lead: "Пуэры, улуны, красный и белый чай. Дадим попробовать перед покупкой и расскажем, как заваривать дома.",
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
  seoTitle: "Подарочный чайный набор — Пуэр Паб, Электросталь",
  seoDescription: "Подарочные наборы чая и посуды в чайной «Пуэр Паб». Электросталь, проспект Ленина, 40/8.",
  hero: {
    ...ceremony.hero,
    title: "Подарочный",
    titleAccent: "набор",
    lead: "Соберём набор под повод и бюджет: чай, посуда, упаковка. Можно добавить сертификат на церемонию.",
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
