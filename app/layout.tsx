import type { Metadata } from "next";
import { Poppins, Nunito } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${poppins.variable} ${nunito.variable} antialiased`}
        style={{ fontFamily: "var(--font-nunito), sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}

