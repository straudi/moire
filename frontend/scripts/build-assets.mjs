// Writes the common SVG assets (public/avatars, public/garments) from src/data/templates.json.
// Run after changing templates.json:  npm run assets
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "src/data/templates.json"), "utf8"));
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.viewBox}">${body}</svg>\n`;
const stroke = 'stroke="#33352b" stroke-opacity=".14" stroke-width="1.2" stroke-linejoin="round"';
const lines = (t) => t.lines.map((d) => `<path d="${d}" fill="none" stroke="#303128" stroke-opacity=".18" stroke-width="1.2"/>`).join("");

mkdirSync(join(root, "public/avatars"), { recursive: true });
mkdirSync(join(root, "public/garments"), { recursive: true });
writeFileSync(join(root, "public/avatars/base.svg"), svg(data.avatar.back + data.avatar.front));
for (const [id, t] of Object.entries(data.templates)) {
  const body = t.shapes.map((d) => `<path d="${d}" fill="#d9d4c7" ${stroke}/>`).join("") + lines(t) + t.extra;
  writeFileSync(join(root, `public/garments/${id}.svg`), svg(body));
}
console.log(`wrote avatars/base.svg and ${Object.keys(data.templates).length} garments`);
