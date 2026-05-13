// supabase/functions/send-notification-email/index.ts
//
// Sends transactional emails via Resend.
// Called by the admin review dashboard when a listing is approved/rejected.
//
// CALL FROM FRONTEND:
//   const { data } = await supabase.functions.invoke('send-notification-email', {
//     body: {
//       type: 'approved' | 'rejected',
//       listing_id: '...',
//       reason: '...'  // optional, only for rejected
//     }
//   })

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const FROM_ADDRESS = "Nasiha <notifications@mynasiha.com>"
const REPLY_TO = "hello@mynasiha.com"
const SITE_URL = "https://mynasiha.com"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { type, listing_id, reason } = await req.json()

    if (!type || !listing_id) {
      return json({ ok: false, error: "Missing type or listing_id" }, 400)
    }
    if (type !== "approved" && type !== "rejected") {
      return json({ ok: false, error: "Invalid type" }, 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Load the listing + owner profile
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from("content")
      .select("id, name, owner_id, url_slug, categories(slug, name)")
      .eq("id", listing_id)
      .single()

    if (listingErr || !listing) {
      return json({ ok: false, error: `Listing not found: ${listingErr?.message}` }, 404)
    }

    // Get owner email
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(listing.owner_id)
    const ownerEmail = userData?.user?.email
    if (!ownerEmail) {
      return json({ ok: false, error: "Owner has no email" }, 400)
    }

    // Check owner's notification preference
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("display_name, notify_on_review")
      .eq("id", listing.owner_id)
      .maybeSingle()

    if (profile && profile.notify_on_review === false) {
      return json({ ok: true, skipped: "user opted out" })
    }

    const displayName = profile?.display_name || "there"
    const categoryName = listing.categories?.name || "listing"
    const categorySlug = listing.categories?.slug
    const listingUrl = categorySlug && listing.url_slug
      ? `${SITE_URL}/${categorySlug}/${listing.url_slug}`
      : null

    // Build the email
    const subject = type === "approved"
      ? `Your ${categoryName} listing is live on Nasiha`
      : `Your ${categoryName} submission needs changes`

    const html = type === "approved"
      ? approvedEmail({ displayName, listingName: listing.name, listingUrl })
      : rejectedEmail({ displayName, listingName: listing.name, reason: reason || "" })

    // Send via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY")
    if (!resendKey) {
      return json({ ok: false, error: "RESEND_API_KEY not configured" }, 500)
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [ownerEmail],
        reply_to: REPLY_TO,
        subject,
        html,
      }),
    })

    const body = await resp.json()
    if (!resp.ok) {
      console.error("Resend error:", body)
      return json({ ok: false, error: body?.message || "Resend failed" }, 500)
    }

    return json({ ok: true, email_id: body.id })
  } catch (e) {
    console.error("send-notification-email error:", e)
    return json({ ok: false, error: String(e?.message || e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

// --- Email templates ---

function approvedEmail({ displayName, listingName, listingUrl }: {
  displayName: string; listingName: string; listingUrl: string | null;
}) {
  return `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FAF7F2; padding: 24px; color: #1C2B3A;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; border: 1px solid rgba(0,0,0,0.06);">
    <div style="font-size: 24px; font-weight: 800; color: #1C2B3A; margin-bottom: 8px;">nasiha</div>
    <div style="height: 2px; background: linear-gradient(90deg, #C2410C 0%, #E8860A 100%); border-radius: 1px; margin-bottom: 24px;"></div>
    <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 12px;">Your listing is live ✅</h1>
    <p style="font-size: 15px; line-height: 1.5; margin: 0 0 18px;">Hi ${escapeHtml(displayName)},</p>
    <p style="font-size: 15px; line-height: 1.5; margin: 0 0 18px;">Good news — your listing <strong>${escapeHtml(listingName)}</strong> has been approved and is now visible to the community on Nasiha.</p>
    ${listingUrl ? `
    <div style="margin: 24px 0;">
      <a href="${listingUrl}" style="display: inline-block; background: #C2410C; color: white; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; font-size: 14px;">View your listing →</a>
    </div>` : ""}
    <p style="font-size: 13px; line-height: 1.5; color: #6A7A8A; margin: 18px 0 0;">You can edit, pause, or share your listing anytime from <a href="${SITE_URL}/my-listings" style="color: #C2410C;">My Listings</a>.</p>
    <div style="height: 1px; background: rgba(0,0,0,0.08); margin: 28px 0 18px;"></div>
    <p style="font-size: 12px; color: #6A7A8A; margin: 0;">Sent by Nasiha · Your community, all in one place.<br><a href="${SITE_URL}/account/email" style="color: #6A7A8A;">Manage email preferences</a></p>
  </div>
</body></html>
  `.trim()
}

function rejectedEmail({ displayName, listingName, reason }: {
  displayName: string; listingName: string; reason: string;
}) {
  return `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FAF7F2; padding: 24px; color: #1C2B3A;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; border: 1px solid rgba(0,0,0,0.06);">
    <div style="font-size: 24px; font-weight: 800; color: #1C2B3A; margin-bottom: 8px;">nasiha</div>
    <div style="height: 2px; background: linear-gradient(90deg, #C2410C 0%, #E8860A 100%); border-radius: 1px; margin-bottom: 24px;"></div>
    <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 12px;">Your submission needs changes</h1>
    <p style="font-size: 15px; line-height: 1.5; margin: 0 0 18px;">Hi ${escapeHtml(displayName)},</p>
    <p style="font-size: 15px; line-height: 1.5; margin: 0 0 18px;">Thanks for submitting <strong>${escapeHtml(listingName)}</strong> to Nasiha. After reviewing it, we couldn't publish it as-is.</p>
    ${reason ? `
    <div style="background: #FEE2E2; border-left: 3px solid #DC2626; padding: 14px 18px; border-radius: 6px; margin: 0 0 18px;">
      <div style="font-size: 12px; font-weight: 700; color: #991B1B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Why</div>
      <div style="font-size: 14px; color: #1C2B3A; line-height: 1.5;">${escapeHtml(reason)}</div>
    </div>` : ""}
    <p style="font-size: 15px; line-height: 1.5; margin: 0 0 18px;">You can edit your submission and resubmit, or reach out if you have questions.</p>
    <div style="margin: 24px 0;">
      <a href="${SITE_URL}/my-listings" style="display: inline-block; background: #C2410C; color: white; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; font-size: 14px;">Edit my submission →</a>
    </div>
    <div style="height: 1px; background: rgba(0,0,0,0.08); margin: 28px 0 18px;"></div>
    <p style="font-size: 12px; color: #6A7A8A; margin: 0;">Sent by Nasiha · Your community, all in one place.<br><a href="${SITE_URL}/account/email" style="color: #6A7A8A;">Manage email preferences</a></p>
  </div>
</body></html>
  `.trim()
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
