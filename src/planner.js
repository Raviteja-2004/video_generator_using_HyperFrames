import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import OpenAI from "openai";
import { validatePlan, SCHEMA_VERSION } from "./schema.js";

dotenv.config();

export const SYSTEM_PROMPT_VERSION = "1.3.0";

const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL || "https://llm.ganeshnayak.in/v1";

if (!apiKey) {
  console.error("FATAL: OPENAI_API_KEY environment variable is not set.");
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  baseURL
});

export const SYSTEM_PROMPT = `You are an expert motion graphics director and video planner for HyperFrames.
You turn a human plain-language brief into a structured JSON video plan (schema version: ${SCHEMA_VERSION}).

CRITICAL INVARIANTS & STRICT RULES:
1. NEVER INVENT FABRICATED OR UNSUPPORTED CLAIMS:
   - Do NOT invent numerical statistics (e.g., "10x faster", "99.4% accuracy", "$500M saved"), rankings, customer quotes, prices, dates, or guarantees that are NOT explicitly mentioned in the user's brief.
   - If the brief does NOT provide a statistic, do NOT invent one and do NOT use the "stat-highlight" template. Use "feature-callout", "title", or "image-hero" instead.
   - Creative styling and visual copy phrasing are encouraged, but all factual claims and numbers must originate strictly from the brief.

2. SINGLE WRITER OF HTML:
   - Output ONLY structured JSON matching the Plan schema. Do NOT write HTML, CSS, or GSAP code.

3. DURATION AND TIMING:
   - Total duration MUST exactly equal the sum of all scene durations.
   - Per-scene duration must be between 1.5s and 10s.

4. TEMPLATE SCHEMA DEFINITIONS (Strictly include required fields per template):
   - "title":
     Requires: "heading" (string), Optional: "subheading" (string)
   - "feature-callout":
     Requires: "heading" (string), "features" (array of 2-4 strings, e.g. ["Feature 1", "Feature 2", "Feature 3"])
   - "stat-highlight" (ONLY if statistics exist in brief):
     Requires: "heading" (string), "stat" (object: { "value": "10x", "label": "Velocity" })
   - "image-hero":
     Requires: "heading" (string), "imageSlot" (object: { "prompt": "Detailed visual description", "style": "modern vector flat minimalist illustration neon dark theme", "aspectRatio": "1:1", "required": boolean })
   - "cta":
     Requires: "heading" (string), "ctaText" (string, e.g. "Start Free Trial" or "Learn More"), Optional: "ctaSubtext" (string)

5. ALLOWED ASPECT RATIOS:
   - "16:9" (widescreen landscape) or "9:16" (vertical mobile/tiktok/reels). Default to "16:9" unless portrait/vertical/reel/story/tiktok is mentioned.

6. HIGH-CONTRAST PALETTE (WCAG Accessible):
   - "background": dark background hex (e.g. #0a0a0f, #0f172a, #09090b)
   - "surface": card/box surface hex (e.g. #18181b, #1e293b)
   - "primary": vibrant accent hex (e.g. #8b5cf6, #3b82f6, #06b6d4, #10b981)
   - "text": high-contrast primary text hex (e.g. #ffffff, #f8fafc)
   - "subtext": secondary muted text hex (e.g. #94a3b8, #a1a1aa)

7. SCENE SEMANTICS:
   - Each scene must specify:
     - purpose: "hook" | "feature-presentation" | "social-proof" | "call-to-action" | "announcement"
     - visualEmphasis: "high" | "medium" | "subtle"
     - textDensity: "low" | "medium" | "high"
     - motionIntent: "scale-up" | "slide-up" | "stagger-reveal" | "counter-zoom" | "fade-in"

Example JSON Output:
{
  "schemaVersion": "${SCHEMA_VERSION}",
  "title": "CodeStream Launch",
  "aspectRatio": "16:9",
  "totalDuration": 9,
  "palette": {
    "background": "#09090b",
    "surface": "#18181b",
    "primary": "#8b5cf6",
    "text": "#ffffff",
    "subtext": "#a1a1aa"
  },
  "scenes": [
    {
      "id": "scene-1",
      "template": "title",
      "purpose": "hook",
      "visualEmphasis": "high",
      "textDensity": "low",
      "duration": 3,
      "motionIntent": "scale-up",
      "heading": "CodeStream",
      "subheading": "AI-Powered Development"
    },
    {
      "id": "scene-2",
      "template": "feature-callout",
      "purpose": "feature-presentation",
      "visualEmphasis": "high",
      "textDensity": "medium",
      "duration": 3,
      "motionIntent": "stagger-reveal",
      "heading": "Key Capabilities",
      "features": ["Instant Review", "Auto Refactor", "Zero Latency"]
    },
    {
      "id": "scene-3",
      "template": "cta",
      "purpose": "call-to-action",
      "visualEmphasis": "high",
      "textDensity": "low",
      "duration": 3,
      "motionIntent": "slide-up",
      "heading": "Ready to Ship Faster?",
      "ctaText": "Start Free Trial"
    }
  ]
}`;

/**
 * Computes deterministic cache key for a given brief and planning configuration.
 * @param {string} brief
 * @param {object} params
 * @returns {string} SHA256 hex hash
 */
export function computePlanCacheKey(brief, params = {}) {
  const normalized = {
    normalizedBrief: brief.trim().toLowerCase().replace(/\s+/g, " "),
    model: "gpt-5.5",
    systemPromptVersion: SYSTEM_PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    seed: params.seed ?? 42,
    temperature: params.temperature ?? 0.1
  };
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/**
 * Classifies model failure into diagnostic categories.
 * @param {string} rawResponse
 * @param {Error|null} error
 * @param {number} currentMaxTokens
 * @param {boolean} [allowTokenAdaptation=true]
 * @returns {{ type: string, description: string, adaptiveAdjustment: object }}
 */
export function classifyFailure(rawResponse, error, currentMaxTokens, allowTokenAdaptation = true) {
  const errMsg = error ? error.message : "Unknown error";
  if (!rawResponse || rawResponse.trim().length === 0) {
    return {
      type: "EMPTY_RESPONSE_OR_TOKEN_STARVATION",
      description: "Model returned empty response or reasoning tokens consumed the entire budget.",
      adaptiveAdjustment: {
        maxTokens: allowTokenAdaptation ? Math.min(currentMaxTokens + 2048, 8192) : currentMaxTokens
      }
    };
  }
  if (errMsg.includes("Unexpected end of JSON") || errMsg.includes("is not valid JSON") || errMsg.includes("Unexpected token")) {
    return {
      type: "MALFORMED_JSON_OR_TRUNCATION",
      description: `JSON parsing failed: ${errMsg}`,
      adaptiveAdjustment: {
        maxTokens: allowTokenAdaptation ? Math.min(currentMaxTokens + 1024, 8192) : currentMaxTokens
      }
    };
  }
  if (errMsg.includes("Schema validation failed")) {
    return {
      type: "SCHEMA_VALIDATION_FAILURE",
      description: errMsg,
      adaptiveAdjustment: { maxTokens: currentMaxTokens }
    };
  }
  return {
    type: "GENERAL_FAILURE",
    description: errMsg,
    adaptiveAdjustment: { maxTokens: currentMaxTokens }
  };
}

/**
 * Plans a video from a brief using GPT-5.5 with deterministic caching, adaptive retries, and strict schema validation.
 * @param {string} brief
 * @param {object} [options]
 * @param {number} [options.maxAttempts=3] Total planner attempts allowed (initial + retries).
 * @param {number} [options.initialMaxTokens=4096]
 * @param {boolean} [options.allowTokenAdaptation=true]
 * @param {number} [options.seed=42]
 * @param {boolean} [options.useCache=true]
 * @param {string} [options.cacheDir="cache/plans"]
 * @param {string} [options.errorArtifactPath="briefs/plan-error.json"]
 * @returns {Promise<object>} Parsed and validated plan
 */
export async function planVideo(brief, options = {}) {
  const maxAttempts = options.maxAttempts ?? 3; // Total attempts allowed
  let currentMaxTokens = options.initialMaxTokens ?? 4096;
  const allowTokenAdaptation = options.allowTokenAdaptation ?? true;
  const seed = options.seed ?? 42;
  const useCache = options.useCache ?? true;
  const cacheDir = options.cacheDir ?? "cache/plans";
  const errorArtifactPath = options.errorArtifactPath ?? "briefs/plan-error.json";

  const cacheKey = computePlanCacheKey(brief, { seed });
  const cacheFilePath = path.resolve(process.cwd(), cacheDir, `${cacheKey}.json`);

  if (useCache) {
    try {
      const cachedContent = await fs.readFile(cacheFilePath, "utf-8");
      const parsedCached = JSON.parse(cachedContent);
      const validation = validatePlan(parsedCached);
      if (validation.success) {
        console.log(`[Planner] Cache HIT (${cacheKey.slice(0, 12)}). Returning cached plan.`);
        return validation.data;
      }
    } catch {
      // Cache miss or corrupted cache, proceed to live call
    }
  }

  const history = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Create a video plan for the following brief:\n"${brief}"` }
  ];

  const attemptsLog = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Planner] Attempt ${attempt}/${maxAttempts} (budget: ${currentMaxTokens} tokens) for brief: "${brief.slice(0, 50)}..."`);
    let rawResponse = "";

    try {
      const completion = await client.chat.completions.create({
        model: "gpt-5.5",
        messages: history,
        max_tokens: currentMaxTokens,
        temperature: 0.1,
        seed
      });

      rawResponse = completion.choices?.[0]?.message?.content?.trim() || "";

      let cleaned = rawResponse;
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      }

      const parsed = JSON.parse(cleaned);
      const validation = validatePlan(parsed);

      if (!validation.success) {
        throw new Error(`Schema validation failed: ${validation.error}`);
      }

      console.log(`[Planner] Successfully generated valid plan on attempt ${attempt} (${validation.data.scenes.length} scenes, ${validation.data.totalDuration}s, ${validation.data.aspectRatio})`);

      // Write to deterministic cache
      try {
        await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
        await fs.writeFile(cacheFilePath, JSON.stringify(validation.data, null, 2), "utf-8");
      } catch (cacheErr) {
        console.warn(`[Planner] Warning: Could not write cache file: ${cacheErr.message}`);
      }

      return validation.data;
    } catch (err) {
      const classification = classifyFailure(rawResponse, err, currentMaxTokens, allowTokenAdaptation);
      console.warn(`[Planner] Attempt ${attempt} failed [${classification.type}]: ${classification.description}`);

      attemptsLog.push({
        attempt,
        timestamp: new Date().toISOString(),
        maxTokens: currentMaxTokens,
        failureType: classification.type,
        rawResponse: rawResponse.slice(0, 500),
        error: classification.description
      });

      // Adapt token budget for next attempt
      currentMaxTokens = classification.adaptiveAdjustment.maxTokens;

      if (attempt < maxAttempts) {
        history.push({
          role: "assistant",
          content: rawResponse || "(empty response / truncated)"
        });
        history.push({
          role: "user",
          content: `Your previous response failed validation [${classification.type}]:\n${classification.description}\n\nPlease correct this issue immediately and return ONLY the complete valid JSON plan conforming to schema version ${SCHEMA_VERSION}.`
        });
      }
    }
  }

  // Exhausted all maxAttempts -> write plan-error.json and throw
  const errorArtifact = {
    brief,
    cacheKey,
    maxAttempts,
    schemaVersion: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    attempts: attemptsLog
  };

  try {
    await fs.mkdir(path.dirname(path.resolve(process.cwd(), errorArtifactPath)), { recursive: true });
    await fs.writeFile(
      path.resolve(process.cwd(), errorArtifactPath),
      JSON.stringify(errorArtifact, null, 2),
      "utf-8"
    );
  } catch (writeErr) {
    console.error(`[Planner] Failed writing error artifact: ${writeErr.message}`);
  }

  console.error(`[Planner] FATAL: Planner exhausted all ${maxAttempts} attempts. Diagnostic artifact written to ${errorArtifactPath}`);
  throw new Error(`Planner failed after ${maxAttempts} total attempts. See ${errorArtifactPath} for diagnostics.`);
}
