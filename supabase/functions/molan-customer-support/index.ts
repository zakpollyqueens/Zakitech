import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const respond = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const allowedRoles = new Set(["owner", "vice_admin", "receptionist", "support_officer", "operations_officer"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed." });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return respond(401, { error: "Sign in to ZakiTech to access the support inbox." });

    const ztUrl = Deno.env.get("SUPABASE_URL");
    const ztServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const molanUrl = Deno.env.get("MOLAN_SUPABASE_URL");
    const molanServiceKey = Deno.env.get("MOLAN_SUPABASE_SERVICE_ROLE_KEY");
    if (!ztUrl || !ztServiceKey || !molanUrl || !molanServiceKey) {
      return respond(503, { error: "Support bridge configuration is incomplete. Check the ZakiTech and Molan Supabase server secrets." });
    }

    const zt = createClient(ztUrl, ztServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const molan = createClient(molanUrl, molanServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await zt.auth.getUser(token);
    if (authError || !authData.user) return respond(401, { error: "Your session is invalid. Sign in again." });

    const { data: actor, error: actorError } = await zt.from("zt_profiles")
      .select("user_id,display_name,role,status,full_access")
      .eq("user_id", authData.user.id).maybeSingle();
    if (actorError || !actor || actor.status !== "active") return respond(403, { error: "Your ZakiTech account is not active." });
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return respond(400, { error: "Invalid request body." }); }
    const action = typeof body.action === "string" ? body.action : "";
    const ticketId = typeof body.ticket_id === "string" ? body.ticket_id : "";
    const actorName = actor.display_name || authData.user.email || "ZakiTech Support";
    const websiteReadRoles = new Set(["owner","vice_admin","operations_officer","support_officer","web_developer","application_developer","engineer","release_manager"]);
    const websiteBuildRoles = new Set(["owner","vice_admin","operations_officer","web_developer","application_developer","engineer"]);
    if (action === "website_requests" || action === "website_build") {
      const permitted = action === "website_build" ? websiteBuildRoles : websiteReadRoles;
      if (!permitted.has(actor.role) && actor.full_access !== true) return respond(403, { error: "Your role is not authorized to manage website production." });
    } else if (!allowedRoles.has(actor.role) && actor.full_access !== true) {
      return respond(403, { error: "Your role is not authorized to access customer support." });
    }

    if (action === "website_requests") {
      const { data: requests, error: requestError } = await molan.from("website_service_requests")
        .select("id,company_id,requested_by,package_code,package_amount,package_currency_code,payment_plan,status,payment_status,deposit_amount,balance_amount,public_business_name,business_name,business_brief,website_feel,public_information,public_contacts,business_location,preferred_domain,requested_features,created_at,updated_at,delivered_website_url,voice_note_path")
        .order("created_at", { ascending: false }).limit(250);
      if (requestError) return respond(500, { error: "Could not load website orders from Molan Business." });
      const rows = requests || [];
      const ids = rows.map((r: any) => r.id);
      let jobs: any[] = [], payments: any[] = [];
      if (ids.length) {
        const [jobResult, paymentResult] = await Promise.all([
          molan.from("website_service_build_jobs").select("request_id,status,progress_percent,progress_message,created_at,updated_at,completed_at").in("request_id", ids),
          molan.from("website_service_checkout_payments").select("request_id,status,amount,currency_code,provider_metadata,created_at,verified_at").in("request_id", ids).order("created_at", { ascending: false }).limit(500),
        ]);
        if (jobResult.error) return respond(500, { error: "Could not load website build progress." });
        if (paymentResult.error) return respond(500, { error: "Could not load verified website payment records." });
        jobs = jobResult.data || [];
        payments = paymentResult.data || [];
      }
      const jobMap = new Map(jobs.map((j: any) => [j.request_id, j]));
      const paymentMap = new Map<string, any[]>();
      for (const p of payments) paymentMap.set(p.request_id, [...(paymentMap.get(p.request_id) || []), p]);
      const result = rows.map((r: any) => {
        const ps = paymentMap.get(r.id) || [];
        const verified = ps.filter((p: any) => p.status === "verified");
        return {
          ...r,
          delivered_website_url: r.payment_status === "paid" ? r.delivered_website_url : null,
          build_job: jobMap.get(r.id) || null,
          payment_summary: {
            verified_deposit: verified.some((p: any) => p.provider_metadata?.payment_stage === "deposit"),
            verified_balance: verified.some((p: any) => p.provider_metadata?.payment_stage === "balance"),
            latest_status: ps[0]?.status || "not_started",
            latest_amount: ps[0]?.amount ?? null,
            latest_currency: ps[0]?.currency_code ?? null,
          },
        };
      });
      return respond(200, { requests: result, actor: { id: actor.user_id, name: actorName, role: actor.role } });
    }

    if (action === "website_build") {
      const requestId = typeof body.request_id === "string" ? body.request_id : "";
      const buildAction = body.build_action === "publish" ? "publish" : body.build_action === "build" ? "build" : "";
      if (!/^[0-9a-f-]{36}$/i.test(requestId) || !buildAction) return respond(400, { error: "Choose a valid website request and build action." });
      const base = molanUrl.replace(/\\/+$/, "");
      const upstream = await fetch(base + "/functions/v1/website-service-builder", {
        method: "POST",
        headers: { Authorization: "Bearer " + molanServiceKey, apikey: molanServiceKey, "Content-Type": "application/json" },
        body: JSON.stringify({ action: buildAction, request_id: requestId }),
      });
      const result = await upstream.json().catch(() => ({}));
      const { error: auditError } = await zt.from("zt_audit_events").insert({
        actor_user_id: actor.user_id,
        event_type: "website_service_" + buildAction + "_requested",
        details: { request_id: requestId, build_action: buildAction, result_status: result?.status || (upstream.ok ? "accepted" : "failed"), role: actor.role },
      });
      if (auditError) console.error("Website production audit event could not be saved:", auditError.message);
      if (!upstream.ok || result?.success !== true) return respond(upstream.status || 502, { error: result?.error || "The website workflow could not complete this action.", status: result?.status || "pending" });
      return respond(200, { ...result, message: buildAction === "build" ? "Website build request processed." : "Website publication request processed." });
    }

    if (action === "bootstrap") {
      const { data: tickets, error } = await molan.from("support_tickets")
        .select("id,ticket_number,customer_user_id,customer_name,customer_email,company_name,subject,initial_message,category,priority,status,assigned_staff_id,created_at,updated_at,resolved_at")
        .order("updated_at", { ascending: false }).limit(500);
      if (error) return respond(500, { error: "Could not load customer support tickets. Check the Molan support schema and service-role secret." });
      const rows = tickets || [];
      const ids = rows.map((t: any) => t.id);
      const unread = new Map<string, number>();
      if (ids.length) {
        const { data: msgs, error: msgError } = await molan.from("support_messages")
          .select("ticket_id").in("ticket_id", ids).eq("sender_role", "customer").is("staff_read_at", null);
        if (msgError) return respond(500, { error: "Could not load unread customer message counts." });
        for (const m of msgs || []) unread.set(m.ticket_id, (unread.get(m.ticket_id) || 0) + 1);
      }
      return respond(200, { tickets: rows.map((t: any) => ({ ...t, unread_customer_messages: unread.get(t.id) || 0 })), actor: { id: actor.user_id, name: actorName, role: actor.role } });
    }

    if (!ticketId && ["messages", "assign", "status", "reply"].includes(action)) {
      return respond(400, { error: "A support ticket ID is required." });
    }

    if (action === "messages") {
      const { data: ticket, error: ticketError } = await molan.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
      if (ticketError) return respond(500, { error: "Could not load this support ticket." });
      if (!ticket) return respond(404, { error: "Support ticket not found." });
      const { data: messages, error: messagesError } = await molan.from("support_messages")
        .select("id,ticket_id,sender_user_id,sender_role,sender_name,body,created_at,customer_read_at,staff_read_at")
        .eq("ticket_id", ticketId).order("created_at", { ascending: true });
      if (messagesError) return respond(500, { error: "Could not load the conversation." });
      const { error: markError } = await molan.from("support_messages").update({ staff_read_at: new Date().toISOString() })
        .eq("ticket_id", ticketId).eq("sender_role", "customer").is("staff_read_at", null);
      if (markError) return respond(500, { error: "Messages loaded, but read tracking could not be updated." });
      return respond(200, { ticket, messages: messages || [], actor: { id: actor.user_id, name: actorName, role: actor.role } });
    }

    if (action === "assign") {
      const { data, error } = await molan.from("support_tickets")
        .update({ assigned_staff_id: actor.user_id, status: "in_progress" })
        .eq("id", ticketId).select("id,assigned_staff_id,status").maybeSingle();
      if (error) return respond(500, { error: "Could not assign this ticket." });
      if (!data) return respond(404, { error: "Support ticket not found." });
      return respond(200, { ticket: data, message: "Ticket assigned to you." });
    }

    if (action === "status") {
      const status = typeof body.status === "string" ? body.status : "";
      const valid = new Set(["new", "open", "in_progress", "awaiting_customer", "escalated", "resolved", "closed"]);
      if (!valid.has(status)) return respond(400, { error: "Invalid ticket status." });
      const updates: Record<string, unknown> = { status, resolved_at: ["resolved", "closed"].includes(status) ? new Date().toISOString() : null };
      const { data, error } = await molan.from("support_tickets").update(updates)
        .eq("id", ticketId).select("id,status,resolved_at,updated_at").maybeSingle();
      if (error) return respond(500, { error: "Could not update ticket status." });
      if (!data) return respond(404, { error: "Support ticket not found." });
      return respond(200, { ticket: data, message: "Ticket status updated." });
    }

    if (action === "reply") {
      const raw = typeof body.message === "string" ? body.message.trim() : "";
      if (!raw || raw.length > 12000) return respond(400, { error: "Write a message of 1–12,000 characters." });
      const { data: ticket, error: ticketError } = await molan.from("support_tickets")
        .select("id,status").eq("id", ticketId).maybeSingle();
      if (ticketError) return respond(500, { error: "Could not verify this support ticket." });
      if (!ticket) return respond(404, { error: "Support ticket not found." });
      if (ticket.status === "closed") return respond(409, { error: "This ticket is closed. Reopen it before replying." });
      const paragraphs = raw.split(/\n\s*\n/).map((s: string) => s.trim()).filter(Boolean);
      const rows = paragraphs.map((paragraph: string) => ({
        ticket_id: ticketId, sender_user_id: actor.user_id, sender_role: "support", sender_name: actorName, body: paragraph,
      }));
      const { data: inserted, error: insertError } = await molan.from("support_messages").insert(rows)
        .select("id,ticket_id,sender_user_id,sender_role,sender_name,body,created_at,customer_read_at,staff_read_at");
      if (insertError) return respond(500, { error: "Could not send the reply. Check the support_messages schema." });
      const { error: updateError } = await molan.from("support_tickets").update({
        status: "awaiting_customer", resolved_at: null,
      }).eq("id", ticketId);
      if (updateError) return respond(500, { error: "Reply was saved, but the ticket status could not be updated." });
      return respond(200, { messages: inserted || [], message: "Reply sent to the customer." });
    }

    return respond(400, { error: "Unknown support action." });
  } catch (error) {
    console.error("molan-customer-support failure", error);
    return respond(500, { error: "An unexpected support service error occurred." });
  }
});