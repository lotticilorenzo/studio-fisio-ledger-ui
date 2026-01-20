import type { Metadata, Viewport } from "next";
import { Poppins, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";

const poppins = Poppins({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

const nunito = Nunito({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Studio FISYO - Gestionale Appuntamenti",
  description: "Sistema di gestione appuntamenti per Studio FISYO",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FISYO",
  },
  icons: {
    icon: "/brand/icon-192.png",
    apple: "/brand/icon-512.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#facc15",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${nunito.variable} antialiased`}
        style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        suppressHydrationWarning
      >
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
