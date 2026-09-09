import { useEffect, useRef } from "react";
import { useTheme } from "../theme";

/* Coarse land mask as lon/lat boxes — enough silhouette at dot resolution. */
const LAND: number[][] = [
  [-168, -60, 60, 72], [-165, -56, 50, 60], [-130, -58, 40, 50], [-125, -70, 30, 40],
  [-115, -88, 20, 30], [-105, -83, 14, 20], [-92, -77, 7, 14],
  [-50, -22, 60, 82],
  [-80, -60, 5, 12], [-80, -35, -5, 5], [-78, -35, -15, -5], [-72, -38, -25, -15],
  [-72, -48, -35, -25], [-74, -62, -45, -35], [-74, -67, -54, -45],
  [-10, 30, 40, 50], [-8, 40, 50, 58], [0, 55, 58, 65], [8, 60, 65, 71], [-11, -1, 50, 59],
  [-17, 35, 21, 33], [-17, 45, 11, 21], [-10, 48, 3, 11], [8, 42, -6, 3],
  [11, 41, -18, -6], [13, 36, -28, -18], [16, 32, -35, -28],
  [34, 60, 13, 32], [60, 90, 8, 32], [55, 90, 32, 45], [40, 140, 45, 71],
  [90, 135, 30, 45], [95, 123, 18, 30], [96, 110, 8, 18], [95, 141, -9, 6], [128, 146, 31, 46],
  [113, 153, -33, -11], [115, 150, -39, -33], [166, 179, -47, -34],
];
const SEA: number[][] = [
  [-93, -79, 52, 63], [-96, -84, 19, 29], [28, 41, 41, 47], [47, 54, 37, 47],
  [80, 93, 8, 20], [126, 140, -39, -33], [15, 24, 56, 64], [34, 40, 14, 27],
];

interface Node {
  n: string;
  lon: number;
  lat: number;
  kind: "ref" | "buy";
}
const NODES: Node[] = [
  { n: "Zurich", lon: 8.5, lat: 47.4, kind: "ref" },
  { n: "Accra", lon: -0.2, lat: 5.6, kind: "ref" },
  { n: "Lima", lon: -77.0, lat: -12.0, kind: "ref" },
  { n: "Singapore", lon: 103.8, lat: 1.3, kind: "buy" },
  { n: "Mumbai", lon: 72.9, lat: 19.1, kind: "buy" },
  { n: "Jo'burg", lon: 28.0, lat: -26.2, kind: "buy" },
];
const HUB = { lon: 55.3, lat: 25.3 };

function inBoxes(list: number[][], lon: number, lat: number) {
  for (const b of list) {
    if (lon >= b[0] && lon <= b[1] && lat >= b[2] && lat <= b[3]) return true;
  }
  return false;
}
const isLand = (lon: number, lat: number) =>
  inBoxes(LAND, lon, lat) && !inBoxes(SEA, lon, lat);

export function WorldMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const root = document.documentElement;
    const css = (v: string) => getComputedStyle(root).getPropertyValue(v).trim();

    function draw() {
      const parent = cv!.parentElement;
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      const w = Math.max(320, r.width);
      const h = Math.max(220, r.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv!.width = w * dpr;
      cv!.height = h * dpr;
      const g = cv!.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const padX = 26;
      const padTop = 64;
      const padBot = 64;
      const mw = w - padX * 2;
      const mh = h - padTop - padBot;
      const latTop = 78;
      const latBot = -58;
      const px = (lon: number) => padX + ((lon + 180) / 360) * mw;
      const py = (lat: number) => padTop + ((latTop - lat) / (latTop - latBot)) * mh;

      const gold = css("--color-gold-500") || "#E9A83C";
      const goldHi = css("--color-gold-hi") || "#F6DCA6";
      const tile = css("--color-ink-800") || "#262321";

      const step = Math.max(5, Math.round(mw / 108));
      for (let x = padX; x <= padX + mw; x += step) {
        for (let y = padTop; y <= padTop + mh; y += step) {
          const lon = ((x - padX) / mw) * 360 - 180;
          const lat = latTop - ((y - padTop) / mh) * (latTop - latBot);
          if (!isLand(lon, lat)) continue;
          const dx = lon - HUB.lon;
          const dy = lat - HUB.lat;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const heat = Math.max(0, 1 - dist / 110);
          g.beginPath();
          g.arc(x, y, heat > 0.62 ? 1.9 : 1.5, 0, Math.PI * 2);
          g.fillStyle = heat > 0.62 ? goldHi : gold;
          g.globalAlpha = 0.2 + heat * 0.62;
          g.fill();
        }
      }
      g.globalAlpha = 1;

      const hx = px(HUB.lon);
      const hy = py(HUB.lat);
      NODES.forEach((nd) => {
        const nx = px(nd.lon);
        const ny = py(nd.lat);
        const mx = (nx + hx) / 2;
        const my = (ny + hy) / 2 - Math.abs(nx - hx) * 0.22 - 12;
        g.beginPath();
        g.moveTo(nx, ny);
        g.quadraticCurveTo(mx, my, hx, hy);
        g.strokeStyle = nd.kind === "ref" ? goldHi : gold;
        g.globalAlpha = 0.5;
        g.lineWidth = 1.1;
        g.setLineDash([4, 4]);
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;

        g.beginPath();
        g.arc(nx, ny, 3.2, 0, Math.PI * 2);
        g.fillStyle = nd.kind === "ref" ? goldHi : gold;
        g.fill();
        g.beginPath();
        g.arc(nx, ny, 7, 0, Math.PI * 2);
        g.globalAlpha = 0.16;
        g.fill();
        g.globalAlpha = 1;
      });

      g.beginPath();
      g.arc(hx, hy, 16, 0, Math.PI * 2);
      g.fillStyle = gold;
      g.globalAlpha = 0.14;
      g.fill();
      g.beginPath();
      g.arc(hx, hy, 9, 0, Math.PI * 2);
      g.globalAlpha = 0.26;
      g.fill();
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(hx, hy, 4.6, 0, Math.PI * 2);
      g.fillStyle = goldHi;
      g.fill();

      g.font = '600 10px "IBM Plex Mono", monospace';
      g.textAlign = "center";
      g.lineWidth = 3.5;
      g.strokeStyle = tile;
      g.strokeText("DUBAI", hx, hy - 22);
      g.fillStyle = goldHi;
      g.fillText("DUBAI", hx, hy - 22);
    }

    draw();
    const ro = new ResizeObserver(() => draw());
    if (cv.parentElement) ro.observe(cv.parentElement);
    if (document.fonts?.ready) document.fonts.ready.then(draw);
    return () => ro.disconnect();
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Dotted world map showing refining and buyer counterparties routed into Dubai"
      className="absolute inset-0 block h-full w-full"
    />
  );
}
