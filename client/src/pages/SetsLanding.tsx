import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  Loader2,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import type { Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { METRIKA_GOALS, trackEvent } from "@/lib/metrics";
import "@/styles/sets.css";

type BundleSpec = {
  id: string;
  label: string;
  title: string;
  lead: string;
  note: string;
  productIds: number[];
  portionGrams: number;
  isCustom?: boolean;
};
type ResolvedBundle = BundleSpec & { products: Product[] };

const bundles: BundleSpec[] = [
  {
    id: "small",
    label: "Малый набор",
    title: "Начать легко",
    lead: "Три понятных чая для первых домашних заварок.",
    note: "3 чая по 5 г",
    productIds: [4, 22, 3],
    portionGrams: 5,
  },
  {
    id: "large",
    label: "Большой набор",
    title: "Раскрыть больше",
    lead: "Базовая тройка и три редких чая для новых впечатлений.",
    note: "6 чаёв по 5 г",
    productIds: [4, 22, 3, 14, 19, 8],
    portionGrams: 5,
  },
  {
    id: "custom",
    label: "Свой набор",
    title: "Собрать с мастером",
    lead: "Расскажите, что любите, а мастер подберёт чай под вас.",
    note: "Состав и бюджет обсудим",
    productIds: [],
    portionGrams: 0,
    isCustom: true,
  },
];

const priceFor = (product: Product, grams: number) =>
  product.pricePerGram * grams;
const BOX_IMAGE = "/sets-box-concept-v1.png";
const formatRussianPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const local = (digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1) : digits).slice(0, 10);
  if (!local) return digits ? "+7" : "";
  const groups = [local.slice(0, 3), local.slice(3, 6), local.slice(6, 8), local.slice(8, 10)].filter(Boolean);
  return `+7 ${groups[0] || ""}${groups[1] ? ` ${groups[1]}` : ""}${groups[2] ? `-${groups[2]}` : ""}${groups[3] ? `-${groups[3]}` : ""}`;
};

export default function SetsLanding() {
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });
  const [selectedBundle, setSelectedBundle] = useState<ResolvedBundle | null>(
    null,
  );
  const [form, setForm] = useState({
    name: "",
    phone: "",
    telegram: "",
    method: "pickup",
    portioning: false,
    consent: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const visibleBundles = useMemo(
    () =>
      bundles
        .map((bundle) => ({
          ...bundle,
          products: bundle.productIds
            .map((id) => products.find((product) => product.id === id))
            .filter(
              (product): product is Product => !!product && !product.outOfStock,
            ),
        }))
        .filter((bundle) => bundle.isCustom || bundle.products.length >= 2),
    [products],
  );

  useEffect(() => {
    trackEvent(METRIKA_GOALS.setsLandingViewed);
    document.title = "Наборы чая - Пуэр Паб";
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const previous = meta?.content;
    meta?.setAttribute(
      "content",
      "Готовые наборы чая от Пуэр Паб: для знакомства, спокойного вечера и пуэрного стола.",
    );
    return () => {
      if (meta && previous) meta.content = previous;
    };
  }, []);

  const openOrder = (bundle: ResolvedBundle) => {
    trackEvent(METRIKA_GOALS.setsCtaClick, { bundle: bundle.id });
    trackEvent(METRIKA_GOALS.setsAddedToCart, { bundle: bundle.id });
    setSelectedBundle(bundle);
    setSubmitted(false);
    setFormError("");
  };
  const submitOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBundle) return;
    if (!form.consent) {
      setFormError("Нужно согласие на обработку данных.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const total = selectedBundle.products.reduce(
        (sum, product) => sum + priceFor(product, selectedBundle.portionGrams),
        0,
      );
      const orderText = selectedBundle.isCustom
        ? "Индивидуальный набор: клиент хочет собрать состав с чайным мастером."
        : `Набор «${selectedBundle.title}» · ${total.toLocaleString("ru-RU")} ₽. Состав: ${selectedBundle.products.map((product) => `${product.name} ${selectedBundle.portionGrams} г`).join(", ")}.`;
      const response = await fetch("/api/landing/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          telegram: form.telegram || null,
          guests: 1,
          variant: "gift",
          consent: true,
          comment: `${orderText} Получение: ${form.method === "delivery" ? "доставка" : "самовывоз"}. Фасовка в порционные пакетики: ${form.portioning ? "да, для подходящих чаёв" : "нет"}.`,
        }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ||
            "Не удалось отправить заявку",
        );
      trackEvent(METRIKA_GOALS.setsOrderSubmitted, {
        bundle: selectedBundle.id,
        method: form.method,
      });
      setSubmitted(true);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Не удалось отправить заявку",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sets-page">
      <header className="sets-nav">
        <Link href="/" className="sets-brand">
          Пуэр Паб
        </Link>
        <a href="#sets" className="sets-nav-link">
          Наборы
        </a>
        <Link href="/ceremony" className="sets-nav-link">
          Чайная церемония
        </Link>
      </header>
      <main>
        <section className="sets-hero">
          <div className="sets-hero-inner">
            <p className="sets-kicker">Пуэр Паб · Электросталь</p>
            <h1>
              Чайный набор,
              <br />
              <em>который легко</em>
              <br />
              заваривать дома.
            </h1>
            <p>
              Два готовых набора без сложного выбора. Начните с понятных вкусов,
              а мы поможем с каждым шагом.
            </p>
            <div className="sets-primary-wrap">
              <a className="sets-primary" href="#sets" onClick={() => trackEvent(METRIKA_GOALS.setsHeroCtaClick)}>
                <ShoppingBag size={18} />
                Выбрать набор
              </a>
            </div>
          </div>
          <div className="sets-hero-box">
            <img
              src={BOX_IMAGE}
              alt="Чайный набор Пуэр Паб в коробке с горным пейзажем"
            />
            <span>15 × 15 см</span>
          </div>
        </section>
        <section className="sets-portioning">
          <p className="sets-kicker">Легко заварить</p>
          <h2>Разложим чай по пакетикам.</h2>
          <span>Для кружки или чайника</span>
        </section>
        <section id="sets" className="sets-grid-wrap">
          <div className="sets-section-head">
            <div>
              <p className="sets-kicker">Готовые наборы</p>
              <h2>Выберите размер или соберите свой</h2>
            </div>
          <p>Состав и цена сверяются с наличием в каталоге.</p>
          </div>
          {isLoading ? (
            <div className="sets-loading">
              <Loader2 className="animate-spin" />
              Собираем наборы
            </div>
          ) : (
            <div className="sets-grid">
              {visibleBundles.map((bundle) => {
                const total = bundle.products.reduce(
                  (sum, product) =>
                    sum + priceFor(product, bundle.portionGrams),
                  0,
                );
                return (
                  <article className="sets-card" key={bundle.id}>
                    <div className="sets-card-image">
                      <span>{bundle.label}</span>
                      <strong>
                        {bundle.isCustom
                          ? "вместе"
                          : `${bundle.products.length} чаёв`}
                      </strong>
                      <small>
                        {bundle.isCustom
                          ? "с чайным мастером"
                          : `по ${bundle.portionGrams} г`}
                      </small>
                    </div>
                    <div className="sets-card-body">
                      <h3>{bundle.title}</h3>
                      <p>{bundle.lead}</p>
                      <ul>
                        {bundle.isCustom ? (
                          <>
                            <li>
                              <Check size={15} />
                              Подберём вкусы
                            </li>
                            <li>
                              <Check size={15} />
                              Учтём бюджет
                            </li>
                            <li>
                              <Check size={15} />
                              Подскажем, как заварить
                            </li>
                          </>
                        ) : (
                          bundle.products.map((product) => (
                            <li key={product.id}>
                              <Check size={15} />
                              {product.name} · {bundle.portionGrams} г
                            </li>
                          ))
                        )}
                      </ul>
                      <div className="sets-card-bottom">
                        <div>
                          <small>{bundle.note}</small>
                          <strong>
                            {bundle.isCustom
                              ? "По запросу"
                              : `${total.toLocaleString("ru-RU")} ₽`}
                          </strong>
                        </div>
                        <Button onClick={() => openOrder(bundle)}>
                          Выбрать <ChevronRight size={17} />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <section className="sets-note">
          <Sparkles size={22} />
          <div>
            <h2>Не знаете, что выбрать?</h2>
            <p>
              Напишите, какое настроение хочется получить. Подберём другой набор
              вручную.
            </p>
          </div>
          <a href="https://t.me/puerpub" target="_blank" rel="noreferrer">
            Написать в Telegram
          </a>
        </section>
      </main>
      <footer className="sets-footer">
        <span>Пуэр Паб · проспект Ленина, 40/8</span>
        <Link href="/">Весь каталог</Link>
      </footer>
      <Dialog
        open={!!selectedBundle}
        onOpenChange={(open) => !open && setSelectedBundle(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {submitted ? "Заявка принята" : "Оформить набор"}
            </DialogTitle>
          </DialogHeader>
          {submitted ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Мы уточним способ получения, фасовку и подтвердим заказ по
                телефону.
              </p>
              <Button
                className="w-full"
                onClick={() => setSelectedBundle(null)}
              >
                Готово
              </Button>
            </div>
          ) : (
            selectedBundle && (
              <form onSubmit={submitOrder} className="space-y-4">
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="font-medium">{selectedBundle.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedBundle.isCustom
                      ? "Состав и бюджет подберём вместе."
                      : selectedBundle.products
                          .map((product) => product.name)
                          .join(" · ")}
                  </p>
                  <p className="mt-2 font-serif text-xl">
                    {selectedBundle.isCustom
                      ? "По запросу"
                      : `${selectedBundle.products.reduce((sum, product) => sum + priceFor(product, selectedBundle.portionGrams), 0).toLocaleString("ru-RU")} ₽`}
                  </p>
                </div>
                <Label className="grid gap-1.5 text-sm">
                  Как вас зовут
                  <Input
                    autoFocus
                    required
                    minLength={2}
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                </Label>
                <Label className="grid gap-1.5 text-sm">
                  Телефон
                  <Input
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+7 999 123-45-67"
                    maxLength={18}
                    value={form.phone}
                    onFocus={() => !form.phone && setForm({ ...form, phone: "+7" })}
                    onChange={(event) => setForm({ ...form, phone: formatRussianPhone(event.target.value) })}
                  />
                </Label>
                <Label className="grid gap-1.5 text-sm">
                  Telegram{" "}
                  <span className="font-normal text-muted-foreground">
                    необязательно
                  </span>
                  <Input
                    placeholder="@username"
                    value={form.telegram}
                    onChange={(event) =>
                      setForm({ ...form, telegram: event.target.value })
                    }
                  />
                </Label>
                <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.portioning}
                    onChange={(event) =>
                      setForm({ ...form, portioning: event.target.checked })
                    }
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    <b>Разложить по пакетикам</b>
                    <br />
                    <span className="text-muted-foreground">
                      Подходящие чаи вручную подготовим для простой заварки.
                    </span>
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={form.method === "pickup" ? "default" : "outline"}
                    onClick={() => setForm({ ...form, method: "pickup" })}
                  >
                    Самовывоз
                  </Button>
                  <Button
                    type="button"
                    variant={form.method === "delivery" ? "default" : "outline"}
                    onClick={() => setForm({ ...form, method: "delivery" })}
                  >
                    Доставка
                  </Button>
                </div>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(event) =>
                      setForm({ ...form, consent: event.target.checked })
                    }
                    className="mt-0.5 accent-primary"
                  />
                  Согласен на обработку данных и связь по заказу.
                </label>
                {formError && (
                  <p className="text-sm text-destructive">{formError}</p>
                )}
                <Button className="w-full" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Отправить заявку"
                  )}
                </Button>
              </form>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
