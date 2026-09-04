import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

export const IMAGE_RESOLVER_VERSION = "1.0.0";

const defaultApiKey = process.env.OPENAI_API_KEY;
const defaultBaseURL = process.env.OPENAI_BASE_URL || "https://llm.ganeshnayak.in/v1";
const defaultModel = process.env.IMAGE_MODEL || "gpt-image-2";

/**
 * Computes a deterministic cache key for an image generation request.
 * @param {object} imageSlot - { prompt, style, aspectRatio }
 * @param {object} [options] - { model, seed, version }
 * @returns {string} SHA256 hex digest
 */
export function computeImageCacheKey(imageSlot, options = {}) {
  const normalized = {
    normalizedPrompt: (imageSlot.prompt || "").trim().toLowerCase().replace(/\s+/g, " "),
    normalizedStyle: (imageSlot.style || "").trim().toLowerCase().replace(/\s+/g, " "),
    aspectRatio: imageSlot.aspectRatio || "1:1",
    model: options.model || defaultModel,
    version: options.version || IMAGE_RESOLVER_VERSION,
    seed: options.seed ?? 42
  };
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/**
 * Classifies an image generation failure.
 * @param {Error} error
 * @param {unknown} rawResponse
 * @returns {{ type: string, description: string, retryable: boolean }}
 */
export function classifyImageFailure(error, rawResponse) {
  const msg = error ? error.message : "Unknown error";
  if (error?.name === "AbortError" || msg.includes("timeout") || msg.includes("timed out") || msg.includes("ETIMEDOUT")) {
    return {
      type: "TIMEOUT",
      description: `Image generation timed out: ${msg}`,
      retryable: true
    };
  }
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("quota")) {
    return {
      type: "RATE_LIMIT",
      description: `Rate limit encountered: ${msg}`,
      retryable: true
    };
  }
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.includes("Internal Server Error")) {
    return {
      type: "SERVER_ERROR",
      description: `Upstream server error: ${msg}`,
      retryable: true
    };
  }
  if (msg.includes("Invalid base64") || msg.includes("Malformed response") || msg.includes("Empty image data")) {
    return {
      type: "MALFORMED_RESPONSE",
      description: `Malformed image payload: ${msg}`,
      retryable: true
    };
  }
  return {
    type: "API_ERROR",
    description: msg,
    retryable: false
  };
}

/**
 * Validates and decodes base64 image data into a binary Buffer.
 * @param {string} b64Data
 * @returns {Buffer}
 */
export function decodeBase64Image(b64Data) {
  if (!b64Data || typeof b64Data !== "string") {
    throw new Error("Invalid base64: payload is empty or not a string");
  }

  // Strip possible data URI prefix
  const cleanB64 = b64Data.replace(/^data:image\/\w+;base64,/, "").trim();
  if (cleanB64.length === 0) {
    throw new Error("Invalid base64: empty string after stripping header");
  }

  const buffer = Buffer.from(cleanB64, "base64");
  if (buffer.length < 64) {
    throw new Error(`Invalid image buffer: decoded size too small (${buffer.length} bytes)`);
  }

  return buffer;
}

/**
 * Resolves a single image slot with deterministic caching, retries, and timeout gating.
 * @param {object} imageSlot - ImageSlotSchema object { prompt, style, aspectRatio, required }
 * @param {string} sceneId - ID of the scene requiring the image
 * @param {object} [options]
 * @param {string} [options.model="gpt-image-2"]
 * @param {number} [options.seed=42]
 * @param {number} [options.timeoutMs=60000]
 * @param {number} [options.maxAttempts=3]
 * @param {number} [options.backoffMs=500]
 * @param {boolean} [options.useCache=true]
 * @param {string} [options.assetsDir="assets/images"]
 * @param {string} [options.cacheDir="cache/images"]
 * @param {OpenAI} [options.client]
 * @param {Function} [options.customGenerator] - Injected generator for test mocking
 * @returns {Promise<string|null>} Relative local path to saved image, or null if optional failure
 */
export async function resolveSingleImage(imageSlot, sceneId, options = {}) {
  const model = options.model || defaultModel;
  const seed = options.seed ?? 42;
  const timeoutMs = options.timeoutMs ?? 180000; // 180 seconds production timeout
  const maxAttempts = options.maxAttempts ?? 3;
  const backoffMs = options.backoffMs ?? 500;
  const useCache = options.useCache ?? true;
  const assetsDir = options.assetsDir || "assets/images";
  const cacheDir = options.cacheDir || "cache/images";
  const isRequired = Boolean(imageSlot.required);

  const cacheKey = computeImageCacheKey(imageSlot, { model, seed });
  const relativeAssetPath = `${assetsDir}/${cacheKey}.png`;
  const absoluteAssetPath = path.resolve(process.cwd(), relativeAssetPath);
  const cacheMetaPath = path.resolve(process.cwd(), cacheDir, `${cacheKey}.json`);

  // 1. Check Deterministic Cache Hit
  if (useCache) {
    try {
      const fileStat = await fs.stat(absoluteAssetPath);
      if (fileStat.size > 0) {
        console.log(`[ImageResolver] Cache HIT for scene "${sceneId}" (${cacheKey.slice(0, 12)} -> ${relativeAssetPath})`);
        return relativeAssetPath;
      }
    } catch {
      // Cache miss, proceed to generate
    }
  }

  console.log(`[ImageResolver] Cache MISS for scene "${sceneId}". Generating with ${model} (seed: ${seed})...`);

  // Build full generation prompt
  const stylePrompt = imageSlot.style ? ` Style: ${imageSlot.style}` : "";
  const fullPrompt = `${imageSlot.prompt}.${stylePrompt}`.trim();

  const client = options.client || new OpenAI({
    apiKey: defaultApiKey,
    baseURL: defaultBaseURL
  });

  const attemptsLog = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[ImageResolver] Attempt ${attempt}/${maxAttempts} for scene "${sceneId}" (timeout: ${timeoutMs}ms)`);
    let rawResponse = null;

    try {
      let imageBuffer;

      if (typeof options.customGenerator === "function") {
        // Injected mock generator
        const genResult = await options.customGenerator({
          prompt: fullPrompt,
          model,
          seed,
          attempt,
          timeoutMs
        });
        rawResponse = genResult;
        if (Buffer.isBuffer(genResult)) {
          imageBuffer = genResult;
        } else if (genResult?.b64_json) {
          imageBuffer = decodeBase64Image(genResult.b64_json);
        } else if (typeof genResult === "string") {
          imageBuffer = decodeBase64Image(genResult);
        } else {
          throw new Error("Malformed response: customGenerator did not return buffer or b64_json");
        }
      } else {
        // Live OpenAI / Azure OpenAI image generation call with AbortController timeout
        const abortController = new AbortController();
        const timer = setTimeout(() => abortController.abort(), timeoutMs);

        try {
          const response = await client.images.generate(
            {
              model,
              prompt: fullPrompt,
              n: 1,
              size: "1024x1024"
            },
            {
              signal: abortController.signal
            }
          );
          clearTimeout(timer);
          rawResponse = response;

          const firstItem = response?.data?.[0];
          if (!firstItem) {
            throw new Error("Malformed response: data array is empty");
          }

          if (firstItem.b64_json) {
            imageBuffer = decodeBase64Image(firstItem.b64_json);
          } else if (firstItem.url) {
            // Fallback if URL is returned instead of b64_json
            const imgFetch = await fetch(firstItem.url, { signal: abortController.signal });
            if (!imgFetch.ok) {
              throw new Error(`Failed to download image URL: HTTP ${imgFetch.status}`);
            }
            const arrayBuf = await imgFetch.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuf);
          } else {
            throw new Error("Malformed response: data item has neither b64_json nor url");
          }
        } finally {
          clearTimeout(timer);
        }
      }

      if (!imageBuffer || imageBuffer.length < 64) {
        throw new Error("Empty or truncated image buffer decoded");
      }

      // Persist binary image deterministically
      await fs.mkdir(path.dirname(absoluteAssetPath), { recursive: true });
      await fs.writeFile(absoluteAssetPath, imageBuffer);

      // Write cache metadata
      const meta = {
        cacheKey,
        sceneId,
        prompt: imageSlot.prompt,
        style: imageSlot.style,
        aspectRatio: imageSlot.aspectRatio,
        model,
        seed,
        assetPath: relativeAssetPath,
        sizeBytes: imageBuffer.length,
        createdAt: new Date().toISOString()
      };
      await fs.mkdir(path.dirname(cacheMetaPath), { recursive: true });
      await fs.writeFile(cacheMetaPath, JSON.stringify(meta, null, 2), "utf-8");

      console.log(`[ImageResolver] Successfully resolved image for scene "${sceneId}" -> ${relativeAssetPath} (${imageBuffer.length} bytes)`);
      return relativeAssetPath;
    } catch (err) {
      const failure = classifyImageFailure(err, rawResponse);
      console.warn(`[ImageResolver] Attempt ${attempt} failed [${failure.type}]: ${failure.description}`);

      attemptsLog.push({
        attempt,
        timestamp: new Date().toISOString(),
        failureType: failure.type,
        error: failure.description
      });

      if (attempt < maxAttempts && failure.retryable) {
        const waitTime = backoffMs * Math.pow(2, attempt - 1);
        console.log(`[ImageResolver] Waiting ${waitTime}ms before retry...`);
        await new Promise(r => setTimeout(r, waitTime));
      } else if (!failure.retryable && attempt < maxAttempts) {
        // Non-retryable error (e.g. fatal API key or bad auth)
        break;
      }
    }
  }

  // All attempts failed
  const errorDetails = {
    sceneId,
    cacheKey,
    isRequired,
    prompt: imageSlot.prompt,
    attempts: attemptsLog,
    timestamp: new Date().toISOString()
  };

  if (isRequired) {
    // FAIL LOUDLY for required images
    const errArtifactPath = path.resolve(process.cwd(), "briefs/image-error.json");
    try {
      await fs.mkdir(path.dirname(errArtifactPath), { recursive: true });
      await fs.writeFile(errArtifactPath, JSON.stringify(errorDetails, null, 2), "utf-8");
    } catch (writeErr) {
      console.error(`[ImageResolver] Failed writing image error artifact: ${writeErr.message}`);
    }

    const fatalMsg = `[ImageResolver] FATAL: Required image for scene "${sceneId}" failed to generate after ${attemptsLog.length} attempts. Reason: ${attemptsLog[attemptsLog.length - 1]?.error || "Unknown"}`;
    console.error(fatalMsg);
    throw new Error(fatalMsg);
  } else {
    // Optional/decorative image: degrade gracefully to placeholder
    console.warn(`[ImageResolver] Optional image for scene "${sceneId}" failed. Degrading to deterministic placeholder.`);
    return null;
  }
}

/**
 * Resolves all image requirements for a validated video plan.
 * @param {object} plan - Validated PlanSchema object
 * @param {object} [options]
 * @returns {Promise<{ resolvedImages: Record<string, string|null>, stats: { total: number, resolved: number, failedOptional: number } }>}
 */
export async function resolvePlanImages(plan, options = {}) {
  const resolvedImages = {};
  let total = 0;
  let resolved = 0;
  let failedOptional = 0;

  for (const scene of plan.scenes) {
    if (scene.template === "image-hero" || scene.imageSlot) {
      total++;
      if (!scene.imageSlot) {
        throw new Error(`Scene "${scene.id}" uses template "image-hero" but has no imageSlot defined.`);
      }

      const assetPath = await resolveSingleImage(scene.imageSlot, scene.id, options);
      if (assetPath) {
        resolvedImages[scene.id] = assetPath;
        resolved++;
      } else {
        resolvedImages[scene.id] = null;
        failedOptional++;
      }
    }
  }

  return {
    resolvedImages,
    stats: {
      total,
      resolved,
      failedOptional
    }
  };
}
