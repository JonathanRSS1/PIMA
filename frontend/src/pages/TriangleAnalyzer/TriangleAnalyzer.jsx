import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";


function round(v, d = 6) {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
}
function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export default function TriangleAnalyzer() {
  const ggbDivId = "ggb-element";
  const ggbApiRef = useRef(null);
  const [s1, setS1] = useState(5); // a = BC
  const [s2, setS2] = useState(4); // b = AC
  const [s3, setS3] = useState(3); // c = AB
  const [results, setResults] = useState(null);
  const [loadingApplet, setLoadingApplet] = useState(true);
  const [message, setMessage] = useState("");

  // safe delete: GeoGebra puede rechazar Delete con varios argumentos; borramos uno-a-uno
  function safeDelete(api, names = []) {
    if (!api) return;
    names.forEach((name) => {
      try {
        api.evalCommand(`Delete[${name}]`);
      } catch (e) {
        // ignorar errores por objeto
      }
    });
  }

  useEffect(() => {
    function initApplet() {
      if (!window || !window.GGBApplet) return;
      const params = {
        appName: "geometry",
        // aumenté el width para que el applet sea más ancho y no provoque overflow
        width: 890,
        height: 520,
        showToolBar: false,
        showAlgebraInput: false,
        showMenuBar: false,
        useBrowserForJS: true,
        appletOnLoad: function (api) {
          ggbApiRef.current = api;
          setLoadingApplet(false);
          // limpiar
          safeDelete(api, ["A", "B", "C", "poly", "a_len", "b_len", "c_len", "Area"]);
        },
      };

      const ggb = new window.GGBApplet(params, true);
      ggb.inject(ggbDivId);
    }

    if (!window.GGBApplet) {
      const script = document.createElement("script");
      script.src = "https://www.geogebra.org/apps/deployggb.js";
      script.async = true;
      script.onload = initApplet;
      script.onerror = () => {
        setLoadingApplet(false);
        setMessage("No se pudo cargar GeoGebra — la vista seguirá en modo local (JS).");
      };
      document.body.appendChild(script);
    } else {
      initApplet();
    }

    return () => {
      try {
        ggbApiRef.current = null;
      } catch (e) {}
    };
  }, []);

  // helpers matemáticos avanzados
  function heronArea(a, b, c) {
    const s = (a + b + c) / 2;
    const under = s * (s - a) * (s - b) * (s - c);
    if (under <= 0) return 0;
    return Math.sqrt(under);
  }
  function computeAnglesFromSides(a, b, c) {
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    const A = Math.acos(clamp((b * b + c * c - a * a) / (2 * b * c))) * (180 / Math.PI);
    const B = Math.acos(clamp((a * a + c * c - b * b) / (2 * a * c))) * (180 / Math.PI);
    const C = 180 - A - B;
    return { A, B, C };
  }
  function medianLengths(a, b, c) {
    const m_a = 0.5 * Math.sqrt(2 * b * b + 2 * c * c - a * a);
    const m_b = 0.5 * Math.sqrt(2 * a * a + 2 * c * c - b * b);
    const m_c = 0.5 * Math.sqrt(2 * a * a + 2 * b * b - c * c);
    return { m_a, m_b, m_c };
  }
  function bisectorLength(a, b, c, angleDeg) {
    const Ahalf = (angleDeg * Math.PI) / 360;
    const numerator = 2 * b * c * Math.cos(Ahalf);
    const denom = b + c;
    if (denom === 0) return 0;
    return numerator / denom;
  }
  function altitudes(area, a, b, c) {
    if (a === 0) return { h_a: 0, h_b: 0, h_c: 0 };
    return { h_a: (2 * area) / a, h_b: (2 * area) / b, h_c: (2 * area) / c };
  }
  function circumcenter(Ax, Ay, Bx, By, Cx, Cy) {
    const D = 2 * (Ax * (By - Cy) + Bx * (Cy - Ay) + Cx * (Ay - By));
    if (Math.abs(D) < 1e-12) return null;
    const Ux = ((Ax * Ax + Ay * Ay) * (By - Cy) + (Bx * Bx + By * By) * (Cy - Ay) + (Cx * Cx + Cy * Cy) * (Ay - By)) / D;
    const Uy = ((Ax * Ax + Ay * Ay) * (Cx - Bx) + (Bx * Bx + By * By) * (Ax - Cx) + (Cx * Cx + Cy * Cy) * (Bx - Ax)) / D;
    return { x: Ux, y: Uy };
  }
  function incentro(Ax, Ay, Bx, By, Cx, Cy, a, b, c) {
    const p = a + b + c;
    if (p === 0) return null;
    const x = (a * Ax + b * Bx + c * Cx) / p;
    const y = (a * Ay + b * By + c * Cy) / p;
    return { x, y };
  }
  function centroid(Ax, Ay, Bx, By, Cx, Cy) {
    return { x: (Ax + Bx + Cx) / 3, y: (Ay + By + Cy) / 3 };
  }
  function orthocenter(Ax, Ay, Bx, By, Cx, Cy) {
    const A1 = By - Cy;
    const B1 = Cx - Bx;
    const C1 = Bx * Cy - Cx * By;
    const C2 = -(B1 * Ax - A1 * Ay);
    const A3 = Cy - Ay;
    const B3 = Ax - Cx;
    const C3 = Cx * Ay - Ax * Cy;
    const C4 = -(B3 * Bx - A3 * By);
    const det = B1 * (-A3) - B3 * (-A1);
    if (Math.abs(det) < 1e-12) return null;
    const x = (-C2 * (-A3) - (-C4) * (-A1)) / det;
    const y = (B1 * (-C4) - B3 * (-C2)) / det;
    return { x, y };
  }

  // Clasificaciones
  function classifyBySides(a, b, c) {
    if (Math.abs(a - b) < 1e-6 && Math.abs(b - c) < 1e-6) return "Equilátero";
    if (Math.abs(a - b) < 1e-6 || Math.abs(b - c) < 1e-6 || Math.abs(a - c) < 1e-6) return "Isósceles";
    return "Escaleno";
  }
  function classifyByAngles(a, b, c) {
    const sides = [a, b, c].sort((x, y) => x - y);
    const [s_small, s_mid, s_large] = sides;
    if (Math.abs(s_large * s_large - (s_small * s_small + s_mid * s_mid)) < 1e-6) return "Rectángulo";
    if (s_large * s_large > s_small * s_small + s_mid * s_mid) return "Obtusángulo";
    return "Acutángulo";
  }

  // utilidades GeoGebra
  function safeGetObjType(api, name) {
    try {
      const t = api.getObjectType(name);
      return t && t !== "undefined";
    } catch (e) {
      return false;
    }
  }
  function tryGetNumericVar(api, name) {
    try {
      const v = api.getValue(name);
      if (v === undefined || v === null) return NaN;
      return Number(v);
    } catch (e) {
      return NaN;
    }
  }

  // Dibujar triángulo (valida desigualdad y alerta con explicación y ejemplo)
  function drawTriangle() {
    const api = ggbApiRef.current;
    const a = Number(s1);
    const b = Number(s2);
    const c = Number(s3);

    if (![a, b, c].every((v) => Number.isFinite(v))) {
      setResults({ error: "Introduce valores numéricos válidos." });
      return;
    }

    // comprobar desigualdades y construir mensaje detallado
    const fails = [];
    if (a + b <= c) fails.push({ cond: `a + b <= c`, detail: `${a} + ${b} <= ${c}` });
    if (a + c <= b) fails.push({ cond: `a + c <= b`, detail: `${a} + ${c} <= ${b}` });
    if (b + c <= a) fails.push({ cond: `b + c <= a`, detail: `${b} + ${c} <= ${a}` });

    if (fails.length > 0) {
      // explicativo: por qué y ejemplos concretos para arreglar
      let msg = `Las longitudes NO cumplen la desigualdad triangular:
`;
      fails.forEach((f) => {
        msg += ` - ${f.cond}  (ej: ${f.detail})
`;
      });
      msg += `
Qué significa: la suma de dos lados debe ser mayor que el tercero.
`;
      // sugerencias: dar ejemplo concreto cambiando el lado mayor a un valor válido
      const maxSide = Math.max(a, b, c);
      const sumOtherTwo = a + b + c - maxSide;
      const suggest = sumOtherTwo - 0.1; // ejemplo: hacer el mayor ligeramente menor para que cumpla
      msg += `Ejemplo: cambia el lado mayor (${maxSide}) a algo menor que ${sumOtherTwo} — por ejemplo ${round(suggest, 3)}.
`;
      try {
        window.alert(msg);
      } catch (e) {}
      setResults({ error: msg });
      return;
    }

    // coordenadas de C por ley de cosenos
    const x = (b * b + c * c - a * a) / (2 * c);
    const y2 = Math.max(0, b * b - x * x);
    const y = Math.sqrt(y2);

    if (api) {
      try {
        safeDelete(api, ["A", "B", "C", "poly", "a_len", "b_len", "c_len", "Area"]);
        api.evalCommand(`A = (0,0)`);
        api.evalCommand(`B = (${round(c, 6)},0)`);
        api.evalCommand(`C = (${round(x, 6)},${round(y, 6)})`);
        api.evalCommand("poly = Polygon(A,B,C)");
        api.evalCommand("a_len = Distance(B,C)");
        api.evalCommand("b_len = Distance(A,C)");
        api.evalCommand("c_len = Distance(A,B)");
        api.evalCommand("Area = Area(poly)");
        try {
          const maxSide = Math.max(a, b, c);
          api.setCoordSystem(-1, c + 2, -1, Math.max(maxSide + 2, y + 2));
        } catch (e) {}
        setResults(null);
        setMessage("");
      } catch (err) {
        setResults({ error: "Error al dibujar en GeoGebra: " + (err.message || err) });
      }
    } else {
      // fallback JS
      const area = heronArea(a, b, c);
      const angles = computeAnglesFromSides(a, b, c);
      const sidesSorted = [a, b, c].sort((x, y) => x - y);
      const rightCheck = Math.abs(sidesSorted[2] * sidesSorted[2] - (sidesSorted[0] * sidesSorted[0] + sidesSorted[1] * sidesSorted[1])) < 1e-6;
      setResults({
        a_len: round(a),
        b_len: round(b),
        c_len: round(c),
        area: round(area),
        angles: [round(angles.A, 4), round(angles.B, 4), round(angles.C, 4)],
        typeBySides: classifyBySides(a, b, c),
        typeByAngles: classifyByAngles(a, b, c),
        rightCheck,
      });
    }
  }

  // computeProperties reforzado (incluye centros, R, r, medianas, alturas, bisectrices...)
  function computeProperties() {
    const api = ggbApiRef.current;
    try {
      let a_len, b_len, c_len, area;
      let Ax, Ay, Bx, By, Cx, Cy;
      if (api) {
        const typeA = safeGetObjType(api, "A");
        const typeB = safeGetObjType(api, "B");
        const typeC = safeGetObjType(api, "C");
        if (typeA && typeB && typeC) {
          Ax = Number(api.getXcoord("A"));
          Ay = Number(api.getYcoord("A"));
          Bx = Number(api.getXcoord("B"));
          By = Number(api.getYcoord("B"));
          Cx = Number(api.getXcoord("C"));
          Cy = Number(api.getYcoord("C"));
          a_len = dist(Bx, By, Cx, Cy);
          b_len = dist(Ax, Ay, Cx, Cy);
          c_len = dist(Ax, Ay, Bx, By);
          area = heronArea(a_len, b_len, c_len);
        } else {
          a_len = tryGetNumericVar(api, "a_len");
          b_len = tryGetNumericVar(api, "b_len");
          c_len = tryGetNumericVar(api, "c_len");
          area = tryGetNumericVar(api, "Area");
        }
      }

      // fallback a inputs
      if (![a_len, b_len, c_len].every((v) => Number.isFinite(v))) {
        a_len = Number(s1);
        b_len = Number(s2);
        c_len = Number(s3);
        area = heronArea(a_len, b_len, c_len);
        setMessage("Usando los lados introducidos (no se pudieron leer medidas de GeoGebra).");
      } else setMessage("");

      const perimeter = a_len + b_len + c_len;
      const semiperimeter = perimeter / 2;
      const angles = computeAnglesFromSides(a_len, b_len, c_len);
      const { m_a, m_b, m_c } = medianLengths(a_len, b_len, c_len);
      const { h_a, h_b, h_c } = altitudes(area, a_len, b_len, c_len);
      const R = (a_len * b_len * c_len) / (4 * (area || 1e-12));
      const r = area / (semiperimeter || 1e-12);

      // centers (if coordinates exist; otherwise compute coordinates for canonical placement)
      if (!Ax && !Bx && !Cx) {
        // canonical placement: A=(0,0), B=(c,0), C by law of cos
        Ax = 0;
        Ay = 0;
        Bx = c_len;
        By = 0;
        const xC = (b_len * b_len + c_len * c_len - a_len * a_len) / (2 * c_len);
        const yC = Math.sqrt(Math.max(0, b_len * b_len - xC * xC));
        Cx = xC;
        Cy = yC;
      }

      const circum = circumcenter(Ax, Ay, Bx, By, Cx, Cy);
      const incent = incentro(Ax, Ay, Bx, By, Cx, Cy, a_len, b_len, c_len);
      const cent = centroid(Ax, Ay, Bx, By, Cx, Cy);
      const ortho = orthocenter(Ax, Ay, Bx, By, Cx, Cy);

      const bis_a = bisectorLength(a_len, b_len, c_len, angles.A);
      const bis_b = bisectorLength(b_len, a_len, c_len, angles.B);
      const bis_c = bisectorLength(c_len, a_len, b_len, angles.C);

      // pythagoras quick info
      const sidesSorted = [a_len, b_len, c_len].sort((x, y) => x - y);
      const [s_small, s_mid, s_large] = sidesSorted;
      const lhs = s_small * s_small + s_mid * s_mid;
      const rhs = s_large * s_large;
      const diff = Math.abs(lhs - rhs);
      const pct = (diff / (rhs || 1e-12)) * 100;
      const rightCheck = diff < 1e-6;
      const pythReason = rightCheck ? "Cumple Pitágoras (aprox)." : (rhs > lhs ? "No cumple: el lado mayor^2 es mayor -> triángulo obtusángulo en ese vértice." : "No cumple: el lado mayor^2 es menor -> triángulo acutángulo en ese vértice.");

      setResults({
        a_len: round(a_len),
        b_len: round(b_len),
        c_len: round(c_len),
        perimeter: round(perimeter),
        semiperimeter: round(semiperimeter),
        area: round(area),
        angles: { A: round(angles.A, 4), B: round(angles.B, 4), C: round(angles.C, 4), A_rad: (angles.A * Math.PI) / 180, B_rad: (angles.B * Math.PI) / 180, C_rad: (angles.C * Math.PI) / 180 },
        medians: { m_a: round(m_a), m_b: round(m_b), m_c: round(m_c) },
        altitudes: { h_a: round(h_a), h_b: round(h_b), h_c: round(h_c) },
        bisectors: { l_a: round(bis_a), l_b: round(bis_b), l_c: round(bis_c) },
        R: round(R),
        r: round(r),
        circumcenter: circum ? { x: round(circum.x, 6), y: round(circum.y, 6) } : null,
        incentro: incent ? { x: round(incent.x, 6), y: round(incent.y, 6) } : null,
        centroid: { x: round(cent.x, 6), y: round(cent.y, 6) },
        orthocenter: ortho ? { x: round(ortho.x, 6), y: round(ortho.y, 6) } : null,
        pythagoras: { lhs: round(lhs, 6), rhs: round(rhs, 6), diff: round(diff, 6), pct: round(pct, 6), holds: rightCheck, reason: pythReason },
        typeBySides: classifyBySides(a_len, b_len, c_len),
        typeByAngles: classifyByAngles(a_len, b_len, c_len),
      });
    } catch (err) {
      setResults({ error: "Error al calcular propiedades: " + (err.message || err) });
    }
  }

  // applyPythagoras: muestra más datos y explica por qué no cumple
  function applyPythagoras() {
    if (results && results.pythagoras) {
      // ya tenemos info
      setResults((r) => ({ ...(r || {}), pythagoras: r.pythagoras }));
      if (!results.pythagoras.holds) {
        try { window.alert(`Pitágoras NO se cumple.
LHS=${results.pythagoras.lhs} RHS=${results.pythagoras.rhs}
Diferencia absoluta=${results.pythagoras.diff} (~${results.pythagoras.pct}% de RHS).
Razón: ${results.pythagoras.reason}`); } catch (e) {}
      } else {
        try { window.alert(`Pitágoras cumple (aprox).
LHS=${results.pythagoras.lhs} RHS=${results.pythagoras.rhs}`); } catch (e) {}
      }
      return;
    }

    // si no existe, calcula propiedades y luego muestra alerta con explicación
    computeProperties();
    setTimeout(() => {
      if (results && results.pythagoras) {
        applyPythagoras();
      } else {
        try { window.alert("Primero calcula propiedades (CALCULAR) o dibuja el triángulo."); } catch (e) {}
      }
    }, 200);
  }

  function resetAll() {
    const api = ggbApiRef.current;
    try {
      safeDelete(api, ["A", "B", "C", "poly", "a_len", "b_len", "c_len", "Area"]);
    } catch (e) {}
    setResults(null);
    setMessage("");
  }

  // Render UI (mostramos muchos más datos si computeProperties fue ejecutado)
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-900 to-purple-800 p-6 text-slate-100">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left - Controls */}
<motion.div 
  initial={{ opacity: 0, x: -20 }} 
  animate={{ opacity: 1, x: 0 }} 
  transition={{ duration: 0.45 }} 
  className="lg:col-span-4 bg-white/5 backdrop-blur-md p-6 rounded-2xl shadow-2xl"
>
          <h2 className="text-2xl font-bold mb-2">Triángulos interactivos</h2>
          <p className="text-sm text-slate-300 mb-4">Introduce lados (en unidades) o usa los valores por defecto y presiona <span className="font-semibold">DIBUJAR</span>.</p>

          <div className="grid grid-cols-1 gap-3">
            <label className="text-xs text-slate-300">Lado a (BC)</label>
            <input value={s1} onChange={(e) => setS1(e.target.value)} type="number" step="any" className="w-full rounded-lg p-2 bg-white/5 border border-white/10" />

            <label className="text-xs text-slate-300">Lado b (AC)</label>
            <input value={s2} onChange={(e) => setS2(e.target.value)} type="number" step="any" className="w-full rounded-lg p-2 bg-white/5 border border-white/10" />

            <label className="text-xs text-slate-300">Lado c (AB)</label>
            <input value={s3} onChange={(e) => setS3(e.target.value)} type="number" step="any" className="w-full rounded-lg p-2 bg-white/5 border border-white/10" />

            <div className="flex gap-2 mt-3">
              <button onClick={drawTriangle} className="flex-1 py-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 font-semibold shadow">DIBUJAR</button>
              <button onClick={computeProperties} className="flex-1 py-2 rounded-2xl bg-white/5 border border-white/10">CALCULAR</button>
            </div>

            <div className="flex gap-2 mt-2">
              <button onClick={applyPythagoras} className="flex-1 py-2 rounded-2xl bg-emerald-500/80 font-semibold">APLICAR PITÁGORAS</button>
              <button onClick={resetAll} className="flex-1 py-2 rounded-2xl bg-red-500/80 font-semibold">LIMPIAR</button>
            </div>

            <div className="mt-4 text-sm text-slate-300 p-3 rounded-lg bg-white/2">
              <strong>Tips:</strong>
              <ul className="mt-2 list-disc ml-5">
                <li>Si no ves nada, revisa tu conexion </li>
                <li>Puedes arrastrar los vértices en el applet (si lo haces, pulsa <em>CALCULAR</em> para sincronizar).</li>
              </ul>
            </div>

            {message && <div className="mt-2 text-sm text-amber-200">{message}</div>}
          </div>
        </motion.div>

        {/* Right - GeoGebra + results */}
<motion.div
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.45 }}
  className="lg:col-span-8 bg-white/5 p-4 rounded-2xl shadow-2xl"
>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Vista interactiva (GeoGebra)</h3>
            <div className="text-xs text-slate-300">Applet suministrado por GeoGebra • Arrastra vértices</div>
          </div>

          <div id={ggbDivId} className="w-full rounded-lg overflow-hidden border border-white/5 shadow-inner" style={{ minHeight: 520 }} />

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/3">
              <div className="text-xs text-slate-300">Lados</div>
              <div className="text-lg font-mono">a: {results?.a_len ?? "—"}</div>
              <div className="text-lg font-mono">b: {results?.b_len ?? "—"}</div>
              <div className="text-lg font-mono">c: {results?.c_len ?? "—"}</div>
            </div>

            <div className="p-3 rounded-xl bg-white/3">
              <div className="text-xs text-slate-300">Ángulos (°)</div>
              <div className="text-lg">{results?.angles ? `${results.angles.A}°, ${results.angles.B}°, ${results.angles.C}°` : "—"}</div>
              <div className="text-xs text-slate-400 mt-1">Tipo: {results?.typeByAngles ?? "—"}</div>
            </div>

            <div className="p-3 rounded-xl bg-white/3">
              <div className="text-xs text-slate-300">Área</div>
              <div className="text-lg font-mono">{results?.area ?? "—"}</div>
              <div className="text-xs text-slate-400 mt-1">Lados: {results?.typeBySides ?? "—"}</div>
            </div>
          </div>

          {/* Detalles extendidos */}
          {results && (
            <div className="mt-3 grid grid-cols-1 gap-3">
              <div className="p-3 rounded-xl bg-white/6 border border-white/5">
                <div className="text-sm font-medium mb-2">Medidas avanzadas</div>
                <div className="text-xs text-slate-300 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>Perímetro: {results.perimeter ?? "-"}</div>
                  <div>Semiperímetro: {results.semiperimeter ?? "-"}</div>
                  <div>R (circunradio): {results.R ?? "-"}</div>
                  <div>r (inradio): {results.r ?? "-"}</div>
                  <div>Alturas: h_a={results?.altitudes?.h_a ?? "-"} · h_b={results?.altitudes?.h_b ?? "-"} · h_c={results?.altitudes?.h_c ?? "-"}</div>
                  <div>Medianas: m_a={results?.medians?.m_a ?? "-"} · m_b={results?.medians?.m_b ?? "-"} · m_c={results?.medians?.m_c ?? "-"}</div>
                  <div>Bisectrices: l_a={results?.bisectors?.l_a ?? "-"} · l_b={results?.bisectors?.l_b ?? "-"} · l_c={results?.bisectors?.l_c ?? "-"}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/6 border border-white/5">
                <div className="text-sm font-medium mb-2">Centros (coordenadas)</div>
                <div className="text-xs text-slate-300 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>Centroide: {results?.centroid ? `${results.centroid.x}, ${results.centroid.y}` : "-"}</div>
                  <div>Circuncentro: {results?.circumcenter ? `${results.circumcenter.x}, ${results.circumcenter.y}` : "-"}</div>
                  <div>Incentro: {results?.incentro ? `${results.incentro.x}, ${results.incentro.y}` : "-"}</div>
                  <div>Ortócentro: {results?.orthocenter ? `${results.orthocenter.x}, ${results.orthocenter.y}` : "-"}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/6 border border-white/5">
                <div className="text-sm font-medium mb-2">Pitágoras y comprobaciones</div>
                <div className="text-xs text-slate-300">
                  <div>LHS (catetos^2 sum) = {results?.pythagoras?.lhs ?? "-"}</div>
                  <div>RHS (hipotenusa^2) = {results?.pythagoras?.rhs ?? "-"}</div>
                  <div>Diferencia absoluta = {results?.pythagoras?.diff ?? "-"}</div>
                  <div>% de diferencia respecto RHS ≈ {results?.pythagoras?.pct ?? "-"}%</div>
                  <div>Estado: {results?.pythagoras?.holds ? <span className="text-emerald-400">Cumple</span> : <span className="text-amber-400">No cumple</span>}</div>
                  <div className="mt-1 text-sm text-slate-400">Razón: {results?.pythagoras?.reason ?? "-"}</div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-slate-800/40 to-slate-700/20 border border-white/5">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-slate-300">Pitágoras (rápido)</div>
                {results?.pythagoras ? (
                  <div className="text-sm">LHS: {results.pythagoras.lhs} — RHS: {results.pythagoras.rhs} — {results.pythagoras.holds ? <span className="text-emerald-400 font-semibold">Cumple ✔</span> : <span className="text-amber-400 font-semibold">No cumple</span>}</div>
                ) : (
                  <div className="text-sm text-slate-400">Pulsa <strong>APLICAR PITÁGORAS</strong> tras <strong>CALCULAR</strong> para comprobar y obtener explicación.</div>
                )}
              </div>

              <div className="text-xs text-slate-400">{loadingApplet ? "Cargando applet..." : "Applet listo"}</div>
            </div>
          </div>

          {results?.error && (
            <div className="mt-3 p-3 rounded-lg bg-red-600/30 text-red-100">{results.error}</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
