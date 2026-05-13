// supabase/functions/check-email/index.ts
//
// Looks up if an email is known to Nasiha, returning:
//   - "not_found"            : new email, show signup form
//   - "subscriber_no_password" : on newsletter list but no full account → show "set password" form
//   - "full_user"            : has full account → show login form
//
// CALL FROM FRONTEND:
//   const { data } = await supabase.functions.invoke('check-email', { body: { email } })
//
// Returns:
//   { status: "not_found" | "subscriber_no_password" | "full_user", display_name?: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()
    if (!email || !email.includes("@")) {
      return json({ status: "not_found" })
    }
    const cleanEmail = email.toLowerCase().trim()

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Find the user by email. listUsers is the only admin lookup available.
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const user = data?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    )

    if (!user) {
      return json({ status: "not_found" })
    }

    // Has the user set a password? In Supabase, users created via the admin API
    // with no password have user_metadata.signup_method = 'newsletter_only'.
    // A full user has either a password (encrypted_password not null) OR a different signup method.
    // The admin API doesn't expose encrypted_password directly, so we rely on user_metadata.
    const signupMethod = user.user_metadata?.signup_method
    const isSubscriberOnly = signupMethod === "newsletter_only"

    // Get display name from profile
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()

    return json({
      status: isSubscriberOnly ? "subscriber_no_password" : "full_user",
      display_name: profile?.display_name || null,
    })
  } catch (e) {
    console.error("check-email error:", e)
    // On error, treat as not_found so the user can proceed with signup
    return json({ status: "not_found" })
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
