import { useEffect } from 'react'
import './App.css'
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import VoterRegistration from './components/VoterRegistration';
import NavBar from './components/Navbar';
import Home from './components/Home';
import Guide from './components/Guide'
import Contact from './components/Contact'

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname])
  return null;
  ;}


function App() {

  return (
    <>
     <BrowserRouter basename="/">
        <NavBar />
        <ScrollToTop />
        <Routes>
          <Route path= "/" element={<Home/>} />
         <Route path="/register" element={<VoterRegistration />} />
         <Route path="/guide" element={<Guide />} />
         <Route path="/contact-us" element={<Contact/>} />
        </Routes>
        
      </BrowserRouter>
      
    </>
  )
}

export default App;
