import { ImageResponse } from "next/og";

export const alt = "Fantômes — retrouve les abonnements oubliés";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#F6F1E7", color: "#1A1A1A", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80 }}>
        <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, display: "flex" }}>
          Tu paies des abonnements que tu n'utilises plus.
        </div>
        <div style={{ marginTop: 40, fontSize: 40, display: "flex" }}>
          Retrouve-les en deux minutes.
        </div>
        <div style={{ marginTop: 56, background: "#E4572E", color: "#1A1A1A", fontSize: 38, fontWeight: 800, padding: "18px 36px", display: "flex", alignSelf: "flex-start" }}>
          Fantômes — gratuit pour commencer
        </div>
      </div>
    ),
    size
  );
}
