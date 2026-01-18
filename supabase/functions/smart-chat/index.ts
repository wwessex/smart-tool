import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schemas
const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string()
    .min(1, "Message content cannot be empty")
    .max(10000, "Message content too long (max 10,000 characters)"),
});

const RequestSchema = z.object({
  messages: z.array(MessageSchema)
    .min(1, "At least one message is required")
    .max(50, "Maximum 50 messages allowed"),
  systemPrompt: z.string()
    .max(2000, "System prompt too long (max 2,000 characters)")
    .optional(),
});

// Fixed system prompt - user cannot override core instructions
const SYSTEM_PROMPT = `You are a SMART action writing assistant for UK employment advisors. Help create Specific, Measurable, Achievable, Relevant, and Time-bound actions.

Key principles:
- Actions should address barriers to employment
- Include specific dates and review periods  
- Identify who is responsible for each step
- Focus on what the participant will DO, not just learn or read
- Be concise and actionable

IMPORTANT - Be practical and realistic:
- Do NOT assume the advisor has specific resources (booklets, worksheets, specific templates or courses)
- When suggesting resources, use FREE, publicly available ones:
  * gov.uk websites (benefits, Access to Work, driving licence, etc.)
  * NHS services (talking therapies, mental health resources)
  * Citizens Advice (for various issues)
  * Public libraries (free internet, computers, books)
  * Free online tools (Indeed, Reed, Google Maps, free learning sites like Learn My Way)
- If suggesting an activity, keep it achievable with basic tools (pen and paper, phone, library computer)
- Don't tell participants to "read the booklet" or use resources that may not exist - give specific, actionable steps
- For conditions like autism, ADHD, or learning difficulties, focus on reasonable adjustments and practical strategies

When given context about a participant, provide practical suggestions to improve their SMART action. Keep responses focused and realistic.`;

// Simple in-memory rate limiting (per IP hash - no raw IPs stored)
// GDPR: We only store a hash of the IP for rate limiting, never the raw IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute

function checkRateLimit(ipHash: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ipHash);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ipHash, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000);

// Simple hash function for rate limiting (not for security purposes)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GDPR: Get client IP and immediately hash it for rate limiting
    // The raw IP is not stored or logged - only the hash is used
    const rawIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                  req.headers.get("x-real-ip") || 
                  "unknown";
    const ipHash = simpleHash(rawIP);
    
    // Check rate limit using only the hash (no personal data stored)
    if (!checkRateLimit(ipHash)) {
      // GDPR: We don't log the IP or hash to maintain privacy
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment before trying again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input with Zod schema
    const validationResult = RequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      // GDPR: Only log validation structure, not user content
      console.warn(`Input validation failed`);
      return new Response(
        JSON.stringify({ error: `Invalid input: ${errorMessages}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, systemPrompt } = validationResult.data;
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GDPR: Only log message count, not content or IP
    console.log(`Processing chat request with ${messages.length} messages`);

    // Build the messages array with fixed system prompt
    // User-provided systemPrompt is added as context, not as system instructions
    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      // If user provides additional context via systemPrompt, add it as user context
      ...(systemPrompt ? [{ role: "user", content: `Additional context: ${systemPrompt}` }] : []),
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Streaming response from AI gateway");

    // Stream the response back
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("smart-chat error:", error);
    // Return generic error message to avoid information leakage
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
