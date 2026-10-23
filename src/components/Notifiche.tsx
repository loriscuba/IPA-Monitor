import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type Stato = "non-supportate" | "spente" | "attive" | "bloccate" | "attendo";

// La chiave VAPID pubblica arriva in base64url, pushManager la vuole in byte.
function byte(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

// Bottone nella barra: iscrive questo dispositivo alle notifiche delle criticità.
// Su iPhone funziona solo con l'app aggiunta alla schermata Home.
export function Notifiche() {
  const [stato, setStato] = useState<Stato>("attendo");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStato("non-supportate");
      return;
    }
    if (Notification.permission === "denied") return setStato("bloccate");
    navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => setStato(s ? "attive" : "spente"))
      .catch(() => setStato("spente"));
  }, []);

  async function attiva() {
    setStato("attendo");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setStato("bloccate");
      const { data } = await supabase.from("impostazioni").select("valore").eq("chiave", "vapid_public").single();
      if (!data) throw new Error("chiave notifiche non ancora pronta");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: byte(data.valore) }));
      const j = sub.toJSON();
      const { error } = await supabase.from("iscrizioni_push").upsert({
        endpoint: sub.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth,
        dispositivo: navigator.userAgent.slice(0, 200), benvenuto_il: null,
      });
      if (error) throw error;
      setStato("attive");
    } catch (e) {
      alert(`Notifiche non attivate: ${e instanceof Error ? e.message : e}`);
      setStato("spente");
    }
  }

  async function disattiva() {
    setStato("attendo");
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (sub) {
      await supabase.from("iscrizioni_push").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setStato("spente");
  }

  if (stato === "non-supportate") return null;
  if (stato === "bloccate") return <span className="muto piccolo" title="Riattivale dalle impostazioni del telefono">🔕 bloccate</span>;
  return (
    <button className="secondario" disabled={stato === "attendo"} onClick={stato === "attive" ? disattiva : attiva}
      title={stato === "attive" ? "Notifiche attive su questo dispositivo: tocca per spegnerle" : "Ricevi le criticità su questo dispositivo"}>
      {stato === "attive" ? "🔔" : "🔕 Notifiche"}
    </button>
  );
}
