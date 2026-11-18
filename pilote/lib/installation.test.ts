import { describe, expect, it } from "vitest";
import { detecter } from "./installation";

const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const CHROME_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const INSTAGRAM = SAFARI + " Instagram 350.0.0.0 (iPhone16,1; iOS 18_5)";
const PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

describe("détection de l'installation", () => {
  it("reconnaît l'appli déjà installée avant tout", () => {
    expect(detecter(SAFARI, 5, false, true)).toBe("installee");
  });
  it("distingue Safari des autres navigateurs sur iPhone, et l'iPad qui se présente comme un Mac", () => {
    expect(detecter(SAFARI, 5, false, false)).toBe("ios_safari");
    expect(detecter(CHROME_IOS, 5, false, false)).toBe("ios_autre");
    expect(detecter(IPAD, 5, false, false)).toBe("ios_safari");
    expect(detecter(IPAD, 0, false, false)).toBe("ordinateur");
  });
  it("propose le bouton natif sur Android quand Chrome l'offre, sinon le menu", () => {
    expect(detecter(ANDROID, 5, true, false)).toBe("android");
    expect(detecter(ANDROID, 5, false, false)).toBe("android_manuel");
  });
  it("repère les navigateurs intégrés aux réseaux sociaux", () => {
    expect(detecter(INSTAGRAM, 5, false, false)).toBe("integre");
  });
  it("affiche le QR code sur ordinateur", () => {
    expect(detecter(PC, 0, false, false)).toBe("ordinateur");
    expect(detecter(PC, 0, true, false)).toBe("ordinateur");
  });
});
