import { GoogleGenAI, Type } from "@google/genai";
import { TONOS, TONO_POR_DEFECTO } from "@/lib/tonos";

// Modelo principal + respaldos: si uno está saturado (503), limitado (429) o no responde,
// se prueba el siguiente de la lista.
const MODELOS = [
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  ...(process.env.GEMINI_FALLBACK_MODELS || "gemini-3.7-flash,gemini-flash-lite-latest").split(","),
]
  .map((m) => m.trim())
  .filter((m, i, lista) => m && lista.indexOf(m) === i);
const TIMEOUT_POR_MODELO = 25_000; // ms
// Errores del cliente que no se arreglan cambiando de modelo (petición inválida, clave incorrecta…)
const ERRORES_NO_REINTENTABLES = [400, 401, 403];
const TAMANO_MAXIMO = 4 * 1024 * 1024; // 4 MB (Vercel limita el body a 4,5 MB)
const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const CATEGORIAS = [
  "comida",
  "paisaje",
  "meme",
  "captura de pantalla",
  "persona",
  "animal",
  "objeto",
  "documento",
  "arte",
  "otro",
];

// Esquema de salida estructurada: Gemini devuelve JSON válido con esta forma.
const ESQUEMA_RESPUESTA = {
  type: Type.OBJECT,
  properties: {
    categoria: { type: Type.STRING, enum: CATEGORIAS },
    titulo: { type: Type.STRING, description: "Título breve y descriptivo (máx. 8 palabras)." },
    etiquetas: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Entre 3 y 6 etiquetas en minúsculas, sin '#'.",
    },
    descripcion: { type: Type.STRING, description: "Descripción objetiva en 1-2 frases." },
    comentario: { type: Type.STRING, description: "Comentario ingenioso en el tono indicado (2-3 frases)." },
    analisisTecnico: {
      type: Type.STRING,
      description:
        "Si es una captura con un error o código: diagnóstico probable y cómo arreglarlo. En otro caso: análisis de composición, luz y encuadre. 2-4 frases.",
    },
    confianza: { type: Type.NUMBER, description: "Confianza en la categoría, de 0 a 1." },
  },
  required: ["categoria", "titulo", "etiquetas", "descripcion", "comentario", "analisisTecnico", "confianza"],
  propertyOrdering: ["categoria", "titulo", "etiquetas", "descripcion", "comentario", "analisisTecnico", "confianza"],
};

function error(mensaje, status) {
  return Response.json({ error: mensaje }, { status });
}

export async function POST(request) {
  if (!process.env.GEMINI_API_KEY) {
    return error("Falta GEMINI_API_KEY en las variables de entorno del servidor.", 500);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return error("La petición debe ser multipart/form-data.", 400);
  }

  const imagen = formData.get("imagen");
  const tono = TONOS[formData.get("tono")] ? formData.get("tono") : TONO_POR_DEFECTO;

  if (!imagen || typeof imagen === "string") {
    return error("No se ha recibido ninguna imagen.", 400);
  }
  if (!TIPOS_PERMITIDOS.includes(imagen.type)) {
    return error(`Formato no soportado (${imagen.type || "desconocido"}). Usa JPG, PNG, WEBP o HEIC.`, 415);
  }
  if (imagen.size > TAMANO_MAXIMO) {
    return error("La imagen supera el máximo de 4 MB.", 413);
  }

  const base64 = Buffer.from(await imagen.arrayBuffer()).toString("base64");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  let ultimoError;
  for (const modelo of MODELOS) {
    try {
      const respuesta = await ai.models.generateContent({
        model: modelo,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: imagen.type, data: base64 } },
              { text: "Analiza esta imagen, clasifícala y coméntala. Responde en español." },
            ],
          },
        ],
        config: {
          systemInstruction: `${TONOS[tono].prompt} El campo "comentario" debe estar escrito con esa personalidad; el resto de campos deben ser precisos y objetivos.`,
          responseMimeType: "application/json",
          responseSchema: ESQUEMA_RESPUESTA,
          temperature: 0.9,
          httpOptions: { timeout: TIMEOUT_POR_MODELO },
        },
      });

      const resultado = JSON.parse(respuesta.text);
      return Response.json({ ...resultado, tono, modelo });
    } catch (e) {
      ultimoError = e;
      console.warn(`Fallo con ${modelo} (${e?.status ?? e?.name}): ${String(e?.message).slice(0, 150)}`);
      if (ERRORES_NO_REINTENTABLES.includes(e?.status)) break;
    }
  }

  console.error("Error al analizar la imagen:", ultimoError);
  if (ultimoError?.status === 401 || ultimoError?.status === 403) {
    return error("La API key de Gemini no es válida o no tiene permisos.", 502);
  }
  if (ultimoError?.status === 429) {
    return error("Se ha alcanzado el límite de peticiones de la API. Espera un momento y vuelve a intentarlo.", 429);
  }
  if (ultimoError?.status === 503) {
    return error("Los modelos de Gemini están saturados ahora mismo. Vuelve a intentarlo en unos segundos.", 503);
  }
  return error("No se pudo analizar la imagen. Inténtalo de nuevo.", 502);
}
