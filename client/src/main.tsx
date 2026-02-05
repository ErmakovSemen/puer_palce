import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./register-sw";
import { initAnalytics } from "./lib/analytics";

createRoot(document.getElementById("root")!).render(<App />);

registerServiceWorker();

// Инициализация системы аналитики
initAnalytics();
console.log("✅ Analytics initialized");
