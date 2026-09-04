import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
  computeImageCacheKey,
  decodeBase64Image,
  classifyImageFailure,
  resolveSingleImage,
  resolvePlanImages
} from "../src/image-resolver.js";
import { composeProject } from "../src/composer/composer.js";

const execAsync = promisify(exec);
const results = [];

function recordTest(name, passed, detail) {
  results.push({ name, passed, detail });
  const statusMark = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[${statusMark}] ${name}: ${detail}`);
}

async function runHyperframesCheck() {
  try {
    const { stdout, stderr } = await execAsync("npx hyperframes check . --json", {
      cwd: process.cwd(),
      timeout: 60000
    });
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Failed to extract JSON from check output. Raw: ${stdout}\nStderr: ${stderr}`);
    }
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    if (err.stdout) {
      const jsonMatch = err.stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
    throw err;
  }
}

// Minimal 1x1 valid PNG in base64
const VALID_1X1_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function runSuite() {
  console.log("=================================================");
  console.log("       PHASE 3 IMAGE RESOLVER VERIFICATION       ");
  console.log("=================================================\n");

  // 1. Base64 Decoding Tests
  try {
    const decoded = decodeBase64Image(VALID_1X1_PNG_B64);
    const withPrefix = decodeBase64Image(`data:image/png;base64,${VALID_1X1_PNG_B64}`);
    const matches = decoded.length > 50 && decoded.equals(withPrefix);
    recordTest("base64 decoding", matches, `Successfully decoded standard b64 and data-uri prefix (${decoded.length} bytes)`);
  } catch (err) {
    recordTest("base64 decoding", false, err.message);
  }

  // 2. Base64 Error Handling (Empty / Truncated / Corrupt)
  try {
    let emptyCaught = false;
    let smallCaught = false;
    try { decodeBase64Image(""); } catch { emptyCaught = true; }
    try { decodeBase64Image("aGVsbG8="); } catch { smallCaught = true; } // "hello" is < 64 bytes
    recordTest("base64 error handling", emptyCaught && smallCaught, "Correctly rejected empty and undersized base64 payloads");
  } catch (err) {
    recordTest("base64 error handling", false, err.message);
  }

  // 3. Cache Key Determinism & Normalization
  try {
    const slot1 = { prompt: "Glowing Neon Wave ", style: "vector flat ", aspectRatio: "1:1" };
    const slot2 = { prompt: "  glowing  neon wave", style: "vector   flat", aspectRatio: "1:1" };
    const key1 = computeImageCacheKey(slot1, { seed: 42, model: "gpt-image-2" });
    const key2 = computeImageCacheKey(slot2, { seed: 42, model: "gpt-image-2" });
    const diffSeedKey = computeImageCacheKey(slot1, { seed: 99, model: "gpt-image-2" });
    const match = (key1 === key2) && (key1 !== diffSeedKey);
    recordTest("cache key determinism", match, `Normalized key (${key1.slice(0, 10)}) matches across whitespace variants and differs for distinct seeds`);
  } catch (err) {
    recordTest("cache key determinism", false, err.message);
  }

  // 4. Persistence & Cache Miss / Cache Hit Flow
  const testSlot = {
    prompt: "Unit test synthetic graphic illustration",
    style: "minimalist dark neon",
    aspectRatio: "1:1",
    required: true
  };

  const testAssetsDir = "assets/images/test";
  const testCacheDir = "cache/images/test";
  const testKey = computeImageCacheKey(testSlot, { seed: 100, model: "gpt-image-2" });
  const testAssetPath = path.resolve(process.cwd(), testAssetsDir, `${testKey}.png`);
  const testMetaPath = path.resolve(process.cwd(), testCacheDir, `${testKey}.json`);

  // Clean test paths if existing
  try { await fs.unlink(testAssetPath); } catch {}
  try { await fs.unlink(testMetaPath); } catch {}

  try {
    let generatorCalledCount = 0;
    const mockGenerator = async () => {
      generatorCalledCount++;
      return { b64_json: VALID_1X1_PNG_B64 };
    };

    // First call: Cache Miss -> Generates and persists
    const path1 = await resolveSingleImage(testSlot, "scene-test", {
      seed: 100,
      assetsDir: testAssetsDir,
      cacheDir: testCacheDir,
      customGenerator: mockGenerator
    });

    const fileExists = await fs.stat(testAssetPath).then(() => true).catch(() => false);
    const metaExists = await fs.stat(testMetaPath).then(() => true).catch(() => false);
    recordTest("image persistence & cache miss", fileExists && metaExists && generatorCalledCount === 1, `Persisted asset (${path1}) and cache metadata (${testMetaPath})`);

    // Second call: Cache Hit -> Does NOT invoke generator
    const path2 = await resolveSingleImage(testSlot, "scene-test", {
      seed: 100,
      assetsDir: testAssetsDir,
      cacheDir: testCacheDir,
      customGenerator: mockGenerator
    });

    const isHit = (path1 === path2) && (generatorCalledCount === 1);
    recordTest("cache hit & identical cached asset", isHit, `Reused exact cached asset (${path2}) without re-invoking generator (calls: ${generatorCalledCount})`);
  } catch (err) {
    recordTest("image persistence & cache miss", false, err.message);
    recordTest("cache hit & identical cached asset", false, err.message);
  }

  // 5. Malformed API Response & Retry Behavior
  try {
    let attemptsMade = 0;
    const flakeyGenerator = async ({ attempt }) => {
      attemptsMade = attempt;
      if (attempt < 3) {
        // Return malformed object on attempts 1 and 2
        return { bad_field: true };
      }
      return { b64_json: VALID_1X1_PNG_B64 };
    };

    const slotRetry = { prompt: "Retry test graphic", style: "dark", required: true };
    const retryAssetPath = await resolveSingleImage(slotRetry, "scene-retry", {
      seed: 200,
      maxAttempts: 3,
      backoffMs: 10,
      useCache: false,
      assetsDir: testAssetsDir,
      cacheDir: testCacheDir,
      customGenerator: flakeyGenerator
    });

    recordTest("malformed response & retry recovery", attemptsMade === 3 && Boolean(retryAssetPath), `Retried through 2 malformed responses and succeeded on attempt ${attemptsMade}`);
  } catch (err) {
    recordTest("malformed response & retry recovery", false, err.message);
  }

  // 6. Timeout Classification & Gating
  try {
    const timeoutGenerator = async () => {
      const err = new Error("Request timed out after 50ms");
      err.name = "AbortError";
      throw err;
    };

    let caughtTimeout = false;
    const slotTimeout = { prompt: "Timeout test graphic", style: "dark", required: true };
    try {
      await resolveSingleImage(slotTimeout, "scene-timeout", {
        seed: 300,
        maxAttempts: 2,
        backoffMs: 10,
        timeoutMs: 50,
        useCache: false,
        assetsDir: testAssetsDir,
        cacheDir: testCacheDir,
        customGenerator: timeoutGenerator
      });
    } catch (err) {
      caughtTimeout = err.message.includes("FATAL") && err.message.includes("timed out");
    }

    recordTest("api timeout handling", caughtTimeout, "Classified AbortError timeout and halted execution");
  } catch (err) {
    recordTest("api timeout handling", false, err.message);
  }

  // 7. Required Image Failure Exhaustion -> FAILS LOUDLY
  try {
    const failingGenerator = async () => {
      throw new Error("500 Internal Server Error: Image service unavailable");
    };

    let threwFatal = false;
    const slotRequiredFail = { prompt: "Required failing image", style: "neon", required: true };
    try {
      await resolveSingleImage(slotRequiredFail, "scene-req-fail", {
        seed: 400,
        maxAttempts: 2,
        backoffMs: 10,
        useCache: false,
        assetsDir: testAssetsDir,
        cacheDir: testCacheDir,
        customGenerator: failingGenerator
      });
    } catch (err) {
      threwFatal = err.message.includes("FATAL: Required image for scene");
    }

    const errArtifact = await fs.readFile(path.resolve(process.cwd(), "briefs/image-error.json"), "utf-8")
      .then(JSON.parse)
      .catch(() => null);

    const artifactValid = errArtifact?.sceneId === "scene-req-fail" && errArtifact?.isRequired === true;
    recordTest("required image exhaustion fails loudly", threwFatal && artifactValid, "Failed loudly, stopped pipeline, and recorded diagnostic briefs/image-error.json");
  } catch (err) {
    recordTest("required image exhaustion fails loudly", false, err.message);
  }

  // 8. Optional Image Failure -> Graceful Placeholder Fallback
  try {
    const failingOptionalGenerator = async () => {
      throw new Error("503 Service Unavailable");
    };

    const slotOptional = { prompt: "Optional decorative background", style: "subtle", required: false };
    const optionalResult = await resolveSingleImage(slotOptional, "scene-opt-fail", {
      seed: 500,
      maxAttempts: 2,
      backoffMs: 10,
      useCache: false,
      assetsDir: testAssetsDir,
      cacheDir: testCacheDir,
      customGenerator: failingOptionalGenerator
    });

    recordTest("optional image failure graceful fallback", optionalResult === null, "Optional image failure returned null without throwing or stopping the pipeline");
  } catch (err) {
    recordTest("optional image failure graceful fallback", false, err.message);
  }

  // 9. Live Image Generation & Resolution on Brief 2 Plan (Portrait 9:16 with gpt-image-2)
  console.log("\n--- Resolving Live gpt-image-2 for Brief 2 Plan (PulseFit 9:16) ---");
  let liveAssetPath = null;
  try {
    const plan2Raw = await fs.readFile(path.resolve(process.cwd(), "briefs/brief-2-plan.json"), "utf-8");
    const plan2 = JSON.parse(plan2Raw);

    const imageResolution = await resolvePlanImages(plan2, {
      model: "gpt-image-2",
      seed: 42,
      timeoutMs: 60000
    });

    liveAssetPath = imageResolution.resolvedImages["scene-2"];
    const fileStat = await fs.stat(path.resolve(process.cwd(), liveAssetPath));

    recordTest(
      "live gpt-image-2 generation & plan resolution (Brief 2)",
      Boolean(liveAssetPath) && fileStat.size > 1000,
      `Resolved live image: ${liveAssetPath} (${fileStat.size} bytes)`
    );
  } catch (err) {
    recordTest("live gpt-image-2 generation & plan resolution (Brief 2)", false, err.message);
  }

  // 10. Brief 2 Composition with Real Generated Image (9:16 Portrait) + HyperFrames Check Gate
  console.log("\n--- Composing Brief 2 (9:16) with Real Generated Asset and Running Gate Check ---");
  try {
    const plan2Raw = await fs.readFile(path.resolve(process.cwd(), "briefs/brief-2-plan.json"), "utf-8");
    const plan2 = JSON.parse(plan2Raw);

    const comp2 = composeProject(plan2, {
      resolvedImages: {
        "scene-2": liveAssetPath
      }
    });

    const hasRealImg = comp2.html.includes(`<img src="${liveAssetPath}"`);
    await fs.writeFile(path.resolve(process.cwd(), "index.html"), comp2.html, "utf-8");
    await fs.writeFile(path.resolve(process.cwd(), "meta.json"), JSON.stringify(comp2.metaJson, null, 2), "utf-8");

    const check2 = await runHyperframesCheck();
    await fs.writeFile(path.resolve(process.cwd(), "briefs/brief-2-check.json"), JSON.stringify(check2, null, 2), "utf-8");

    recordTest(
      "9:16 image-hero composition with real asset & hyperframes check",
      hasRealImg && check2.ok === true,
      `Check ok: ${check2.ok} | Lint errs: ${check2.lint?.errorCount || 0}, Layout: ${check2.layout?.errorCount || 0}, Contrast: ${check2.contrast?.errorCount || 0}`
    );
  } catch (err) {
    recordTest("9:16 image-hero composition with real asset & hyperframes check", false, err.message);
  }

  // 11. Widescreen 16:9 Image-Hero Composition with Real Asset + HyperFrames Check Gate
  console.log("\n--- Composing 16:9 Widescreen Image-Hero with Real Asset and Running Gate Check ---");
  try {
    const landscapePlan = {
      schemaVersion: "1.1.0",
      title: "VisionAI Platform Launch",
      aspectRatio: "16:9",
      totalDuration: 9,
      palette: {
        background: "#09090b",
        surface: "#18181b",
        primary: "#8b5cf6",
        text: "#ffffff",
        subtext: "#a1a1aa"
      },
      scenes: [
        {
          id: "scene-1",
          template: "title",
          purpose: "hook",
          visualEmphasis: "high",
          textDensity: "low",
          duration: 3,
          motionIntent: "scale-up",
          heading: "VisionAI Intelligence",
          subheading: "Next-Gen Computer Vision"
        },
        {
          id: "scene-2",
          template: "image-hero",
          purpose: "feature-presentation",
          visualEmphasis: "high",
          textDensity: "low",
          duration: 3,
          motionIntent: "counter-zoom",
          heading: "Real-Time Neural Detection",
          imageSlot: {
            prompt: "Neural network visual interface with glowing nodes and bounding boxes",
            style: "modern vector flat minimalist illustration neon dark theme",
            aspectRatio: "1:1",
            required: true
          }
        },
        {
          id: "scene-3",
          template: "cta",
          purpose: "call-to-action",
          visualEmphasis: "high",
          textDensity: "low",
          duration: 3,
          motionIntent: "slide-up",
          heading: "Transform Your Vision",
          ctaText: "Get Started Free"
        }
      ]
    };

    const compLandscape = composeProject(landscapePlan, {
      resolvedImages: {
        "scene-2": liveAssetPath
      }
    });

    const hasRealImg169 = compLandscape.html.includes(`<img src="${liveAssetPath}"`);
    await fs.writeFile(path.resolve(process.cwd(), "index.html"), compLandscape.html, "utf-8");
    await fs.writeFile(path.resolve(process.cwd(), "meta.json"), JSON.stringify(compLandscape.metaJson, null, 2), "utf-8");

    const checkLandscape = await runHyperframesCheck();

    recordTest(
      "16:9 image-hero composition with real asset & hyperframes check",
      hasRealImg169 && checkLandscape.ok === true,
      `Check ok: ${checkLandscape.ok} | Lint errs: ${checkLandscape.lint?.errorCount || 0}, Layout: ${checkLandscape.layout?.errorCount || 0}, Contrast: ${checkLandscape.contrast?.errorCount || 0}`
    );
  } catch (err) {
    recordTest("16:9 image-hero composition with real asset & hyperframes check", false, err.message);
  }

  // Summary
  console.log("\n=================================================");
  console.log("             PHASE 3 SUMMARY                      ");
  console.log("=================================================");
  const allPassed = results.every(r => r.passed);
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed:      ${results.filter(r => r.passed).length}`);
  console.log(`Failed:      ${results.filter(r => !r.passed).length}`);
  console.log(`Status:      ${allPassed ? "ALL TESTS PASSED ✓" : "FAILURES DETECTED ✗"}`);
  console.log("=================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error("FATAL SUITE CRASH:", err);
  process.exit(1);
});
