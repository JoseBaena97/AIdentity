import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: "AIdentity — Clasificador de imágenes con IA",
  description:
    "Arrastra una imagen y deja que una IA multimodal la etiquete y la comente.",
};

// Se ejecuta antes de pintar: aplica el tema guardado o, si no hay, el del sistema.
// Así se evita el parpadeo de tema claro al cargar en modo oscuro.
const scriptTema = `(function(){try{var t=localStorage.getItem("tema");var d=t?t==="oscuro":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
