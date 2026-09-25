// Supabase client (`db`) plus a promise that resolves once the page markup is ready.
const domReady = new Promise((resolve) => {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", resolve);
  else resolve();
});

let db = null;
try {
  db = window.supabase.createClient(UC_CONFIG.SUPABASE_URL, UC_CONFIG.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
} catch (e) {
  console.error("Could not start Supabase (offline, or the library failed to load).", e);
}
