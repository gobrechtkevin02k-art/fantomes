import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", weight: ["600", "800"] });
const dmsans = DM_Sans({ subsets: ["latin"], variable: "--font-dmsans" });

const base = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: "Fantômes — retrouve les abonnements que tu paies sans t'en servir",
  description: "Dépose ton relevé bancaire : on retrouve les prélèvements oubliés, classés par ce qu'ils te coûtent par an. Gratuit pour commencer.",
  openGraph: {
    title: "Tu paies des abonnements que tu n'utilises plus",
    description: "Retrouve-les en deux minutes. Gratuit pour commencer.",
    locale: "fr_FR",
    type: "website",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F6F1E7" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${dmsans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
