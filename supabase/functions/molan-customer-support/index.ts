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
    if (!allowedRoles.has(actor.role) && actor.full_access !== true) {
      return respond(403, { error: "Your role is not authorized to access customer support." });
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return respond(400, { error: "Invalid request body." }); }
    const action = typeof body.action === "string" ? body.action : "";
    const ticketId = typeof body.ticket_id === "string" ? body.ticket_id : "";
    const actorName = actor.display_name || authData.user.email || "ZakiTech Support";

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