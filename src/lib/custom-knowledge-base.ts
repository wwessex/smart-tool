import { supabase } from "@/integrations/supabase/client";

export interface CustomKnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomKnowledgeEntryInput {
  title: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export type UpdateCustomKnowledgeEntryInput = Partial<CreateCustomKnowledgeEntryInput>;

export async function listCustomKnowledgeEntries(params?: { q?: string; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.limit) query.set("limit", String(params.limit));

  const endpoint = query.toString()
    ? `custom-knowledge-base?${query.toString()}`
    : "custom-knowledge-base";

  const { data, error } = await supabase.functions.invoke<{ data: CustomKnowledgeEntry[] }>(endpoint, {
    method: "GET",
  });

  if (error) {
    throw new Error(error.message || "Failed to load custom knowledge entries");
  }

  return data?.data ?? [];
}

export async function createCustomKnowledgeEntry(input: CreateCustomKnowledgeEntryInput) {
  const { data, error } = await supabase.functions.invoke<{ data: CustomKnowledgeEntry }>(
    "custom-knowledge-base",
    {
      method: "POST",
      body: input,
    }
  );

  if (error) {
    throw new Error(error.message || "Failed to create custom knowledge entry");
  }

  if (!data?.data) {
    throw new Error("Backend did not return a created knowledge entry");
  }

  return data.data;
}

export async function updateCustomKnowledgeEntry(id: string, input: UpdateCustomKnowledgeEntryInput) {
  const { data, error } = await supabase.functions.invoke<{ data: CustomKnowledgeEntry }>(
    `custom-knowledge-base/${id}`,
    {
      method: "PUT",
      body: input,
    }
  );

  if (error) {
    throw new Error(error.message || "Failed to update custom knowledge entry");
  }

  if (!data?.data) {
    throw new Error("Backend did not return an updated knowledge entry");
  }

  return data.data;
}

export async function deleteCustomKnowledgeEntry(id: string) {
  const { data, error } = await supabase.functions.invoke<{ data: { id: string } }>(
    `custom-knowledge-base/${id}`,
    {
      method: "DELETE",
    }
  );

  if (error) {
    throw new Error(error.message || "Failed to delete custom knowledge entry");
  }

  return data?.data?.id ?? id;
}
