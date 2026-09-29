"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TONOS, TONO_POR_DEFECTO } from "@/lib/tonos";
import Particulas from "./Particulas";

const MAX_HISTORIAL = 3;
const LADO_MAXIMO = 1600; // px: reducimos la imagen antes de enviarla para ganar velocidad

const REDES = [
  {
    nombre: "LinkedIn",
    url: "https://www.linkedin.com/in/josebaenalopez/",
    icono:
      "M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z",
  },
  {
    nombre: "GitHub",
    url: "https://github.com/JoseBaena97",
    icono:
      "M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3z",
  },
];

// Redimensiona y recomprime en el navegador. Si el navegador no puede decodificar
// el formato (p. ej. HEIC fuera de Safari), se envía el archivo original.
async function prepararImagen(archivo) {
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return { blob, preview: canvas.toDataURL("image/jpeg", 0.7) };
  } catch {
    return { blob: archivo, preview: URL.createObjectURL(archivo) };
  }
}

export default function Home() {
  const [imagen, setImagen] = useState(null); // { blob, preview, nombre }
  const [tono, setTono] = useState(TONO_POR_DEFECTO);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [historial, setHistorial] = useState([]);
  const inputRef = useRef(null);

  const cargarArchivo = useCallback(async (archivo) => {
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) {
      setError("Eso no parece una imagen. Prueba con JPG, PNG, WEBP o HEIC.");
      return;
    }
    setError("");
    setResultado(null);
    const { blob, preview } = await prepararImagen(archivo);
    setImagen({ blob, preview, nombre: archivo.name || "imagen pegada" });
  }, []);

  // Permite pegar una imagen del portapapeles (Ctrl+V), ideal para capturas de bugs.
  useEffect(() => {
    const alPegar = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
      if (item) cargarArchivo(item.getAsFile());
    };
    window.addEventListener("paste", alPegar);
    return () => window.removeEventListener("paste", alPegar);
  }, [cargarArchivo]);

  const analizar = async () => {
    if (!imagen || cargando) return;
    setCargando(true);
    setError("");
    setResultado(null);

    const formData = new FormData();
    formData.append("imagen", imagen.blob, imagen.nombre);
    formData.append("tono", tono);

    try {
      const res = await fetch("/api/analizar", { method: "POST", body: formData });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error || "Error desconocido");
      setResultado(datos);
      setHistorial((h) =>
        [{ id: crypto.randomUUID(), preview: imagen.preview, resultado: datos }, ...h].slice(0, MAX_HISTORIAL)
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const restaurar = (entrada) => {
    setImagen({ blob: null, preview: entrada.preview, nombre: entrada.resultado.titulo });
    setResultado(entrada.resultado);
    setTono(entrada.resultado.tono);
    setError("");
  };

  const alSoltar = (e) => {
    e.preventDefault();
    setArrastrando(false);
    cargarArchivo(e.dataTransfer.files?.[0]);
  };


  return (
    <div className="flex min-h-screen flex-col">
      <Particulas activo={cargando} />
      <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/70 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="" className="h-6 w-6 rounded-md" />
            <span className="text-sm font-semibold tracking-tight">AIdentity</span>
          </div>
          <div className="flex items-center gap-4">
            <Redes />
            <BotonTema />
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:py-20">
        <header className="mb-12 max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Clasifica cualquier imagen con IA.</h1>
          <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400">
            Sube una foto y un modelo multimodal la etiqueta, la describe y te da su opinión.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Columna izquierda: entrada */}
          <section className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={alSoltar}
              className={`relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl border transition-colors ${
                arrastrando
                  ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-900"
                  : imagen
                    ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                    : "border-dashed border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
              }`}
            >
              {imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagen.preview} alt="Vista previa" className="h-full w-full object-contain" />
              ) : (
                <div className="px-6 text-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mx-auto mb-4 h-8 w-8 text-zinc-400"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                  <p className="text-sm font-medium">Arrastra una imagen o haz clic</p>
                  <p className="mt-1 text-sm text-zinc-500">También puedes pegarla con Ctrl+V</p>
                </div>
              )}
              {cargando && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
                  <p className="text-sm text-zinc-500">Analizando…</p>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  cargarArchivo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div
                role="radiogroup"
                aria-label="Tono del comentario"
                className="grid flex-1 grid-cols-3 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900"
              >
                {Object.entries(TONOS).map(([clave, { etiqueta }]) => (
                  <button
                    key={clave}
                    role="radio"
                    aria-checked={tono === clave}
                    onClick={() => setTono(clave)}
                    className={`rounded-md px-2 py-1.5 text-sm transition ${
                      tono === clave
                        ? "bg-white font-medium shadow-sm dark:bg-zinc-800"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
              <button
                onClick={analizar}
                disabled={!imagen?.blob || cargando}
                className="h-10 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-30 sm:h-auto dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {cargando ? "Analizando…" : "Analizar"}
              </button>
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {error}
              </p>
            )}

            {historial.length > 0 && (
              <div className="pt-4">
                <h2 className="mb-3 text-sm text-zinc-500">Recientes</h2>
                <div className="grid grid-cols-3 gap-3">
                  {historial.map((entrada) => (
                    <button
                      key={entrada.id}
                      onClick={() => restaurar(entrada)}
                      className={`overflow-hidden rounded-lg border text-left transition ${
                        resultado === entrada.resultado
                          ? "border-zinc-900 dark:border-zinc-100"
                          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entrada.preview} alt="" className="aspect-square w-full object-cover" />
                      <p className="truncate px-2 py-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        {entrada.resultado.titulo}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Columna derecha: resultado */}
          <section className="min-h-[300px] rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-950">
            {resultado ? (
              <Resultado datos={resultado} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-sm font-medium">Sin resultados todavía</p>
                <p className="mt-1 max-w-xs text-sm text-zinc-500">
                  Prueba con un plato de comida, un paisaje, un meme o la captura de un bug.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white/70 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-zinc-500 sm:flex-row">
          <p>Hecho por Jose Baena</p>
          <p>Next.js · Tailwind CSS · Google Gemini</p>
        </div>
      </footer>
    </div>
  );
}

function BotonTema() {
  const [oscuro, setOscuro] = useState(false);

  // El tema real lo fija el script de layout.jsx antes de hidratar; aquí solo lo leemos.
  useEffect(() => setOscuro(document.documentElement.classList.contains("dark")), []);

  const alternar = () => {
    const nuevo = !oscuro;
    setOscuro(nuevo);
    document.documentElement.classList.toggle("dark", nuevo);
    try {
      localStorage.setItem("tema", nuevo ? "oscuro" : "claro");
    } catch {}
  };

  return (
    <button
      onClick={alternar}
      aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={oscuro ? "Tema claro" : "Tema oscuro"}
      className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        {oscuro ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </>
        ) : (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        )}
      </svg>
    </button>
  );
}

function Redes() {
  return (
    <div className="flex items-center gap-4">
      {REDES.map(({ nombre, url, icono }) => (
        <a
          key={nombre}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={nombre}
          title={nombre}
          className="text-zinc-400 transition hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d={icono} />
          </svg>
        </a>
      ))}
    </div>
  );
}

function Resultado({ datos }) {
  const confianza = Math.round((datos.confianza ?? 0) * 100);

  return (
    <article className="space-y-6">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 font-medium capitalize dark:border-zinc-700">
          {datos.categoria}
        </span>
        <div className="flex items-center gap-2 text-zinc-500" title="Confianza de la clasificación">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${confianza}%` }} />
          </div>
          <span className="font-mono">{confianza}%</span>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{datos.titulo}</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{datos.descripcion}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {datos.etiquetas.map((etiqueta) => (
            <span
              key={etiqueta}
              className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
            >
              {etiqueta}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="mb-2 text-xs font-medium text-zinc-500">{TONOS[datos.tono]?.etiqueta}</h3>
        <p className="text-lg leading-relaxed">“{datos.comentario}”</p>
      </div>

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="mb-2 text-xs font-medium text-zinc-500">Análisis técnico</h3>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{datos.analisisTecnico}</p>
      </div>

      <p className="font-mono text-[11px] text-zinc-400">{datos.modelo}</p>
    </article>
  );
}
