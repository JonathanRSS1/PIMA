// src/components/Navbar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import LogoPima from "../../assets/LogoPima.svg"; 

const categories = [
  { name: "Calculadora de energía", path: "/EnergyCalculator" },
  { name: "Comparación de funciones", path: "/FunctionComparison" },
  { name: "Ley de los grandes números", path: "/LawOfLargeNumbersCasino" },
  { name: "Cálculo de triángulos", path: "/TriangleAnalyzer" },
];

const Navbar = () => {
  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 70, damping: 15 }}
        className="bg-gradient-to-r from-purple-600 to-purple-800
 text-white shadow-lg fixed w-full top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between h-16 items-center">
            {/* Logo clickable */}
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex items-center space-x-3"
            >
              <NavLink to="/" className="flex items-center space-x-3">
                <img
                  src={LogoPima}
                  alt="Logo PIMA"
                  className="h-14 w-auto object-contain drop-shadow-md cursor-pointer"
                />
                <span className="text-2xl font-extrabold tracking-wide">
                  PIMA
                </span>
              </NavLink>
            </motion.div>

            {/* Categorías */}
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="hidden md:flex space-x-6"
            >
              {categories.map((category) => (
                <motion.div
                  key={category.name}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <NavLink
                    to={category.path}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-lg font-medium transition-colors duration-300 
                      ${
                        isActive
                          ? "bg-white text-blue-700 shadow-md" 
                          : "hover:bg-white hover:text-blue-700"
                      }`
                    }
                  >
                    {category.name}
                  </NavLink>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </motion.nav>

      <div className="h-16"></div>
    </>
  );
};

export default Navbar;
