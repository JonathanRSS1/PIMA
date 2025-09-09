// src/components/FunctionComparison.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/* ----------------------------- Utilidades ----------------------------- */
const linspace = (a, b, n) => {
  const out = [];
  if (n <= 1) return [a, b];
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out.push(a + step * i);
  return out;
};

/* ------------------ Parsing seguro para potencias ------------------ */
const normalizeExpressionForEval = (expr) => {
  if (!expr || typeof expr !== "string") return expr;
  let s = expr.trim();
  s = s.replace(/Math\./g, "");
  s = s.replace(/\^/g, "**");

  const isIdChar = (c) => /[A-Za-z0-9_.\$]/.test(c);

  const extractLeftToken = (str, idxBefore) => {
    let i = idxBefore;
    if (i < 0) return { start: 0, token: "", parenthesized: false };
    while (i >= 0 && /\s/.test(str[i])) i--;
    if (i < 0) return { start: 0, token: "", parenthesized: false };

    if (str[i] === ")") {
      let depth = 0;
      let j = i;
      for (; j >= 0; j--) {
        if (str[j] === ")") depth++;
        else if (str[j] === "(") {
          depth--;
          if (depth === 0) break;
        }
      }
      const start = Math.max(0, j);
      return { start, token: str.slice(start, i + 1), parenthesized: true };
    } else {
      let j = i;
      while (j >= 0 && isIdChar(str[j])) j--;
      const start = j + 1;
      return { start, token: str.slice(start, i + 1), parenthesized: false };
    }
  };

  const extractRightToken = (str, idxAfter) => {
    let i = idxAfter;
    const L = str.length;
    while (i < L && /\s/.test(str[i])) i++;
    if (i >= L) return { end: L, token: "" };

    if (str[i] === "(") {
      let depth = 0;
      let j = i;
      for (; j < L; j++) {
        if (str[j] === "(") depth++;
        else if (str[j] === ")") {
          depth--;
          if (depth === 0) break;
        }
      }
      const end = Math.min(L, j + 1);
      return { end, token: str.slice(i, end) };
    } else {
      let j = i;
      if (str[j] === "+" || str[j] === "-") j++;
      while (j < L && isIdChar(str[j])) j++;
      const end = j;
      return { end, token: str.slice(i, end) };
    }
  };

  const canTreatAsUnaryMinus = (str, posMinus) => {
    if (posMinus < 0) return false;
    let k = posMinus - 1;
    while (k >= 0 && /\s/.test(str[k])) k--;
    if (k < 0) return true;
    const prev = str[k];
    return /[=+\-*/^,(?:]/.test(prev);
  };

  while (s.includes("**")) {
    const idx = s.indexOf("**");
    const left = extractLeftToken(s, idx - 1);
    const right = extractRightToken(s, idx + 2);

    const before = s.slice(0, left.start);
    const after = s.slice(right.end);

    let unaryMinus = false;
    const minusPos = left.start - 1;
    if (minusPos >= 0 && s[minusPos] === "-" && !left.parenthesized && canTreatAsUnaryMinus(s, minusPos)) {
      unaryMinus = true;
    }

    let baseText = left.token;
    let prefix = before;
    if (unaryMinus) {
      let newPrefix = prefix;
      while (newPrefix.length && /\s/.test(newPrefix[newPrefix.length - 1])) newPrefix = newPrefix.slice(0, -1);
      newPrefix = newPrefix.slice(0, Math.max(0, newPrefix.length - 1));
      prefix = newPrefix;
    }

    const expText = right.token;
    const mathPow = `Math.pow(${baseText},${expText})`;
    const replacement = unaryMinus ? `-${mathPow}` : mathPow;

    s = prefix + replacement + after;
  }

  return s;
};

const safeEval = (expr, x) => {
  try {
    if (!expr || typeof expr !== "string") return NaN;
    const normalized = normalizeExpressionForEval(expr);
    // eslint-disable-next-line no-new-func
    const fn = new Function("x", `with(Math){ return (${normalized}); }`);
    const v = fn(x);
    return typeof v === "number" && isFinite(v) ? v : NaN;
  } catch (e) {
    return NaN;
  }
};

/* ------------------ Cálculo (roots/intersections/extremes/area) ------------------ */
const findRoots = (expr, a, b, samples = 400) => {
  const xs = linspace(a, b, samples + 1);
  const roots = [];
  const f = (x) => safeEval(expr, x);
  for (let i = 0; i < xs.length - 1; i++) {
    const x1 = xs[i],
      x2 = xs[i + 1];
    const y1 = f(x1),
      y2 = f(x2);
    if (isNaN(y1) || isNaN(y2)) continue;
    if (Math.abs(y1) < 1e-9) {
      roots.push(Number(x1.toFixed(8)));
      continue;
    }
    if (y1 * y2 < 0) {
      let lo = x1,
        hi = x2,
        flo = y1;
      for (let it = 0; it < 60; it++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if (isNaN(fm)) break;
        if (Math.abs(fm) < 1e-9) {
          lo = hi = mid;
          break;
        }
        if (flo * fm <= 0) hi = mid;
        else {
          lo = mid;
          flo = fm;
        }
      }
      roots.push(Number(((lo + hi) / 2).toFixed(8)));
    }
  }
  roots.sort((a, b) => a - b);
  const uniq = [];
  for (const r of roots) if (uniq.length === 0 || Math.abs(uniq[uniq.length - 1] - r) > 1e-6) uniq.push(r);
  return uniq;
};

const findIntersections = (expr1, expr2, a, b, samples = 600) => {
  const h = (x) => safeEval(expr1, x) - safeEval(expr2, x);
  const xs = linspace(a, b, samples + 1);
  const pts = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const x1 = xs[i],
      x2 = xs[i + 1];
    const y1 = h(x1),
      y2 = h(x2);
    if (isNaN(y1) || isNaN(y2)) continue;
    if (Math.abs(y1) < 1e-9) pts.push({ x: x1, y: safeEval(expr1, x1) });
    if (y1 * y2 < 0) {
      let lo = x1,
        hi = x2;
      for (let it = 0; it < 60; it++) {
        const mid = (lo + hi) / 2;
        const hm = h(mid);
        if (isNaN(hm)) break;
        if (Math.abs(hm) < 1e-9) {
          lo = hi = mid;
          break;
        }
        if (hm * y1 <= 0) hi = mid;
        else lo = mid;
      }
      const xm = (lo + hi) / 2;
      pts.push({ x: xm, y: safeEval(expr1, xm) });
    }
  }
  pts.sort((a, b) => a.x - b.x);
  const uniq = [];
  for (const p of pts) if (uniq.length === 0 || Math.abs(uniq[uniq.length - 1].x - p.x) > 1e-6) uniq.push(p);
  return uniq;
};

const findExtremes = (expr, a, b, samples = 800) => {
  const xs = linspace(a, b, samples + 1);
  let max = { x: null, y: -Infinity },
    min = { x: null, y: Infinity },
    found = false;
  const f = (x) => safeEval(expr, x);
  for (const x of xs) {
    const y = f(x);
    if (isNaN(y)) continue;
    found = true;
    if (y > max.y) max = { x, y };
    if (y < min.y) min = { x, y };
  }
  if (!found) return { max: null, min: null };
  return { max, min };
};

const integrateAbs = (expr1, expr2, a, b, samples = 1000) => {
  const xs = linspace(a, b, samples + 1);
  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i],
      x1 = xs[i + 1];
    const y0 = Math.abs(safeEval(expr1, x0) - safeEval(expr2, x0));
    const y1 = Math.abs(safeEval(expr1, x1) - safeEval(expr2, x1));
    if (isNaN(y0) || isNaN(y1)) continue;
    area += ((y0 + y1) / 2) * (x1 - x0);
  }
  return area;
};

/* -------------------------- Componente Principal ------------------------- */
export default function FunctionComparison() {
  const [f1, setF1] = useState("x^2");
  const [f2, setF2] = useState("-x^2");
  const [a, setA] = useState(-8);
  const [b, setB] = useState(8);
  const [samples, setSamples] = useState(600);
  const [showGGB, setShowGGB] = useState(true);

  // GeoGebra refs & state
  const ggbContainerRef = useRef(null);
  const ggbInstanceRef = useRef(null);
  const [ggbReady, setGgbReady] = useState(false);
  const [ggbError, setGgbError] = useState(null);

  // export state
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  // sampling & stats (JS)
  const sampled = useMemo(() => {
    const n = Math.min(Math.max(Math.floor(samples), 100), 2500);
    const xs = linspace(a, b, n);
    return xs.map((x) => {
      const y1 = safeEval(f1, x);
      const y2 = safeEval(f2, x);
      return { x, y1: isNaN(y1) ? null : y1, y2: isNaN(y2) ? null : y2 };
    });
  }, [f1, f2, a, b, samples]);

  const yDomain = useMemo(() => {
    let ymin = Infinity,
      ymax = -Infinity;
    sampled.forEach((p) => {
      if (p.y1 !== null) {
        ymin = Math.min(ymin, p.y1);
        ymax = Math.max(ymax, p.y1);
      }
      if (p.y2 !== null) {
        ymin = Math.min(ymin, p.y2);
        ymax = Math.max(ymax, p.y2);
      }
    });
    if (!isFinite(ymin) || !isFinite(ymax)) return [-10, 10];
    if (ymin === ymax) {
      ymin -= 1;
      ymax += 1;
    }
    const pad = (ymax - ymin) * 0.15 || 1;
    return [Number((ymin - pad).toFixed(6)), Number((ymax + pad).toFixed(6))];
  }, [sampled]);

  const stats = useMemo(() => {
    const r = {};
    r.f1 = {};
    r.f2 = {};
    r.f1.roots = findRoots(f1, a, b, Math.max(200, Math.floor(samples / 3)));
    r.f2.roots = findRoots(f2, a, b, Math.max(200, Math.floor(samples / 3)));
    r.f1.extremes = findExtremes(f1, a, b, Math.max(400, samples));
    r.f2.extremes = findExtremes(f2, a, b, Math.max(400, samples));
    r.intersections = findIntersections(f1, f2, a, b, Math.max(400, samples));
    r.area = integrateAbs(f1, f2, a, b, Math.max(400, samples));

    const integral = (expr) => {
      const xs = linspace(a, b, Math.max(400, samples));
      let s = 0;
      for (let i = 0; i < xs.length - 1; i++) {
        const x0 = xs[i],
          x1 = xs[i + 1];
        const y0 = safeEval(expr, x0),
          y1 = safeEval(expr, x1);
        if (isNaN(y0) || isNaN(y1)) continue;
        s += ((y0 + y1) / 2) * (x1 - x0);
      }
      return s;
    };

    r.f1.average = integral(f1) / (b - a);
    r.f2.average = integral(f2) / (b - a);
    return r;
  }, [f1, f2, a, b, samples]);

  /* ------------------ MiniChart responsivo ------------------ */
  // ahora MiniChart usa viewBox interno para ocupar 100% del contenedor
  const MiniChart = ({ expr, color = "#1f77b4" }) => {
    const viewW = 680; // internal coordinate width
    const viewH = 320; // internal coordinate height
    const xs = linspace(a, b, 240);
    const ptsRaw = xs.map((x) => ({ x, y: safeEval(expr, x) }));
    const points = ptsRaw.filter((p) => Number.isFinite(p.y));
    if (points.length === 0) {
      return (
        <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" height="240" preserveAspectRatio="xMidYMid meet">
          <rect x={0} y={0} width={viewW} height={viewH} fill="#ffffff" stroke="#e5e7eb" />
          <text x={viewW / 2} y={viewH / 2} textAnchor="middle" fill="#9ca3af" fontSize="12">
            Sin datos válidos
          </text>
        </svg>
      );
    }

    const ymin = Math.min(...points.map((p) => p.y));
    const ymax = Math.max(...points.map((p) => p.y));
    const padY = (ymax - ymin) * 0.12 || 1;
    const y0 = ymin - padY;
    const y1 = ymax + padY;

    const xToPx = (x) => ((x - a) / (b - a)) * (viewW - 80) + 40; // internal padding 40
    const yToPx = (y) => 20 + (viewH - 60) - ((y - y0) / (y1 - y0)) * (viewH - 60); // top padding 20, bottom 40

    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xToPx(p.x).toFixed(2)},${yToPx(p.y).toFixed(2)}`)
      .join(" ");

    // axis ticks
    const ticksX = [];
    const ticksCount = Math.min(8, Math.max(4, Math.floor((viewW - 80) / 90)));
    for (let i = 0; i <= ticksCount; i++) ticksX.push(a + (i / ticksCount) * (b - a));
    const ticksY = [];
    const ticksYCount = Math.min(6, Math.max(3, Math.floor((viewH - 60) / 60)));
    for (let i = 0; i <= ticksYCount; i++) ticksY.push(y0 + (i / ticksYCount) * (y1 - y0));

    return (
      <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" height="240" preserveAspectRatio="xMidYMid meet">
        <rect x={0} y={0} width={viewW} height={viewH} fill="#ffffff" stroke="#e5e7eb" rx="6" />
        {/* grid */}
        {ticksX.map((tx, i) => {
          const px = xToPx(tx);
          return <line key={`gx${i}`} x1={px} x2={px} y1={20} y2={viewH - 40} stroke="#f3f4f6" />;
        })}
        {ticksY.map((ty, i) => {
          const py = yToPx(ty);
          return <line key={`gy${i}`} x1={40} x2={viewW - 40} y1={py} y2={py} stroke="#f3f4f6" />;
        })}
        {/* axis lines */}
        {!(y1 < 0 || y0 > 0) && <line x1={40} x2={viewW - 40} y1={yToPx(0)} y2={yToPx(0)} stroke="#111827" strokeWidth={1} />}
        {!(a > 0 || b < 0) && <line x1={xToPx(0)} x2={xToPx(0)} y1={20} y2={viewH - 40} stroke="#111827" strokeWidth={1} />}

        {/* ticks labels */}
        {ticksX.map((tx, i) => (
          <g key={`tx${i}`} transform={`translate(${xToPx(tx)}, ${viewH - 18})`}>
            <line y1={-8} y2={0} stroke="#bdbdbd" />
            <text y={14} textAnchor="middle" fontSize="10" fill="#475569">
              {Number(tx.toFixed(3))}
            </text>
          </g>
        ))}
        {ticksY.map((ty, i) => (
          <g key={`ty${i}`} transform={`translate(${18}, ${yToPx(ty)})`}>
            <text x={0} y={4} textAnchor="end" fontSize="10" fill="#475569">
              {Number(ty.toFixed(3))}
            </text>
          </g>
        ))}

        {/* area fill not used here (mini) */}

        {/* path */}
        <path d={path} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />

        {/* small vertex marker */}
        {/* compute approximate vertex for mini */}
        <circle cx={xToPx(points[Math.floor(points.length / 2)].x)} cy={yToPx(points[Math.floor(points.length / 2)].y)} r={2.2} fill="#111827" />
      </svg>
    );
  };

  /* ------------------ CSV export ------------------ */
  const exportCSV = () => {
    const xs = linspace(a, b, 201);
    const header = ["x", "f1", "f2"].join(",");
    const rows = xs.map((x) => {
      const v1 = safeEval(f1, x),
        v2 = safeEval(f2, x);
      return [x, isNaN(v1) ? "" : v1, isNaN(v2) ? "" : v2].join(",");
    });
    const csv = [header].concat(rows).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a_el = document.createElement("a");
    a_el.href = url;
    a_el.download = "function_comparison_data.csv";
    document.body.appendChild(a_el);
    a_el.click();
    a_el.remove();
    URL.revokeObjectURL(url);
  };

  /* ------------------ SVG generator (mejor tabla y layout centrado) ------------------ */
  const COLORS = {
    f1: "#1f77b4",
    f2: "#ff7f0e",
    grid: "#e6e6e6",
    axis: "#111827",
    areaFill: "rgba(30,136,229,0.12)",
    labelBG: "#ffffffcc",
    text: "#0f172a",
    tableBorder: "#e6e6e6",
    tableHeader: "#f8fafc",
  };

  function escapeXml(unsafe) {
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  const generateSVGString = ({ width = 1100, height = 760 } = {}) => {
    // layout
    const pad = 56;
    const plotW = width - pad * 2;
    const plotH = height - pad * 2 - 140; // leave room for table
    const [ymin, ymax] = yDomain;

    const xToPx = (x) => ((x - a) / (b - a)) * plotW + pad;
    const yToPx = (y) => pad + plotH - ((y - ymin) / (ymax - ymin)) * plotH;

    // points for full svg plot (use sampled)
    const ptsF1 = sampled.map((p) => ({ x: p.x, y: p.y1 })).filter((p) => p.y !== null);
    const ptsF2 = sampled.map((p) => ({ x: p.x, y: p.y2 })).filter((p) => p.y !== null);

    const pathFromPts = (pts) => {
      if (pts.length === 0) return "";
      return pts
        .map((p, i) => `${i === 0 ? "M" : "L"}${xToPx(p.x).toFixed(2)},${yToPx(p.y).toFixed(2)}`)
        .join(" ");
    };

    const pathF1 = pathFromPts(ptsF1);
    const pathF2 = pathFromPts(ptsF2);

    // area polygon
    const areaPts = [];
    for (let i = 0; i < sampled.length; i++) {
      const p = sampled[i];
      if (p.y1 !== null && p.y2 !== null) areaPts.push({ x: p.x, y1: p.y1, y2: p.y2 });
    }
    let areaPolygon = "";
    if (areaPts.length > 1) {
      const top = areaPts.map((p) => `${xToPx(p.x).toFixed(2)},${yToPx(p.y1).toFixed(2)}`);
      const bot = areaPts
        .slice()
        .reverse()
        .map((p) => `${xToPx(p.x).toFixed(2)},${yToPx(p.y2).toFixed(2)}`);
      areaPolygon = top.concat(bot).join(" ");
    }

    // ticks
    const ticksX = [];
    const ticksCount = Math.min(12, Math.max(4, Math.floor(plotW / 85)));
    for (let i = 0; i <= ticksCount; i++) ticksX.push(a + (i / ticksCount) * (b - a));
    const ticksY = [];
    const ticksYCount = Math.min(10, Math.max(4, Math.floor(plotH / 60)));
    for (let i = 0; i <= ticksYCount; i++) ticksY.push(ymin + (i / ticksYCount) * (ymax - ymin));

    // labels at right side of plot: evaluate functions at near-right x
    const labelX = b - (b - a) * 0.06;
    const f1LabelY = safeEval(f1, labelX);
    const f2LabelY = safeEval(f2, labelX);
    const f1LabelPx = xToPx(labelX);
    const f2LabelPx = xToPx(labelX);
    const f1LabelPy = Number.isFinite(f1LabelY) ? yToPx(f1LabelY) : pad + plotH * 0.25;
    const f2LabelPy = Number.isFinite(f2LabelY) ? yToPx(f2LabelY) : pad + plotH * 0.75;

    // Table placement centered below plot
    const tableW = Math.min(560, width - 160);
    const tableH = 120;
    const tableX = Math.round((width - tableW) / 2);
    const tableY = pad + plotH + 20;

    // prepare data strings
    const intersectionsStr = stats.intersections.length
      ? stats.intersections.slice(0, 6).map((p, i) => `${i + 1}. x=${p.x.toFixed(4)}, y=${p.y.toFixed(4)}`)
      : ["—"];
    const areaText = Number(stats.area || 0).toFixed(6);
    const f1avg = Number.isFinite(stats.f1.average) ? Number(stats.f1.average).toFixed(6) : "N/A";
    const f2avg = Number.isFinite(stats.f2.average) ? Number(stats.f2.average).toFixed(6) : "N/A";
    const f1max = stats.f1.extremes.max ? `(${stats.f1.extremes.max.x.toFixed(3)}, ${stats.f1.extremes.max.y.toFixed(3)})` : "N/A";
    const f1min = stats.f1.extremes.min ? `(${stats.f1.extremes.min.x.toFixed(3)}, ${stats.f1.extremes.min.y.toFixed(3)})` : "N/A";
    const f2max = stats.f2.extremes.max ? `(${stats.f2.extremes.max.x.toFixed(3)}, ${stats.f2.extremes.max.y.toFixed(3)})` : "N/A";
    const f2min = stats.f2.extremes.min ? `(${stats.f2.extremes.min.x.toFixed(3)}, ${stats.f2.extremes.min.y.toFixed(3)})` : "N/A";

    // table columns
    const col1W = Math.round(tableW * 0.48);
    const col2W = tableW - col1W;

    // build table rows as SVG rectangles + text - ensures crisp layout on export
    const tableHeaderY = tableY + 12;
    const rowHeight = 20;
    const rows = [
      ["Intersecciones", intersectionsStr.join(" | ")],
      ["Área |f1 - f2|", areaText],
      ["Promedio f1", f1avg],
      ["Promedio f2", f2avg],
      ["Máx/Mín f1", `${f1max} / ${f1min}`],
      ["Máx/Mín f2", `${f2max} / ${f2min}`],
    ];

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background: #ffffff; font-family: Inter, Roboto, Arial;">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.06"/></filter>
  </defs>

  <!-- plot background -->
  <rect x="${pad}" y="${pad}" width="${plotW}" height="${plotH}" fill="#fff" stroke="#f3f4f6" rx="6"/>

  <!-- vertical grid -->
  ${ticksX
    .map((tx) => {
      const px = xToPx(tx).toFixed(2);
      return `<line x1="${px}" x2="${px}" y1="${pad}" y2="${pad + plotH}" stroke="${COLORS.grid}" stroke-width="1"/>`;
    })
    .join("\n  ")}

  <!-- horizontal grid -->
  ${ticksY
    .map((ty) => {
      const py = yToPx(ty).toFixed(2);
      return `<line y1="${py}" y2="${py}" x1="${pad}" x2="${pad + plotW}" stroke="${COLORS.grid}" stroke-width="1"/>`;
    })
    .join("\n  ")}

  <!-- axes -->
  ${!(ymin > 0 || ymax < 0) ? `<line x1="${xToPx(0).toFixed(2)}" x2="${xToPx(0).toFixed(2)}" y1="${pad}" y2="${pad + plotH}" stroke="${COLORS.axis}" stroke-width="1.25"/>` : ""}
  ${!(a > 0 || b < 0) ? `<line x1="${pad}" x2="${pad + plotW}" y1="${yToPx(0).toFixed(2)}" y2="${yToPx(0).toFixed(2)}" stroke="${COLORS.axis}" stroke-width="1.25"/>` : ""}

  <!-- tick labels X -->
  ${ticksX
    .map((tx) => {
      const px = xToPx(tx).toFixed(2);
      return `<g transform="translate(${px}, ${pad + plotH + 10})">
        <line y1="-8" y2="0" stroke="#bdbdbd" stroke-width="1" />
        <text y="20" text-anchor="middle" font-size="12" fill="${COLORS.text}">${Number(tx.toFixed(3))}</text>
      </g>`;
    })
    .join("\n  ")}

  <!-- tick labels Y -->
  ${ticksY
    .map((ty) => {
      const py = yToPx(ty).toFixed(2);
      return `<g transform="translate(${pad - 8}, ${py})">
        <text x="-8" y="4" text-anchor="end" font-size="12" fill="${COLORS.text}">${Number(ty.toFixed(3))}</text>
      </g>`;
    })
    .join("\n  ")}

  <!-- area between curves -->
  ${areaPolygon ? `<polygon points="${areaPolygon}" fill="${COLORS.areaFill}" stroke="none"/>` : ""}

  <!-- curves -->
  ${pathF2 ? `<path d="${pathF2}" fill="none" stroke="${COLORS.f2}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` : ""}
  ${pathF1 ? `<path d="${pathF1}" fill="none" stroke="${COLORS.f1}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` : ""}

  <!-- labels attached to curves (right side) -->
  ${pathF1 ? `<g transform="translate(${Math.max(pad + 8, f1LabelPx)}, ${Math.max(pad + 16, Math.min(pad + plotH - 16, Math.round(f1LabelPy)))})">
    <rect x="6" y="-12" width="${Math.max(80, 12 + f1.length * 6)}" height="22" rx="6" fill="#ffffff" stroke="#e6e6e6"/>
    <rect x="10" y="-8" width="10" height="8" rx="2" fill="${COLORS.f1}"/>
    <text x="30" y="6" font-size="12" fill="${COLORS.text}">f1: ${escapeXml(f1)}</text>
  </g>` : ""}

  ${pathF2 ? `<g transform="translate(${Math.max(pad + 8, f2LabelPx)}, ${Math.max(pad + 16, Math.min(pad + plotH - 16, Math.round(f2LabelPy)))})">
    <rect x="6" y="-12" width="${Math.max(80, 12 + f2.length * 6)}" height="22" rx="6" fill="#ffffff" stroke="#e6e6e6"/>
    <rect x="10" y="-8" width="10" height="8" rx="2" fill="${COLORS.f2}"/>
    <text x="30" y="6" font-size="12" fill="${COLORS.text}">f2: ${escapeXml(f2)}</text>
  </g>` : ""}

  <!-- centered title -->
  <text x="${width / 2}" y="${pad - 22}" font-size="18" text-anchor="middle" fill="#0f172a" font-weight="600">Comparison of Functions</text>
  <text x="${width / 2}" y="${pad - 6}" font-size="12" text-anchor="middle" fill="#6b7280">Interval: [${a}, ${b}] • sample: ${sampled.length} pts</text>

  <!-- data table (SVG native table, centered) -->
  <g transform="translate(${tableX}, ${tableY})" filter="url(#shadow)">
    <rect x="0" y="0" width="${tableW}" height="${tableH}" rx="10" fill="#ffffff" stroke="${COLORS.tableBorder}"/>
    <!-- header -->
    <rect x="0" y="0" width="${tableW}" height="${rowHeight}" fill="${COLORS.tableHeader}" rx="10 10 0 0"/>
    <text x="12" y="${rowHeight - 6}" font-size="13" font-weight="700" fill="${COLORS.text}">Metric</text>
    <text x="${tableW - 12}" y="${rowHeight - 6}" font-size="13" font-weight="700" fill="${COLORS.text}" text-anchor="end">Value</text>

    <!-- rows -->
    ${rows
      .map((r, i) => {
        const y = rowHeight + i * rowHeight + 6;
        const bg = i % 2 === 0 ? "" : `<rect x="0" y="${rowHeight + i * rowHeight}" width="${tableW}" height="${rowHeight}" fill="#fbfbfd"/>`;
        return `${bg}
        <text x="12" y="${y + 8}" font-size="12" fill="${COLORS.text}">${escapeXml(r[0])}</text>
        <text x="${tableW - 12}" y="${y + 8}" font-size="12" fill="${COLORS.text}" text-anchor="end">${escapeXml(r[1])}</text>`;
      })
      .join("\n    ")}
  </g>
</svg>`;

    return svg;
  };

  const svgToBlob = (svgString) => new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });

  /* ------------------ Exportar SOLO SVG ------------------ */
  const exportSVG = () => {
    setExporting(true);
    setExportMessage(null);
    try {
      const width = 1100;
      const height = 760;
      const svg = generateSVGString({ width, height });
      const blob = svgToBlob(svg);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "function_comparison.svg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setExportMessage("SVG descargado correctamente.");
    } catch (err) {
      console.error("Error exportando SVG:", err);
      setExportMessage("Error exportando SVG. Revisa consola.");
    } finally {
      setExporting(false);
    }
  };

  /* ------------------ GeoGebra helpers (visual only) ------------------ */
  const toGGB = (expr) => {
    if (!expr || typeof expr !== "string") return expr;
    return expr.replace(/\*\*/g, "^").replace(/Math\./g, "");
  };

  const ensureGGBScript = () =>
    new Promise((resolve, reject) => {
      if (window.GGBApplet) return resolve();
      const existing = document.getElementById("geogebra-script");
      if (existing) {
        const check = setInterval(() => {
          if (window.GGBApplet) {
            clearInterval(check);
            resolve();
          }
        }, 80);
        setTimeout(() => {
          if (!window.GGBApplet) {
            clearInterval(check);
            reject(new Error("timeout loading deployggb.js"));
          }
        }, 8000);
        return;
      }
      const s = document.createElement("script");
      s.id = "geogebra-script";
      s.src = "https://www.geogebra.org/apps/deployggb.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });

  const initGGB = async () => {
    if (!ggbContainerRef.current) return;
    setGgbError(null);
    setGgbReady(false);
    try {
      await ensureGGBScript();
    } catch (e) {
      setGgbError("No se pudo cargar deployggb.js (CDN). Revisa consola/Network.");
      return;
    }

    try {
      ggbContainerRef.current.innerHTML = '<div id="ggb-applet" style="width:100%;height:600px"></div>';
    } catch {}

    if (!window.GGBApplet) {
      setGgbError("deployggb.js cargado pero GGBApplet no está disponible.");
      return;
    }

    const paramsG = {
      appName: "graphing",
      width: 1100, // ancho fijado
      height: 600,
      showToolBar: false,
      showAlgebraInput: false,
      showMenuBar: false,
      language: "es",
      appletOnLoad: function () {
        const ggb = window.ggbApplet || document.ggbApplet;
        ggbInstanceRef.current = ggb;
        setGgbReady(true);
        setTimeout(() => {
          try {
            updateGGB();
          } catch (e) {
            console.warn("updateGGB error after load:", e);
          }
        }, 120);
      },
    };

    try {
      const applet = new window.GGBApplet(paramsG, true);
      applet.inject("ggb-applet");
    } catch (err) {
      setGgbError("Fallo al inyectar GeoGebra. Revisa consola.");
      console.warn("Fallo inyectando GeoGebra:", err);
    }
  };

  const destroyGGB = () => {
    try {
      if (ggbContainerRef.current) ggbContainerRef.current.innerHTML = "";
      ggbInstanceRef.current = null;
      setGgbReady(false);
    } catch (e) {
      console.warn("Error destruyendo GeoGebra:", e);
    }
  };

  const updateGGB = () => {
    const g = ggbInstanceRef.current;
    if (!g) return;
    try {
      try {
        g.deleteObject("f");
        g.deleteObject("g");
        g.deleteObject("intersecciones");
        g.deleteObject("area");
      } catch {}

      const gf = toGGB(f1);
      const gg = toGGB(f2);
      g.evalCommand(`f(x) = ${gf}`);
      g.evalCommand(`g(x) = ${gg}`);

      try {
        g.evalCommand("SetColor(f, 0, 120, 255)");
        g.evalCommand("SetColor(g, 255, 120, 0)");
        g.evalCommand("SetLineThickness(f, 3)");
        g.evalCommand("SetLineThickness(g, 3)");
      } catch {}

      const ymin = yDomain[0];
      const ymax = yDomain[1];
      try {
        if (typeof g.setCoordSystem === "function") {
          g.setCoordSystem(a, ymin, b, ymax);
        } else {
          g.evalCommand(`SetCoordSystem(${a}, ${ymin}, ${b}, ${ymax})`);
        }
      } catch (err) {
        try {
          g.evalCommand(`SetCoordSystem(${a}, ${ymin}, ${b}, ${ymax})`);
        } catch {}
      }

      try {
        g.evalCommand("intersecciones = Intersect(f, g)");
      } catch {}
      try {
        g.evalCommand(`area = IntegralBetween(f, g, ${a}, ${b})`);
        try {
          g.evalCommand("SetFilling(area, 0.3)");
        } catch {
          try {
            g.setFilling && g.setFilling("area", 0.3);
          } catch {}
        }
      } catch {}
    } catch (e) {
      console.warn("Error updating GeoGebra:", e);
    }
  };

  // lifecycle
  useEffect(() => {
    let mounted = true;
    if (showGGB && mounted) {
      initGGB();
    }
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGGB]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (showGGB && ggbInstanceRef.current) updateGGB();
    }, 120);
    return () => clearTimeout(t);
  }, [f1, f2, a, b, yDomain, showGGB]);

  useEffect(() => {
    if (!showGGB) destroyGGB();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGGB === false]);

  // render
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-indigo-600 text-center">⚖️ Comparison of Functions</h1>

      <h2 className="text-xl font-semibold text-center text-indigo-600">Plano cartesiano (GeoGebra)</h2>

      <div className="bg-white shadow rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">f1(x)</label>
          <input value={f1} onChange={(e) => setF1(e.target.value)} className="mt-1 p-2 border rounded w-full" />
          <p className="text-xs text-gray-500 mt-1">Ej: x^2, Math.sin(x), (x-1)/(x+1), -x^3</p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">f2(x)</label>
          <input value={f2} onChange={(e) => setF2(e.target.value)} className="mt-1 p-2 border rounded w-full" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">a</label>
          <input type="number" value={a} onChange={(e) => setA(Number(e.target.value))} className="mt-1 p-2 border rounded w-full" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">b</label>
          <input type="number" value={b} onChange={(e) => setB(Number(e.target.value))} className="mt-1 p-2 border rounded w-full" />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">Samples (resolución)</label>
          <input type="number" min={200} max={2500} value={samples} onChange={(e) => setSamples(Number(e.target.value))} className="mt-1 p-2 border rounded w-full" />
        </div>

        <div className="md:col-span-2 flex items-center gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-green-600 text-white rounded">Exportar CSV</button>
          <button onClick={() => setShowGGB((s) => !s)} className="px-4 py-2 bg-indigo-600 text-white rounded">
            {showGGB ? "Ocultar GeoGebra" : "Mostrar GeoGebra"}
          </button>
          <button onClick={exportSVG} className="px-4 py-2 bg-sky-600 text-white rounded" disabled={exporting}>
            {exporting ? "Exportando..." : "Exportar imagen (SVG)"}
          </button>
        </div>
      </div>

      <div>
        {showGGB ? (
          <div ref={ggbContainerRef} className="w-full flex justify-center">
            <div style={{ width: "100%", maxWidth: 1100 }}>
              <div id="ggb-wrapper" style={{ width: "100%", minHeight: 600 }} />
            </div>
            <div className="mt-3 text-sm text-gray-600 w-64">
              {ggbReady ? (
                <div className="text-green-600 font-medium">GeoGebra cargado y listo.</div>
              ) : ggbError ? (
                <div className="text-red-600 font-medium">{ggbError}</div>
              ) : (
                <div>Inicializando GeoGebra...</div>
              )}
              {exportMessage && <div className="mt-2 text-xs text-gray-700">{exportMessage}</div>}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500 border-dashed border-2 border-gray-200 rounded-lg">
            GeoGebra está oculto. Pulsa <span className="font-semibold">Mostrar GeoGebra</span> para renderizar la gráfica aquí.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="bg-white shadow rounded-xl p-4 flex flex-col items-center">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-indigo-600">f1(x) = {f1}</h3>
            <div className="text-sm text-gray-500">Promedio: {isNaN(stats.f1.average) ? "N/A" : Number(stats.f1.average).toFixed(6)}</div>
          </div>
          <div className="w-full mt-3">
            <MiniChart expr={f1} color="#1f77b4" />
          </div>
          <div className="mt-3 text-sm text-center">
            <p><strong>Raíces:</strong> {stats.f1.roots.length ? stats.f1.roots.map((r) => Number(r.toFixed(6))).join(", ") : "Ninguna"}</p>
            <p><strong>Máx:</strong> {stats.f1.extremes.max ? `(${stats.f1.extremes.max.x.toFixed(6)}, ${stats.f1.extremes.max.y.toFixed(6)})` : "N/A"}</p>
            <p><strong>Mín:</strong> {stats.f1.extremes.min ? `(${stats.f1.extremes.min.x.toFixed(6)}, ${stats.f1.extremes.min.y.toFixed(6)})` : "N/A"}</p>
          </div>
        </article>

        <article className="bg-white shadow rounded-xl p-4 flex flex-col items-center">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-indigo-600">f2(x) = {f2}</h3>
            <div className="text-sm text-gray-500">Promedio: {isNaN(stats.f2.average) ? "N/A" : Number(stats.f2.average).toFixed(6)}</div>
          </div>
          <div className="w-full mt-3">
            <MiniChart expr={f2} color="#ff7f0e" />
          </div>
          <div className="mt-3 text-sm text-center">
            <p><strong>Raíces:</strong> {stats.f2.roots.length ? stats.f2.roots.map((r) => Number(r.toFixed(6))).join(", ") : "Ninguna"}</p>
            <p><strong>Máx:</strong> {stats.f2.extremes.max ? `(${stats.f2.extremes.max.x.toFixed(6)}, ${stats.f2.extremes.max.y.toFixed(6)})` : "N/A"}</p>
            <p><strong>Mín:</strong> {stats.f2.extremes.min ? `(${stats.f2.extremes.min.x.toFixed(6)}, ${stats.f2.extremes.min.y.toFixed(6)})` : "N/A"}</p>
          </div>
        </article>
      </div>

      <div className="bg-white shadow rounded-xl p-4">
        <h3 className="text-lg font-semibold text-indigo-600 text-center">Intersecciones y Área (cálculo JS)</h3>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="font-medium">Intersecciones f1 = f2</p>
            {stats.intersections.length ? (
              <ul className="list-disc pl-5 text-sm">
                {stats.intersections.map((p, i) => (
                  <li key={i}>x = {p.x.toFixed(6)}, y = {p.y.toFixed(6)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">Ninguna en [{a}, {b}]</p>
            )}
          </div>

          <div className="text-center">
            <p className="font-medium">Área |f1 - f2|</p>
            <p className="mt-2 font-semibold">{Number(stats.area || 0).toFixed(6)}</p>
          </div>

          <div className="text-center">
            <p className="font-medium">Ranking por promedio</p>
            <ol className="pl-5 text-sm">
              <li>f1 avg: {isNaN(stats.f1.average) ? "N/A" : Number(stats.f1.average).toFixed(6)}</li>
              <li>f2 avg: {isNaN(stats.f2.average) ? "N/A" : Number(stats.f2.average).toFixed(6)}</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-xl p-4">
        <h3 className="text-lg font-semibold text-indigo-600 text-center">Previsualización (muestra)</h3>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full text-sm mx-auto" style={{ maxWidth: 680 }}>
            <thead>
              <tr className="text-left"><th className="pr-4">x</th><th className="pr-4">f1(x)</th><th className="pr-4">f2(x)</th></tr>
            </thead>
            <tbody>
              {linspace(a, b, 31).map((x, i) => {
                const v1 = safeEval(f1, x);
                const v2 = safeEval(f2, x);
                return (
                  <tr key={i}>
                    <td className="pr-4">{Number(x.toFixed(4))}</td>
                    <td className="pr-4">{Number.isFinite(v1) ? Number(v1.toFixed(6)) : "—"}</td>
                    <td className="pr-4">{Number.isFinite(v2) ? Number(v2.toFixed(6)) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="text-xs text-gray-500 text-center">
        <ol className="list-decimal pl-5">
          <li>Intervalo usado: [{a}, {b}]</li>
          <li>Muestra: {sampled.length} puntos</li>
          <li>Funciones evaluadas con una evaluación segura (safeEval) que maneja ^ como potencia.</li>
        </ol>
      </footer>
    </div>
  );
}
