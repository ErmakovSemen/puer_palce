import { useMemo, useState } from "react";
import { Check, Gift, Loader2, Send, Sparkles, Trophy } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { venue } from "@/lib/landingConfigs";
import { trackEvent } from "@/lib/metrics";
import "@/styles/city-day.css";

type Action = "gift" | "quiz";
type RegistrationActivity = Action | "registration";

const QUIZ = [
  { question: "Из какого растения получают зелёный, белый, чёрный чай и улуны?", options: ["Из камелии китайской", "Из мяты", "Из гибискуса"], answer: 0 },
  { question: "Что сильнее всего меняет вкус заварки?", options: ["Температура воды", "Цвет чашки", "Размер чайника"], answer: 0 },
  { question: "Какой чай заваривают короткими проливами?", options: ["Китайский листовой", "Растворимый", "Пакетированный"], answer: 0 },
  { question: "Как выбрать чай по вкусу?", options: ["Рассказать, что люблю", "Выбрать самый дорогой", "Заварить всё кипятком"], answer: 0 },
  { question: "Зачем прогревают посуду перед завариванием?", options: ["Чтобы тепло держалось ровнее", "Только для красоты", "Чтобы чай стал слаще"], answer: 0 },
] as const;

function formatRussianPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("7") || digits.startsWith("8")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (!digits) return "";
  let formatted = `+7 (${digits.slice(0, 3)}`;
  if (digits.length >= 3) formatted += ")";
  if (digits.length > 3) formatted += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) formatted += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) formatted += `-${digits.slice(8, 10)}`;
  return formatted;
}

function isCompleteRussianPhone(value: string) {
  return /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(value);
}

export default function CityDayLanding() {
  const [selected, setSelected] = useState<Action | null>(null);
  const [registered, setRegistered] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [vk, setVk] = useState(false);
  const [telegram, setTelegram] = useState(false);
  const [giftDone, setGiftDone] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizDone, setQuizDone] = useState(false);
  const [pending, setPending] = useState<RegistrationActivity | null>(null);
  const [error, setError] = useState("");

  const score = useMemo(
    () => answers.reduce((sum, answer, index) => sum + (answer === QUIZ[index]?.answer ? 1 : 0), 0),
    [answers],
  );

  const select = (action: Action) => {
    setSelected(action);
    setError("");
    if (!registered) {
      requestAnimationFrame(() => {
        document.getElementById("city-day-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  };

  const validProfile = () => {
    if (!name.trim() || !phone.trim() || !consent) {
      setError("Укажите имя, номер и согласие для участия.");
      return false;
    }
    if (!isCompleteRussianPhone(phone)) {
      setError("Введите номер полностью: +7 (999) 123-45-67.");
      return false;
    }
    return true;
  };

  const save = async (activity: RegistrationActivity, quizScore?: number) => {
    setError("");
    setPending(activity);
    try {
      const response = await apiRequest("POST", "/api/day-city/registrations", {
        name: name.trim(), phone: phone.trim(), activity, subscribedVk: vk,
        subscribedTelegram: telegram, quizScore, consent, website: "",
      });
      await response.json();
      trackEvent(`city_day_${activity}`, { quiz_score: quizScore });
      return true;
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "";
      setError(
        message === "Not Found"
          ? "Сейчас открыт только предпросмотр страницы: регистрация заработает после публикации."
          : message || "Не удалось сохранить регистрацию",
      );
      return false;
    } finally {
      setPending(null);
    }
  };

  const register = async () => {
    if (!validProfile()) return;
    if (await save("registration")) setRegistered(true);
  };

  const registerGift = async () => {
    if (!vk || !telegram) {
      setError("Для подарка подтвердите подписку на VK и Telegram.");
      return;
    }
    if (await save("gift")) setGiftDone(true);
  };

  const answerQuestion = async (answer: number) => {
    const next = [...answers, answer];
    if (quizIndex < QUIZ.length - 1) {
      setAnswers(next);
      setQuizIndex((value) => value + 1);
      return;
    }
    const nextScore = next.reduce((sum, selectedAnswer, index) => sum + (selectedAnswer === QUIZ[index]?.answer ? 1 : 0), 0);
    setAnswers(next);
    if (await save("quiz", nextScore)) setQuizDone(true);
  };

  return (
    <main className="city-day-page">
      <div className="city-day-shell">
        <header><a className="city-day-logo" href="/">Пуэр Паб <span>茶</span></a><span>День города</span></header>
        <section className="city-day-hero">
          <p>Электросталь · День города</p>
          <h1>Чайный подарок<br />и <em>квиз</em></h1>
          <img
            className="city-day-mascot"
            src="/mascot/red-panda-tea-master-v1.png"
            alt="Красная панда — чайный мастер Пуэр Паба"
          />
          <div className="city-day-actions">
            <button onClick={() => select("gift")} className="city-day-choice city-day-choice-gift"><Gift size={24} /><strong>Розыгрыш подарков</strong><small>Подписка → чайный пробник</small></button>
            <button onClick={() => select("quiz")} className="city-day-choice"><Sparkles size={24} /><strong>Чайный квиз</strong><small>5 вопросов → приз за знания</small></button>
          </div>
        </section>

        <section id="city-day-form" className="city-day-card">
          {!registered ? <>
            <h2>{selected === "quiz" ? "Регистрация для квиза" : selected === "gift" ? "Регистрация для подарка" : "Регистрация"}</h2>
            <div className="city-day-fields"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Как вас зовут" autoComplete="name" /><input value={phone} onChange={(event) => setPhone(formatRussianPhone(event.target.value))} placeholder="+7 (999) 123-45-67" type="tel" inputMode="tel" autoComplete="tel" maxLength={18} aria-invalid={phone.length > 0 && !isCompleteRussianPhone(phone)} /></div>
            <label className="city-day-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Согласен на обработку номера для участия в акции</label>
            {error && <p className="city-day-error" role="alert">{error}</p>}
            <button onClick={register} disabled={pending !== null} className="city-day-submit">{pending === "registration" ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} {selected === "quiz" ? "Зарегистрироваться и начать квиз" : selected === "gift" ? "Зарегистрироваться и получить подарок" : "Зарегистрироваться"}</button>
          </> : selected === "gift" ? <>
            {giftDone ? <div className="city-day-result"><Check size={26} /><div><strong>Готово</strong><span>Покажите этот экран бариста и заберите пробник.</span></div><button onClick={() => select("quiz")}>Пройти квиз</button></div> : <><h2>Подарок за подписку</h2><div className="city-day-subscription"><span>Подпишитесь на нас</span><label><input type="checkbox" checked={vk} onChange={(event) => setVk(event.target.checked)} /> VK</label><label><input type="checkbox" checked={telegram} onChange={(event) => setTelegram(event.target.checked)} /> Telegram</label></div>{error && <p className="city-day-error" role="alert">{error}</p>}<button onClick={registerGift} disabled={pending !== null} className="city-day-submit">{pending === "gift" ? <Loader2 className="animate-spin" size={18} /> : <Gift size={18} />} Получить подарок</button></>}
          </> : selected === "quiz" ? <>
            {quizDone ? <div className="city-day-result"><Trophy size={26} /><div><strong>{score >= 4 ? `${score}/5 — приз ваш` : `${score}/5 — спасибо за игру`}</strong><span>{score >= 4 ? "Покажите экран бариста." : "Попробуйте чайный пробник за подписку."}</span></div></div> : <div className="city-day-question"><p>{quizIndex + 1} / {QUIZ.length}</p><h3>{QUIZ[quizIndex].question}</h3>{QUIZ[quizIndex].options.map((option, index) => <button key={option} onClick={() => answerQuestion(index)} disabled={pending !== null}>{option}</button>)}</div>}
          </> : <div className="city-day-result"><Check size={26} /><div><strong>Вы зарегистрированы</strong><span>Теперь выберите подарок или квиз выше.</span></div></div>}
        </section>

        <footer><span>Подписка нужна для участия в розыгрыше.</span><div><a href={venue.vkHref} target="_blank" rel="noreferrer" aria-label="ВКонтакте">VK</a><a href={venue.telegramHref} target="_blank" rel="noreferrer" aria-label="Telegram"><Send size={18} /></a></div></footer>
      </div>
    </main>
  );
}
