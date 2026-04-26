import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import Jummah from './pages/Jummah'
import MapPage from './pages/Map'
import MosqueDetail from './pages/MosqueDetail'
import Events, { EventDetailPage } from './pages/Events'
import Admin from './pages/Admin'
import EventsMap from './pages/EventsMap'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jummah" element={<Jummah />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:slug" element={<EventDetailPage />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/events/map" element={<EventsMap />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/jummah/:slug" element={<MosqueDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
