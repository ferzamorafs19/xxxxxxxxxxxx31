import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAntiDetection } from "./utils/obfuscation";
import { StealthMode } from "./utils/stealth";

// Inicializar protecciones anti-detección
initAntiDetection();
StealthMode.initialize();

// Verificar si estamos siendo analizados y activar modo evasivo si es necesario
StealthMode.activateEvasiveMode();

// Delay aleatorio antes de renderizar para simular carga humana
const renderDelay = Math.floor(Math.random() * 200) + 50;
setTimeout(() => {
  createRoot(document.getElementById("root")!).render(<App />);
}, renderDelay);

// Monitoreo continuo contra análisis automatizado
setInterval(() => {
  StealthMode.activateEvasiveMode();
}, 30000); // Verificar cada 30 segundos
