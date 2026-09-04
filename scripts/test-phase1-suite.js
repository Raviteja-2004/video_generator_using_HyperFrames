import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { validatePlan, SCHEMA_VERSION } from "../src/schema.js";
import { planVideo, computePlanCacheKey, classifyFailure } from "../src/planner.js";

const results = [];

function recordTest(name, passed, detail) {
  results.push({ name, passed, detail });
  const statusMark = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[${statusMark}] ${name}: ${detail}`);
}

async function runSuite() {
  console.log("=================================================");
  console.log("       PHASE 1 RIGOROUS VERIFICATION SUITE       ");
  console.log("=================================================\n");

  await fs.mkdir(path.resolve(process.cwd(), "briefs"), { recursive: true });
  await fs.mkdir(path.resolve(process.cwd(), "cache/plans"), { recursive: true });

  // 1. Schema Validation (Unit test)
  try {
    const validDummy = {
      schemaVersion: SCHEMA_VERSION,
      title: "Test Video",
      aspectRatio: "16:9",
      totalDuration: 6,
      palette: {
        background: "#09090b",
        surface: "#18181b",
        primary: "#8b5cf6",
        text: "#ffffff",
        subtext: "#a1a1aa"
      },
      scenes: [
        {
          id: "s1",
          template: "title",
          purpose: "hook",
          visualEmphasis: "high",
          textDensity: "low",
          duration: 3,
          motionIntent: "scale-up",
          heading: "Welcome to Test"
        },
        {
          id: "s2",
          template: "cta",
          purpose: "call-to-action",
          visualEmphasis: "high",
          textDensity: "low",
          duration: 3,
          motionIntent: "slide-up",
          heading: "Join Today",
          ctaText: "Get Started"
        }
      ]
    };
    const checkValid = validatePlan(validDummy);
    recordTest("schema validation", checkValid.success, "Valid structured plan accepted");
  } catch (err) {
    recordTest("schema validation", false, err.message);
  }

  // 2. Duration Invariant
  try {
    const invalidDurationDummy = {
      schemaVersion: SCHEMA_VERSION,
      title: "Test Video",
      aspectRatio: "16:9",
      totalDuration: 10, // mismatch: sum of scenes is 6s
      palette: {
        background: "#09090b",
        surface: "#18181b",
        primary: "#8b5cf6",
        text: "#ffffff",
        subtext: "#a1a1aa"
      },
      scenes: [
        { id: "s1", template: "title", duration: 3, motionIntent: "fade", heading: "H1" },
        { id: "s2", template: "cta", duration: 3, motionIntent: "fade", heading: "H2", ctaText: "CTA" }
      ]
    };
    const checkInvalid = validatePlan(invalidDurationDummy);
    recordTest("duration invariant", !checkInvalid.success && checkInvalid.error.includes("Total duration"), "Strictly rejected plan where totalDuration (10s) != sum of scenes (6s)");
  } catch (err) {
    recordTest("duration invariant", false, err.message);
  }

  // 3. Template-Specific Validation
  try {
    const missingFeatureDummy = {
      schemaVersion: SCHEMA_VERSION,
      title: "Test",
      aspectRatio: "16:9",
      totalDuration: 6,
      palette: { background: "#000000", surface: "#111111", primary: "#8b5cf6", text: "#ffffff", subtext: "#aaaaaa" },
      scenes: [
        { id: "s1", template: "feature-callout", duration: 3, motionIntent: "fade", heading: "Features" }, // Missing features array
        { id: "s2", template: "cta", duration: 3, motionIntent: "fade", heading: "CTA", ctaText: "Go" }
      ]
    };
    const checkTemplate = validatePlan(missingFeatureDummy);
    recordTest("template-specific validation", !checkTemplate.success && checkTemplate.error.includes("feature-callout"), "Rejected feature-callout missing required features array");
  } catch (err) {
    recordTest("template-specific validation", false, err.message);
  }

  // 4. Adaptive Retry & Failure Classification
  try {
    const classification = classifyFailure("", new Error("Unexpected end of JSON input"), 1024, true);
    const adaptsToken = classification.adaptiveAdjustment.maxTokens > 1024;
    recordTest("adaptive retry behavior", classification.type === "EMPTY_RESPONSE_OR_TOKEN_STARVATION" && adaptsToken, `Classified as ${classification.type}, adjusted maxTokens from 1024 to ${classification.adaptiveAdjustment.maxTokens}`);
  } catch (err) {
    recordTest("adaptive retry behavior", false, err.message);
  }

  // 5. Live Brief Generation: Brief 1 (Widescreen 16:9 Developer Ad)
  let plan1;
  try {
    const brief1Text = "A 12 second ad for an AI developer tool called 'CodeStream', dark theme with vibrant purple neon accent, featuring title, three key feature callouts (Instant Code Review, Real-time Refactoring, Zero Latency), explicit stat '10x Developer Velocity' mentioned in brief, and ends with 'Start Free Trial' CTA.";
    plan1 = await planVideo(brief1Text, { useCache: false, seed: 100 });
    await fs.writeFile(path.resolve(process.cwd(), "briefs/brief-1-plan.json"), JSON.stringify(plan1, null, 2));
    const pass = plan1.aspectRatio === "16:9" && plan1.scenes.length >= 4 && plan1.totalDuration === 12;
    recordTest("16:9 plan", pass, `Generated ${plan1.scenes.length} scenes, duration=${plan1.totalDuration}s, ratio=${plan1.aspectRatio}`);
  } catch (err) {
    recordTest("16:9 plan", false, err.message);
  }

  // 6. Live Brief Generation: Brief 2 (Vertical 9:16 Mobile Fitness Reel)
  let plan2;
  try {
    const brief2Text = "A 15 second vertical TikTok/Reels mobile promo for 'PulseFit' workout companion, portrait 9:16 aspect ratio, sleek dark slate theme with neon emerald green accent. Starts with bold hero hook, showcases an animated UI hero illustration of heart rate tracking (required image), highlights 3 real-time coaching features (Adaptive Workouts, Form Correction, Live Pace Guidance), and ends with 'Download on iOS & Android' CTA.";
    plan2 = await planVideo(brief2Text, { useCache: false, seed: 200 });
    await fs.writeFile(path.resolve(process.cwd(), "briefs/brief-2-plan.json"), JSON.stringify(plan2, null, 2));
    const pass = plan2.aspectRatio === "9:16" && plan2.scenes.length >= 4 && plan2.totalDuration === 15;
    recordTest("9:16 plan", pass, `Generated ${plan2.scenes.length} scenes, duration=${plan2.totalDuration}s, ratio=${plan2.aspectRatio}`);
  } catch (err) {
    recordTest("9:16 plan", false, err.message);
  }

  // 7. Live Brief Generation: Brief 3 (Widescreen 16:9 Announcement, 3 scenes)
  let plan3;
  try {
    const brief3Text = "A 9 second cinematic announcement for 'DesignX Global 2026', widescreen 16:9, dark theme with electric cyan accent, minimal 3 scenes. Scene 1 announces Tokyo 2026, Scene 2 highlights 2 features: Keynotes & Workshops, Scene 3 invites registration with 'Secure Your Seat Now'.";
    plan3 = await planVideo(brief3Text, { useCache: false, seed: 300 });
    await fs.writeFile(path.resolve(process.cwd(), "briefs/brief-3-plan.json"), JSON.stringify(plan3, null, 2));
    const pass = plan3.aspectRatio === "16:9" && plan3.scenes.length === 3 && plan3.totalDuration === 9;
    recordTest("different scene counts", pass, `Verified brief 3 has exactly 3 scenes (Brief 1 has ${plan1?.scenes?.length || 4}, Brief 2 has ${plan2?.scenes?.length || 4})`);
  } catch (err) {
    recordTest("different scene counts", false, err.message);
  }

  // 8. Anti-Hallucination Invariant Test (Brief without statistics)
  try {
    const statlessBrief = "A clean 6 second brand teaser for a creative design studio called 'Aether', dark theme with electric cyan, featuring 2 core design services: Brand Identity and UI Motion, ending on a call to action to view portfolio. No statistics or numbers are provided.";
    const statlessPlan = await planVideo(statlessBrief, { useCache: false, seed: 400 });
    const hasStatTemplate = statlessPlan.scenes.some(s => s.template === "stat-highlight");
    const hasInventedStat = statlessPlan.scenes.some(s => !!s.stat);
    const pass = !hasStatTemplate && !hasInventedStat;
    recordTest("unsupported/fabricated-claim prevention", pass, pass ? "Plan contains zero invented numerical stats or stat-highlight templates" : "FAILED: Plan manufactured unsupported statistics!");
  } catch (err) {
    recordTest("unsupported/fabricated-claim prevention", false, err.message);
  }

  // 9. Determinism Test (Same brief twice produces identical hash)
  try {
    const testBrief = "A 6 second quick teaser for CloudDB, dark theme, purple accent, 2 scenes: title and CTA.";
    const runA = await planVideo(testBrief, { useCache: false, seed: 777 });
    const runB = await planVideo(testBrief, { useCache: true, seed: 777 });
    const hashA = crypto.createHash("sha256").update(JSON.stringify(runA)).digest("hex");
    const hashB = crypto.createHash("sha256").update(JSON.stringify(runB)).digest("hex");
    const pass = hashA === hashB;
    recordTest("same-input deterministic plan test", pass, `Run A Hash: ${hashA.slice(0, 12)}... | Run B Hash: ${hashB.slice(0, 12)}... (Exact Match: ${pass})`);
  } catch (err) {
    recordTest("same-input deterministic plan test", false, err.message);
  }

  // 10. Retry Exhaustion & Diagnostic Artifact Verification
  try {
    let threw = false;
    try {
      await planVideo("A forced failure test", {
        initialMaxTokens: 10,
        allowTokenAdaptation: false, // Prevents adaptation so all 3 attempts hit token starvation and exhaust
        maxAttempts: 3,
        useCache: false,
        errorArtifactPath: "briefs/plan-error.json"
      });
    } catch (err) {
      threw = true;
    }
    const errorLogRaw = await fs.readFile(path.resolve(process.cwd(), "briefs/plan-error.json"), "utf-8");
    const errorLog = JSON.parse(errorLogRaw);
    const pass = threw && errorLog.maxAttempts === 3 && errorLog.attempts.length === 3 && errorLog.attempts[0].failureType !== undefined;
    recordTest("retry exhaustion artifact", pass, `Captured all ${errorLog.attempts.length} attempts in plan-error.json with failureType and timestamped logs`);
  } catch (err) {
    recordTest("retry exhaustion artifact", false, err.message);
  }

  console.log("\n=================================================");
  console.log("             TEST SUITE SUMMARY                  ");
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
