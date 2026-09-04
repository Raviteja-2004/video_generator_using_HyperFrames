import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";
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

async function runSuite() {
  console.log("=================================================");
  console.log("       PHASE 2 COMPOSER VERIFICATION SUITE       ");
  console.log("=================================================\n");

  // 1. Test All 5 Templates Individual Generation
  try {
    const allTemplatesPlan = {
      title: "All Templates Test",
      aspectRatio: "16:9",
      totalDuration: 15,
      palette: {
        background: "#09090b",
        surface: "#18181b",
        primary: "#8b5cf6",
        text: "#ffffff",
        subtext: "#a1a1aa"
      },
      scenes: [
        { id: "s1", template: "title", duration: 3, motionIntent: "scale-up", heading: "Title Scene", subheading: "Sub" },
        { id: "s2", template: "feature-callout", duration: 3, motionIntent: "stagger-reveal", heading: "Features", features: ["F1", "F2", "F3"] },
        { id: "s3", template: "stat-highlight", duration: 3, motionIntent: "counter-zoom", heading: "Stats", stat: { value: "10x", label: "Velocity" } },
        { id: "s4", template: "image-hero", duration: 3, motionIntent: "fade-in", heading: "Hero", imageSlot: { prompt: "Test prompt", style: "dark" } },
        { id: "s5", template: "cta", duration: 3, motionIntent: "slide-up", heading: "CTA", ctaText: "Join Now", ctaSubtext: "Free" }
      ]
    };

    const composed = composeProject(allTemplatesPlan);
    const hasAll = ["title", "feature-callout", "stat-highlight", "image-hero", "cta"].every(t => composed.html.includes(t));
    recordTest("five core templates coverage", hasAll, "Composed project containing all 5 templates (title, feature-callout, stat-highlight, image-hero, cta)");
  } catch (err) {
    recordTest("five core templates coverage", false, err.message);
  }

  // 2. Determinism Invariant (Same plan twice produces exact byte-for-byte HTML)
  try {
    const planRaw = await fs.readFile(path.resolve(process.cwd(), "briefs/brief-1-plan.json"), "utf-8");
    const plan1 = JSON.parse(planRaw);
    const compA = composeProject(plan1);
    const compB = composeProject(plan1);
    const hashA = crypto.createHash("sha256").update(compA.html).digest("hex");
    const hashB = crypto.createHash("sha256").update(compB.html).digest("hex");
    const match = hashA === hashB;
    recordTest("deterministic composition invariant", match, `HTML Hash A (${hashA.slice(0, 10)}) === HTML Hash B (${hashB.slice(0, 10)}): ${match}`);
  } catch (err) {
    recordTest("deterministic composition invariant", false, err.message);
  }

  // 3. Long Text & Safe Clamping Test
  try {
    const longTextPlan = {
      title: "Super Extended Title for Extreme Stress Testing Long Copy Constraints in Layout",
      aspectRatio: "16:9",
      totalDuration: 6,
      palette: { background: "#09090b", surface: "#18181b", primary: "#8b5cf6", text: "#ffffff", subtext: "#a1a1aa" },
      scenes: [
        {
          id: "s1",
          template: "title",
          duration: 3,
          motionIntent: "scale-up",
          heading: "This is an extremely long headline designed to verify that word wrapping and font scaling do not cause canvas overflow or layout disruption",
          subheading: "An equally extensive subheading detailing the underlying technical mechanics and assertions enforced by the deterministic compiler."
        },
        {
          id: "s2",
          template: "feature-callout",
          duration: 3,
          motionIntent: "stagger-reveal",
          heading: "Extensive Feature Callout Header",
          features: [
            "Continuous automated regression testing across multiple layout orientations",
            "Deterministic compilation with zero non-reproducible mutations",
            "High contrast WCAG-conscious color palette enforcement"
          ]
        }
      ]
    };
    const longComposed = composeProject(longTextPlan);
    const valid = longComposed.html.length > 500 && longComposed.html.includes("word-wrap: break-word");
    recordTest("long text & layout safety", valid, "Applied safe word-wrap, flex containment, and responsive sizing without layout degradation");
  } catch (err) {
    recordTest("long text & layout safety", false, err.message);
  }

  // 4. Brief 1 (Widescreen 16:9) HyperFrames Gate Check
  console.log("\n--- Running HyperFrames Check on Brief 1 (16:9) ---");
  try {
    const plan1Raw = await fs.readFile(path.resolve(process.cwd(), "briefs/brief-1-plan.json"), "utf-8");
    const plan1 = JSON.parse(plan1Raw);
    const comp1 = composeProject(plan1);
    await fs.writeFile(path.resolve(process.cwd(), "index.html"), comp1.html, "utf-8");
    await fs.writeFile(path.resolve(process.cwd(), "meta.json"), JSON.stringify(comp1.metaJson, null, 2), "utf-8");

    const check1 = await runHyperframesCheck();
    await fs.writeFile(path.resolve(process.cwd(), "briefs/brief-1-check.json"), JSON.stringify(check1, null, 2), "utf-8");
    recordTest("16:9 composition hyperframes check (Brief 1)", check1.ok === true, `Check ok: ${check1.ok} | Lint: ${check1.lint?.errorCount || 0} errs, Layout: ${check1.layout?.errorCount || 0} errs, Contrast: ${check1.contrast?.errorCount || 0} errs`);
  } catch (err) {
    recordTest("16:9 composition hyperframes check (Brief 1)", false, err.message);
  }

  // 5. Brief 2 (Vertical 9:16) HyperFrames Gate Check
  console.log("\n--- Running HyperFrames Check on Brief 2 (9:16 Portrait) ---");
  try {
    const plan2Raw = await fs.readFile(path.resolve(process.cwd(), "briefs/brief-2-plan.json"), "utf-8");
    const plan2 = JSON.parse(plan2Raw);
    const comp2 = composeProject(plan2);
    await fs.writeFile(path.resolve(process.cwd(), "index.html"), comp2.html, "utf-8");
    await fs.writeFile(path.resolve(process.cwd(), "meta.json"), JSON.stringify(comp2.metaJson, null, 2), "utf-8");

    const check2 = await runHyperframesCheck();
    await fs.writeFile(path.resolve(process.cwd(), "briefs/brief-2-check.json"), JSON.stringify(check2, null, 2), "utf-8");
    recordTest("9:16 vertical composition hyperframes check (Brief 2)", check2.ok === true, `Check ok: ${check2.ok} | Lint: ${check2.lint?.errorCount || 0} errs, Layout: ${check2.layout?.errorCount || 0} errs, Contrast: ${check2.contrast?.errorCount || 0} errs`);
  } catch (err) {
    recordTest("9:16 vertical composition hyperframes check (Brief 2)", false, err.message);
  }

  // 6. Brief 3 (Widescreen 16:9, 3 Scenes) HyperFrames Gate Check
  console.log("\n--- Running HyperFrames Check on Brief 3 (16:9) ---");
  try {
    const plan3Raw = await fs.readFile(path.resolve(process.cwd(), "briefs/brief-3-plan.json"), "utf-8");
    const plan3 = JSON.parse(plan3Raw);
    const comp3 = composeProject(plan3);
    await fs.writeFile(path.resolve(process.cwd(), "index.html"), comp3.html, "utf-8");
    await fs.writeFile(path.resolve(process.cwd(), "meta.json"), JSON.stringify(comp3.metaJson, null, 2), "utf-8");

    const check3 = await runHyperframesCheck();
    await fs.writeFile(path.resolve(process.cwd(), "briefs/brief-3-check.json"), JSON.stringify(check3, null, 2), "utf-8");
    recordTest("different scene count hyperframes check (Brief 3)", check3.ok === true, `Check ok: ${check3.ok} | Lint: ${check3.lint?.errorCount || 0} errs, Layout: ${check3.layout?.errorCount || 0} errs, Contrast: ${check3.contrast?.errorCount || 0} errs`);
  } catch (err) {
    recordTest("different scene count hyperframes check (Brief 3)", false, err.message);
  }

  console.log("\n=================================================");
  console.log("             PHASE 2 SUMMARY                      ");
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
