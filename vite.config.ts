import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa + HashRouter: funziona su GitHub Pages e su qualunque hosting statico.
export default defineConfig({ base: "./", plugins: [react()] });
