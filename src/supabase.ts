import { createClient } from "@supabase/supabase-js";

// Solo il progetto "Demo IPA" e la sua chiave pubblicabile: i dati degli altri progetti
// arrivano già raccolti dal collettore, quindi nel browser non c'è nessun'altra chiave.
const url = import.meta.env.VITE_SUPABASE_URL ?? "https://exchjppslwhbnbzuhfqs.supabase.co";
const key = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_SxSgB8SFGXBxN2HzQBQfFA_ppbgB_ZT";

export const supabase = createClient(url, key, { db: { schema: "ipamonitor" } });
