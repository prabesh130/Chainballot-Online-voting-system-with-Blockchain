import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import Logo from "../assets/image/chain_ballot_logo_no_bg.png";
import { useAuth } from "../context/AuthContext";

const NavBar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user, logout } = useAuth();
  const electionEndDate = new Date("2026-03-21T22:00:00");
  const isElectionEnded = currentTime > electionEndDate;

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ BONUS: Disable background scroll when dropdown is open
  useEffect(() => {
    document.body.style.overflow =
      isDropdownOpen || isMenuOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isDropdownOpen, isMenuOpen]);
  return (
    <>
      <div className="h-8"></div>

      {/* ✅ Blur overlay (dropdown only) */}
      {(isDropdownOpen || isMenuOpen) && (
        <div
          onClick={() => setIsDropdownOpen(false)}
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm"
        />
      )}

      <nav
        className={`
          sticky top-1 z-50 mx-16 h-20 rounded-3xl
          border-2 border-red-800
          transition-all duration-300
          ${
            scrolled
              ? "bg-gray-50 shadow-xl backdrop-blur-none"
              : "bg-gray-50/70 backdrop-blur-lg"
          }
        `}
      >
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-5 lg:px-10">
          {/* Logo */}
          <NavLink
            to="/"
            className="flex items-center gap-2 hover:scale-105 transition"
            onClick={closeMenu}
          >
            <img src={Logo} alt="Logo" className="w-10 md:w-14" />
            <span className="text-blue-400 md:text-3xl text-xl font-semibold">
              ChainBallot
            </span>
          </NavLink>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center text-blue-400 gap-x-2">
            <Navlink to="/" onClick={closeMenu}>
              Home
            </Navlink>
            {isElectionEnded && (
              <Navlink to="/results" onClick={closeMenu}>
                Results
              </Navlink>
            )}
            <Navlink to="/Guide" onClick={closeMenu}>
              Guide
            </Navlink>
            <Navlink to="/contact-us" onClick={closeMenu}>
              Contact
            </Navlink>

            {!user ? (
              <Navlink to="/login" onClick={closeMenu}>
                Login
              </Navlink>
            ) : (
              <div className="relative ml-2" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold hover:scale-110 transition"
                >
                  {user.name
                    ? user.name.charAt(0).toUpperCase()
                    : user.roll?.toString().charAt(0) || "👤"}
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-3 z-50 w-72 bg-white rounded-2xl shadow-2xl border overflow-hidden">
                    <div className="p-5 bg-blue-50 border-b">
                      <p className="font-bold">{user.name || "User"}</p>
                      <p className="text-sm text-blue-600">Roll: {user.roll}</p>
                      {user.email && (
                        <p className="text-xs text-gray-500 truncate mt-1">
                          {user.email}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        logout();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full px-5 py-3 text-left font-bold text-red-500 hover:bg-red-50"
                    >
                      🚪 Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Hamburger */}
          <div
            className="lg:hidden text-blue-400 cursor-pointer"
            onClick={handleMenuToggle}
          >
            ☰
          </div>
        </div>

        {/* ✅ Mobile Menu (UNCHANGED) */}
        {isMenuOpen && (
          <div className="flex flex-col mt-1 border rounded-3xl min-h-screen w-full items-center bg-gray-100 py-6 space-y-4">
            <Navlink to="/" onClick={closeMenu}>
              Home
            </Navlink>
            {isElectionEnded && (
              <Navlink to="/results" onClick={closeMenu}>
                Results
              </Navlink>
            )}
            <Navlink to="/Guide" onClick={closeMenu}>
              Guide
            </Navlink>
            <Navlink to="/contact-us" onClick={closeMenu}>
              Contact
            </Navlink>

            {!user ? (
              <Navlink to="/login" onClick={closeMenu}>
                Login
              </Navlink>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2 py-4 px-6 bg-blue-50 rounded-xl border w-64">
                  <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                    {user.name
                      ? user.name.charAt(0).toUpperCase()
                      : user.roll?.toString().charAt(0) || "👤"}
                  </div>
                  <p className="font-bold">{user.name || "User"}</p>
                  <p className="text-sm text-blue-600">Roll: {user.roll}</p>
                  {user.email && (
                    <p className="text-xs text-gray-500">{user.email}</p>
                  )}
                </div>

                <button
                  onClick={() => {
                    logout();
                    closeMenu();
                  }}
                  className="font-bold text-red-500 hover:text-red-700"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        )}
      </nav>
    </>
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
      onClick={onClick}
      className={({ isActive }) =>
        `px-3 py-2 font-bold uppercase transition ${
          isActive ? "text-theme" : "text-blue-400 hover:text-blue-900"
        }`
      }
    >
      {children}
    </NavLink>
  );
};

export default NavBar;
