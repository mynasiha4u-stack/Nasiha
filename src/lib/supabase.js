import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1eW1oeGZob3FyeXhuanVicnl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY2OTMsImV4cCI6MjA5MTAwMjY5M30.yP_jGHNmJcGKaKXF7O-ctJaO8iqhujqZ8AKSGc_yGSY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
