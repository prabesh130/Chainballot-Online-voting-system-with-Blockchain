import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import Logo from "../assets/image/chain_ballot_logo_no_bg.png";

const NavBar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <nav className="sticky rounded-3xl top-0 left-0 z-50 w-full h-20 bg-gray-50 backdrop-filter backdrop-blur-lg shadow-lg flex transition-all justify-between duration-300 hover:bg-slate-900/98">
      <div className="flex w-full items-center justify-between px-4 max-w-full mx-auto">
        <div className="flex items-center flex-shrink-0">
          <NavLink
            to="/"
            className="flex items-center gap-2 group transition-transform duration-300 hover:scale-105"
            onClick={closeMenu}
          >
            <img
              src={Logo}
              alt="Logo"
              className="h-14 w-14 transition-transform duration-300 group-hover:rotate-12"
            />
            <span className="text-blue-400 hover:text-blue-900 text-3xl font-semibold tracking-wider group-hover:text-theme transition-colors duration-300">
              ChainBallot
            </span>
          </NavLink>
        </div>

        <div className="hidden lg:flex flex-row text-blue-400 items-center gap-x-1 xl:gap-x-2">
          <Navlink to="/" onClick={closeMenu}>
            Home
          </Navlink>
          <Navlink to="/Guide" onClick={closeMenu}>
            Guide
          </Navlink>

          <Navlink to="/contact-us" onClick={closeMenu}>
            Contact
          </Navlink>

          <Navlink to="/register" onClick={closeMenu}>
            Register
          </Navlink>
        </div>

        <div
          className="lg:hidden text-blue-400 hover:text-theme transition-color duration-500 cursor-pointer"
          onClick={handleMenuToggle}
        >
          <svg
            className="h-8 w-8"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            {isMenuOpen ? (
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M18.3 5.71a.996.996 0 00-1.41 0L12 10.59 7.11 5.7A.996.996 0 105.7 7.11L10.59 12 5.7 16.89a.996.996 0 101.41 1.41L12 13.41l4.89 4.89a.996.996 0 101.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"
              />
            ) : (
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3 12h18v2H3v-2zm0-5h18v2H3V7zm0 10h18v2H3v-2z"
              />
            )}
          </svg>
        </div>
      </div>

      {isMenuOpen && (
        <div className="lg:hidden fixed top-20 text-center text-blue-400 backdrop-blur bg-blue-200 w-full  p-4 flex py-48 justify-evenly flex-col">
          <Navlink to="/" onClick={closeMenu}>
            Home
          </Navlink>
          <Navlink to="/contact-us" onClick={closeMenu}>
            Contact Us
          </Navlink>
          <Navlink to="/register" onClick={closeMenu}>
            Register
          </Navlink>
        </div>
      )}
    </nav>
  );
};

interface NavlinkProps {
  to: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const Navlink: React.FC<NavlinkProps> = ({ to, children, onClick }) => {
  const baseurl = ".";

  return (
    <NavLink
      to={baseurl + to}
      className={({ isActive }) => {
        const baseClasses =
          "px-3 xl:px-4 py-2 font-bold uppercase tracking-wide transition-all duration-300 text-sm xl:text-base whitespace-nowrap relative group ";
        return isActive
          ? baseClasses +
              "text-theme after:absolute  after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-theme after:scale-x-100 after:transition-transform after:duration-300"
          : baseClasses +
              "text-blue-400 hover:text-theme hover:text-blue-900 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-theme after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300";
      }}
      onClick={onClick}
    >
      {children}
    </NavLink>
  );
};

export default NavBar;
