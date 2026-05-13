import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './lib/AuthContext'
import Home from './pages/Home'
import Jummah from './pages/Jummah'
import MapPage from './pages/Map'
import MosqueDetail from './pages/MosqueDetail'
import Events, { EventDetailPage } from './pages/Events'
import Admin from './pages/Admin'
import Auth from './pages/Auth'
import Account from './pages/Account'
import ProfileSettings from './pages/ProfileSettings'
import EmailPreferences from './pages/EmailPreferences'
import AdminReview from './pages/AdminReview'
import SubmitListing from './pages/SubmitListing'
import MyListings from './pages/MyListings'
import EventPlanning, { EventVendorDetail } from './pages/EventPlanning'
import Childcare, { ChildcareDetail } from './pages/Childcare'
import ChildcareMap from './pages/ChildcareMap'
import JummahMap from './pages/JummahMap'
import Restaurants, { RestaurantDetail } from './pages/Restaurants'
import RestaurantsMap from './pages/RestaurantsMap'
import Schools, { SchoolDetail } from './pages/Schools'
import SchoolsMap from './pages/SchoolsMap'
import Lawyers, { LawyerDetail } from './pages/Lawyers'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/account" element={<Account />} />
          <Route path="/account/profile" element={<ProfileSettings />} />
          <Route path="/account/email" element={<EmailPreferences />} />
          <Route path="/submit" element={<SubmitListing />} />
          <Route path="/my-listings" element={<MyListings />} />
          <Route path="/admin/review" element={<AdminReview />} />
          <Route path="/jummah" element={<Jummah />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:slug" element={<EventDetailPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/childcare" element={<Childcare />} />
          <Route path="/childcare/map" element={<ChildcareMap />} />
          <Route path="/childcare/:slug" element={<ChildcareDetail />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/jummah/map" element={<JummahMap />} />
          <Route path="/jummah/:slug" element={<MosqueDetail />} />
          <Route path="/restaurants" element={<Restaurants />} />
          <Route path="/restaurants/map" element={<RestaurantsMap />} />
          <Route path="/restaurants/:slug" element={<RestaurantDetail />} />
          <Route path="/full-time-islamic-schools" element={<Schools />} />
          <Route path="/full-time-islamic-schools/map" element={<SchoolsMap />} />
          <Route path="/full-time-islamic-schools/:slug" element={<SchoolDetail />} />
          <Route path="/lawyers" element={<Lawyers />} />
          <Route path="/lawyers/:slug" element={<LawyerDetail />} />
          {/* Desserts/Catering/Event Planning — new canonical URL */}
          <Route path="/desserts-catering-event-planning" element={<EventPlanning />} />
          <Route path="/desserts-catering-event-planning/:slug" element={<EventVendorDetail />} />
          {/* Old URL kept as alias so existing bookmarks/links don't break */}
          <Route path="/event-planning" element={<EventPlanning />} />
          <Route path="/event-planning/:slug" element={<EventVendorDetail />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
