import { useEffect } from "react";
import "./App.css";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import VoterRegistration from "./components/VoterRegistration";
import NavBar from "./components/Navbar";
import Home from "./components/Home";
import Guide from "./components/Guide";
import ContactUs from "./components/Contact_us";
import EmailVerified from "./components/emailVerified";
import "./index.css";
import RightDecor from "./assets/image/moon.png";
import Footer from "./components/Footer";
import Login from "./components/Login";
import VotingPortal from "./components/VotingPortal";
import ProtectedRoute from "./components/ProtectedRoute";
import VoteProcessing from "./components/VoteProcessing";
import PageWrapper from "./components/Pagewrapper";

/* Scroll to top on route change */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/* Animated Routes */
function AnimatedRoutes() {
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

        <Route
          path="/voting-portal"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <VotingPortal />
              </PageWrapper>
            </ProtectedRoute>
          }
        />

        <Route
          path="/process-vote"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <VoteProcessing />
              </PageWrapper>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
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
          <AnimatedRoutes />
        </div>

        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
