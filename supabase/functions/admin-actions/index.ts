import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Auth: require authenticated user with admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Auth required" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return jsonResponse({ error: "Invalid auth" }, 401);

    // Check admin role
    const { data: isAdmin } = await serviceClient
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!isAdmin) return jsonResponse({ error: "Admin role required" }, 403);

    const body = await req.json();
    const { action } = body;

    if (action === "clean-stuck-runs") {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error } = await serviceClient
        .from("sync_runs")
        .update({ status: "error", error: "Timeout: marcado como erro pelo admin", finished_at: new Date().toISOString() })
        .eq("status", "running")
        .lt("started_at", thirtyMinAgo)
        .select("id");

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ cleaned: data?.length || 0 });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("[admin-actions] Error:", error.message);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
