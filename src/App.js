import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import Jummah from './pages/Jummah'
import Events from './pages/Events'
import MapPage from './pages/Map'
import MosqueDetail from './pages/MosqueDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jummah" element={<Jummah />} />
        <Route path="/events" element={<Events />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/jummah/:slug" element={<MosqueDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
