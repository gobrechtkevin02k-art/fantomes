import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";
import { DonneesProvider } from "@/lib/donnees";
import { AutonomieProvider } from "@/lib/autonomie";
import Shell from "@/components/Shell";
import { imagesDemarrage } from "@/lib/demarrage";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pilote — paris sportifs pilotés par la confiance",
  description: "Compare les cotes Winamax au juste prix du marché, calcule un indice de confiance et fixe seul la mise selon ta bankroll et tes objectifs.",
  applicationName: "Pilote",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Pilote", statusBarStyle: "black-translucent", startupImage: imagesDemarrage() },
  formatDetection: { telephone: false, email: false, address: false },
  icons: { apple: "/icones/apple-touch-icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#090c11", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* Garde l'invitation d'installation d'Android/Chrome si elle arrive avant le reste du code. */}
        <script dangerouslySetInnerHTML={{ __html: "addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__piloteInvitation=e})" }} />
      </head>
      <body>
        <StoreProvider>
          <DonneesProvider>
            <AutonomieProvider>
              <Shell>{children}</Shell>
            </AutonomieProvider>
          </DonneesProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
