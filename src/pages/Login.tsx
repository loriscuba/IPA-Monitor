import { useState } from "react";
import { supabase } from "../supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);

  const entra = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttesa(true);
    setErrore(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErrore(error.message === "Invalid login credentials" ? "Email o password errate." : error.message);
    setAttesa(false);
  };

  return (
    <main className="login">
      <form onSubmit={entra} className="pannello">
        <img src="icone/icona-192.png" alt="IPA Media" width={96} height={96} className="login-logo" />
        <h1>IPA Monitor</h1>
        <p className="muto">Accesso riservato.</p>
        <label>
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {errore && <p className="errore">{errore}</p>}
        <button disabled={attesa}>{attesa ? "Accesso…" : "Entra"}</button>
      </form>
    </main>
  );
}
