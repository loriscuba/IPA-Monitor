import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./stile.css";

// Service worker: rende l'app installabile sul telefono (solo nella build pubblicata).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
