// src/components/LawOfLargeNumbersCasino.jsx
// Virtual Casino · Law of Large Numbers — version: alerts ONLY in table (no floating toasts)
// - Completely removed any floating toast UI
// - pushToast now **only** adds success/error to recentAlerts; 'info' messages are ignored
// - GeoGebra remains separate and centered

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "katex/dist/katex.min.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function LawOfLargeNumbersCasino() {
  // --- Estado del juego ---
  const [game, setGame] = useState("roulette"); // 'roulette'|'die'|'coin'
  const [bet, setBet] = useState(1);
  const [autoplay, setAutoplay] = useState(false);
  const [rounds, setRounds] = useState(500);
  const [speed, setSpeed] = useState(40);

  // moneda
  const [coinP, setCoinP] = useState(0.5);
  const [coinPayout, setCoinPayout] = useState(0.98);

  // dado
  const [dieFace, setDieFace] = useState(1);
  const [diePayout, setDiePayout] = useState(4.8);

  // ruleta (europea, orden realista)
  const rouletteOrder = useMemo(
    () => [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26],
    []
  );
  const rouletteColors = useMemo(() => ({ red: new Set([32, 19, 21, 25, 34, 27, 36, 30, 23, 5, 16, 1, 14, 9, 18, 7, 12, 3]) }), []);
  const isRed = (n) => n !== 0 && rouletteColors.red.has(n);
  const rouletteP = 18 / 37;
  const roulettePayout = 1.0;

  // estadísticas y distribuciones
  const [bankroll, setBankroll] = useState([0]);
  const [plays, setPlays] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [lastDieValue, setLastDieValue] = useState(null);
  const [lastCoinSide, setLastCoinSide] = useState(null);

  const [dieCounts, setDieCounts] = useState(Array(6).fill(0));
  const [coinCounts, setCoinCounts] = useState({ cara: 0, cruz: 0 });
  const [rouletteCounts, setRouletteCounts] = useState(Array(37).fill(0));
  const [deltas, setDeltas] = useState([]);

  // acumulado de victorias para trazar la tasa empírica
  const [cumWins, setCumWins] = useState([]);

  // anim flags
  const [spinning, setSpinning] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [rolling, setRolling] = useState(false);

  // GeoGebra refs
  const ggbRef = useRef(null);
  const ggbReady = useRef(false);
  const ggbContainerRef = useRef(null);

  // GeoGebra draw option
  const [ggbDrawAsPoints, setGgbDrawAsPoints] = useState(false);

  // wheel ref
  const wheelRef = useRef(null);

  // recent alerts (tabla)
  const [recentAlerts, setRecentAlerts] = useState([]); // {id,text,type,time}

  // ---- IMPORTANT: pushToast ahora SOLO guarda success/error en recentAlerts y NO muestra toasts flotantes ----
  function pushToast(text, type = "info") {
    if (type === "success" || type === "error") {
      const id = Date.now() + Math.random();
      const time = new Date().toLocaleTimeString();
      setRecentAlerts((r) => [{ id, text, type, time }, ...r].slice(0, 12));
    }
    // NOTE: 'info' messages are intentionally ignored (no floating UI, no console spam)
  }

  // ----- matemáticas: EV y ventaja de la casa -----
  function evPerPlay() {
    if (game === "roulette") return rouletteP * roulettePayout * bet + (1 - rouletteP) * -bet;
    if (game === "die") {
      const p = 1 / 6;
      return p * diePayout * bet + (1 - p) * -bet;
    }
    return coinP * coinPayout * bet + (1 - coinP) * -bet;
  }
  function houseEdgePercent() {
    const ev = evPerPlay();
    return -(ev / bet) * 100;
  }

  // ----- Chart.js data -----
  const labels = bankroll.map((_, i) => i);
  const ev = evPerPlay();
  const evLine = labels.map((x) => +(ev * x).toFixed(6));
  const data = {
    labels,
    datasets: [
      { label: "Saldo acumulado", data: bankroll, borderColor: "rgba(99,102,241,0.95)", backgroundColor: "rgba(99,102,241,0.12)", tension: 0.15, pointRadius: 0, borderWidth: 2.4 },
      { label: "Recta EV · x", data: evLine, borderColor: "rgba(16,185,129,0.9)", borderDash: [8, 6], pointRadius: 0, borderWidth: 2 },
    ],
  };
  const options = { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, scales: { x: { title: { display: true, text: "Jugadas" } }, y: { title: { display: true, text: "Saldo" } } }, plugins: { legend: { position: "top" } } };

  // ----- GeoGebra: carga e inicialización (crea p,A,N) -----
  useEffect(() => {
    if (window.ggbApplet || ggbReady.current) return;
    const s = document.createElement("script");
    s.src = "https://www.geogebra.org/apps/deployggb.js";
    s.async = true;
    s.onload = () => {
      try {
        const params = {
          id: "ggb-ep",
          appName: "classic",
          width: 1280,
          height: 520,
          showToolBar: false,
          showAlgebraInput: false,
          showMenuBar: false,
          showResetIcon: false,
          borderColor: "#111827",
          preventFocus: true,
          appletOnLoad: function (applet) {
            ggbRef.current = applet;
            ggbReady.current = true;

            // INICIALIZAR variables y sliders nativos para evitar 'undefined variable'
            try {
              applet.evalCommand("p = 0.5");
              applet.evalCommand("A = 0.98");
              applet.evalCommand("N = 0");

              applet.evalCommand("p = Slider(0, 1, 0.01, 0.5)");
              applet.evalCommand("A = Slider(0.5, 1.5, 0.01, 0.98)");
              applet.evalCommand("N = Slider(0, 100, 1, 0)");

              try { applet.evalCommand("SetCaption(p, \"p (prob.)\")"); } catch (e) {}
              try { applet.evalCommand("SetCaption(A, \"A (payout)\")"); } catch (e) {}
              try { applet.evalCommand("SetCaption(N, \"N (jugadas)\")"); } catch (e) {}

              try { applet.evalCommand("f(x) = (p*A - (1 - p)) * x"); } catch (e) {}
              try { applet.evalCommand("P = (0, 0)"); } catch (e) {}

              try { applet.evalCommand("L = {}"); } catch (e) {}
              try { applet.evalCommand("H = {}"); } catch (e) {}
              try { applet.evalCommand("WinRate = {}"); } catch (e) {}
            } catch (e) {
              console.warn("Error inicializando sliders en GeoGebra:", e);
            }

            pushToast("GeoGebra cargado y variables p,A,N creadas.", "success");
          },
        };
        // eslint-disable-next-line no-undef
        // @ts-ignore
        const app = new window.GGBApplet(params, true);
        app.inject("ggb-container");
      } catch (e) {
        console.warn("GeoGebra no cargó:", e);
        pushToast("GeoGebra no pudo cargarse desde la CDN.", "error");
      }
    };
    document.body.appendChild(s);
  }, []);

  // sincronizar React -> GeoGebra (valores y f(x))
  useEffect(() => {
    const ap = ggbRef.current;
    if (!ap) return;
    try {
      try { ap.evalCommand(`SetValue[p, ${coinP}]`); } catch (e) {}
      try { ap.evalCommand(`SetValue[A, ${coinPayout}]`); } catch (e) {}
      try { ap.evalCommand(`SetValue[N, ${Math.max(0, plays)}]`); } catch (e) {}
      try { ap.evalCommand(`f(x) = ${ev} * x`); } catch (e) {}

      const current = bankroll[bankroll.length - 1] ?? 0;
      try {
        if (typeof ap.setCoords === "function") ap.setCoords("P", plays, current);
        else ap.evalCommand(`P = (${plays}, ${current})`);
      } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }
  }, [coinP, coinPayout, plays, bankroll, ev]);

  // trazado del histórico en GeoGebra
  function drawHistoryInGeoGebra() {
    const ap = ggbRef.current;
    if (!ap) { pushToast("GeoGebra no está listo.", "error"); return; }
    try {
      try { ap.evalCommand("Delete(L)"); } catch (e) {}
      try { ap.evalCommand("Delete(H)"); } catch (e) {}

      try {
        ap.evalCommand(`L = Sequence[(x, f(x)), x, 0, ${Math.max(0, plays)}]`);
      } catch (e) {
        try {
          const pts = bankroll.map((v, i) => `(${i}, ${v})`).join(", ");
          ap.evalCommand(`L = {${pts}}`);
        } catch (err) { console.warn("Fallback GeoGebra L falló", err); }
      }

      if (ggbDrawAsPoints) {
        try { ap.evalCommand("H = Points(L)"); } catch (e) { try { ap.evalCommand("H = Points(L)"); } catch (err) { pushToast("GeoGebra: no se pudo dibujar como puntos", "error"); } }
        pushToast("Histórico dibujado como puntos (puede ser lento)", "success");
      } else {
        try { ap.evalCommand("H = PolyLine(L)"); pushToast("Histórico dibujado como polilínea", "success"); } catch (e) {
          try { ap.evalCommand("H = Points(L)"); pushToast("GeoGebra: PolyLine falló, usado Points(L) como fallback", "success"); } catch (err) { pushToast("GeoGebra: no se pudo dibujar histórico", "error"); }
        }
      }
    } catch (e) { console.warn("drawHistoryInGeoGebra error", e); pushToast("Error al dibujar histórico en GeoGebra", "error"); }
  }

  // trazado de la tasa empírica de victoria (Win rate) en GeoGebra
  function drawWinRateInGeoGebra() {
    const ap = ggbRef.current;
    if (!ap) { pushToast("GeoGebra no está listo.", "error"); return; }
    try {
      try { ap.evalCommand("Delete(WinRate)"); } catch (e) {}

      const pts = cumWins.map((w, i) => `(${i + 1}, ${(i + 1) > 0 ? (w / (i + 1)).toFixed(6) : 0})`).join(", ");
      if (pts.length === 0) { pushToast("No hay datos para trazar la tasa de victoria.", "error"); return; }
      try {
        ap.evalCommand(`WinRate = {${pts}}`);
        try { ap.evalCommand("WinRateCurve = PolyLine(WinRate)"); pushToast("Tasa de victoria trazada en GeoGebra", "success"); } catch (e) { ap.evalCommand("WinRatePts = Points(WinRate)"); pushToast("Tasa de victoria mostrada como puntos", "success"); }
      } catch (e) { console.warn("drawWinRateInGeoGebra fallo:", e); pushToast("No se pudo trazar la tasa de victoria", "error"); }
    } catch (e) { console.warn(e); }
  }

  // helper: registrar resultado
  function recordResult({ type, value, delta }) {
    setBankroll((prev) => [...prev, +(prev[prev.length - 1] + delta).toFixed(6)]);
    setPlays((p) => p + 1);
    setWins((w) => w + (delta > 0 ? 1 : 0));
    setLosses((l) => l + (delta > 0 ? 0 : 1));
    setDeltas((arr) => [...arr, delta]);

    setCumWins((prev) => {
      const last = prev.length ? prev[prev.length - 1] : 0;
      const newVal = last + (delta > 0 ? 1 : 0);
      return [...prev, newVal];
    });

    if (type === "die") {
      setDieCounts((c) => {
        const n = [...c];
        n[value - 1]++;
        return n;
      });
      setLastDieValue(value);
    }
    if (type === "coin") {
      setCoinCounts((c) => ({ ...c, [value]: c[value] + 1 }));
      setLastCoinSide(value);
    }
    if (type === "roulette") {
      setRouletteCounts((c) => {
        const n = [...c];
        n[value]++;
        return n;
      });
    }

    // actualizamos la representación en GeoGebra (histórico y tasa)
    setTimeout(() => {
      try { drawHistoryInGeoGebra(); } catch (e) { /* ignore */ }
      try { drawWinRateInGeoGebra(); } catch (e) { /* ignore */ }
    }, 80);
  }

  // ----- PLAY VISUALS & OUTCOMES -----
  async function spinWheelVisual() {
    if (spinning) return;
    setSpinning(true);
    // info messages suppressed

    const idx = Math.floor(Math.random() * 37);
    const number = rouletteOrder[idx];
    const red = isRed(number);

    const sectorAngle = 360 / 37;
    const baseRotations = 6;
    const randomOffset = (Math.random() - 0.5) * sectorAngle;
    const targetAngle = baseRotations * 360 + idx * sectorAngle + sectorAngle / 2 + randomOffset;

    const wheel = wheelRef.current;
    if (wheel) {
      wheel.style.transition = "transform 2000ms cubic-bezier(.17,.67,.3,1)";
      wheel.style.transform = `rotate(${targetAngle}deg)`;
    }

    await new Promise((r) => setTimeout(r, 2100));

    if (wheel) {
      const normalized = targetAngle % 360;
      wheel.style.transition = "none";
      wheel.style.transform = `rotate(${normalized}deg)`;
    }

    setSpinning(false);
    const win = red;
    const delta = win ? roulettePayout * bet : -bet;
    recordResult({ type: "roulette", value: number, delta });
    setLastResult(`Ruleta: ${number} (${number === 0 ? "verde" : red ? "rojo" : "negro"}) — ${win ? "GANASTE" : "PERDISTE"} ${Math.abs(delta).toFixed(2)}`);
    pushToast(`Ruleta: salió ${number}. ${win ? "GANASTE" : "PERDISTE"} ${Math.abs(delta).toFixed(2)}`, win ? "success" : "error");
  }

  async function flipCoinVisual() {
    if (flipping) return;
    setFlipping(true);
    const coin = document.getElementById("coin3d");
    if (coin) coin.classList.add("flip");
    await new Promise((r) => setTimeout(r, 820));
    if (coin) coin.classList.remove("flip");
    setFlipping(false);

    const r = Math.random();
    const win = r < coinP;
    const delta = win ? coinPayout * bet : -bet;
    const side = win ? "cara" : "cruz";
    recordResult({ type: "coin", value: side, delta });
    setLastResult(`${side.toUpperCase()} — ${win ? "GANASTE" : "PERDISTE"} ${Math.abs(delta).toFixed(2)}`);
    pushToast(`Moneda: salió ${side.toUpperCase()}. ${win ? "GANASTE" : "PERDISTE"} ${Math.abs(delta).toFixed(2)}`, win ? "success" : "error");
  }

  async function rollDieVisual() {
    if (rolling) return;
    setRolling(true);
    const dieEl = document.getElementById("die-box");
    if (dieEl) dieEl.classList.add("shake");
    await new Promise((r) => setTimeout(r, 1000));
    if (dieEl) dieEl.classList.remove("shake");
    const out = 1 + Math.floor(Math.random() * 6);
    const win = out === dieFace;
    const delta = win ? diePayout * bet : -bet;
    recordResult({ type: "die", value: out, delta });
    setLastResult(`Dado: salió ${out} — ${win ? "GANASTE" : "PERDISTE"} ${Math.abs(delta).toFixed(2)}`);
    pushToast(`Dado: salió ${out}. ${win ? "GANASTE" : "PERDISTE"} ${Math.abs(delta).toFixed(2)}`, win ? "success" : "error");
    setRolling(false);
  }

  function playVisualOnce() {
    if (game === "roulette") spinWheelVisual();
    else if (game === "coin") flipCoinVisual();
    else rollDieVisual();
  }

  // autoplay
  useEffect(() => {
    if (!autoplay) return;
    let count = 0;
    const id = setInterval(() => {
      playVisualOnce();
      count++;
      if (count >= rounds) {
        clearInterval(id);
        setAutoplay(false);
      }
    }, Math.max(10, speed));
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, rounds, speed, game, bet, coinP, coinPayout, dieFace, diePayout]);

  function resetAll() {
    setBankroll([0]);
    setPlays(0);
    setWins(0);
    setLosses(0);
    setLastResult(null);
    setLastDieValue(null);
    setLastCoinSide(null);
    setDieCounts(Array(6).fill(0));
    setCoinCounts({ cara: 0, cruz: 0 });
    setRouletteCounts(Array(37).fill(0));
    setDeltas([]);
    setCumWins([]);
    setRecentAlerts([]);
    pushToast("Simulación reiniciada.", "success");
  }

  // Estadísticas auxiliares
  function deltasStats() {
    if (deltas.length === 0) return { mean: 0, variance: 0, std: 0 };
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const variance = deltas.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / deltas.length;
    return { mean, variance, std: Math.sqrt(variance) };
  }
  function percentile(arr, p) {
    if (!arr || arr.length === 0) return null;
    const s = [...arr].sort((a, b) => a - b);
    const idx = (p / 100) * (s.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return s[lo];
    const frac = idx - lo;
    return s[lo] * (1 - frac) + s[hi] * frac;
  }
  function countsByBlocks(block = 100) {
    if (plays === 0) return [];
    const blocks = Math.ceil(plays / block);
    const counts = Array(blocks).fill(0);
    for (let i = 0; i < plays; i++) {
      const b = Math.floor(i / block);
      if (deltas[i] > 0) counts[b]++;
    }
    return counts;
  }

  // CSV export (CORREGIDO)
  function exportCSV() {
    const rows = [];
    rows.push(["jugada", "delta", "saldo_after"]);
    let s = 0;
    for (let i = 0; i < deltas.length; i++) {
      s = +(s + deltas[i]).toFixed(6);
      rows.push([i + 1, deltas[i], s]);
    }
    const csv = rows
  .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
  .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historial_jugadas.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const current = bankroll[bankroll.length - 1] ?? 0;
  const winRate = plays > 0 ? wins / plays : 0;

  // visual sizes
  const VIS_DIM = 520;

  // ---- render ----
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <header className="max-w-7xl mx-auto flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold"> Casino Virtual · Ley de los grandes numeros</h1>
          <p className="text-slate-300 mt-1">Con Geogebra.</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Izquierda: controles + tabla */}
        <section className="lg:col-span-7 space-y-5">
          <div className="flex gap-2">
            <button onClick={() => setGame("roulette")} className={`px-3 py-2 rounded ${game === "roulette" ? "bg-rose-600" : "bg-slate-700"}`}>Ruleta</button>
            <button onClick={() => setGame("die")} className={`px-3 py-2 rounded ${game === "die" ? "bg-amber-500" : "bg-slate-700"}`}>Dado</button>
            <button onClick={() => setGame("coin")} className={`px-3 py-2 rounded ${game === "coin" ? "bg-yellow-500" : "bg-slate-700"}`}>Moneda</button>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-300">Apuesta: {bet}</label>
                <input type="range" min={1} max={50} value={bet} onChange={(e) => setBet(parseInt(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="text-xs text-slate-300">Velocidad autoplay (ms): {speed}</label>
                <input type="range" min={10} max={500} value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))} className="w-full" />
              </div>
            </div>

            {game === "coin" && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label>p(cara): {coinP.toFixed(2)}</label>
                  <input type="range" min={0} max={1} step={0.01} value={coinP} onChange={(e) => setCoinP(parseFloat(e.target.value))} />
                </div>
                <div>
                  <label>Pago si ganas: {coinPayout.toFixed(2)}×</label>
                  <input type="range" min={0.5} max={1.5} step={0.01} value={coinPayout} onChange={(e) => setCoinPayout(parseFloat(e.target.value))} />
                </div>
              </div>
            )}

            {game === "die" && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label>Cara objetivo: {dieFace}</label>
                  <input type="range" min={1} max={6} value={dieFace} onChange={(e) => setDieFace(parseInt(e.target.value))} />
                </div>
                <div>
                  <label>Pago si aciertas: {diePayout.toFixed(2)}×</label>
                  <input type="range" min={3.5} max={6} step={0.1} value={diePayout} onChange={(e) => setDiePayout(parseFloat(e.target.value))} />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={playVisualOnce} className="px-3 py-2 rounded bg-emerald-500">Jugar 1</button>
              <button onClick={() => setAutoplay((v) => !v)} className={`px-3 py-2 rounded ${autoplay ? "bg-red-500" : "bg-indigo-500"}`}>{autoplay ? "Parar Auto" : "Auto"}</button>
              <button onClick={resetAll} className="px-3 py-2 rounded bg-slate-700">Reiniciar</button>
            </div>

            <div className="mt-2 text-xs text-slate-300 bg-slate-900/40 p-2 rounded">
              <div><strong>EV por jugada:</strong> {ev.toFixed(4)}</div>
              <div><strong>Ventaja casa:</strong> {houseEdgePercent().toFixed(2)}%</div>
            </div>
          </div>

          {/* Tabla ampliada (izquierda) */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 text-sm">
            <h3 className="font-semibold mb-2">Tabla de estadísticas ampliada</h3>
            <div className="text-xs text-slate-400 mb-2">Incluye probabilidades empíricas, percentiles y conteos por bloques.</div>

            <table className="w-full text-xs table-auto border-separate" style={{ borderSpacing: "0 6px" }}>
              <thead>
                <tr className="text-slate-400 text-left"><th>Indicador</th><th className="text-right">Valor</th><th className="text-right">Extra</th></tr>
              </thead>
              <tbody>
                <tr className="bg-slate-900/30"><td className="py-2">Jugadas</td><td className="text-right">{plays}</td><td className="text-right">-</td></tr>
                <tr className="bg-slate-900/30"><td className="py-2">Ganadas</td><td className="text-right">{wins}</td><td className="text-right">Tasa {plays ? (wins / plays * 100).toFixed(2) + '%' : '—'}</td></tr>
                <tr className="bg-slate-900/30"><td className="py-2">Perdidas</td><td className="text-right">{losses}</td><td className="text-right">-</td></tr>
                <tr className="bg-slate-900/30"><td className="py-2">p(gana) teoría</td><td className="text-right">{(game === 'roulette' ? rouletteP : game === 'die' ? (1 / 6) : coinP).toFixed(4)}</td><td className="text-right">Emp: {plays ? (wins / plays).toFixed(4) : '—'}</td></tr>
                <tr className="bg-slate-900/30"><td className="py-2">EV por jugada</td><td className="text-right">{ev.toFixed(6)}</td><td className="text-right">Pérdida esperada tot: {(ev * plays).toFixed(4)}</td></tr>
                <tr className="bg-slate-900/30"><td className="py-2">Delta media</td><td className="text-right">{deltas.length ? (deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(4) : '—'}</td><td className="text-right">Desv: {deltasStats().std.toFixed(4)}</td></tr>
                <tr className="bg-slate-900/30"><td className="py-2">Percentil 25 / 50 / 75 (saldo)</td><td className="text-right">{plays ? `${percentile(bankroll, 25)?.toFixed(2)} / ${percentile(bankroll, 50)?.toFixed(2)} / ${percentile(bankroll, 75)?.toFixed(2)}` : '—'}</td><td className="text-right">Min: {bankroll.length ? bankroll[0].toFixed(2) : '—'}</td></tr>
                <tr className="bg-slate-900/30"><td className="py-2">Conteos por bloques (N=100)</td><td className="text-right">{plays ? countsByBlocks(100).join(', ') : '—'}</td><td className="text-right">Bloques: {Math.ceil(plays / 100)}</td></tr>
              </tbody>
            </table>

            <div className="mt-3 flex gap-2">
              <button onClick={exportCSV} className="px-2 py-1 text-xs rounded bg-slate-700">Exportar historial (CSV)</button>
              <button onClick={() => drawHistoryInGeoGebra()} className="px-2 py-1 text-xs rounded bg-indigo-600">Trazar histórico en GeoGebra</button>
              <button onClick={() => drawWinRateInGeoGebra()} className="px-2 py-1 text-xs rounded bg-emerald-600">Trazar tasa victoria</button>
              <button onClick={() => { try { ggbRef.current && ggbRef.current.evalCommand("Delete(L);Delete(H);Delete(WinRate);Delete(WinRateCurve);Delete(WinRatePts)"); pushToast("Histórico eliminado en GeoGebra", "success"); } catch (e) { pushToast("No se pudo eliminar histórico", "error"); } }} className="px-2 py-1 text-xs rounded bg-slate-700">Quitar histórico</button>
            </div>

            <div className="mt-3 text-xs text-slate-400">Opciones de dibujo: <label className="ml-2"><input type="checkbox" checked={ggbDrawAsPoints} onChange={(e) => setGgbDrawAsPoints(e.target.checked)} /> dibujar PUNTOS (lento)</label></div>

            {/* --- Tabla de alertas compacta --- */}
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Últimas alertas (GANASTE / PERDISTE)</h4>
              <div className="max-h-40 overflow-auto bg-slate-900/20 rounded p-2 text-xs border border-slate-800">
                {recentAlerts.length === 0 ? (
                  <div className="text-slate-400">Aquí aparecerán las últimas alertas de resultado.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400"><th className="text-left">Hora</th><th className="text-left">Tipo</th><th className="text-left">Mensaje</th></tr>
                    </thead>
                    <tbody>
                      {recentAlerts.map((a) => (
                        <tr key={a.id} className={a.type === 'success' ? 'bg-emerald-600/5' : 'bg-rose-600/5'}>
                          <td className="py-1 pr-2">{a.time}</td>
                          <td className="py-1 pr-2 font-semibold">{a.type === 'success' ? 'GANASTE' : 'PERDISTE'}</td>
                          <td className="py-1 text-slate-100">{a.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* Derecha: visuales + chart (sin applet aquí, está separado abajo) */}
        <section className="lg:col-span-5 space-y-4">
          {/* Visual grande */}
          <div className="bg-slate-800/50 rounded-2xl p-4 flex justify-center">
            <div style={{ width: VIS_DIM, height: VIS_DIM }} className="relative select-none">
              {game === "roulette" && <RouletteSVG order={rouletteOrder} isRed={isRed} wheelRef={wheelRef} />}

              {game === "die" && (
                <div id="die-anim" className="w-full h-full flex items-center justify-center">
                  <div id="die-box" onClick={() => rollDieVisual()} className="w-44 h-44 bg-white rounded-xl shadow-2xl border border-slate-200 relative cursor-pointer">
                    <DieFaceLarge value={lastDieValue ?? dieFace} />
                  </div>
                </div>
              )}

              {game === "coin" && (
                <div className="w-full h-full flex items-center justify-center perspective-1000">
                  <div onClick={() => flipCoinVisual()} className="cursor-pointer">
                    <Coin3D lastSide={lastCoinSide} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4" style={{ height: 320 }}>
            <Line options={options} data={data} />
          </div>

          {/* bottom stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/60 p-3 rounded border border-slate-700 text-sm">
              <div className="text-xs text-slate-400">Saldo actual</div>
              <div className="font-semibold text-lg">{current.toFixed(2)}</div>
            </div>
            <div className="bg-slate-800/60 p-3 rounded border border-slate-700 text-sm">
              <div className="text-xs text-slate-400">Jugadas / Ganadas</div>
              <div className="font-semibold text-lg">{plays} / {wins}</div>
            </div>
            <div className="bg-slate-800/60 p-3 rounded border border-slate-700 text-sm">
              <div className="text-xs text-slate-400">Tasa victoria</div>
              <div className="font-semibold text-lg">{(winRate * 100).toFixed(2)}%</div>
            </div>
          </div>
        </section>
      </main>

      {/* Applet GeoGebra: un poquito más abajo, SIN contenedor extra, con border-radius mínimo */}
      <div className="w-full flex justify-center" style={{ marginTop: 18, marginBottom: 36 }}>
        <div id="ggb-container" ref={ggbContainerRef} style={{ width: 700, height: 320, borderRadius: 6, overflow: 'hidden' }} />
      </div>

      {/* styles */}
      <style>{`
        .perspective-1000{ perspective: 1000px; }
        .coin{ width: 176px; height: 176px; position: relative; transform-style: preserve-3d; border-radius: 50%; }
        .coin.flip{ animation: coinflip3d 0.8s ease-in-out; }
        .coin .face{ position:absolute; inset:0; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:40px; }
        .coin .front{ background: radial-gradient(circle at 40% 35%, #ffe58a, #f1c232 60%, #ad7f1b 120%); transform: translateZ(6px); color:#5b4213; }
        .coin .back{ background: radial-gradient(circle at 60% 65%, #ffe58a, #f1c232 60%, #ad7f1b 120%); transform: rotateY(180deg) translateZ(6px); color:#5b4213; }
        .coin .edge{ position:absolute; inset:0; border-radius:50%; background: linear-gradient(90deg, #d1a452, #ad7f1b 50%, #d1a452); transform: translateZ(0); }
        .coin .rim{ position:absolute; inset:-2px; border-radius:50%; box-shadow:0 0 0 3px rgba(0,0,0,.25) inset; }
        @keyframes coinflip3d{0%{transform:rotateY(0)}50%{transform:rotateY(540deg)}100%{transform:rotateY(1080deg)}}

        @keyframes diceroll{0%{transform:translateY(0) rotate(0)}30%{transform:translateY(-12px) rotate(40deg)}60%{transform:translateY(6px) rotate(-20deg)}100%{transform:translateY(0) rotate(0)}}
        .shake{ animation: diceroll 0.75s ease-in-out; }

        .roulette-shadow{filter: drop-shadow(0 12px 24px rgba(0,0,0,.45));}
      `}</style>
    </div>
  );
}

// ----- Subcomponentes -----
function RouletteSVG({ order, isRed, wheelRef }) {
  const size = 520;
  const radius = size / 2 - 16;
  const center = size / 2;
  const sectors = 37;
  const angle = (2 * Math.PI) / sectors;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", zIndex: 30 }}>
        <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-b-[28px] border-l-transparent border-r-transparent border-b-red-600" />
      </div>

      <svg ref={wheelRef} className="roulette-shadow" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ zIndex: 10 }}>
        <defs>
          <radialGradient id="wood" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#3f2d1b" />
            <stop offset="100%" stopColor="#1f140b" />
          </radialGradient>
        </defs>

        <circle cx={center} cy={center} r={radius + 14} fill="url(#wood)" />
        <circle cx={center} cy={center} r={radius + 4} fill="#111827" />

        {order.map((num, i) => {
          const start = i * angle - Math.PI / 2;
          const end = start + angle;
          const largeArc = end - start > Math.PI ? 1 : 0;
          const x1 = center + Math.cos(start) * radius;
          const y1 = center + Math.sin(start) * radius;
          const x2 = center + Math.cos(end) * radius;
          const y2 = center + Math.sin(end) * radius;
          const path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          const color = num === 0 ? "#10b981" : isRed(num) ? "#ef4444" : "#0f172a";
          return <path key={i} d={path} fill={color} stroke="#0b1020" strokeWidth={1} />;
        })}

        {order.map((num, i) => {
          const mid = (i + 0.5) * angle - Math.PI / 2;
          const rx = center + Math.cos(mid) * (radius - 22);
          const ry = center + Math.sin(mid) * (radius - 22);
          return (
            <text key={`t${i}`} x={rx} y={ry} textAnchor="middle" dominantBaseline="middle" fontSize={num === 0 ? 13 : 14} fontWeight={700} fill={num === 0 ? "#052e1e" : "#f8fafc"} transform={`rotate(${(mid * 180) / Math.PI + 90}, ${rx}, ${ry})`}>
              {num}
            </text>
          );
        })}

        <circle cx={center} cy={center} r={radius - 60} fill="#0b1020" />
        <circle cx={center} cy={center} r={radius - 110} fill="#111827" />
      </svg>
    </div>
  );
}

function DieFaceLarge({ value = 1 }) {
  const pips = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [25, 75], [75, 25], [75, 75]],
    5: [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
    6: [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]],
  };
  return (
    <div className="w-44 h-44 bg-white rounded-xl relative">
      {pips[value].map((pos, i) => (
        <span key={i} className="absolute w-4 h-4 rounded-full bg-slate-900" style={{ left: `calc(${pos[0]}% - 8px)`, top: `calc(${pos[1]}% - 8px)` }} />
      ))}
      <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ boxShadow: "inset 0 10px 30px rgba(0,0,0,.15)" }} />
    </div>
  );
}

function Coin3D({ lastSide }) {
  return (
    <div id="coin3d" className="coin">
      <div className="edge" />
      <div className="rim" />
      <div className="face front">{lastSide ? (lastSide === "cara" ? "₵" : "◎") : "₵"}</div>
      <div className="face back">{lastSide ? (lastSide === "cara" ? "◎" : "₵") : "◎"}</div>
    </div>
  );
}