import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { conexionConfigurada } from "./lib/supabase";
import Layout from "./components/Layout";
import Portada from "./pages/Portada";
import Login from "./pages/Login";
import Cargar from "./pages/Cargar";
import Simba from "./pages/Simba";
import Jumbo from "./pages/Jumbo";
import Sostenimiento from "./pages/Sostenimiento";
import St35 from "./pages/St35";
import St1030 from "./pages/St1030";
import Resumen from "./pages/Resumen";
import Mensual from "./pages/Mensual";

// Ruta "/cargar": solo administradores. Sin sesión de admin, va a /login.
function RutaCargar() {
  const { cargando, esAdmin } = useAuth();
  if (cargando) return <p className="cargando">Cargando…</p>;
  if (!esAdmin) return <Navigate to="/login" replace />;
  return (
    <Layout titulo="Cargar datos">
      <Cargar />
    </Layout>
  );
}

function SinConexion() {
  return (
    <div className="pantalla-centro">
      <div className="tarjeta">
        <h1>Falta configurar la conexión a Supabase</h1>
        <p className="nota">
          Defina las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY al compilar la aplicación.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!conexionConfigurada) return <SinConexion />;
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Layout><Portada /></Layout>} />
        <Route path="/simba" element={<Layout titulo="Simba"><Simba /></Layout>} />
        <Route path="/jumbo" element={<Layout titulo="Jumbo"><Jumbo /></Layout>} />
        <Route path="/sostenimiento" element={<Layout titulo="Sostenimiento"><Sostenimiento /></Layout>} />
        <Route path="/st35" element={<Layout titulo="ST 35"><St35 /></Layout>} />
        <Route path="/st1030" element={<Layout titulo="ST 1030"><St1030 /></Layout>} />
        <Route path="/resumen" element={<Layout titulo="Resumen"><Resumen /></Layout>} />
        <Route path="/mensual" element={<Layout titulo="Mensual"><Mensual /></Layout>} />
        <Route path="/login" element={<Layout titulo="Ingresar"><Login /></Layout>} />
        <Route path="/cargar" element={<RutaCargar />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
