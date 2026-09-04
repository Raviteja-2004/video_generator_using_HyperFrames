/**
 * Phase 4 - Test 1: Fresh Live gpt-image-2 Generation (Guaranteed Cache Bypass)
 *
 * Uses a unique timestamp-based prompt identity to ensure:
 * - No matching cache file can exist
 * - A LIVE call is made to the configured gpt-image-2 gateway
 * - The response is decoded and persisted
 * - The resulting asset passes HyperFrames gate
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { resolveSingleImage, computeImageCacheKey } from "../src/image-resolver.js";
import { composeProject } from "../src/composer/composer.js";

const results = [];
function recordTest(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`[${passed ? "? PASS" : "? FAIL"}] ${name}: ${detail}`);
}

console.log("\n=================================================");
console.log("  TEST 1: FRESH LIVE gpt-image-2 (CACHE BYPASS)");
console.log("=================================================\n");

try {
  // Deterministic unique identity using a fixed seed that won't be in cache
  // Using a fixed timestamp string so this specific test can be identified in logs
  const testRunId = "phase4-fresh-verify-" + Date.now();
  const uniqueSlot = {
    prompt: `Futuristic neural network visualization with glowing teal nodes on deep space background, photorealistic 3D render ${testRunId}`,
    style: "cinematic photorealistic dark neon 3d abstract",
    aspectRatio: "1:1",
    required: true
  };

  const expectedKey = computeImageCacheKey(uniqueSlot, { seed: 7777, model: "gpt-image-2" });
  const expectedAssetPath = path.resolve(process.cwd(), "assets/images", `${expectedKey}.png`);
  const expectedMetaPath = path.resolve(process.cwd(), "cache/images", `${expectedKey}.json`);

  // Ensure cache is clean for this specific key
  try { await fs.unlink(expectedAssetPath); } catch {}
  try { await fs.unlink(expectedMetaPath); } catch {}

  console.log(`[Test] Cache key: ${expectedKey.slice(0, 20)}...`);
  console.log(`[Test] Prompt: "${uniqueSlot.prompt.slice(0, 80)}..."`);
  console.log(`[Test] Calling live gpt-image-2 API (useCache: false)...`);

  const tStart = Date.now();
  const resolvedPath = await resolveSingleImage(uniqueSlot, "fresh-scene-verify", {
    seed: 7777,
    model: "gpt-image-2",
    useCache: false,    // Force live API call
    timeoutMs: 180000,
    maxAttempts: 3
  });
  const elapsed = Date.now() - tStart;

  // Verify file was persisted with real content
  const fileStat = await fs.stat(path.resolve(process.cwd(), resolvedPath));
  console.log(`[Test] Image resolved: ${resolvedPath} (${fileStat.size} bytes, ${(elapsed/1000).toFixed(1)}s)`);

  // Read first few bytes to confirm PNG signature
  const fileHandle = await fs.open(path.resolve(process.cwd(), resolvedPath), "r");
  const header = Buffer.alloc(8);
  await fileHandle.read(header, 0, 8, 0);
  await fileHandle.close();
  const isPNG = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
  console.log(`[Test] PNG signature check: ${isPNG ? "VALID PNG" : "NOT PNG (raw data)"}`);

  // Compose fresh asset into a gate-testable composition
  const testPlan = {
    schemaVersion: "1.1.0",
    title: "Fresh Image Gate Test",
    aspectRatio: "16:9",
    totalDuration: 6,
    palette: { background: "#09090b", surface: "#18181b", primary: "#06b6d4", text: "#ffffff", subtext: "#a1a1aa" },
    scenes: [
      { id: "s1", template: "image-hero", duration: 3, motionIntent: "counter-zoom", heading: "Neural Network", imageSlot: uniqueSlot },
      { id: "s2", template: "cta", duration: 3, motionIntent: "slide-up", heading: "Deploy Now", ctaText: "Get Started" }
    ]
  };

  const comp = composeProject(testPlan, { resolvedImages: { "s1": resolvedPath } });
  await fs.writeFile(path.resolve(process.cwd(), "index.html"), comp.html, "utf-8");
  await fs.writeFile(path.resolve(process.cwd(), "meta.json"), JSON.stringify(comp.metaJson, null, 2), "utf-8");

  console.log("[Test] Running HyperFrames gate check on composition with fresh image...");
  let gateJson;
  try {
    const out = execSync("npx hyperframes check . --json", { cwd: process.cwd(), timeout: 120000 }).toString();
    const match = out.match(/\{[\s\S]*\}/);
    gateJson = match ? JSON.parse(match[0]) : null;
  } catch (e) {
    const match = (e.stdout || "").toString().match(/\{[\s\S]*\}/);
    gateJson = match ? JSON.parse(match[0]) : null;
  }

  const isSuccess = Boolean(resolvedPath) && fileStat.size > 5000 && gateJson?.ok === true;
  recordTest(
    "fresh live gpt-image-2 generation & hyperframes gate",
    isSuccess,
    `Generated ${fileStat.size} bytes (${isPNG ? "valid PNG" : "raw"}) in ${(elapsed/1000).toFixed(1)}s via LIVE API. Gate: ok=${gateJson?.ok}, lint=${gateJson?.lint?.ok}, contrast=${gateJson?.contrast?.ok}, layout=${gateJson?.layout?.ok}`
  );
} catch (err) {
  console.error("[Test] Error:", err.message);
  recordTest("fresh live gpt-image-2 generation & hyperframes gate", false, err.message);
}

// Restore good composition
import { composeProject as comp2 } from "../src/composer/composer.js";
const goodPlan = {
  schemaVersion: "1.1.0", title: "DesignX Global 2026", aspectRatio: "16:9", totalDuration: 9,
  palette: { background: "#0a0a0f", surface: "#18181b", primary: "#06b6d4", text: "#ffffff", subtext: "#94a3b8" },
  scenes: [
    { id: "scene-1", template: "title", duration: 3, motionIntent: "scale-up", heading: "DesignX Global 2026", subheading: "Tokyo" },
    { id: "scene-2", template: "feature-callout", duration: 3, motionIntent: "stagger-reveal", heading: "What Awaits You", features: ["Keynotes", "Workshops"] },
    { id: "scene-3", template: "cta", duration: 3, motionIntent: "slide-up", heading: "Secure Your Seat Now", ctaText: "Register Now" }
  ]
};
import fs2 from "node:fs";
import path2 from "node:path";
const goodComp = comp2(goodPlan);
fs2.writeFileSync(path2.resolve(process.cwd(), "index.html"), goodComp.html, "utf-8");

console.log("\n=================================================");
const allPassed = results.every(r => r.passed);
console.log(`Total: ${results.length} | Passed: ${results.filter(r => r.passed).length} | Failed: ${results.filter(r => !r.passed).length}`);
console.log(`Status: ${allPassed ? "ALL TESTS PASSED ?" : "FAILURES DETECTED ?"}`);
process.exit(allPassed ? 0 : 1);
