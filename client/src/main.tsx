import { createRoot } from "react-dom/client";
import "./index.css";
import { registerServiceWorker } from "./register-sw";
import { initAnalytics } from "./lib/analytics";

const root = createRoot(document.getElementById("root")!);
const isCityDayLanding = window.location.pathname === "/day-city";

// QR-лендинг не должен ждать загрузки всей витрины и админки.
if (isCityDayLanding) {
  root.render(<div className="min-h-screen bg-[#fff9f0]" aria-label="Загружаем квиз" />);
  void import("./pages/CityDayLanding").then(({ default: CityDayLanding }) => {
    root.render(<CityDayLanding />);
  });
} else {
  void import("./App").then(({ default: App }) => {
    root.render(<App />);
  });
}

registerServiceWorker();

// Инициализация системы аналитики
initAnalytics();
console.log("✅ Analytics initialized");
