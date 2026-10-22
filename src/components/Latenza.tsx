import { useState } from "react";
import type { Controllo } from "../dati";

const L = 320;
const H = 56;
const M = 4;

/** Andamento della latenza nelle ultime 24 ore; i controlli KO sono segnati sotto la linea. */
export function Latenza({ punti }: { punti: Controllo[] }) {
  const [sel, setSel] = useState<number | null>(null);
  if (punti.length < 2) return <p className="muto piccolo">Storico in arrivo: serve qualche raccolta.</p>;

  const t0 = new Date(punti[0].creato_il).getTime();
  const t1 = new Date(punti[punti.length - 1].creato_il).getTime();
  const max = Math.max(...punti.map((p) => p.latenza_ms ?? 0), 1);
  const x = (p: Controllo) => M + ((new Date(p.creato_il).getTime() - t0) / Math.max(t1 - t0, 1)) * (L - 2 * M);
  const y = (ms: number) => H - M - (ms / max) * (H - 2 * M - 8);

  // La linea si interrompe dove il sito non ha risposto.
  let d = "";
  let su = false;
  for (const p of punti) {
    if (p.ok && p.latenza_ms != null) {
      d += `${su ? "L" : "M"}${x(p).toFixed(1)},${y(p.latenza_ms).toFixed(1)}`;
      su = true;
    } else su = false;
  }

  const muovi = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * L;
    let migliore = 0;
    punti.forEach((p, i) => {
      if (Math.abs(x(p) - px) < Math.abs(x(punti[migliore]) - px)) migliore = i;
    });
    setSel(migliore);
  };
  const p = sel != null ? punti[sel] : null;

  return (
    <div className="latenza">
      <svg
        viewBox={`0 0 ${L} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Latenza ultime 24 ore, massimo ${max} ms`}
        onPointerMove={muovi}
        onPointerLeave={() => setSel(null)}
      >
        <line x1={M} x2={L - M} y1={H - M} y2={H - M} className="asse" />
        <path d={d} className="linea" vectorEffect="non-scaling-stroke" />
        {punti.map((q, i) =>
          q.ok ? null : <rect key={i} x={x(q) - 1.5} y={H - M - 3} width={3} height={3} className="ko" />,
        )}
        {p && <line x1={x(p)} x2={x(p)} y1={M} y2={H - M} className="mirino" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="latenza-info piccolo">
        {p ? (
          <>
            {new Date(p.creato_il).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} ·{" "}
            {p.ok ? `${p.latenza_ms} ms` : "non raggiungibile"}
          </>
        ) : (
          <span className="muto">24 h · max {max} ms</span>
        )}
      </div>
    </div>
  );
}
