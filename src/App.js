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
import Childcare, { ChildcareDetail } from './pages/Childcare'
import ChildcareMap from './pages/ChildcareMap'
import JummahMap from './pages/JummahMap'
import Restaurants, { RestaurantDetail } from './pages/Restaurants'
import RestaurantsMap from './pages/RestaurantsMap'

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
        <Route path="/childcare" element={<Childcare />} />
        <Route path="/childcare/map" element={<ChildcareMap />} />
        <Route path="/childcare/:slug" element={<ChildcareDetail />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/jummah/map" element={<JummahMap />} />
        <Route path="/jummah/:slug" element={<MosqueDetail />} />
        <Route path="/restaurants" element={<Restaurants />} />
        <Route path="/restaurants/map" element={<RestaurantsMap />} />
        <Route path="/restaurants/:slug" element={<RestaurantDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
