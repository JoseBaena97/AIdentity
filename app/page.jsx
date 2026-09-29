"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TONOS, TONO_POR_DEFECTO } from "@/lib/tonos";

const MAX_HISTORIAL = 3;
const LADO_MAXIMO = 1600; // px: reducimos la imagen antes de enviarla para ganar velocidad

const ICONOS_CATEGORIA = {
  comida: "🍽️",
  paisaje: "🏞️",
  meme: "😂",
  "captura de pantalla": "🖥️",
  persona: "🧑",
  animal: "🐾",
  objeto: "📦",
  documento: "📄",
  arte: "🖼️",
  otro: "✨",
};

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
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <header className="mb-10 text-center">
        <h1 className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-amber-200 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
          AIdentity
        </h1>
        <p className="mt-3 text-zinc-400">
          Suelta una imagen y una IA multimodal la clasificará, la etiquetará y te dirá lo que piensa de ella.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
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
            className={`relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
              arrastrando
                ? "scale-[1.01] border-fuchsia-400 bg-fuchsia-500/10"
                : "border-zinc-700 bg-zinc-900/60 hover:border-zinc-500"
            }`}
          >
            {imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagen.preview} alt="Vista previa" className="h-full w-full object-contain" />
            ) : (
              <div className="px-6 text-center text-zinc-400">
                <div className="mb-3 text-5xl">📸</div>
                <p className="font-medium text-zinc-200">Arrastra una imagen aquí</p>
                <p className="mt-1 text-sm">o haz clic para elegirla · también puedes pegarla con Ctrl+V</p>
              </div>
            )}
            {cargando && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/70 backdrop-blur-sm">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-fuchsia-400 border-t-transparent" />
                <p className="text-sm text-zinc-300">La IA está mirando tu imagen…</p>
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
            <label className="flex-1">
              <span className="sr-only">Tono del comentario</span>
              <select
                value={tono}
                onChange={(e) => setTono(e.target.value)}
                className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 outline-none focus:border-fuchsia-400"
              >
                {Object.entries(TONOS).map(([clave, { etiqueta }]) => (
                  <option key={clave} value={clave}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={analizar}
              disabled={!imagen?.blob || cargando}
              className="h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {cargando ? "Analizando…" : "Analizar imagen"}
            </button>
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
          )}

          {historial.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Análisis recientes</h2>
              <div className="grid grid-cols-3 gap-3">
                {historial.map((entrada) => (
                  <button
                    key={entrada.id}
                    onClick={() => restaurar(entrada)}
                    className={`group overflow-hidden rounded-xl border bg-zinc-900 text-left transition hover:border-fuchsia-400 ${
                      resultado === entrada.resultado ? "border-fuchsia-400" : "border-zinc-800"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entrada.preview} alt="" className="aspect-square w-full object-cover" />
                    <p className="truncate px-2 py-1.5 text-xs text-zinc-300">
                      {ICONOS_CATEGORIA[entrada.resultado.categoria]} {entrada.resultado.titulo}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Columna derecha: resultado */}
        <section className="min-h-[300px] rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          {resultado ? (
            <Resultado datos={resultado} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
              <div className="mb-3 text-4xl">🤖</div>
              <p>Aquí aparecerá el análisis.</p>
              <p className="mt-1 text-sm">Prueba con un plato de comida, un paisaje, un meme o una captura de un bug.</p>
            </div>
          )}
        </section>
      </div>

      <footer className="mt-12 flex flex-col items-center gap-3 text-xs text-zinc-600">
        <div className="flex items-center gap-4">
          {REDES.map(({ nombre, url, icono }) => (
            <a
              key={nombre}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={nombre}
              title={nombre}
              className="text-zinc-500 transition hover:text-fuchsia-300"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d={icono} />
              </svg>
            </a>
          ))}
        </div>
        <p>By Jose Baena | Next.js · Tailwind CSS · Google Gemini (visión multimodal)</p>
      </footer>
    </main>
  );
}

function Resultado({ datos }) {
  const confianza = Math.round((datos.confianza ?? 0) * 100);

  return (
    <article className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-sm font-medium capitalize text-indigo-200">
          {ICONOS_CATEGORIA[datos.categoria]} {datos.categoria}
        </span>
        <div className="flex items-center gap-2 text-xs text-zinc-400" title="Confianza de la clasificación">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-emerald-400" style={{ width: `${confianza}%` }} />
          </div>
          {confianza}%
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-white">{datos.titulo}</h2>
        <p className="mt-2 text-zinc-400">{datos.descripcion}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {datos.etiquetas.map((etiqueta) => (
          <span key={etiqueta} className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
            #{etiqueta}
          </span>
        ))}
      </div>

      <blockquote className="rounded-xl border-l-4 border-fuchsia-400 bg-fuchsia-500/10 p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-fuchsia-300">
          {TONOS[datos.tono]?.etiqueta}
        </p>
        <p className="italic text-zinc-100">“{datos.comentario}”</p>
      </blockquote>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Análisis técnico</h3>
        <p className="text-sm leading-relaxed text-zinc-300">{datos.analisisTecnico}</p>
      </div>

      <p className="text-right text-[11px] text-zinc-600">Modelo: {datos.modelo}</p>
    </article>
  );
}
