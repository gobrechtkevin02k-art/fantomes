// Écrans de démarrage iPhone (générés par scripts/visuels.cjs) : largeur, hauteur en points CSS et densité.
// Sans eux, iOS affiche un écran blanc le temps que l'appli installée se charge.

export const ECRANS_DEMARRAGE: [number, number, number][] = [
  [440, 956, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [390, 844, 3],
  [428, 926, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [375, 667, 2],
];

export function imagesDemarrage(): { url: string; media: string }[] {
  return ECRANS_DEMARRAGE.map(([l, h, d]) => ({
    url: `/icones/demarrage-${l * d}x${h * d}.png`,
    media: `(device-width: ${l}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait)`,
  }));
}
