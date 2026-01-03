import { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import VoterRegistration from "./components/VoterRegistration";
import NavBar from "./components/Navbar";
import Home from "./components/Home";
import Guide from "./components/Guide";
import Contact from "./components/Contact";
import "./index.css"
import RightDecor from "./assets/image/moon.png";
import Footer from "./components/Footer";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

//

function App() {
  return (
    <BrowserRouter basename="/">
      {/* Left-side decorative vector */}
      <img
        src={RightDecor}
        alt="Decorative Vector"
        className="
             hidden md:block

    absolute -right-40 -top-11
     pointer-events-none
    z-0
    rotate-[240deg]
    blur-sm
          transition-all duration-700 ease-in-out
        "
      />
      {/* Main content */}
      <div className="relative z-0 ">
        <NavBar />
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<VoterRegistration />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/contact-us" element={<Contact />} />
        </Routes>
      </div>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
