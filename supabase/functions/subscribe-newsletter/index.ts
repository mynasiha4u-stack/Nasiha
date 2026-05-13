// supabase/functions/subscribe-newsletter/index.ts
//
// Newsletter signup flow:
// 1. Validate email
// 2. Check if user already exists in auth.users
//    - If yes → just (re)subscribe to Beehiiv, mark profile.newsletter_subscribed = true
//    - If no → create auth user with no password + send confirmation email
//      then subscribe to Beehiiv
//
// CALL FROM FRONTEND:
//   const { data, error } = await supabase.functions.invoke('subscribe-newsletter', {
//     body: { email, source: 'events_page' }
//   })
//
// Returns:
//   { ok: true, status: 'new' | 'already_subscribed' | 'resubscribed' }
//   { ok: false, error: '...' }

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
    const { email, source = "unknown" } = await req.json()

    if (!email || !email.includes("@")) {
      return json({ ok: false, error: "Please provide a valid email." }, 400)
    }
    const cleanEmail = email.toLowerCase().trim()

    // Supabase admin client (uses service role, bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 1. Check if email already exists in auth.users
    // listUsers doesn't have a filter param, so we use admin.getUserByEmail via paginated fetch
    // Instead use the users table filtered approach
    const { data: existingByEmail } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    const existing = existingByEmail?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    )

    let userId: string
    let isNewUser = false

    if (existing) {
      userId = existing.id
    } else {
      // 2. Create a new auth user with no password, no email verification email
      // (We'll send Beehiiv's confirmation email instead — Beehiiv handles double opt-in)
      isNewUser = true
      const { data: created, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          email_confirm: false, // they'll need to set a password + verify later if they want to log in
          user_metadata: {
            newsletter_source: source,
            signup_method: "newsletter_only",
          },
        })
      if (createError || !created.user) {
        return json(
          { ok: false, error: `Could not create user: ${createError?.message}` },
          500
        )
      }
      userId = created.user.id
    }

    // 3. Add to Beehiiv (Beehiiv sends its own double-opt-in email)
    const beehiivKey = Deno.env.get("BEEHIIV_API_KEY")
    const beehiivPubId = Deno.env.get("BEEHIIV_PUBLICATION_ID")
    let beehiivSubscriberId: string | null = null
    let beehiivStatus = "skipped"

    if (beehiivKey && beehiivPubId) {
      try {
        const bhResp = await fetch(
          `https://api.beehiiv.com/v2/publications/${beehiivPubId}/subscriptions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${beehiivKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: cleanEmail,
              send_welcome_email: true,
              utm_source: "nasiha",
              utm_medium: source,
              reactivate_existing: true,
            }),
          }
        )
        const bhJson = await bhResp.json()
        if (bhResp.ok && bhJson.data) {
          beehiivSubscriberId = bhJson.data.id
          beehiivStatus = "subscribed"
        } else {
          console.warn("Beehiiv API returned non-ok:", bhJson)
          beehiivStatus = `error: ${bhJson?.errors?.[0]?.message || "unknown"}`
        }
      } catch (e) {
        console.warn("Beehiiv API call failed:", e)
        beehiivStatus = `network error: ${e.message}`
      }
    }

    // 4. Update user_profiles
    const { error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .update({
        newsletter_subscribed: true,
        newsletter_source: source,
        beehiiv_subscriber_id: beehiivSubscriberId,
      })
      .eq("id", userId)

    if (profileErr) console.warn("Profile update failed:", profileErr)

    return json({
      ok: true,
      status: isNewUser ? "new" : "resubscribed",
      beehiiv: beehiivStatus,
    })
  } catch (e) {
    console.error("subscribe-newsletter error:", e)
    return json({ ok: false, error: String(e?.message || e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
