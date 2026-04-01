import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jsliqlmjksintyigkulq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzbGlxbG1qa3NpbnR5aWdrdWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTU3NDUsImV4cCI6MjA5MDQ3MTc0NX0.0ZD_5kQkDUcF5tAfz5uQH6WcemqQmOyzXBCIvl_CY1Y'

export const supabase = createClient(supabaseUrl, supabaseKey)