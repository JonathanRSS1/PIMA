// src/components/Navbar.jsx
import React from "react";
import { Link } from "react-router-dom";

const categories = [
  
 
  { name: "Calculadora de energia", path: "/EnergyCalculator" },
  { name: "Comparaciòn de funciones", path: "/FunctionComparison" },
  { name: "Ley de los numeros grandes", path: "/LawOfLargeNumbersCasino" },
  { name: "Calculo de triangulos", path: "/TriangleAnalyzer" }





];

const Navbar = () => {
  return (
    <nav className="bg-blue-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          <div className="text-xl font-bold">PIMA</div>
          <div className="flex space-x-6">
            {categories.map((category) => (
              <Link
                key={category.name}
                to={category.path}
                className="hover:bg-blue-500 px-3 py-2 rounded-md transition"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
