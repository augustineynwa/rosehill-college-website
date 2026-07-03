/**
 * build-crest.mjs — extrude the official Rosehill College crest SVG into a
 * reusable crest.glb. Heraldry is preserved exactly: the three official
 * colours (#273370 navy, #da3029 red, #f3f3f3 silver), original proportions
 * (viewBox 688.13 x 952.92) and paint-order layering.
 *
 * Each SVG path becomes its own named mesh (frag_###) so the homepage can
 * assemble the crest from fragments under scroll control.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';

// three's loaders expect browser globals
globalThis.DOMParser = DOMParser;
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.();
        this.onload?.({ target: this });
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = 'data:application/octet-stream;base64,' + Buffer.from(buf).toString('base64');
        this.onloadend?.();
        this.onload?.({ target: this });
      });
    }
  };
}

const THREE = await import('three');
const { SVGLoader } = await import('three/examples/jsm/loaders/SVGLoader.js');
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const SVG_PATH = join(__dirname, '..', '..', 'images', 'RHC-Official-Crest.svg');
const OUT = join(__dirname, '..', 'public', 'assets', 'crest.glb');

let svgText = readFileSync(SVG_PATH, 'utf8');

// SVGLoader ignores <style> blocks — inline the class fills so every path
// carries its official colour (.cls-1 #273370, .cls-2 #da3029, .cls-3 #f3f3f3).
const classFills = {};
const styleBlock = svgText.match(/<style>([\s\S]*?)<\/style>/);
if (styleBlock) {
  for (const rule of styleBlock[1].matchAll(/\.([\w-]+)[^{}]*\{[^}]*?fill:\s*([^;}\s]+)/g)) {
    classFills[rule[1]] = rule[2];
  }
}
svgText = svgText.replace(/class="([\w-]+)"/g, (m, cls) =>
  classFills[cls] ? `fill="${classFills[cls]}"` : m);

const svgData = new SVGLoader().parse(svgText);

// crest proportions: 688.13 x 952.92 → scale so height = 2 world units
const VIEW_W = 688.13;
const VIEW_H = 952.92;
const SCALE = 2 / VIEW_H;
const DEPTH = 26;              // extrusion depth in SVG units (~0.055 world)
const LAYER_STEP = 0.2;        // paint-order z separation (total ≈ 40 SVG units)

const materials = new Map();
function materialFor(colorHex) {
  if (!materials.has(colorHex)) {
    const isSilver = colorHex === '#f3f3f3';
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      metalness: isSilver ? 0.65 : 0.3,
      roughness: isSilver ? 0.32 : 0.48,
      name: 'crest-' + colorHex.slice(1),
    });
    materials.set(colorHex, m);
  }
  return materials.get(colorHex);
}

const group = new THREE.Group();
group.name = 'RHC_Crest';

// Pass 1: extrude every filled path, remember its paint order + centroid.
const pieces = [];
let paintOrder = 0;
for (const path of svgData.paths) {
  const style = path.userData.style;
  const fill = (style.fill && style.fill !== 'none') ? style.fill : null;
  if (!fill) continue;
  const colorHex = new THREE.Color(fill).getHexString().toLowerCase();
  const shapes = SVGLoader.createShapes(path);
  if (!shapes.length) continue;

  for (const shape of shapes) {
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: 2.0,
      bevelSize: 1.4,
      bevelSegments: 1,
      curveSegments: 3,
    });
    // paint order → forward stacking so upper layers never z-fight
    // (negative here: the rotateX(π) below negates z, putting later paths in front)
    geom.translate(0, 0, -paintOrder * LAYER_STEP);
    geom.computeBoundingBox();
    const c = geom.boundingBox.getCenter(new THREE.Vector3());
    pieces.push({ geom, colorHex, cx: c.x, cy: c.y });
  }
  paintOrder++;
}

// Pass 2: cluster pieces into fragments — a 4x5 spatial grid per colour.
// Keeps the fragment-assembly animation (≈30 pieces) without 200 draw calls.
const GRID_X = 4, GRID_Y = 5;
const clusters = new Map();
for (const p of pieces) {
  const gx = Math.min(GRID_X - 1, Math.max(0, Math.floor((p.cx / VIEW_W) * GRID_X)));
  const gy = Math.min(GRID_Y - 1, Math.max(0, Math.floor((p.cy / VIEW_H) * GRID_Y)));
  const key = `${p.colorHex}|${gx}|${gy}`;
  if (!clusters.has(key)) clusters.set(key, []);
  clusters.get(key).push(p.geom);
}

let fragIndex = 0;
for (const [key, geoms] of clusters) {
  const colorHex = key.split('|')[0];
  const merged = geoms.length > 1 ? mergeGeometries(geoms) : geoms[0];
  // SVG y grows down → rotate around X. A rotation (det +1) keeps the
  // winding order intact so normals and lighting stay correct.
  merged.rotateX(Math.PI);
  const mesh = new THREE.Mesh(merged, materialFor('#' + colorHex));
  mesh.name = `frag_${String(fragIndex).padStart(3, '0')}_${colorHex}`;
  fragIndex++;
  group.add(mesh);
}

// centre the whole crest and normalise scale.
// x/y centre on the SVG canvas centre — exactly how the official 2D crest
// is composed — rather than the mesh bounding box (the asymmetric mantling
// would skew the optical centre). Geometry was rotateX(π)'d, so y negates.
group.updateMatrixWorld(true);
const bbox = new THREE.Box3().setFromObject(group);
const centre = bbox.getCenter(new THREE.Vector3());
centre.x = VIEW_W / 2;
centre.y = -VIEW_H / 2;
for (const child of group.children) child.position.sub(centre);
group.scale.setScalar(SCALE);

const scene = new THREE.Scene();
scene.add(group);

const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (result) => {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, Buffer.from(result));
    const kb = Math.round(Buffer.from(result).length / 1024);
    console.log(`crest.glb written (${fragIndex} fragments, ${kb} KB) -> ${OUT}`);
  },
  (err) => { console.error(err); process.exit(1); },
  { binary: true },
);
