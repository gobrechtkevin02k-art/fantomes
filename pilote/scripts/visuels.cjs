// Génère les visuels de l'appli installée : icônes (dont « maskable » pour Android)
// et écrans de démarrage iPhone. Usage : node scripts/visuels.cjs (Chromium + Playwright requis).
// Les fichiers produits sont versionnés dans public/icones : inutile de relancer à chaque déploiement.

const { chromium } = require("playwright");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "public", "icones");
const DEGRADE = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset=".55" stop-color="#a78bfa"/><stop offset="1" stop-color="#fbbf24"/></linearGradient>`;
const TRACE = `<path d="M9 22.5V9.5h7.2a4.6 4.6 0 0 1 0 9.2H12.6" fill="none" stroke="url(#g)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="21.5" cy="22.5" r="2" fill="#fbbf24"/>`;

// Icône « maskable » : fond plein jusqu'aux bords, logo dans la zone sûre (cercle de 80 %).
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs>${DEGRADE}<radialGradient id="h" cx=".8" cy="0" r="1"><stop offset="0" stop-color="#34d399" stop-opacity=".16"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></radialGradient></defs><rect width="32" height="32" fill="#10151c"/><rect width="32" height="32" fill="url(#h)"/><g transform="translate(3 2.4) scale(0.8)">${TRACE}</g></svg>`;

const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs>${DEGRADE}</defs><rect x="1" y="1" width="30" height="30" rx="9" fill="#10151c" stroke="url(#g)" stroke-width="2"/>${TRACE}</svg>`;

// Écrans de démarrage iPhone (points CSS × densité). Sans eux, iOS affiche un écran blanc à l'ouverture.
const ECRANS = [
  [440, 956, 3], // 16 Pro Max, 17 Pro Max
  [402, 874, 3], // 16 Pro, 17 Pro, 17
  [430, 932, 3], // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [390, 844, 3], // 12, 13, 14, 16e
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [414, 736, 3], // 6s/7/8 Plus
  [375, 667, 2], // SE 2e/3e gén., 6s/7/8
];

const nomEcran = ([l, h, d]) => `demarrage-${l * d}x${h * d}.png`;

function pageDemarrage(l, h) {
  return `<html><body style="margin:0;width:${l}px;height:${h}px;background:#090c11;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;overflow:hidden">
  <div style="position:absolute;inset:0;background:radial-gradient(${l * 1.4}px ${h * 0.45}px at 85% -8%, rgba(52,211,153,.10), transparent 60%),radial-gradient(${l * 1.2}px ${h * 0.4}px at -10% 12%, rgba(167,139,250,.08), transparent 60%)"></div>
  <div style="position:relative;width:${Math.round(l * 0.24)}px;height:${Math.round(l * 0.24)}px">${logo.replace("<svg ", '<svg width="100%" height="100%" ')}</div>
  <div style="position:relative;margin-top:${Math.round(l * 0.05)}px;color:#e9eef3;font-size:${Math.round(l * 0.075)}px;font-weight:700;letter-spacing:-.02em">Pilote</div>
  <div style="position:relative;margin-top:6px;color:#5d6875;font-size:${Math.round(l * 0.034)}px">Paris sportifs pilotés par la confiance</div>
  </body></html>`;
}

(async () => {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  for (const taille of [192, 512]) {
    await page.setViewportSize({ width: taille, height: taille });
    await page.setContent(`<html><body style="margin:0">${maskable.replace("<svg ", `<svg width="${taille}" height="${taille}" `)}</body></html>`);
    await page.screenshot({ path: path.join(OUT, `icone-maskable-${taille}.png`) });
  }
  for (const e of ECRANS) {
    const [l, h, d] = e;
    const ctx = await navigateur.newContext({ viewport: { width: l, height: h }, deviceScaleFactor: d });
    const p = await ctx.newPage();
    await p.setContent(pageDemarrage(l, h));
    await p.screenshot({ path: path.join(OUT, nomEcran(e)) });
    await ctx.close();
  }
  await navigateur.close();
  // Palette réduite : un écran de démarrage passe d'environ 600 Ko à 40 Ko.
  for (const f of fs.readdirSync(OUT).filter((f) => /^(demarrage|icone-maskable)/.test(f))) {
    const p = path.join(OUT, f);
    fs.writeFileSync(p, await sharp(p).png({ palette: true, quality: 90, effort: 10, dither: 0.6 }).toBuffer());
  }
  console.log("Visuels générés dans", OUT);
})();
