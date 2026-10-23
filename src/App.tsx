import { useEffect, useState } from "react";
import { HashRouter, Link, Route, Routes } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Progetto } from "./pages/Progetto";
import { Notifiche } from "./components/Notifiche";

export function App() {
  const [sessione, setSessione] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessione(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessione(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (sessione === undefined) return null;
  if (!sessione) return <Login />;

  return (
    <HashRouter>
      <header className="barra">
        <Link to="/" className="marchio">
          <img src="icone/favicon.png" alt="" width={28} height={28} />
          IPA Monitor
        </Link>
        <span className="muto piccolo nascondi-mobile">{sessione.user.email}</span>
        <Notifiche />
        <button className="secondario" onClick={() => supabase.auth.signOut()}>
          Esci
        </button>
      </header>
      <main className="contenuto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/progetto/:id" element={<Progetto />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
