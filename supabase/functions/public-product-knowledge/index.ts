import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=60, s-maxage=60",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const safeHttps = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : null; } catch { return null; }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ error: "Method not allowed." }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Public product catalogue is not configured." }, 503);
  try {
    const [productsResult, announcementsResult] = await Promise.all([
      admin.from("zt_products")
        .select("name,slug,description,status,website_url,deployment_url,current_version,updated_at")
        .eq("status", "launched").order("updated_at", { ascending: false }).limit(100),
      admin.from("zt_announcements")
        .select("title,body,audience,published_at,updated_at")
        .eq("status", "published").order("published_at", { ascending: false }).limit(50),
    ]);
    if (productsResult.error) console.error("Public product catalogue query failed:", productsResult.error.message);
    if (announcementsResult.error) console.error("Public announcement query failed:", announcementsResult.error.message);
    const audienceAllowlist = new Set(["all", "public", "customers", "customer", "everyone"]);
    const products = (productsResult.data || []).map((p: any) => ({
      name: String(p.name || "").slice(0, 160),
      slug: String(p.slug || "").slice(0, 100),
      description: String(p.description || "").slice(0, 1800),
      status: "launched",
      website_url: safeHttps(p.website_url),
      deployment_url: safeHttps(p.deployment_url),
      current_version: String(p.current_version || "").slice(0, 80) || null,
      updated_at: p.updated_at || null,
    }));
    const announcements = (announcementsResult.data || [])
      .filter((a: any) => audienceAllowlist.has(String(a.audience || "").toLowerCase()))
      .map((a: any) => ({
        title: String(a.title || "").slice(0, 180),
        body: String(a.body || "").slice(0, 1600),
        published_at: a.published_at || a.updated_at || null,
      }));
    return json({
      company: { name: "ZakiTech Solutions", motto: "Equipping minds with IT solutions." },
      known_products: [
        { name: "Molano AI", description: "AI assistant for general help, public product information, and the website-draft workflow." },
        { name: "Molan Business", description: "Business workspace with customer support, website service requests, verified Jjuma Pay checkout, and website build progress." },
        { name: "ZakiChat", description: "Messaging application in the ZakiTech product portfolio." },
      ],
      launched_products: products,
      public_announcements: announcements,
      generated_at: new Date().toISOString(),
      privacy_note: "This feed contains approved public product details and published public/customer announcements only. It does not include private customer tickets, account data, internal repositories, or staff-only notifications.",
    });
  } catch (error) {
    console.error("Public product catalogue failed:", error);
    return json({ error: "The public product catalogue is temporarily unavailable." }, 500);
  }
});
