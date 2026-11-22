import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { conexionConfigurada } from "./lib/supabase";
import Layout from "./components/Layout";
import Portada from "./pages/Portada";
import Login from "./pages/Login";
import Cargar from "./pages/Cargar";
import PortadaDatos from "./pages/PortadaDatos";
import PaginaFamilia from "./pages/PaginaFamilia";
import Resumen from "./pages/Resumen";
import Mensual from "./pages/Mensual";
import { ModeloProvider, MODO_LOCAL } from "./datos/ModeloProvider";
import { FiltrosProvider } from "./components/Filtros";
import { EQUIPOS_POR_PAGINA } from "./medidas/contexto";

// La galería de componentes es solo para desarrollo: no entra al paquete de producción.
const Galeria = import.meta.env.DEV ? lazy(() => import("./pages/Galeria")) : null;

const TITULO_DISP = "DISPONIBILIDADES";
const TITULO_RESUMEN = "DISIPONIBILIDAD-MTTR-MTBF (Z4 NPI MEC-ELC)"; // con la errata del reporte original

// Datos y filtros se cargan una vez y se comparten entre las páginas del tablero.
function Tablero() {
  return (
    <ModeloProvider>
      <FiltrosProvider>
        <Outlet />
      </FiltrosProvider>
    </ModeloProvider>
  );
}

// Las ST3.5 y ST1030 muestran en la tabla los paros de los 8 scoops (contrato, sección 7).
const SCOOPS = [...EQUIPOS_POR_PAGINA.st35, ...EQUIPOS_POR_PAGINA.st1030];

const PAGINAS_FAMILIA = [
  { ruta: "/simba", titulo: "Tiro Largo", grafico: EQUIPOS_POR_PAGINA.simba, tabla: EQUIPOS_POR_PAGINA.simba },
  { ruta: "/jumbo", titulo: "Perforación Mecánizada", grafico: EQUIPOS_POR_PAGINA.jumbo, tabla: EQUIPOS_POR_PAGINA.jumbo },
  { ruta: "/sostenimiento", titulo: "Equipos de Sostenimiento", grafico: EQUIPOS_POR_PAGINA.sostenimiento, tabla: EQUIPOS_POR_PAGINA.sostenimiento },
  { ruta: "/st35", titulo: "Cargadoras Bajo Perfil", grafico: EQUIPOS_POR_PAGINA.st35, tabla: SCOOPS },
  { ruta: "/st1030", titulo: "Cargadoras Bajo Perfil", grafico: EQUIPOS_POR_PAGINA.st1030, tabla: SCOOPS },
];

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
  if (!conexionConfigurada && !MODO_LOCAL) return <SinConexion />;
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Tablero />}>
          <Route path="/" element={<Layout><PortadaDatos /></Layout>} />
          {PAGINAS_FAMILIA.map((p) => (
            <Route
              key={p.ruta}
              path={p.ruta}
              element={
                <Layout titulo={TITULO_DISP} amplio>
                  <PaginaFamilia key={p.ruta} titulo={p.titulo} equiposGrafico={p.grafico} equiposTabla={p.tabla} />
                </Layout>
              }
            />
          ))}
          <Route path="/resumen" element={<Layout titulo={TITULO_RESUMEN} amplio><Resumen /></Layout>} />
          <Route path="/mensual" element={<Layout titulo={TITULO_DISP} amplio><Mensual /></Layout>} />
        </Route>
        {Galeria && (
          <Route
            path="/galeria"
            element={
              <Layout titulo="Galería de componentes" amplio>
                <Suspense fallback={<p className="cargando">Cargando…</p>}>
                  <Galeria />
                </Suspense>
              </Layout>
            }
          />
        )}
        <Route path="/login" element={<Layout titulo="Ingresar"><Login /></Layout>} />
        <Route path="/cargar" element={<RutaCargar />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
