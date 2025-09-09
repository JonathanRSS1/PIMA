// src/App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "./global/components/NavBar";

import EnergyCalculator from "./pages/EnergyCalculator/EnergyCalculator";
import FunctionComparison from "./pages/FunctionComparison/FunctionComparison";
import LawOfLargeNumbersCasino from "./pages/LawOfLargeNumbersCasino/LawOfLargeNumbersCasino";
import TriangleAnalizer from "./pages/TriangleAnalyzer/TriangleAnalyzer";

function FloatingSymbols() {
  const symbols = [
    "∑","√","π","∞","∫","Δ","θ","±","≈","≠","≤","≥","α","β","γ","δ",
    "Ω","µ","σ","λ","ϕ","ψ","∂","∇","∴","∵","⊂","⊃","⊆","⊇","∩","∪"
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 40 }).map((_, i) => {
        const sym = symbols[Math.floor(Math.random() * symbols.length)];

        // Tamaños aleatorios (pequeños y grandes mezclados)
        const size = `${Math.floor(20 + Math.random() * 50)}px`;

        // Posición inicial aleatoria pero fija en el centro
        const startX = Math.random() * 80 + 10; // margen para que no estén en el borde
        const startY = Math.random() * 70 + 15;

        // Movimiento flotante pequeño
        const offsetX = Math.random() * 20 - 10; // -10% a +10%
        const offsetY = Math.random() * 20 - 10;

        // Duración distinta para cada símbolo
        const duration = 6 + Math.random() * 6;

        return (
          <motion.div
            key={i}
            className="absolute text-gray-400 select-none"
            style={{ fontSize: size, left: `${startX}%`, top: `${startY}%` }}
            animate={{
              x: [0, offsetX, 0],
              y: [0, offsetY, 0],
              rotate: [0, 15, -15, 0],
            }}
            transition={{
              duration,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "easeInOut",
            }}
          >
            {sym}
          </motion.div>
        );
      })}
    </div>
  );
}

function Home() {
  return (
    <div className="relative flex flex-col items-center justify-center h-[80vh] text-center">
      <FloatingSymbols />
      <motion.h1
        className="text-5xl md:text-6xl font-extrabold text-purple-700 drop-shadow-lg relative z-10"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        ¡Bienvenido a PIMA!
      </motion.h1>
      <motion.p
        className="mt-4 text-lg md:text-2xl text-gray-700 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.5 }}
      >
        Plataforma Integral de Matemáticas Aplicadas
      </motion.p>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-pink-300 relative overflow-hidden">
      <Navbar />
      <Routes>
        <Route path="/EnergyCalculator" element={<EnergyCalculator />} />
        <Route path="/FunctionComparison" element={<FunctionComparison />} />
        <Route path="/LawOfLargeNumbersCasino" element={<LawOfLargeNumbersCasino />} />
        <Route path="/TriangleAnalyzer" element={<TriangleAnalizer />} />
        
        {/* Página por defecto */}
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}

export default App;
