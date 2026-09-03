import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rfalxrhxsvwirjurohkd.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmYWx4cmh4c3Z3aXJqdXJvaGtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTEwNDEsImV4cCI6MjEwMzg2NzA0MX0.x_j55TpCY6RR5nf4BUZEYH3qrrKdJEZSMU1FKw5h8LE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service role client for admin operations (server-side only)
const supabaseServiceKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmYWx4cmh4c3Z3aXJqdXJvaGtkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODI5MTA0MSwiZXhwIjoyMTAzODY3MDQxfQ.JtmK954zUU6G9v1Z8mjMfb6MzzD2letXlSnU4VZ2QHE";

// Only use service role in server-side contexts
export const supabaseAdmin =
  typeof window === "undefined"
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;
