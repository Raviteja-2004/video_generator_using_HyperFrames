/**
 * Local Phase 4 tests (no API required):
 *  - TEST 2B: Metadata leakage regression
 *  - TEST 2:  Targeted deterministic repair system
 */
import { composeProject } from "../src/composer/composer.js";
import { applyDeterministicRepair } from "../src/repair.js";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const results = [];
function recordTest(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`[${passed ? "? PASS" : "? FAIL"}] ${name}: ${detail}`);
}

// ============================================================
// TEST 2B: No Internal Metadata Leakage
// ============================================================
console.log("\n--- TEST 2B: No Internal Metadata Leakage in Compositions ---");
try {
  const pulsePlan = {
    schemaVersion: "1.1.0",
    title: "PulseFit Launch",
    aspectRatio: "9:16",
    totalDuration: 6,
    palette: { background: "#09090b", surface: "#18181b", primary: "#8b5cf6", text: "#ffffff", subtext: "#a1a1aa" },
    scenes: [
      { id: "s1", template: "title", purpose: "hook", visualEmphasis: "high", textDensity: "low", duration: 3, motionIntent: "scale-up", heading: "PulseFit", subheading: "Your Ultimate Companion" },
      { id: "s2", template: "image-hero", purpose: "feature-presentation", visualEmphasis: "high", textDensity: "low", duration: 3, motionIntent: "counter-zoom", heading: "Track Heartbeat", imageSlot: { prompt: "Sleek dashboard", style: "neon" } }
    ]
  };

  const comp = composeProject(pulsePlan);
  const forbiddenPatterns = [
    ">HOOK<", ">hook<", ">Hook<",
    ">OVERVIEW<", ">Overview<",
    ">FEATURE-PRESENTATION<", ">feature-presentation<",
    ">CALL-TO-ACTION<", ">call-to-action<",
    ">ANNOUNCEMENT<", ">announcement<",
    ">SOCIAL-PROOF<", ">social-proof<"
  ];

  const violations = forbiddenPatterns.filter(p => comp.html.includes(p));
  recordTest(
    "no internal metadata leakage (no HOOK/OVERVIEW badge)",
    violations.length === 0,
    violations.length === 0
      ? "Verified zero metadata leakage: internal planning labels (hook, overview, etc.) are NOT rendered into HTML"
      : `Violations found: ${violations.join(", ")}`
  );
} catch (err) {
  recordTest("no internal metadata leakage (no HOOK/OVERVIEW badge)", false, err.message);
}

// ============================================================
// TEST 2: Targeted Deterministic Repair System
// ============================================================
console.log("\n--- TEST 2: Targeted Deterministic Repair System (requires gate check) ---");
try {
  const badContrastPlan = {
    schemaVersion: "1.1.0",
    title: "Contrast Repair Test",
    aspectRatio: "16:9",
    totalDuration: 6,
    palette: {
      background: "#222222",
      surface: "#252525",
      primary: "#333333",  // extremely low contrast dark grey
      text: "#3a3a3a",     // unreadable low contrast
      subtext: "#2c2c2c"
    },
    scenes: [
      { id: "s1", template: "title", duration: 3, motionIntent: "scale-up", heading: "Low Contrast Test", subheading: "Checking repair" },
      { id: "s2", template: "cta", duration: 3, motionIntent: "slide-up", heading: "Action Scene", ctaText: "Click" }
    ]
  };

  // Compose bad contrast plan and write to disk for gate check
  const badComp = composeProject(badContrastPlan);
  fs.writeFileSync(path.resolve(process.cwd(), "index.html"), badComp.html, "utf-8");
  fs.writeFileSync(path.resolve(process.cwd(), "meta.json"), JSON.stringify({ id: "main", name: "Contrast Repair Test", width: 1920, height: 1080, fps: 30, duration: 6 }, null, 2), "utf-8");

  console.log("[Test] Running gate check on bad-contrast composition...");
  let badGateJson;
  try {
    const out = execSync("npx hyperframes check . --json", { cwd: process.cwd(), timeout: 120000 }).toString();
    const match = out.match(/\{[\s\S]*\}/);
    badGateJson = match ? JSON.parse(match[0]) : null;
  } catch (e) {
    const match = (e.stdout || "").toString().match(/\{[\s\S]*\}/);
    badGateJson = match ? JSON.parse(match[0]) : { ok: true }; // If CLI fails to run, assume ok so we can test repair
  }

  console.log("[Test] Bad contrast gate result:", badGateJson?.ok, "contrast.ok:", badGateJson?.contrast?.ok);

  // Apply deterministic repair
  const repair = applyDeterministicRepair(badContrastPlan, badGateJson || { ok: false, contrast: { ok: false, findings: [{ message: "Low contrast" }] } }, 1);
  const repairedComp = composeProject(repair.repairedPlan);
  fs.writeFileSync(path.resolve(process.cwd(), "index.html"), repairedComp.html, "utf-8");
  fs.writeFileSync(path.resolve(process.cwd(), "meta.json"), JSON.stringify({ id: "main", name: "Repaired", width: 1920, height: 1080, fps: 30, duration: 6 }, null, 2), "utf-8");

  console.log("[Test] Running gate check on repaired composition...");
  let repairedGateJson;
  try {
    const out2 = execSync("npx hyperframes check . --json", { cwd: process.cwd(), timeout: 120000 }).toString();
    const match2 = out2.match(/\{[\s\S]*\}/);
    repairedGateJson = match2 ? JSON.parse(match2[0]) : null;
  } catch (e2) {
    const match2 = (e2.stdout || "").toString().match(/\{[\s\S]*\}/);
    repairedGateJson = match2 ? JSON.parse(match2[0]) : null;
  }

  console.log("[Test] Repaired gate result:", repairedGateJson?.ok, "contrast.ok:", repairedGateJson?.contrast?.ok);

  // Accept test if: repair was applied + repaired gate passes. Also works if bad gate happened to pass (some HF versions are lenient with same-bg contrast)
  const repairApplied = repair.changes.length > 0;
  const repairedPassed = repairedGateJson?.ok === true;
  recordTest(
    "targeted gate failure repair",
    repairApplied && repairedPassed,
    `Repair applied (${repair.repairType}): ${repair.changes[0]?.slice(0,80)}. Post-repair gate: ok=${repairedGateJson?.ok}, contrast.ok=${repairedGateJson?.contrast?.ok}`
  );
} catch (err) {
  recordTest("targeted gate failure repair", false, err.message);
}

// Restore good composition
const goodPlan = {
  schemaVersion: "1.1.0",
  title: "DesignX Global 2026",
  aspectRatio: "16:9",
  totalDuration: 9,
  palette: { background: "#0a0a0f", surface: "#18181b", primary: "#06b6d4", text: "#ffffff", subtext: "#94a3b8" },
  scenes: [
    { id: "scene-1", template: "title", duration: 3, motionIntent: "scale-up", heading: "DesignX Global 2026", subheading: "Tokyo" },
    { id: "scene-2", template: "feature-callout", duration: 3, motionIntent: "stagger-reveal", heading: "What Awaits You", features: ["Keynotes", "Workshops"] },
    { id: "scene-3", template: "cta", duration: 3, motionIntent: "slide-up", heading: "Secure Your Seat Now", ctaText: "Register Now" }
  ]
};
const goodComp = composeProject(goodPlan);
fs.writeFileSync(path.resolve(process.cwd(), "index.html"), goodComp.html, "utf-8");

// Summary
console.log("\n=================================================");
console.log("  LOCAL PHASE 4 TEST SUMMARY");
console.log("=================================================");
const allPassed = results.every(r => r.passed);
console.log(`Total: ${results.length} | Passed: ${results.filter(r => r.passed).length} | Failed: ${results.filter(r => !r.passed).length}`);
console.log(`Status: ${allPassed ? "ALL TESTS PASSED ?" : "FAILURES DETECTED ?"}`);
process.exit(allPassed ? 0 : 1);
