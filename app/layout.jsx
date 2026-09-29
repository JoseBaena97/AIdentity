import "./globals.css";

export const metadata = {
  title: "AIdentity — Clasificador de imágenes con IA",
  description:
    "Arrastra una imagen y deja que una IA multimodal la etiquete y la comente.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
