import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAntiDetection } from "./utils/obfuscation";

// Inicializar protecciones anti-detección
initAntiDetection();

// Delay aleatorio antes de renderizar
const renderDelay = Math.floor(Math.random() * 200) + 50;
setTimeout(() => {
  createRoot(document.getElementById("root")!).render(<App />);
}, renderDelay);
