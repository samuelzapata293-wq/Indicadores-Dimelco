import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { clienteSupabase } from "../lib/supabase";

export default function Login() {
  const navegar = useNavigate();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const { error } = await clienteSupabase().auth.signInWithPassword({
        email: correo.trim(),
        password: clave,
      });
      if (error) {
        setError("Correo o contraseña incorrectos");
      } else {
        navegar("/", { replace: true });
      }
    } catch {
      setError("No se pudo conectar. Intente de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <form className="tarjeta" onSubmit={entrar}>
      <p className="nota" style={{ marginBottom: 14 }}>
        Ingrese con su correo y contraseña. Sin sesión, la aplicación solo permite consultar.
      </p>
      <label className="campo">
        <span>Correo</span>
        <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoFocus required />
      </label>
      <label className="campo">
        <span>Contraseña</span>
        <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} required />
      </label>
      {error && <div className="error-texto" role="alert">{error}</div>}
      <button className="boton" style={{ marginTop: 10, width: "100%" }} disabled={cargando}>
        {cargando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
