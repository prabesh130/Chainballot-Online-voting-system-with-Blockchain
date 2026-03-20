import { useEffect, useState } from "react";
import "./App.css";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import Admin from "./components/Admin";
import VoterRegistration from "./components/VoterRegistration";
import NavBar from "./components/Navbar";
import Home from "./components/Home";
import Guide from "./components/Guide";
import ContactUs from "./components/Contact_us";
import EmailVerified from "./components/emailVerified";
import Footer from "./components/Footer";
import Login from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import PageWrapper from "./components/Pagewrapper";
import Mergedvoting from "./components/Mergedvoting";

import RightDecor from "./assets/image/moon.png";
import "./index.css";

import { ApiPromise, WsProvider } from "@polkadot/api";

/* ===============================
   Scroll to top on route change
================================ */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/* ===============================
   Animated Routes
================================ */
function AnimatedRoutes({ api }: { api: ApiPromise }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageWrapper>
              <Home />
            </PageWrapper>
          }
        />

        <Route
          path="/register"
          element={
            <PageWrapper>
              <VoterRegistration />
            </PageWrapper>
          }
        />

        <Route
          path="/admin"
          element={
            <PageWrapper>
              <Admin />
            </PageWrapper>
          }
        />

        {/* ✅ FINAL VOTING FLOW */}
        <Route
          path="/merged-voting"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <Mergedvoting api={api} />
              </PageWrapper>
            </ProtectedRoute>
          }
        />

        <Route
          path="/login"
          element={
            <PageWrapper>
              <Login />
            </PageWrapper>
          }
        />

        <Route
          path="/emailVerified"
          element={
            <PageWrapper>
              <EmailVerified />
            </PageWrapper>
          }
        />

        <Route
          path="/guide"
          element={
            <PageWrapper>
              <Guide />
            </PageWrapper>
          }
        />

        <Route
          path="/contact-us"
          element={
            <PageWrapper>
              <ContactUs />
            </PageWrapper>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

/* ===============================
   App Root
================================ */
function App() {
  // ✅ Only ApiPromise, no null
  const [api, setApi] = useState<ApiPromise | null>(null);

  useEffect(() => {
    const provider = new WsProvider(import.meta.env.VITE_POLKADOT_URL);
    ApiPromise.create({ provider })
      .then((api) => {
        console.log("✅ Connected to blockchain");
        setApi(api);
      })
      .catch((err) => {
        console.error("❌ Failed to connect to blockchain", err);
      });
  }, []);

  if (!api) {
    return <p className="text-center mt-20">Connecting to blockchain…</p>;
  }

  return (
    <BrowserRouter basename="/">
      <div className="relative overflow-x-hidden">
        <NavBar />

        {/* Decorative vector */}
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
        <div className="relative z-10">
          <ScrollToTop />
          <AnimatedRoutes api={api} />
        </div>

        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
