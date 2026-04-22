const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://puymhxfhoqryxnjubryw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1eW1oeGZob3FyeXhuanVicnl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY2OTMsImV4cCI6MjA5MTAwMjY5M30.yP_jGHNmJcGKaKXF7O-ctJaO8iqhujqZ8AKSGc_yGSY'
)

const EVENTS_CAT = 'd916a550-c316-40a9-9582-35836417b6cb'

async function main() {
  // Delete cancelled
  const { data: cancelled, error: e1 } = await supabase
    .from('content')
    .delete()
    .eq('category_id', EVENTS_CAT)
    .ilike('name', '%*canceled*%')
    .select('name')

  console.log(`Deleted ${cancelled?.length || 0} cancelled events`)

  // Delete private
  const { data: priv, error: e2 } = await supabase
    .from('content')
    .delete()
    .eq('category_id', EVENTS_CAT)
    .ilike('name', 'private%event%')
    .select('name')

  console.log(`Deleted ${priv?.length || 0} private events`)

  // Show what's left
  const { data: remaining } = await supabase
    .from('content')
    .select('name, event_date')
    .eq('category_id', EVENTS_CAT)
    .order('event_date')

  console.log(`\n${remaining?.length} events remaining:`)
  remaining?.forEach(e => console.log(`  ${e.event_date} — ${e.name.substring(0, 60)}`))
}

main().catch(console.error)
