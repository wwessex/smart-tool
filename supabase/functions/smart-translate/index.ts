import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const RequestSchema = z.object({
  action: z.string()
    .min(1, "Action text cannot be empty")
    .max(5000, "Action text too long (max 5,000 characters)"),
  targetLanguage: z.string()
    .min(2, "Language code required")
    .max(50, "Invalid language code"),
});

// Supported languages for UK employment services
const SUPPORTED_LANGUAGES: Record<string, string> = {
  "cy": "Welsh (Cymraeg)",
  "pl": "Polish (Polski)",
  "ur": "Urdu (اردو)",
  "bn": "Bengali (বাংলা)",
  "ar": "Arabic (العربية)",
  "pa": "Punjabi (ਪੰਜਾਬੀ)",
  "so": "Somali (Soomaali)",
  "pt": "Portuguese (Português)",
  "ro": "Romanian (Română)",
  "es": "Spanish (Español)",
  "fr": "French (Français)",
  "zh": "Chinese Simplified (简体中文)",
  "hi": "Hindi (हिन्दी)",
};

// Simple in-memory rate limiting (per IP hash - no raw IPs stored)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 translations per minute

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
    const rawIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                  req.headers.get("x-real-ip") || 
                  "unknown";
    const ipHash = simpleHash(rawIP);
    
    // Check rate limit using only the hash (no personal data stored)
    if (!checkRateLimit(ipHash)) {
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
      console.warn(`Translation input validation failed`);
      return new Response(
        JSON.stringify({ error: `Invalid input: ${errorMessages}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, targetLanguage } = validationResult.data;
    
    // Validate language is supported
    if (!SUPPORTED_LANGUAGES[targetLanguage]) {
      return new Response(
        JSON.stringify({ error: "Unsupported language" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Translation service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const languageName = SUPPORTED_LANGUAGES[targetLanguage];
    
    // GDPR: Only log operation type, not content
    console.log(`Processing translation request to ${targetLanguage}`);

    // Build the translation prompt
    const systemPrompt = `You are a professional translator specializing in employment support documentation.
Your task is to translate SMART action text from English into ${languageName}.

IMPORTANT RULES:
1. Preserve all names, dates, and numbers EXACTLY as written
2. Do not translate proper nouns, acronyms, or abbreviations (e.g., "CV", "DWP", "JobCentre Plus")
3. Maintain the professional, supportive tone of employment guidance
4. Keep the same structure and formatting as the original
5. Return ONLY the translation, no explanations or additional text
6. If a word has no direct translation, use the English word with a brief explanation in parentheses if needed`;

    const userPrompt = `Translate the following employment SMART action into ${languageName}:

${action}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
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
        JSON.stringify({ error: "Translation service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content?.trim() || "";

    if (!translated) {
      console.error("Empty translation response");
      return new Response(
        JSON.stringify({ error: "Translation failed - empty response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Translation completed successfully");

    return new Response(
      JSON.stringify({
        original: action,
        translated,
        language: targetLanguage,
        languageName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("smart-translate error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
