import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json(405, { success: false, error: "Method not allowed." });

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json(503, { success: false, error: "Product feed is not configured." });

  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: product, error: productError } = await db
      .from("zt_products")
      .select("id,slug,name,current_version,status,updated_at")
      .eq("slug", "molan-chat")
      .maybeSingle();
    if (productError) throw productError;
    if (!product) return json(404, { success: false, error: "Molan Chat is not registered in the Product Hub." });

    const now = new Date().toISOString();
    const [{ data: builds, error: buildsError }, { data: notices, error: noticesError }] = await Promise.all([
      db.from("zt_product_builds")
        .select("id,version,title,description,release_notes,channel,file_name,file_size,storage_path,published_at")
        .eq("product_id", product.id)
        .eq("status", "published")
        .not("published_at", "is", null)
        .lte("published_at", now)
        .order("published_at", { ascending: false })
        .limit(20),
      db.from("zt_notifications")
        .select("id,title,body,notification_type,published_at,created_at")
        .eq("product_id", product.id)
        .eq("status", "published")
        .eq("audience", "product_users")
        .not("published_at", "is", null)
        .lte("published_at", now)
        .order("published_at", { ascending: false })
        .limit(30)
    ]);
    if (buildsError) throw buildsError;
    if (noticesError) throw noticesError;

    const releases = (builds || []).map((build: any) => {
      const { data } = db.storage.from("zt-product-releases").getPublicUrl(build.storage_path);
      return {
        id: build.id,
        version: build.version,
        title: build.title,
        description: build.description || "",
        releaseNotes: build.release_notes || "",
        channel: build.channel || "stable",
        fileName: build.file_name,
        fileSizeBytes: Number(build.file_size || 0),
        publishedAt: build.published_at,
        downloadUrl: data.publicUrl
      };
    });

    return json(200, {
      success: true,
      product: {
        name: product.name,
        version: product.current_version,
        status: product.status,
        updatedAt: product.updated_at
      },
      releases,
      notifications: (notices || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.notification_type,
        publishedAt: n.published_at || n.created_at
      }))
    });
  } catch (error) {
    console.error("Molan Chat public product feed failed:", error);
    return json(500, { success: false, error: "Could not load the published Molan Chat product feed." });
  }
});
