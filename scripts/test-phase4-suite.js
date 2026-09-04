import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveSingleImage, computeImageCacheKey } from "../src/image-resolver.js";
import { composeProject } from "../src/composer/composer.js";
import { runHyperframesGate, runPipeline } from "../src/orchestrator.js";
import { applyDeterministicRepair } from "../src/repair.js";

const results = [];

function recordTest(name, passed, detail) {
  results.push({ name, passed, detail });
  const statusMark = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[${statusMark}] ${name}: ${detail}`);
}

async function runSuite() {
  console.log("=================================================");
  console.log("   PHASE 4 ORCHESTRATOR & E2E VERIFICATION SUITE ");
  console.log("=================================================\n");

  // -------------------------------------------------------------
  // TEST 1: FRESH LIVE gpt-image-2 GENERATION (Cache Bypass)
  // -------------------------------------------------------------
  console.log("--- TEST 1: Fresh Live gpt-image-2 Generation (Guaranteed Cache Bypass) ---");
  try {
    const uniqueId = `fresh-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const uniqueSlot = {
      prompt: `Futuristic holographic AI brain with glowing cyan neural synapses unique test ${uniqueId}`,
      style: "modern minimalist 3d isometric vector neon dark theme",
      aspectRatio: "1:1",
      required: true
    };

    const expectedKey = computeImageCacheKey(uniqueSlot, { seed: 9999, model: "gpt-image-2" });
    const expectedAssetPath = path.resolve(process.cwd(), "assets/images", `${expectedKey}.png`);
    const expectedMetaPath = path.resolve(process.cwd(), "cache/images", `${expectedKey}.json`);

    // Ensure no stale cache exists
    try { await fs.unlink(expectedAssetPath); } catch {}
    try { await fs.unlink(expectedMetaPath); } catch {}

    console.log(`[Test] Invoking fresh live API call for prompt "${uniqueSlot.prompt.slice(0, 50)}..."`);
    const tStart = Date.now();
    const resolvedPath = await resolveSingleImage(uniqueSlot, "fresh-scene", {
      seed: 9999,
      model: "gpt-image-2",
      useCache: false, // Force live API call
      timeoutMs: 180000
    });
    const elapsed = Date.now() - tStart;

    const fileStat = await fs.stat(path.resolve(process.cwd(), resolvedPath));

    // Compose fresh asset into a test composition and verify gate
    const testComp = composeProject({
      schemaVersion: "1.1.0",
      title: "Fresh Live Image Gate Test",
      aspectRatio: "16:9",
      totalDuration: 6,
      palette: { background: "#09090b", surface: "#18181b", primary: "#06b6d4", text: "#ffffff", subtext: "#a1a1aa" },
      scenes: [
        {
          id: "s1",
          template: "image-hero",
          duration: 3,
          motionIntent: "counter-zoom",
          heading: "Fresh Neural Engine",
          imageSlot: uniqueSlot
        },
        {
          id: "s2",
          template: "cta",
          duration: 3,
          motionIntent: "slide-up",
          heading: "Deploy Instantly",
          ctaText: "Get Started"
        }
      ]
    }, { resolvedImages: { "s1": resolvedPath } });

    await fs.writeFile(path.resolve(process.cwd(), "index.html"), testComp.html, "utf-8");
    await fs.writeFile(path.resolve(process.cwd(), "meta.json"), JSON.stringify(testComp.metaJson, null, 2), "utf-8");

    const gateResult = await runHyperframesGate();

    const isSuccess = Boolean(resolvedPath) && fileStat.size > 5000 && gateResult.ok === true;
    recordTest(
      "fresh live gpt-image-2 generation & hyperframes gate",
      isSuccess,
      `Generated ${fileStat.size} bytes in ${(elapsed / 1000).toFixed(1)}s via live API. HyperFrames gate check: ${gateResult.ok}`
    );
  } catch (err) {
    recordTest("fresh live gpt-image-2 generation & hyperframes gate", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 2: TARGETED DETERMINISTIC REPAIR SYSTEM
  // -------------------------------------------------------------
  console.log("\n--- TEST 2: Targeted Deterministic Repair System ---");
  try {
    const badContrastPlan = {
      schemaVersion: "1.1.0",
      title: "Contrast Repair Test",
      aspectRatio: "16:9",
      totalDuration: 6,
      palette: {
        background: "#222222",
        surface: "#252525",
        primary: "#333333", // extremely low contrast dark grey
        text: "#3a3a3a",    // unreadable low contrast
        subtext: "#2c2c2c"
      },
      scenes: [
        { id: "s1", template: "title", duration: 3, motionIntent: "scale-up", heading: "Low Contrast Test", subheading: "Checking repair" },
        { id: "s2", template: "cta", duration: 3, motionIntent: "slide-up", heading: "Action Scene", ctaText: "Click" }
      ]
    };

    // 1. Compose and gate bad plan
    const badComp = composeProject(badContrastPlan);
    await fs.writeFile(path.resolve(process.cwd(), "index.html"), badComp.html, "utf-8");
    await fs.writeFile(path.resolve(process.cwd(), "meta.json"), JSON.stringify(badComp.metaJson, null, 2), "utf-8");
    const badGate = await runHyperframesGate();

    // 2. Apply deterministic repair
    const repair = applyDeterministicRepair(badContrastPlan, badGate, 1);
    const repairedComp = composeProject(repair.repairedPlan);
    await fs.writeFile(path.resolve(process.cwd(), "index.html"), repairedComp.html, "utf-8");
    await fs.writeFile(path.resolve(process.cwd(), "meta.json"), JSON.stringify(repairedComp.metaJson, null, 2), "utf-8");
    const repairedGate = await runHyperframesGate();

    const repairSuccess = (badGate.ok === false) && (repairedGate.ok === true);
    recordTest(
      "targeted gate failure repair",
      repairSuccess,
      `Detected initial failure (ok: ${badGate.ok}) -> Applied [${repair.repairType}] -> Gate passed (ok: ${repairedGate.ok})`
    );
  } catch (err) {
    recordTest("targeted gate failure repair", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 3: E2E PIPELINE - BRIEF 1 (CodeStream Widescreen 16:9)
  // -------------------------------------------------------------
  console.log("\n--- TEST 3: E2E Pipeline on Brief 1 (Widescreen 16:9) ---");
  let brief1Summary = null;
  try {
    const brief1Text = "Create a high-energy 12-second widescreen promo for CodeStream AI development platform highlighting instant review and 10x developer velocity.";
    brief1Summary = await runPipeline(brief1Text, {
      jobId: "brief-1-e2e",
      seed: 42
    });

    const fileStat = await fs.stat(path.resolve(process.cwd(), brief1Summary.output.mp4Path));
    const passed = brief1Summary.gateOk && fileStat.size > 10000;
    recordTest(
      "e2e pipeline brief 1 (16:9 widescreen)",
      passed,
      `Rendered MP4: ${brief1Summary.output.mp4Path} (${(fileStat.size / 1024).toFixed(1)} KB, ${brief1Summary.output.durationSeconds}s, ${brief1Summary.output.resolution})`
    );
  } catch (err) {
    recordTest("e2e pipeline brief 1 (16:9 widescreen)", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 4: E2E PIPELINE - BRIEF 2 (PulseFit Portrait 9:16 with Hero Image)
  // -------------------------------------------------------------
  console.log("\n--- TEST 4: E2E Pipeline on Brief 2 (Portrait 9:16 with Image-Hero) ---");
  let brief2Summary = null;
  try {
    const brief2Text = "Create a 15-second vertical 9:16 mobile app launch promo for PulseFit workout companion showing a sleek heart rate tracking dashboard.";
    brief2Summary = await runPipeline(brief2Text, {
      jobId: "brief-2-e2e",
      seed: 42
    });

    const fileStat = await fs.stat(path.resolve(process.cwd(), brief2Summary.output.mp4Path));
    const hasImageHero = Object.keys(brief2Summary.resolvedImages).length > 0;
    const passed = brief2Summary.gateOk && hasImageHero && fileStat.size > 10000;
    recordTest(
      "e2e pipeline brief 2 (9:16 portrait + real image-hero)",
      passed,
      `Rendered MP4: ${brief2Summary.output.mp4Path} (${(fileStat.size / 1024).toFixed(1)} KB, ${brief2Summary.output.durationSeconds}s, ${brief2Summary.output.resolution}) with resolved image`
    );
  } catch (err) {
    recordTest("e2e pipeline brief 2 (9:16 portrait + real image-hero)", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 5: E2E PIPELINE - BRIEF 3 (DevPulse Widescreen 16:9, 3 Scenes)
  // -------------------------------------------------------------
  console.log("\n--- TEST 5: E2E Pipeline on Brief 3 (Widescreen 16:9, 3 Scenes) ---");
  let brief3Summary = null;
  try {
    const brief3Text = "Create a 9-second widescreen video introducing DevPulse real-time cloud monitoring with 3 scenes.";
    brief3Summary = await runPipeline(brief3Text, {
      jobId: "brief-3-e2e",
      seed: 42
    });

    const fileStat = await fs.stat(path.resolve(process.cwd(), brief3Summary.output.mp4Path));
    const passed = brief3Summary.gateOk && brief3Summary.plan.scenes.length === 3 && fileStat.size > 10000;
    recordTest(
      "e2e pipeline brief 3 (16:9 3-scenes)",
      passed,
      `Rendered MP4: ${brief3Summary.output.mp4Path} (${(fileStat.size / 1024).toFixed(1)} KB, ${brief3Summary.output.durationSeconds}s, ${brief3Summary.output.resolution})`
    );
  } catch (err) {
    recordTest("e2e pipeline brief 3 (16:9 3-scenes)", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 6: DETERMINISTIC REPEATABILITY (Same Brief Twice)
  // -------------------------------------------------------------
  console.log("\n--- TEST 6: Deterministic Repeatability (Same Brief Twice) ---");
  try {
    const brief1Text = "Create a high-energy 12-second widescreen promo for CodeStream AI development platform highlighting instant review and 10x developer velocity.";

    console.log("[Test] Executing run A...");
    const runA = await runPipeline(brief1Text, { jobId: "brief-1-repeat-A", seed: 42 });
    console.log("[Test] Executing run B...");
    const runB = await runPipeline(brief1Text, { jobId: "brief-1-repeat-B", seed: 42 });

    const planMatch = JSON.stringify(runA.plan) === JSON.stringify(runB.plan);
    const imageMatch = JSON.stringify(runA.resolvedImages) === JSON.stringify(runB.resolvedImages);
    const durationMatch = runA.output.durationSeconds === runB.output.durationSeconds;
    const resMatch = runA.output.resolution === runB.output.resolution;

    // Compare generated HTML byte hashes
    const compA = composeProject(runA.plan, { resolvedImages: runA.resolvedImages });
    const compB = composeProject(runB.plan, { resolvedImages: runB.resolvedImages });
    const hashA = crypto.createHash("sha256").update(compA.html).digest("hex");
    const hashB = crypto.createHash("sha256").update(compB.html).digest("hex");
    const htmlMatch = hashA === hashB;

    const deterministicPass = planMatch && imageMatch && durationMatch && resMatch && htmlMatch;
    recordTest(
      "deterministic repeatability (same brief twice)",
      deterministicPass,
      `HTML Hash match: ${htmlMatch} (${hashA.slice(0, 10)} === ${hashB.slice(0, 10)}) | Plan match: ${planMatch} | Asset match: ${imageMatch}`
    );
  } catch (err) {
    recordTest("deterministic repeatability (same brief twice)", false, err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n=================================================");
  console.log("             PHASE 4 SUMMARY                      ");
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
