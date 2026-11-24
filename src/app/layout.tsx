import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// next/font descarga las fuentes en el build y las sirve desde nuestro
// dominio: no hace falta permitir fonts.googleapis.com en la CSP.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Pulso", template: "%s · Pulso" },
  description: "Tu estilo de vida, día a día: comidas, actividad, peso, agua y hábitos.",
  applicationName: "Pulso",
  appleWebApp: { capable: true, title: "Pulso", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // Datos de salud: no queremos que los buscadores indexen nada.
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#14161b" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Leer los headers vuelve dinámico el render (requisito del nonce).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="es-AR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          {children}
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
