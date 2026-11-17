import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";
import { DonneesProvider } from "@/lib/donnees";
import Shell from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pilote — paris sportifs pilotés par la confiance",
  description: "Compare les cotes Winamax au juste prix du marché, calcule un indice de confiance et fixe seul la mise selon ta bankroll et tes objectifs.",
  applicationName: "Pilote",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Pilote", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#090c11", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <StoreProvider>
          <DonneesProvider>
            <Shell>{children}</Shell>
          </DonneesProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
