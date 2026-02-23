import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

type KnowledgeEntryInsert = {
  title: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

type KnowledgeEntryUpdate = Partial<KnowledgeEntryInsert>;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
    .slice(0, 20);
}

function parseInsertBody(input: unknown): KnowledgeEntryInsert {
  const data = (input ?? {}) as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const content = typeof data.content === "string" ? data.content.trim() : "";

  if (!title) {
    throw new Error("title is required");
  }
  if (!content) {
    throw new Error("content is required");
  }

  return {
    title,
    content,
    tags: normalizeTags(data.tags),
    metadata: typeof data.metadata === "object" && data.metadata !== null
      ? (data.metadata as Record<string, unknown>)
      : {},
  };
}

function parseUpdateBody(input: unknown): KnowledgeEntryUpdate {
  const data = (input ?? {}) as Record<string, unknown>;
  const update: KnowledgeEntryUpdate = {};

  if (typeof data.title === "string") {
    const title = data.title.trim();
    if (!title) throw new Error("title cannot be empty");
    update.title = title;
  }

  if (typeof data.content === "string") {
    const content = data.content.trim();
    if (!content) throw new Error("content cannot be empty");
    update.content = content;
  }

  if ("tags" in data) {
    update.tags = normalizeTags(data.tags);
  }

  if ("metadata" in data) {
    update.metadata = typeof data.metadata === "object" && data.metadata !== null
      ? (data.metadata as Record<string, unknown>)
      : {};
  }

  if (Object.keys(update).length === 0) {
    throw new Error("at least one updatable field is required");
  }

  return update;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(500, { error: "Missing Supabase environment variables" });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing Authorization header" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse(401, { error: "Invalid or expired token" });
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const id = pathParts.length > 0 ? pathParts[pathParts.length - 1] : null;

    if (req.method === "GET") {
      const q = (url.searchParams.get("q") || "").trim();
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 100);

      let query = supabase
        .from("custom_knowledge_entries")
        .select("id,title,content,tags,metadata,created_at,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (q) {
        query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) {
        return jsonResponse(500, { error: error.message });
      }

      return jsonResponse(200, { data: data ?? [] });
    }

    if (req.method === "POST") {
      const payload = parseInsertBody(await req.json());

      const { data, error } = await supabase
        .from("custom_knowledge_entries")
        .insert({
          ...payload,
          user_id: user.id,
        })
        .select("id,title,content,tags,metadata,created_at,updated_at")
        .single();

      if (error) {
        return jsonResponse(500, { error: error.message });
      }

      return jsonResponse(201, { data });
    }

    if (req.method === "PUT") {
      if (!id || id === "custom-knowledge-base") {
        return jsonResponse(400, { error: "Entry id is required in path for updates" });
      }

      const payload = parseUpdateBody(await req.json());
      const { data, error } = await supabase
        .from("custom_knowledge_entries")
        .update(payload)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id,title,content,tags,metadata,created_at,updated_at")
        .single();

      if (error) {
        return jsonResponse(500, { error: error.message });
      }

      return jsonResponse(200, { data });
    }

    if (req.method === "DELETE") {
      if (!id || id === "custom-knowledge-base") {
        return jsonResponse(400, { error: "Entry id is required in path for deletion" });
      }

      const { error } = await supabase
        .from("custom_knowledge_entries")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        return jsonResponse(500, { error: error.message });
      }

      return jsonResponse(200, { data: { id } });
    }

    return jsonResponse(405, { error: `Method ${req.method} not allowed` });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
});
