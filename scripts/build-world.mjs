import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);

const LAND_SRC = "C:/Users/I7/.cursor/projects/d-Code-GMT24/agent-tools/413320c2-4f95-42b6-b875-dc327a25dafc.txt";
const BORDERS_SRC = "C:/Users/I7/.cursor/projects/d-Code-GMT24/agent-tools/d95b674d-0708-4592-bb96-adb916cede0d.txt";

function ringToPath(ring, digits) {
  let d = "";
  let last = "";
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    const x = (lon + 180).toFixed(digits);
    const y = (90 - lat).toFixed(digits);
    const pair = `${x} ${y}`;
    if (pair === last) continue;
    last = pair;
    d += `${i === 0 ? "M" : "L"}${pair}`;
  }
  return d ? `${d}Z` : "";
}

function polyToPath(polygon, digits) {
  return polygon.map((ring) => ringToPath(ring, digits)).filter(Boolean).join("");
}

function featurePaths(geo, digits, outerOnly = false) {
  const out = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      const rings = outerOnly ? [g.coordinates[0]] : g.coordinates;
      const p = polyToPath(rings, digits);
      if (p) out.push(p);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) {
        const rings = outerOnly ? [poly[0]] : poly;
        const p = polyToPath(rings, digits);
        if (p) out.push(p);
      }
    }
  }
  return out;
}

const land = JSON.parse(fs.readFileSync(LAND_SRC, "utf8"));
const countries = JSON.parse(fs.readFileSync(BORDERS_SRC, "utf8"));
const landPaths = featurePaths(land, 2);
const borderPaths = featurePaths(countries, 1, true);

const file = `/* Natural Earth 110m — public domain. Equirectangular: x=lon+180, y=90-lat. */
export const WORLD_LAND = ${JSON.stringify(landPaths)};
export const WORLD_BORDERS = ${JSON.stringify(borderPaths)};
`;

fs.writeFileSync("D:/Code/GMT24/lib/world-paths.ts", file);
console.log("land", landPaths.length, "chars", file.length);
console.log("borders", borderPaths.length);
