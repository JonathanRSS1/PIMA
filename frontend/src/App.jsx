// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./global/components/NavBar";


import EnergyCalculator from "./pages/EnergyCalculator/EnergyCalculator";
import FunctionComparison from "./pages/FunctionComparison/FunctionComparison";
import LawOfLargeNumbersCasino from "./pages/LawOfLargeNumbersCasino/LawOfLargeNumbersCasino";
import TriangleAnalizer from "./pages/TriangleAnalyzer/TriangleAnalyzer";



// Importa aquí las demás páginas cuando las tengas
// import Geometria from "./pages/Geometria/Geometria";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <Routes>
         
          
          <Route path="/EnergyCalculator" element={<EnergyCalculator />} />
          <Route path="/FunctionComparison" element={<FunctionComparison />} />
          <Route path="/LawOfLargeNumbersCasino" element={<LawOfLargeNumbersCasino />} />
          <Route path="/TriangleAnalyzer" element={<TriangleAnalizer />} />





          {/* <Route path="/geometria" element={<Geometria />} /> */}
          {/* Agrega rutas de otras páginas aquí */}
          <Route
            path="*"
            element={
              <div className="p-6">
                <h1 className="text-2xl font-bold">Bienvenido a la App de GeoGebra</h1>
                <p>Selecciona una categoría en la barra de navegación para comenzar.</p>
              </div>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
