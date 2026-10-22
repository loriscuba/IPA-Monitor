import type { Livello } from "../dati";

const TESTO: Record<Livello, string> = {
  ok: "Operativo",
  attenzione: "Attenzione",
  critico: "Problemi",
  assente: "Nessun dato",
};
const ICONA: Record<Livello, string> = { ok: "✓", attenzione: "!", critico: "✕", assente: "–" };

/** Stato sempre con icona + testo, mai solo colore. */
export function Stato({ livello, testo }: { livello: Livello; testo?: string }) {
  return (
    <span className={`stato stato-${livello}`}>
      <span className="stato-icona" aria-hidden>
        {ICONA[livello]}
      </span>
      {testo ?? TESTO[livello]}
    </span>
  );
}
