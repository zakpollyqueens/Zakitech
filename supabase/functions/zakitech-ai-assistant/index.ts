import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { evaluateAiRequest } from "../_shared/zakitech-ai-policy.ts";

const allowedDefaults = new Set([
  "https://zakpollyqueens.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);
const configuredOrigins = (Deno.env.get("ZAKITECH_ALLOWED_ORIGINS") || "")
  .split(",").map((x) => x.trim()).filter(Boolean);
const allowedOrigins = new Set([...allowedDefaults, ...configuredOrigins]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
const reply = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  if (origin && !allowedOrigins.has(origin)) return new Response("Origin not allowed", { status: 403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return reply(req, 405, { error: "Method not allowed." });

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return reply(req, 401, { error: "Sign in is required." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return reply(req, 503, { error: "The secure AI service is not configured." });

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  if (authError || !authData.user) return reply(req, 401, { error: "Your session is invalid. Please sign in again." });

  const { data: actor, error: profileError } = await db.from("zt_profiles")
    .select("user_id,role,status").eq("user_id", authData.user.id).maybeSingle();
  if (profileError || !actor || actor.status !== "active") {
    return reply(req, 403, { error: "Your ZakiTech account is not active." });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(req, 400, { error: "Invalid request body." }); }
  const prompt = typeof body.message === "string" ? body.message.trim() : "";
  if (!prompt || prompt.length > 4000) return reply(req, 400, { error: "Enter a message up to 4,000 characters." });

  const decision = evaluateAiRequest(prompt);
  // Never persist the raw prompt: it may contain customer or confidential information.
  const audit = await db.from("zt_audit_events").insert({
    actor_user_id: authData.user.id,
    event_type: decision.allowed ? "ai_request_received" : "ai_request_blocked",
    details: {
      category: decision.category,
      decision: decision.allowed ? "policy_filter_passed" : "blocked",
      role: actor.role,
      prompt_length: prompt.length,
      policy_version: "1",
    },
  });
  if (audit.error) return reply(req, 503, { error: "The secure audit service is unavailable. No AI request was processed." });

  if (!decision.allowed) {
    return reply(req, 403, {
      blocked: true,
      category: decision.category,
      message: decision.reason,
    });
  }

  // Fail closed until a vetted model provider and data-handling rules are configured.
  // This prevents this endpoint from implying that a model is connected when it is not.
  return reply(req, 503, {
    providerConfigured: false,
    message: "The security gate is active, but no AI model provider is enabled yet. Your message was not sent to an external AI service. Provider setup and approved data scopes are still required.",
    requestId: crypto.randomUUID(),
  });
});
