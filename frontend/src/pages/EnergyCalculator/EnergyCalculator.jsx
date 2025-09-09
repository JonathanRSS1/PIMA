"use client";

import React, { useMemo, useState, useRef, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, useFBX } from "@react-three/drei";
import "./EnergyCalculator.css";

export default function EnergyCalculator() {
  const APPLIANCES = [
    { id: "horno", name: "Horno eléctrico", category: "Alto consumo", defaultKW: 2.0, icon: "🔥" },
    { id: "aire_split", name: "Aire acondicionado (split)", category: "Alto consumo", defaultKW: 1.5, icon: "❄️" },
    { id: "lavadora_caliente", name: "Lavadora (ciclo de agua caliente)", category: "Alto consumo", defaultKW: 1.2, icon: "🧺" },
    { id: "termo", name: "Calentador (termo)", category: "Alto consumo", defaultKW: 3.0, icon: "🚿" },
    { id: "secadora", name: "Secadora de ropa", category: "Alto consumo", defaultKW: 3.3, icon: "👕" },
    { id: "plancha", name: "Plancha", category: "Alto consumo", defaultKW: 1.2, icon: "👔" },
    { id: "aspiradora", name: "Aspiradora", category: "Alto consumo", defaultKW: 0.8, icon: "🧹" },

    { id: "microondas", name: "Microondas", category: "Consumo medio", defaultKW: 1.0, icon: "📱" },
    { id: "lavavajillas", name: "Lavavajillas", category: "Consumo medio", defaultKW: 1.5, icon: "🍽️" },
    { id: "tv_65", name: 'Televisor (OLED 65")', category: "Consumo medio", defaultKW: 0.2, icon: "📺" },
    { id: "pc", name: "Computadora de escritorio (PC)", category: "Consumo medio", defaultKW: 0.3, icon: "💻" },
    { id: "refrigerador", name: "Refrigerador", category: "Consumo medio", defaultKW: 0.15, icon: "🧊" },
    { id: "batidora", name: "Batidora / Licuadora", category: "Consumo medio", defaultKW: 0.5, icon: "🥤" },

    { id: "laptop", name: "Laptop", category: "Bajo consumo", defaultKW: 0.05, icon: "💻" },
    { id: "router", name: "Router", category: "Bajo consumo", defaultKW: 0.01, icon: "📡" },
    { id: "ventilador", name: "Ventilador", category: "Bajo consumo", defaultKW: 0.06, icon: "🌀" },
    { id: "consola", name: "Consola (reposo)", category: "Bajo consumo", defaultKW: 0.05, icon: "🎮" },
    { id: "foco_led", name: "Foco LED", category: "Bajo consumo", defaultKW: 0.01, icon: "💡" },
    { id: "cargador", name: "Cargador de celular", category: "Bajo consumo", defaultKW: 0.005, icon: "🔌" },
  ];

  const [selected, setSelected] = useState({});
  const [tiers, setTiers] = useState([
    { id: 1, from: 0, to: 99, rate: 0.192553 },
    { id: 2, from: 100, to: 199, rate: 0.192662 },
    { id: 3, from: 200, to: null, rate: 0.190757 },
  ]);

  // GeoGebra
  const ggbContainerId = "ggb-root-applet";
  const ggbRef = useRef(null);
  const [ggbHeight, setGgbHeight] = useState(420);
  const scriptLoadedRef = useRef(false);
  const forceTickRef = useRef(0);

  /* ---- UI helpers (igual que antes) ---- */
  function toggleAppliance(a) {
    setSelected((prev) => {
      const copy = { ...prev };
      if (copy[a.id]) delete copy[a.id];
      else
        copy[a.id] = {
          id: a.id,
          name: a.name,
          quantity: 1,
          hoursPerMonth: 30,
          powerKW: a.defaultKW ?? 0.1,
        };
      return copy;
    });
  }
  function updateSelectedField(id, field, value) {
    setSelected((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }
  function addCustomAppliance() {
    const id = `custom_${Date.now()}`;
    setSelected((prev) => ({ ...prev, [id]: { id, name: "Aparato personalizado", quantity: 1, hoursPerMonth: 30, powerKW: 0.1 } }));
  }
  function removeSelected(id) {
    setSelected((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }
  function updateTier(idx, field, value) {
    setTiers((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }
  function addTier() {
    setTiers((prev) => [...prev, { id: Date.now(), from: null, to: null, rate: 0.0 }]);
  }
  function removeTier(idx) {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  }
  function autofillElSalvador() {
    setTiers([
      { id: 1, from: 0, to: 99, rate: 0.192553 },
      { id: 2, from: 100, to: 199, rate: 0.192662 },
      { id: 3, from: 200, to: null, rate: 0.190757 },
    ]);
  }

  const categories = useMemo(() => Array.from(new Set(APPLIANCES.map((a) => a.category))), []);

  /* ---- resumen (TARIFA ÚNICA: toda la energía se cobra a la tarifa del tramo donde cae el total) ---- */
  const summary = useMemo(() => {
    const items = Object.values(selected);
    const perItem = items.map((it) => {
      const qty = Number(it.quantity) || 0;
      const hours = Number(it.hoursPerMonth) || 0;
      const kw = Number(it.powerKW) || 0;
      const monthlyKWh = qty * kw * hours;
      return { ...it, monthlyKWh };
    });

    const totalKWh = perItem.reduce((s, it) => s + it.monthlyKWh, 0);

    // normalizar y ordenar tramos
    const normalized = tiers
      .map((t) => ({ ...t }))
      .sort((a, b) => Number(a.from ?? 0) - Number(b.from ?? 0));

    // buscar el tramo donde cae el total (tarifa única)
    let applicable = normalized.find((t) => {
      const from = Number(t.from ?? 0);
      const to = t.to === null || t.to === "" ? Number.POSITIVE_INFINITY : Number(t.to);
      return totalKWh >= from && totalKWh <= to;
    });

    let totalCost = 0;
    const breakdown = [];

    if (totalKWh > 0) {
      if (applicable) {
        const rate = Number(applicable.rate || 0);
        totalCost = totalKWh * rate;
        breakdown.push({
          tier: applicable,
          consumed: totalKWh,
          cost: totalCost,
          note: "Tarifa única aplicada (todo el consumo a este tramo)",
          from: applicable.from,
          to: applicable.to,
        });
      } else {
        breakdown.push({
          tier: null,
          consumed: totalKWh,
          cost: 0,
          note: "Sin tarifa definida",
          from: 0,
          to: Number.POSITIVE_INFINITY,
        });
      }
    }

    return { perItem, totalKWh, totalCost, breakdown };
  }, [selected, tiers]);

  /* ---- computeCostForX (tarifa única) ---- */
  const computeCostForX = (x) => {
    if (!Array.isArray(tiers) || tiers.length === 0) return 0;
    if (!(x > 0)) return 0;

    const parts = tiers
      .map((t) => ({ from: Number(t.from ?? 0), to: t.to === null || t.to === "" ? Number.POSITIVE_INFINITY : Number(t.to), rate: Number(t.rate || 0) }))
      .sort((a, b) => a.from - b.from);

    const applicable = parts.find((p) => x >= p.from && x <= p.to);
    if (applicable) return x * applicable.rate;
    return 0;
  };

  /* ---------------- inject deployggb.js (igual que antes) ---------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.GGBApplet) {
      scriptLoadedRef.current = true;
      return;
    }
    if (document.querySelector('script[data-ggb="deploy"]')) return;
    const s = document.createElement("script");
    s.src = "https://cdn.geogebra.org/apps/deployggb.js";
    s.async = true;
    s.setAttribute("data-ggb", "deploy");
    s.onload = () => {
      scriptLoadedRef.current = true;
      console.info("deployggb.js cargado");
    };
    s.onerror = () => console.warn("Error cargando deployggb.js");
    document.head.appendChild(s);
  }, []);

  /* ---------------- inject/reinject GeoGebra (igual robusto) ---------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;

    let pollTimer = null;

    const ensureVisibleStyles = (container, heightPx) => {
      try {
        if (!container) return;
        container.style.position = "relative";
        container.style.display = "block";
        container.style.width = "100%";
        container.style.height = `${heightPx}px`;
        container.style.minHeight = `${heightPx}px`;
        container.style.overflow = "visible";
        container.style.background = "#fff";
        container.style.zIndex = "9999";

        const inner = container.querySelector("iframe, canvas, .geogebraweb, .GeoGebraCanvas");
        if (inner) {
          inner.style.width = "100%";
          inner.style.height = `${heightPx}px`;
          inner.style.display = "block";
          inner.style.visibility = "visible";
          inner.style.zIndex = "10000";
          inner.style.pointerEvents = "auto";
        }
        if (container.firstElementChild) {
          const first = container.firstElementChild;
          first.style.display = "block";
          first.style.visibility = "visible";
          first.style.width = "100%";
          first.style.height = `${heightPx}px`;
        }
      } catch (e) { /* swallow */ }
    };

    const inject = async () => {
      if (!scriptLoadedRef.current && !window.GGBApplet) {
        const t0 = Date.now();
        while (!window.GGBApplet && Date.now() - t0 < 2000) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      if (!window.GGBApplet) {
        console.warn("GeoGebra library aún no disponible para inyectar applet.");
        return;
      }
      const container = document.getElementById(ggbContainerId);
      if (!container) {
        console.warn("Contenedor GeoGebra no encontrado:", ggbContainerId);
        return;
      }
      try { container.innerHTML = ""; } catch {}
      const widthPx = Math.max(360, Math.floor(container.clientWidth || 900));
      const heightPx = Math.max(240, Math.floor(ggbHeight || 420));
      const params = {
        appName: "graphing",
        width: widthPx,
        height: heightPx,
        showToolBar: true,
        showAlgebraInput: false,
        showMenuBar: false,
        language: "es",
        preventFocus: true,
        appletOnLoad: function () {
          try {
            ggbRef.current = window.ggbApplet || this || document.ggbApplet;
          } catch (err) {
            ggbRef.current = this;
          }
          try { ensureVisibleStyles(document.getElementById(ggbContainerId), heightPx); } catch {}
          console.info("GeoGebra applet cargado (appletOnLoad).");
        },
      };
      try {
        // eslint-disable-next-line no-undef
        const app = new window.GGBApplet(params, true);
        app.inject(ggbContainerId);

        let attempts = 0;
        pollTimer = setInterval(() => {
          attempts += 1;
          const maybe = window.ggbApplet || document.ggbApplet || ggbRef.current || app;
          if (maybe && typeof maybe.evalCommand === "function") {
            ggbRef.current = maybe;
            ensureVisibleStyles(document.getElementById(ggbContainerId), heightPx);
            clearInterval(pollTimer);
            pollTimer = null;
            console.info("GeoGebra instancia encontrada por polling.");
            return;
          }
          if (attempts > 30) {
            ensureVisibleStyles(document.getElementById(ggbContainerId), heightPx);
            clearInterval(pollTimer);
            pollTimer = null;
            console.warn("No se encontró instancia de GeoGebra tras polling; se forzaron estilos visuales.");
          }
        }, 120);
      } catch (err) {
        console.warn("Error inyectando GeoGebra (catch):", err);
      }
    };

    inject();

    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [ggbHeight, forceTickRef.current]);

  /* ---------------- update GeoGebra (ahora tarifa única) ---------------- */
  const safeDelete = (ggb, name) => {
    if (!ggb) return;
    try {
      if (typeof ggb.deleteObject === "function") {
        try { ggb.deleteObject(name); return; } catch {}
      }
      try { ggb.evalCommand(`Delete[${name}]`); return; } catch {}
      try { ggb.evalCommand(`Delete("${name}")`); return; } catch {}
    } catch (e) {}
  };

  useEffect(() => {
    const updateGGB = () => {
      const ggb = ggbRef.current || window.ggbApplet;
      if (!ggb || typeof ggb.evalCommand !== "function") return;

      // build parts normalized for tarifa única f(x) = rate * x inside each interval
      const parts = tiers
        .map((t) => ({ from: Number(t.from ?? 0), to: t.to === null || t.to === "" ? null : Number(t.to), rate: Number(t.rate || 0) }))
        .sort((a, b) => a.from - b.from);

      // Build expression like:
      // If[x <= U1, r1*x, If[x <= U2, r2*x, r3*x]]
      const buildRateExpr = (idx) => {
        const p = parts[idx];
        if (!p) return "0";
        const upper = p.to;
        const rate = p.rate;
        if (upper === null || idx === parts.length - 1) {
          return `${rate}*x`;
        } else {
          // if x <= upper use rate*x else recurse
          return `If[x <= ${upper}, ${rate}*x, ${buildRateExpr(idx + 1)}]`;
        }
      };

      let expr = "0";
      if (parts.length > 0) expr = buildRateExpr(0);

      const toRemove = ["f", "P", "LabelText", "A_LineaConsumo", "B_LineaConsumo", "LineaConsumo", "areaFill"];
      toRemove.forEach((n) => safeDelete(ggb, n));

      try { ggb.evalCommand(`f(x) = ${expr}`); } catch (e) { console.warn("No se pudo definir f(x):", e); }

      const consumo = Number(summary.totalKWh || 0);
      const lastTo = parts.length ? parts[parts.length - 1].to : null;
      const xMaxCandidate = lastTo === null || lastTo === undefined ? Math.max(100, consumo * 1.6 || 100) : Math.max(lastTo * 1.1, consumo * 1.3, 20);
      const xMin = 0;
      const xMax = Math.max(10, Number(xMaxCandidate || 100));

      const yAtXmax = computeCostForX(xMax);
      const yAtConsumo = computeCostForX(consumo || Math.min(10, xMax));
      const yMax = Math.max(1, yAtXmax * 1.15, yAtConsumo * 1.2, 10);
      try {
        if (typeof ggb.setCoordSystem === "function") {
          ggb.setCoordSystem(xMin, 0, xMax, yMax);
        } else {
          ggb.evalCommand(`SetCoordSystem(${xMin}, ${0}, ${xMax}, ${yMax})`);
        }
      } catch (e) {}

      try { ggb.evalCommand("SetColor(f, 0, 120, 220)"); ggb.evalCommand("SetLineThickness(f, 4)"); } catch {}

      const xVal = +(consumo || 0).toFixed(6);
      const yVal = +computeCostForX(consumo || 0).toFixed(6);
      try {
        ggb.evalCommand(`P = (${xVal}, ${yVal})`);
      } catch (e) {
        try { ggb.evalCommand(`P = Point[(${xVal}, ${yVal})]`); } catch {}
      }

      try {
        const padY = Math.max(1, yMax * 0.08);
        ggb.evalCommand(`A_LineaConsumo = (${xVal}, ${Math.max(0, yVal - padY)})`);
        ggb.evalCommand(`B_LineaConsumo = (${xVal}, ${Math.max(0, yVal + padY)})`);
        ggb.evalCommand(`LineaConsumo = Line[A_LineaConsumo, B_LineaConsumo]`);
        try { ggb.evalCommand("SetLineStyle(LineaConsumo, 1)"); } catch {}
        try { ggb.evalCommand("SetColor(LineaConsumo, 160, 30, 200)"); } catch {}
      } catch (e) {
        try { ggb.evalCommand(`LineaConsumo = x = ${xVal}`); } catch {}
      }

      try {
        const textStr = `Consumo: ${xVal.toFixed(2)} kWh\\nCosto: $${yVal.toFixed(2)}`;
        safeDelete(ggb, "LabelText");
        ggb.evalCommand(`LabelText = Text["${textStr}", P]`);
      } catch (e) {
        try { ggb.evalCommand(`LabelText = Text["Consumo: ${xVal.toFixed(2)} kWh", (${xVal}, ${Math.min(yMax, yVal + yMax * 0.06)})]`); } catch {}
      }

      try {
        safeDelete(ggb, "areaFill");
        ggb.evalCommand(`areaFill = Integral[f, ${xMin}, ${xMax}]`);
        try { ggb.evalCommand("SetFilling(areaFill, 0.12)"); } catch {}
        try { ggb.evalCommand("SetColor(areaFill, 0,120,220)"); } catch {}
      } catch (e) {}
      try { ggb.evalCommand("SetPointStyle(P, 1)"); ggb.evalCommand("SetPointSize(P, 6)"); } catch {}
    };

    const t1 = setTimeout(updateGGB, 200);
    const t2 = setTimeout(updateGGB, 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [summary.totalKWh, summary.totalCost, tiers, selected]);

  /* ---------------- small sparkline ---------------- */
  const miniSpark = useMemo(() => {
    const maxX = Math.max(10, Math.ceil(Math.max(100, summary.totalKWh * 1.2 || 100)));
    const N = 48;
    const xs = [];
    for (let i = 0; i <= N; i++) xs.push((i / N) * maxX);
    const pts = xs.map((xx) => ({ x: xx, y: computeCostForX(xx) }));
    const ymin = Math.min(...pts.map((p) => p.y));
    const ymax = Math.max(...pts.map((p) => p.y));
    const viewW = 240, viewH = 80, pad = 8;
    const xToPx = (x) => pad + ((x / maxX) * (viewW - pad * 2));
    const yToPx = (y) => pad + (viewH - pad * 2) - ((y - ymin) / Math.max(1e-6, ymax - ymin)) * (viewH - pad * 2 || 1);
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xToPx(p.x).toFixed(2)},${yToPx(p.y).toFixed(2)}`).join(" ");
    return { svg: `<svg width="${viewW}" height="${viewH}" viewBox="0 0 ${viewW} ${viewH}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${viewW}" height="${viewH}" fill="#fff" rx="6"/><path d="${path}" fill="none" stroke="#0077cc" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>` };
  }, [summary, tiers]);

  /* -------------------- RECEIPT / DOWNLOAD --------------------- */
  const formatCurrency = (v) => `$${Number(v || 0).toFixed(2)}`;

  const downloadReceipt = async () => {
    try {
      const items = summary.perItem || [];
      const breakdown = summary.breakdown || [];
      const dateStr = new Date().toLocaleString();

      const itemsRows = items
        .map(
          (it) => `
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #eee; font-size:13px;">${escapeHtml(it.name)}</td>
          <td style="padding:6px 12px; border-bottom:1px solid #eee; font-size:13px; text-align:center;">${it.quantity}</td>
          <td style="padding:6px 12px; border-bottom:1px solid #eee; font-size:13px; text-align:center;">${Number(it.powerKW).toFixed(2)}</td>
          <td style="padding:6px 12px; border-bottom:1px solid #eee; font-size:13px; text-align:center;">${it.hoursPerMonth}</td>
          <td style="padding:6px 12px; border-bottom:1px solid #eee; font-size:13px; text-align:right;">${Number(it.monthlyKWh).toFixed(2)} kWh</td>
        </tr>
      `,
        )
        .join("\n");

      const breakdownRows = breakdown
        .map(
          (b) => `
        <tr>
          <td style="padding:4px 12px; font-size:13px; border-bottom:1px dashed #f1f1f1;">${
            b.tier ? `${b.tier.from ?? b.from}–${b.tier.to === null ? "∞" : b.tier.to} kWh` : `Desde ${b.from} kWh`
          }</td>
          <td style="padding:4px 12px; font-size:13px; text-align:right;">${Number(b.consumed).toFixed(2)} kWh</td>
          <td style="padding:4px 12px; font-size:13px; text-align:right;">${formatCurrency(b.cost)}</td>
        </tr>
      `,
        )
        .join("\n");

      const width = 900;
      const headerH = 140;
      const footerH = 140;
      const itemsH = Math.max(1, items.length) * 28;
      const breakdownH = Math.max(1, breakdown.length) * 28;
      const height = headerH + itemsH + breakdownH + footerH;

      const svg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>
          <defs>
            <style>
              .body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
            </style>
          </defs>
          <rect width='100%' height='100%' fill='#f7f9fc' rx='16' />
          <foreignObject x='20' y='20' width='${width - 40}' height='${height - 40}'>
            <div xmlns='http://www.w3.org/1999/xhtml' class='body' style='width:${width - 40}px; height:${height - 40}px; box-sizing:border-box; padding:20px;'>

              <div style='display:flex; justify-content:space-between; align-items:center; gap:12px;'>
                <div style='display:flex; gap:12px; align-items:center;'>
                  <div style='width:72px; height:72px; background:linear-gradient(135deg,#7c3aed,#06b6d4); border-radius:12px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:28px;'>⚡</div>
                  <div>
                    <div style='font-size:20px; font-weight:700; color:#0f172a;'>Factura de Energía — PIMA</div>
                    <div style='font-size:13px; color:#6b7280;'>Recibo estimado generado ${escapeHtml(dateStr)}</div>
                  </div>
                </div>
                <div style='text-align:right;'>
                  <div style='font-size:14px; color:#6b7280;'>Usuario</div>
                  <div style='font-weight:700; font-size:18px;'>Cliente PIMA</div>
                </div>
              </div>

              <div style='margin-top:18px; display:flex; gap:12px;'>
                <div style='flex:1; background:#ffffff; padding:12px; border-radius:10px; box-shadow:0 6px 18px rgba(12,20,40,0.04);'>
                  <div style='font-size:13px; color:#334155; margin-bottom:6px;'>Resumen</div>
                  <div style='display:flex; align-items:center; justify-content:space-between;'>
                    <div>
                      <div style='font-size:12px; color:#6b7280;'>Consumo total mensual</div>
                      <div style='font-weight:700; font-size:20px; color:#0ea5e9;'>${Number(summary.totalKWh).toFixed(2)} kWh</div>
                    </div>
                    <div style='text-align:right;'>
                      <div style='font-size:12px; color:#6b7280;'>Costo estimado</div>
                      <div style='font-weight:700; font-size:20px; color:#10b981;'>${formatCurrency(summary.totalCost)}</div>
                    </div>
                  </div>
                </div>
                <div style='width:220px; background:#ffffff; padding:12px; border-radius:10px; box-shadow:0 6px 18px rgba(12,20,40,0.04);'>
                  <div style='font-size:12px; color:#6b7280; margin-bottom:8px;'>Mini gráfico costo</div>
                  <div>${miniSpark.svg}</div>
                </div>
              </div>

              <div style='margin-top:18px; background:#fff; padding:12px; border-radius:10px; box-shadow:0 6px 18px rgba(12,20,40,0.04);'>
                <div style='font-size:14px; font-weight:700; color:#0f172a; margin-bottom:8px;'>Aparatos</div>
                <div style='overflow:auto;'>
                  <table style='width:100%; border-collapse:collapse;'>
                    <thead>
                      <tr>
                        <th style='text-align:left; padding:8px 12px; font-size:12px; color:#6b7280;'>Nombre</th>
                        <th style='padding:8px 12px; font-size:12px; color:#6b7280; text-align:center;'>Cant.</th>
                        <th style='padding:8px 12px; font-size:12px; color:#6b7280; text-align:center;'>kW</th>
                        <th style='padding:8px 12px; font-size:12px; color:#6b7280; text-align:center;'>hrs/mes</th>
                        <th style='padding:8px 12px; font-size:12px; color:#6b7280; text-align:right;'>kWh/mes</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${items.length ? itemsRows : `<tr><td colspan='5' style='padding:12px; text-align:center; color:#9ca3af;'>No hay aparatos seleccionados</td></tr>`}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style='margin-top:14px; display:flex; gap:12px;'>
                <div style='flex:1; background:#fff; padding:12px; border-radius:10px; box-shadow:0 6px 18px rgba(12,20,40,0.04);'>
                  <div style='font-size:14px; font-weight:700; color:#0f172a; margin-bottom:8px;'>Desglose por tramos</div>
                  <table style='width:100%; border-collapse:collapse;'>
                    <thead>
                      <tr>
                        <th style='text-align:left; padding:6px 12px; font-size:12px; color:#6b7280;'>Tramo</th>
                        <th style='text-align:right; padding:6px 12px; font-size:12px; color:#6b7280;'>kWh</th>
                        <th style='text-align:right; padding:6px 12px; font-size:12px; color:#6b7280;'>Costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${breakdown.length ? breakdownRows : `<tr><td colspan='3' style='padding:12px; text-align:center; color:#9ca3af;'>Sin desglose</td></tr>`}
                    </tbody>
                  </table>
                </div>

                <div style='width:260px; background:#fff; padding:12px; border-radius:10px; box-shadow:0 6px 18px rgba(12,20,40,0.04);'>
                  <div style='font-size:13px; color:#6b7280;'>Resumen</div>
                  <div style='margin-top:8px; display:flex; justify-content:space-between; align-items:center;'>
                    <div style='font-size:13px; color:#374151;'>Consumo total</div>
                    <div style='font-weight:700; font-size:16px; color:#0ea5e9;'>${Number(summary.totalKWh).toFixed(2)} kWh</div>
                  </div>
                  <div style='margin-top:8px; display:flex; justify-content:space-between; align-items:center;'>
                    <div style='font-size:13px; color:#374151;'>Costo estimado</div>
                    <div style='font-weight:700; font-size:18px; color:#10b981;'>${formatCurrency(summary.totalCost)}</div>
                  </div>

                  <div style='margin-top:12px; font-size:12px; color:#6b7280;'>Tarifas utilizadas</div>
                  <div style='margin-top:8px; font-size:13px;'>
                    ${tiers.map(t => `<div style='display:flex; justify-content:space-between; padding:6px 0; border-top:1px dashed #f3f4f6;'><div>${t.from ?? 0}${t.to === null || t.to === '' ? ' – ∞' : ' – ' + t.to} kWh</div><div style='font-weight:700;'>${formatCurrency(t.rate)}</div></div>`).join('')}
                  </div>
                </div>
              </div>

              <div style='margin-top:20px; display:flex; justify-content:space-between; align-items:center;'>
                <div style='font-size:12px; color:#9ca3af;'>Este documento es una estimación generada por PIMA.</div>
                <div style='text-align:right;'>
                  <div style='font-weight:700; font-size:18px; color:#0f172a;'>Total: ${formatCurrency(summary.totalCost)}</div>
                  <div style='font-size:12px; color:#6b7280;'>Generado: ${escapeHtml(dateStr)}</div>
                </div>
              </div>

            </div>
          </foreignObject>
        </svg>
      `;

      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const a = document.createElement('a');
      const fileName = `Factura_PIMA_${(new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-')}.svg`;
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.rel = 'noopener';
      try {
        const ev = new MouseEvent('click');
        a.dispatchEvent(ev);
      } catch (e) {
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      console.error('Error en downloadReceipt', e);
    }
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (s) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[s];
    });
  }

  /* ----------------------------- RENDER ------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-muted/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center text-2xl">⚡</div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Calculadora de Energía</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">Calcula la cantidad de energia que gastas en casa.</p>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* SELECTOR (izq) */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="xl:col-span-4">
            <div className="bg-card/80 backdrop-blur-sm rounded-3xl border border-border/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-card-foreground">Electrodomésticos</h2>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={addCustomAppliance} className="px-2 py-1 text-xs md:px-3 md:py-1.5 md:text-sm bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-lg">+ Personalizado</motion.button>
              </div>

              <div className="space-y-6">
                {categories.map((cat) => (
                  <div key={cat} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400" />
                      <h3 className="font-semibold text-card-foreground">{cat}</h3>
                    </div>
                    <div className="grid gap-2">
                      {APPLIANCES.filter((a) => a.category === cat).map((a) => (
                        <motion.div key={a.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => toggleAppliance(a)}
                          className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${selected[a.id] ? "bg-primary/10 border-primary shadow-md" : "bg-card border-border hover:shadow-md"}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{a.icon}</span>
                              <div>
                                <div className="font-medium text-sm text-card-foreground">{a.name}</div>
                                <div className="text-xs text-muted-foreground">{a.defaultKW} kW</div>
                              </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected[a.id] ? "bg-primary border-primary" : "border-border"}`}>
                              {selected[a.id] && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* SELECTED (medio) */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="xl:col-span-4">
            <div className="bg-card/80 backdrop-blur-sm rounded-3xl border border-border/50 p-6">
              <h2 className="text-2xl font-bold text-card-foreground mb-6">Aparatos Seleccionados</h2>
              <AnimatePresence mode="popLayout">
                {Object.keys(selected).length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center text-2xl">📱</div>
                    <p className="text-muted-foreground">Selecciona aparatos para comenzar</p>
                  </motion.div>
                ) : (
                  <div className="space-y-4 max-h-96 md:max-h-[calc(100vh-4rem)] overflow-y-auto">
                    {Object.values(selected).map((it) => (
                      <motion.div key={it.id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="p-4 bg-background rounded-2xl border border-border shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-card-foreground">{it.name}</div>
                            <div className="text-sm text-accent font-medium">{(it.quantity * it.powerKW * it.hoursPerMonth).toFixed(2)} kWh/mes</div>
                          </div>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removeSelected(it.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded-lg transition-colors">✕</motion.button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Cantidad</label>
                            <input type="number" min={0} value={it.quantity} onChange={(e) => updateSelectedField(it.id, "quantity", Number(e.target.value))} className="w-full p-2 bg-input border border-border rounded-lg text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Horas/mes</label>
                            <input type="number" min={0} value={it.hoursPerMonth} onChange={(e) => updateSelectedField(it.id, "hoursPerMonth", Number(e.target.value))} className="w-full p-2 bg-input border border-border rounded-lg text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Potencia (kW)</label>
                            <input type="number" step="0.01" min={0} value={it.powerKW} onChange={(e) => updateSelectedField(it.id, "powerKW", Number(e.target.value))} className="w-full p-2 bg-input border border-border rounded-lg text-sm" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* TARIFAS & RESUMEN (der) */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="xl:col-span-4">
            <div className="space-y-6">
              <div className="bg-card/80 backdrop-blur-sm rounded-3xl border border-border/50 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-card-foreground">Tarifas por Tramos</h2>
                  <div className="flex gap-2">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={autofillElSalvador} className="px-3 py-2 bg-accent text-accent-foreground rounded-xl text-sm font-medium">🇸🇻 El Salvador</motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={addTier} className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium">+ Tramo</motion.button>
                  </div>
                </div>

                <div className="space-y-3">
                  <AnimatePresence>
                    {tiers.map((t, idx) => (
                      <motion.div key={t.id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4 bg-background rounded-2xl border border-border">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">{idx + 1}</div>
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <input type="number" placeholder="Desde" value={t.from ?? ""} onChange={(e) => updateTier(idx, "from", e.target.value === "" ? null : Number(e.target.value))} className="p-2 bg-input border border-border rounded-lg text-sm" />
                            <input type="number" placeholder="Hasta (∞)" value={t.to ?? ""} onChange={(e) => updateTier(idx, "to", e.target.value === "" ? null : Number(e.target.value))} className="p-2 bg-input border border-border rounded-lg text-sm" />
                          </div>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removeTier(idx)} className="text-destructive hover:bg-destructive/10 p-2 rounded-lg">🗑️</motion.button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Tarifa:</span>
                          <input type="number" step="0.000001" placeholder="0.00" value={t.rate ?? 0} onChange={(e) => updateTier(idx, "rate", Number(e.target.value))} className="flex-1 p-2 bg-input border border-border rounded-lg text-sm" />
                          <span className="text-sm text-muted-foreground">$/kWh</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              <motion.div layout className="bg-gradient-to-br from-primary/5 to-accent/5 backdrop-blur-sm rounded-3xl border border-primary/20 p-6">
                <h3 className="text-2xl font-bold text-card-foreground mb-6 flex items-center gap-3"><span className="text-2xl">📊</span> Resumen del Consumo</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-background/50 rounded-2xl">
                    <span className="text-muted-foreground">Consumo total mensual</span>
                    <span className="text-2xl font-bold text-primary">{summary.totalKWh.toFixed(2)} kWh</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl border border-accent/20">
                    <div>
                      <div className="text-sm text-muted-foreground">Costo estimado</div>
                      <div className="text-2xl font-bold">${summary.totalCost.toFixed(2)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div dangerouslySetInnerHTML={{ __html: miniSpark.svg }} />
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={downloadReceipt} className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium">Descargar factura (SVG)</motion.button>
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* 3D Scene: ahora con Suspense para modelos FBX */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-card-foreground mb-3">Modelo 3D — Casa 3 pisos (FBX)</h3>
          <p className="text-sm text-muted-foreground mb-4">Rotar/zoom/pan con ratón. Si tienes FBX en /public los verás en la escena.</p>
          <div className="w-full h-[560px] rounded-2xl overflow-hidden border border-border/50">
            <Suspense fallback={<div style={{ padding: 24, textAlign: "center" }}>Cargando modelos 3D...</div>}>
              <Canvas shadows camera={{ position: [8, 6, 8], fov: 50 }}>
                <ambientLight intensity={0.4} />
                <directionalLight castShadow intensity={0.9} position={[10, 15, 8]} />
                <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
                  <planeGeometry args={[50, 50]} />
                  <meshStandardMaterial color="#e6eef9" />
                </mesh>
                {/* FBXHouseAndAppliances debe existir en tu proyecto; no lo toqué */}
                <FBXHouseAndAppliances selected={selected} />
                <gridHelper args={[20, 20, "#e2e8f0", "#e2e8f0"]} position={[0, -0.01, 0]} />
                <OrbitControls makeDefault enablePan enableZoom enableRotate />
              </Canvas>
            </Suspense>
          </div>
        </div>

        {/* GeoGebra natural applet */}
        <div className="mt-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-xl font-semibold text-card-foreground mb-1">GeoGebra — C(x) (costo por tramos)</h3>
              <p className="text-sm text-muted-foreground">La función C(x) muestra el costo acumulado. El punto indica tu consumo actual.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Alto:</label>
              <input type="range" min={240} max={900} value={ggbHeight} onChange={(e) => setGgbHeight(Number(e.target.value))} />
              <span className="text-sm text-muted-foreground w-12 text-right">{ggbHeight}px</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <button onClick={() => { forceTickRef.current++; }} className="px-3 py-2 rounded-md bg-primary text-primary-foreground">Recrear applet</button>
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Estado applet: {ggbRef.current || window.ggbApplet ? "listo" : "no cargado"}
            </div>
          </div>

          <div id={ggbContainerId} style={{ width: "100%", height: `${ggbHeight}px`, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)" }} />
        </div>
      </div>
    </div>
  );
}




function FBXHouseAndAppliances({ selected = {} }) {
  // Normaliza BASE_URL para que funcione en dev y en gh-pages (/PIMA/)
  const base = import.meta.env.BASE_URL || "/";
  const mk = (name) => {
    // normalizar para evitar '//' accidental
    if (!base.endsWith("/")) return `${base}/${name}`;
    return `${base}${name}`;
  };

  // Rutas construidas con BASE_URL (puedes dejar "" en las que completarás luego)
  const casaPath = mk("Casa3.fbx");
  const lavPath = mk("Lavadora.FBX");
  const secPath = mk("Secadora.FBX");
  const refPath = mk("Refrigeradora.fbx");
  const tvPath  = mk("Tv.fbx");
  const pcPath  = mk("10120_LCD_Computer_Monitor_v01_max2011_it2.fbx");
  const lampPath = mk("Space_Corona_FBX.FBX");
  const hornoPath = mk("3d-model.fbx"); // ADDED: horno

  // ---------- NUEVAS RUTAS (modelos que pediste integrar) ----------
  const conditionerPath = mk("Conditioner.fbx"); // aire acondicionado
  const mirashowerPath = mk("mirashower.fbx");   // calentador / termo
  const vacuumPath = mk("17320_Canister_vacuum_cleaner_v1_fix.fbx"); // aspiradora
  const ironPath = mk("10274_Clothes_Iron_v1_iterations-2.fbx"); // plancha
  const blenderPath = mk("11627_Blender_v2_L3.fbx"); // licuadora / batidora
  const dishwasherPath = mk("11636_Diswasher_v1_L3.fbx"); // lavavajillas
  const microwavePath = mk("11642_Microwave_v1_L3.fbx"); // microondas
  // -----------------------------------------------------------------

  // --------- PLACEHOLDERS PARA MODELOS QUE AÚN NO TIENEN ARCHIVO (DEJA VACÍO)
  const consolaPath = mk(""); // consola (rellena el nombre .fbx cuando lo tengas)
  const cargadorPath = mk(""); // cargador
  const routerPath = mk(""); // router
  const ventiladorPath = mk("Fan1.fbx"); // ventilador
  const secadorPeloPath = mk(""); // secador de pelo
  const laptopPath = mk("MAC laptop.FBX"); // LAPTOP - placeholder, añade tu archivo .fbx aquí
  // -----------------------------------------------------------------

  // useFBX (suspende si carga; si falla, React muestra fallback — atrapamos errores con try/catch abajo)
  let casaModel = null;
  let lavModel = null;
  let secModel = null;
  let refModel = null;
  let tvModel = null;
  let pcModel = null;
  let lampModel = null;
  let hornoModel = null; // ADDED: horno

  // ---------- Nuevos modelos: variables para useFBX ----------
  let conditionerModel = null;
  let mirashowerModel = null;
  let vacuumModel = null;
  let ironModel = null;
  let blenderModel = null;
  let dishwasherModel = null;
  let microwaveModel = null;

  // placeholdermodels
  let consolaModel = null;
  let cargadorModel = null;
  let routerModel = null;
  let ventiladorModel = null;
  let secadorPeloModel = null;
  let laptopModel = null; // LAPTOP model variable
  // -----------------------------------------------------------

  try {
    casaModel = useFBX(casaPath);
  } catch (e) {
    console.warn("No se pudo cargar Casa3.fbx (o la carga arrojó). Usando geometría fallback.", e);
    casaModel = null;
  }
  try { lavModel = useFBX(lavPath); } catch (e) { lavModel = null; }
  try { secModel = useFBX(secPath); } catch (e) { secModel = null; }
  try { refModel = useFBX(refPath); } catch (e) { refModel = null; }
  try { tvModel  = useFBX(tvPath);  } catch (e) { tvModel  = null; }
  try { pcModel  = useFBX(pcPath);  } catch (e) { pcModel = null; }
  try { lampModel = useFBX(lampPath); } catch (e) { lampModel = null; }
  try { hornoModel = useFBX(hornoPath); } catch (e) { hornoModel = null; }
  try { microwaveModel = useFBX(microwavePath); } catch (e) { microwaveModel = null; }

  // ---------- Cargar los nuevos FBX (si existen) ----------
  try { conditionerModel = useFBX(conditionerPath); } catch (e) { conditionerModel = null; }
  try { mirashowerModel = useFBX(mirashowerPath); } catch (e) { mirashowerModel = null; }
  try { vacuumModel = useFBX(vacuumPath); } catch (e) { vacuumModel = null; }
  try { ironModel = useFBX(ironPath); } catch (e) { ironModel = null; }
  try { blenderModel = useFBX(blenderPath); } catch (e) { blenderModel = null; }
  try { dishwasherModel = useFBX(dishwasherPath); } catch (e) { dishwasherModel = null; }

  // ---------- PLACEHOLDER LOADS (archivo vacío por ahora) ----------
  try { consolaModel = useFBX(consolaPath); } catch (e) { consolaModel = null; }
  try { cargadorModel = useFBX(cargadorPath); } catch (e) { cargadorModel = null; }
  try { routerModel = useFBX(routerPath); } catch (e) { routerModel = null; }
  try { ventiladorModel = useFBX(ventiladorPath); } catch (e) { ventiladorModel = null; }
  try { secadorPeloModel = useFBX(secadorPeloPath); } catch (e) { secadorPeloModel = null; }
  try { laptopModel = useFBX(laptopPath); } catch (e) { laptopModel = null; }
  // ----------------------------------------------------------

  useEffect(() => {
    if (!casaModel) return;
    console.group("DEBUG FBX Casa — materiales y texturas");
    const mats = new Set();
    casaModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const m = child.material;
        if (!m) {
          console.log("Mesh sin material:", child.name);
          return;
        }
        if (Array.isArray(m)) {
          m.forEach((mm, idx) => {
            console.log("Mesh:", child.name, "material index:", idx, "name:", mm.name, "color:", mm.color ? mm.color.getHexString() : null, "map:", !!mm.map);
            mats.add(mm.name || `idx_${idx}`);
          });
        } else {
          console.log("Mesh:", child.name, "material:", (m.name || "(sin nombre)"), "color:", m.color ? m.color.getHexString() : null, "map:", !!m.map);
          mats.add(m.name || "(sin nombre)");
        }
      }
    });
    console.log("Materiales únicos cargados:", Array.from(mats));
    console.groupEnd();
  }, [casaModel]);

  /* ------------------ Helpers: normalizar materiales/normales + auto-scale ------------------ */
  const normalizeAndAutoScale = (obj, targetMaxSize = 1.0) => {
    if (!obj || !obj.traverse) return;
    // recorrer meshes: normalizar materiales y calcular normales
    obj.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;

      // Geometry: si no tiene normales, calcúlalas
      try {
        const geom = child.geometry;
        if (geom && !geom.attributes.normal) {
          geom.computeVertexNormals();
        }
      } catch (err) {
        // noop
      }

      // Material: si no es MeshStandardMaterial, crear uno nuevo conservando map/color/emissive
      try {
        const m = child.material;
        if (!m) return;
        // si es array de materiales, normalizar cada uno
        if (Array.isArray(m)) {
          const newMats = m.map((mm) => {
            if (!mm) return mm;
            if (mm.isMeshStandardMaterial) {
              // asegurar encoding
              if (mm.map) {
                mm.map.encoding = THREE.sRGBEncoding;
                mm.needsUpdate = true;
              }
              return mm;
            }
            const nm = new THREE.MeshStandardMaterial({
              name: mm.name || mm.uuid,
              color: mm.color ? mm.color.clone() : new THREE.Color(0xffffff),
              emissive: mm.emissive ? mm.emissive.clone() : new THREE.Color(0x000000),
              skinning: !!mm.skinning,
              morphTargets: !!mm.morphTargets,
            });
            if (mm.map) {
              mm.map.encoding = THREE.sRGBEncoding;
              nm.map = mm.map;
              nm.needsUpdate = true;
            }
            if (typeof mm.metalness === "number") nm.metalness = mm.metalness;
            if (typeof mm.roughness === "number") nm.roughness = mm.roughness;
            nm.flatShading = false;
            return nm;
          });
          child.material = newMats;
        } else {
          if (!m.isMeshStandardMaterial) {
            const nm = new THREE.MeshStandardMaterial({
              name: m.name || m.uuid,
              color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
              emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
              skinning: !!m.skinning,
              morphTargets: !!m.morphTargets,
            });
            if (m.map) {
              m.map.encoding = THREE.sRGBEncoding;
              nm.map = m.map;
              nm.needsUpdate = true;
            }
            if (typeof m.metalness === "number") nm.metalness = m.metalness;
            if (typeof m.roughness === "number") nm.roughness = m.roughness;
            nm.flatShading = false;
            child.material = nm;
          } else {
            // si ya es MeshStandardMaterial, asegurar sRGB para mapas
            if (child.material.map) {
              child.material.map.encoding = THREE.sRGBEncoding;
              child.material.needsUpdate = true;
            }
          }
        }
      } catch (err) {
        console.warn("normalizeAndAutoScale - material normalization error", err);
      }
    });

    // Auto-scale: ajustar escala del root `obj` para que su mayor dimensión sea targetMaxSize
    try {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x || 0.0001, size.y || 0.0001, size.z || 0.0001);
      if (maxDim > 0) {
        const s = targetMaxSize / maxDim;
        obj.scale.setScalar(s);
        // centrar en su origen (opcional: mantengo posición actual pero ajusto offset)
        const center = new THREE.Vector3();
        box.getCenter(center);
        obj.position.sub(center.multiplyScalar(s)); // recentrar para que su centro quede cerca del origen
      }
    } catch (err) {
      // noop
    }
  };

  /* ------------------ Aplicar normalización/auto-scale cuando los modelos estén listos ------------------ */
  useEffect(() => {
    const toNormalize = [
      casaModel, lavModel, secModel, refModel, tvModel, pcModel, lampModel, hornoModel,
      conditionerModel, mirashowerModel, vacuumModel, ironModel, blenderModel, dishwasherModel, microwaveModel,
      consolaModel, cargadorModel, routerModel, ventiladorModel, secadorPeloModel, laptopModel
    ];
    toNormalize.forEach((m) => {
      if (m) {
        try {
          normalizeAndAutoScale(m, 0.8); // 0.8 como tamaño de referencia (ajusta si hace falta)
        } catch (e) { /* swallow */ }
      }
    });
    console.log("normalizeAndAutoScale aplicado a modelos existentes.");
  }, [
    casaModel, lavModel, secModel, refModel, tvModel, pcModel, lampModel, hornoModel,
    conditionerModel, mirashowerModel, vacuumModel, ironModel, blenderModel, dishwasherModel, microwaveModel,
    consolaModel, cargadorModel, routerModel, ventiladorModel, secadorPeloModel, laptopModel
  ]);

  // Anchors (misma lógica previa) - posiciones en la escena (x,y,z), floor index menor = piso inferior
  const floorHeight = 1.2;
  const gap = 0.03;
  const anchors = {
    tv_65: [{ floor: 0, pos: [-23, 8.16, 2.4], rotY: 0 }],
    secadora: [{ floor: 0, pos: [105, -39, -29], rotY: 0 }],
    refrigerador: [{ floor: 0, pos: [-24, 0, -20], rotY: 0 }],
    lavadora_caliente: [{ floor: 0, pos: [112, -39, -29], rotY: 0 }],
    foco_led: [{ floor: 0, pos: [1, -5, 7], rotY: 0 }],
    horno: [{ floor: 0, pos: [-5.6, 0, -22], rotY: 0 }],
    pc: [{ floor: 1, pos: [17, 36, 8], rotY: 0 }],
    microondas: [{ floor: 0, pos: [1.2, 7, -21], rotY: 0 }],
    lavavajillas: [{ floor: 0, pos: [0.8, -0.35, -19.0], rotY: 0 }],
    laptop: [{ floor: 0, pos: [-31, 44.5, 6.3], rotY: 20 }],
    cargador: [{ floor: 2, pos: [0.6, -0.1, -0.2], rotY: 0 }],
    router: [{ floor: 2, pos: [-0.8, -0.1, -0.2], rotY: 0 }],
    consola: [{ floor: 1, pos: [0.8, -0.2, 0.7], rotY: 0 }],
    batidora: [{ floor: 0, pos: [0.4, 7, -19], rotY: 0 }], // licuadora / batidora
ventilador: [{ floor: 0, pos: [1.0, 30, -3.5], rotY: 0, rotZ: Math.PI }],    
  secador_pelo: [{ floor: 2, pos: [-1.0, -0.2, 0.5], rotY: 0 }],
    aspiradora: [{ floor: 0, pos: [10.0, 0, -15], rotY: 0 }],
    aire_split: [{ floor: 0, pos: [-22, 45, 19], rotY: 0 }], // aire acondicionado
    termo: [{ floor: 0, pos: [-1.0, 22, 7.5], rotY: 0 }], // calentador / termo
    plancha: [{ floor: 0, pos: [21.0, 16.5, 19.0], rotY: 0 }], // plancha
  };

  function resolveAnchorsFor(id, quantity) {
    const base = anchors[id] ?? [{ floor: 0, pos: [0, 0, 0], rotY: 0 }];
    const resolved = [];
    for (let i = 0; i < quantity; i++) {
      const a = base[i % base.length];
      const offsetX = (Math.floor(i / base.length) * 0.4) * (i % 2 === 0 ? 1 : -1);
      resolved.push({ floor: a.floor, pos: [a.pos[0] + offsetX, a.pos[1], a.pos[2] + Math.floor(i / base.length) * 0.2], rotY: a.rotY ?? 0 });
    }
    return resolved;
  }

  // helper que devuelve un <primitive> con clone y escala
  const renderModelPrimitive = (model, opts = {}) => {
    if (!model) return null;
    // model es un Group (Object3D). clonar por safety.
    const { scale = 1, rotation = [0, 0, 0] } = opts;
    // creamos clon memoizado para evitar clones en cada render
    const cloned = useMemo(() => {
      try {
        const c = model.clone(true);
        c.scale.set(scale, scale, scale);
        c.rotation.set(rotation[0], rotation[1], rotation[2]);
        return c;
      } catch (e) {
        console.warn("Error clonando FBX:", e);
        return model;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [model, scale, rotation.join(",")]);
    return <primitive object={cloned} />;
  };

  // Render casa: si existe Casa3.fbx la colocamos (scale ajustable), si no hacemos fallback con geometría en pisos
  const floors = 3;
  const floorSize = { width: 4.5, depth: 6 };

  return (
    <group>
      {/* Si existe el FBX de la casa, lo mostramos centrado y escalado.
          Ajusta scaleHouse si tu FBX viene muy grande/pequeño. */}
      {casaModel ? (
        <group position={[0, -0.5, 0]} scale={[0.02, 0.02, 0.02]}>
          {/* puedes ajustar la escala manualmente si tu FBX tiene otra unidad */}
          <primitive object={casaModel.clone(true)} />
        </group>
      ) : (
        // fallback: montaje similar a House3DFloored (simplificado)
        <>
          <mesh position={[0, -0.01, 0]} receiveShadow>
            <boxGeometry args={[floorSize.width + 0.6, 0.02, floorSize.depth + 0.6]} />
            <meshStandardMaterial color={"#d1d5db"} />
          </mesh>
          {[...Array(floors)].map((_, f) => {
            const yCenter = f * (floorHeight + gap) + floorHeight / 2;
            return (
              <group key={`floor-fallback-${f}`} position={[0, yCenter, 0]}>
                <mesh position={[0, -floorHeight / 2 + 0.01, 0]} receiveShadow>
                  <boxGeometry args={[floorSize.width, 0.02, floorSize.depth]} />
                  <meshStandardMaterial color={"#f8fafc"} />
                </mesh>
                <mesh position={[0, floorHeight / 2 - 0.01, 0]} receiveShadow>
                  <boxGeometry args={[floorSize.width, 0.02, floorSize.depth]} />
                  <meshStandardMaterial color={"#d1d5db"} />
                </mesh>
              </group>
            );
          })}
        </>
      )}

      {/* Agora los electrodomésticos seleccionados — si existe FBX, usamos eso, si no usamos la geometría simple */}
      {Object.values(selected).map((item) => {
        const id = item.id;
        const qty = Number(item.quantity || 1);
        const resolved = resolveAnchorsFor(id, qty);
        return resolved.map((r, idx) => {
          const worldY = r.floor * (floorHeight + gap) + r.pos[1];
          const worldX = r.pos[0];
          const worldZ = r.pos[2];
          const key = `${id}-${item.id || id}-${idx}`;

          // decide qué modelo FBX usar
          let modelObj = null;
          let modelScale = 1;

          // EXISTENTES
          if (id === "lavadora_caliente" || id === "lavadora") { modelObj = lavModel; modelScale = 0.06; }
          if (id === "secadora") { modelObj = secModel; modelScale = 0.06; }
          if (id === "refrigerador") { modelObj = refModel; modelScale = 0.08; }
          if (id === "tv_65") { modelObj = tvModel; modelScale = 0.2; }
          if (id === "pc") { modelObj = pcModel; modelScale = 0.1; }
          if (id === "foco_led") { modelObj = lampModel; modelScale = 0.2; }
          if (id === "horno") { modelObj = hornoModel; modelScale = 0.17; }

          // --------- NUEVOS MAPEOS (los que pediste integrar) ----------
          if (id === "aire_split") { modelObj = conditionerModel; modelScale = 0.09; }         // Conditioner.fbx
          if (id === "termo") { modelObj = mirashowerModel; modelScale = 0.01; }               // mirashower.fbx
          if (id === "aspiradora") { modelObj = vacuumModel; modelScale = 0.05; }              // vacuum FBX
          if (id === "plancha") { modelObj = ironModel; modelScale = 0.07; }                   // iron FBX
          if (id === "batidora") { modelObj = blenderModel; modelScale = 0.07; }               // blender FBX
          if (id === "lavavajillas") { modelObj = dishwasherModel; modelScale = 0.09; }        // dishwasher FBX
          if (id === "microondas") { modelObj = microwaveModel; modelScale = 0.07; }

          // PLACEHOLDER MAPEOS: tendrás que poner los .fbx en las rutas arriba
          if (id === "consola") { modelObj = consolaModel; modelScale = 0.08; }
          if (id === "cargador") { modelObj = cargadorModel; modelScale = 0.06; }
          if (id === "router") { modelObj = routerModel; modelScale = 0.06; }
          if (id === "ventilador") { modelObj = ventiladorModel; modelScale = 0.01; }
          if (id === "secador_pelo") { modelObj = secadorPeloModel; modelScale = 0.06; }
          if (id === "laptop") { modelObj = laptopModel; modelScale = 0.05; } // LAPTOP mapping
          // ------------------------------------------------------------

          // si existe modelObj, render primitive clonado
          if (modelObj) {
            try {
              const cloned = modelObj.clone(true);
              // multiplicar la escala actual (auto-scale aplicada) por el multiplicador que definiste
              cloned.scale.multiplyScalar(modelScale);

              // ---------- CASO ESPECIAL: varios que solemos "upright" ----------
              if (id === "termo"|| id === "plancha"|| id === "aspiradora" || id === "lavavajillas" || id === "microondas" || id === "batidora" || id === "pc" || id === "consola" ) {
                // aplicamos Z primero (lo "levanta") y después Y para que mire la izquierda/usuario
                const extraRotY = r.rotY ?? 0;
                const yRotation = Math.PI / 2 + extraRotY; // ajuste: 90deg + offset
                return (
                  <group key={key} position={[worldX, worldY, worldZ]}>
                    {/* Rotación en Z primero: lo pone "de pie" */}
                    <group rotation={[0, 0, Math.PI / 2]}>
                      {/* Luego rotación en Y: apuntar hacia la izquierda/usuario */}
                      <group rotation={[0, yRotation, 0]}>
                        <primitive object={cloned} />
                      </group>
                    </group>
                    <Html distanceFactor={8} center>
                      <div style={{ fontSize: 11, padding: "4px 6px", background: "rgba(255,255,255,0.92)", borderRadius: 6, color: "#0f172a", border: "1px solid rgba(0,0,0,0.06)" }}>{item.name}</div>
                    </Html>
                  </group>
                );
              }

              // 🚀 Caso normal (otros objetos)
              return (
                <group key={key} position={[worldX, worldY, worldZ]} rotation={[0, r.rotY || 0, 0]}>
                  <primitive object={cloned} />
                  <Html distanceFactor={8} center>
                    <div style={{ fontSize: 11, padding: "4px 6px", background: "rgba(255,255,255,0.92)", borderRadius: 6, color: "#0f172a", border: "1px solid rgba(0,0,0,0.06)" }}>{item.name}</div>
                  </Html>
                </group>
              );
            } catch (e) {
              console.warn("Error clonando/mostrando modelo FBX:", e);
            }
          }

          // fallback: las geometrías simples (tu antiguo ApplianceModel)
          return (
            <group key={key} position={[worldX, worldY, worldZ]} rotation={[0, r.rotY || 0, 0]}>
              <ApplianceFallback id={id} />
              <Html distanceFactor={8} center>
                <div style={{ fontSize: 11, padding: "4px 6px", background: "rgba(255,255,255,0.92)", borderRadius: 6, color: "#0f172a", border: "1px solid rgba(0,0,0,0.06)" }}>{item.name}</div>
              </Html>
            </group>
          );
        });
      })}
    </group>
  );
}

/* ---------------- Fallback simple para electrodomésticos (si no hay FBX) --------------- */
function ApplianceFallback({ id }) {
  switch (id) {
    case "foco_led":
      return (
        <group>
          {/* Base */}
          <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.2, 16]} />
            <meshStandardMaterial color={"#e5e7eb"} />
          </mesh>
          {/* Bombilla */}
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial emissive={"#fef9c3"} emissiveIntensity={1.5} color={"#fef9c3"} />
          </mesh>
        </group>
      );

    case "tv_65":
      return (
        <group rotation={[0, 0, 0]}>
          <mesh>
            <boxGeometry args={[1.6, 0.9, 0.06]} />
            <meshStandardMaterial color={"#0f172a"} />
          </mesh>
          <mesh position={[0, -0.5, 0.03]}>
            <boxGeometry args={[0.4, 0.06, 0.06]} />
            <meshStandardMaterial color={"#374151"} />
          </mesh>
        </group>
      );
    case "refrigerador":
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.9, 1.4, 0.7]} />
            <meshStandardMaterial color={"#ecfccb"} />
          </mesh>
          <mesh position={[0.28, -0.4, 0.28]}>
            <boxGeometry args={[0.06, 0.5, 0.06]} />
            <meshStandardMaterial color={"#94a3b8"} />
          </mesh>
        </group>
      );
    case "lavadora_caliente":
    case "lavadora":
    case "lavavajillas":
      return (
        <mesh>
          <boxGeometry args={[0.8, 0.9, 0.7]} />
          <meshStandardMaterial color={"#dbeafe"} />
        </mesh>
      );
    case "microondas":
      return (
        <mesh>
          <boxGeometry args={[0.7, 0.4, 0.5]} />
          <meshStandardMaterial color={"#fde68a"} />
        </mesh>
      );
    case "pc":
    case "laptop":
      return (
        <group>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.5, 0.35, 0.4]} />
            <meshStandardMaterial color={"#c7f9cc"} />
          </mesh>
          <mesh position={[0, 0.18, -0.08]}>
            <boxGeometry args={[0.5, 0.02, 0.4]} />
            <meshStandardMaterial color={"#0f172a"} />
          </mesh>
        </group>
      );
    case "horno":
      return (
        <mesh>
          <boxGeometry args={[0.9, 0.8, 0.7]} />
          <meshStandardMaterial color={"#fca5a5"} />
        </mesh>
      );
    case "secadora":
      return (
        <mesh>
          <boxGeometry args={[0.85, 1.0, 0.7]} />
          <meshStandardMaterial color={"#f3e8ff"} />
        </mesh>
      );
    case "ventilador":
      return (
        <mesh>
          <cylinderGeometry args={[0.12, 0.12, 0.02, 16]} />
          <meshStandardMaterial color={"#bfe3ff"} />
        </mesh>
      );
    default:
      return (
        <mesh>
          <boxGeometry args={[0.6, 0.5, 0.5]} />
          <meshStandardMaterial color={"#9ca3af"} />
        </mesh>
      );
  }
}