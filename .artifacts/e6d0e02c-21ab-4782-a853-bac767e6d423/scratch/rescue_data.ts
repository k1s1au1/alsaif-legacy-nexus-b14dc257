
import { createClient } from '@supabase/supabase-js'

const OLD_URL = "https://wzgzkyzpzniduwcgdozl.supabase.co"
const OLD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Z3preXpwem5pZHV3Y2dkb3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTgzNDAsImV4cCI6MjA5Njg3NDM0MH0.5MP_Is4cPMaet0OlS0xO0bFDOvTU30lf1Wo06sqgZzY"

const supabase = createClient(OLD_URL, OLD_KEY)

async function rescue() {
  const tables = ['profiles', 'majlis_posts', 'meetings', 'trips', 'fund_transactions', 'tasks', 'family_projects']
  const results: any = {}

  for (const table of tables) {
    console.log(`Trying to rescue table: ${table}...`)
    const { data, error } = await supabase.from(table).select('*').limit(1000)
    if (error) {
      console.error(`Failed to rescue ${table}:`, error.message)
    } else {
      console.log(`Successfully rescued ${data.length} rows from ${table}`)
      results[table] = data
    }
  }

  // Save results to a file if possible, or just log them
  console.log("FINAL_RESULTS_START")
  console.log(JSON.stringify(results))
  console.log("FINAL_RESULTS_END")
}

rescue()
