import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import dotenv from "dotenv";

import { planVideo } from "./planner.js";
import { validatePlan } from "./schema.js";
import { resolvePlanImages } from "./image-resolver.js";
import { composeProject } from "./composer/composer.js";
import { applyDeterministicRepair } from "./repair.js";

dotenv.config();

const execAsync = promisify(exec);

// Ensure FFmpeg is available on PATH on Windows
const WIN_FFMPEG_PATH = "C:\\Users\\manoj\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-full_build\\bin";
if (process.platform === "win32" && !process.env.PATH?.includes("ffmpeg")) {
  process.env.PATH = `${WIN_FFMPEG_PATH};${process.env.PATH}`;
}

/**
 * Executes the HyperFrames gate check (`hyperframes check . --json`).
 * @returns {Promise<object>} Parsed check result JSON
 */
export async function runHyperframesGate() {
  try {
    const { stdout, stderr } = await execAsync("npx hyperframes check . --json", {
      cwd: process.cwd(),
      timeout: 120000,
      env: process.env
    });
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Failed to parse JSON from gate check. Output:\n${stdout}\nStderr:\n${stderr}`);
    }
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    if (err.stdout) {
      const jsonMatch = err.stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
    throw new Error(`HyperFrames gate check process failed: ${err.message}`);
  }
}

/**
 * Renders the composition into an MP4 video using `hyperframes render`.
 * @param {string} outputMp4Path - Destination path for MP4
 * @returns {Promise<{ outputMp4Path: string, sizeBytes: number, renderOutput: string }>}
 */
export async function renderCompositionToMp4(outputMp4Path) {
  const absoluteOutput = path.resolve(process.cwd(), outputMp4Path);
  await fs.mkdir(path.dirname(absoluteOutput), { recursive: true });

  console.log(`[Orchestrator] Rendering composition to MP4: ${outputMp4Path}...`);
  const cmd = `npx hyperframes render . -o "${outputMp4Path}"`;
  const { stdout, stderr } = await execAsync(cmd, {
    cwd: process.cwd(),
    timeout: 300000, // 5 min timeout
    env: process.env
  });

  const fileStat = await fs.stat(absoluteOutput);
  if (!fileStat || fileStat.size < 1000) {
    throw new Error(`Render failed: generated MP4 is missing or empty (${fileStat?.size || 0} bytes). Log:\n${stdout}\n${stderr}`);
  }

  console.log(`[Orchestrator] Render successful: ${outputMp4Path} (${fileStat.size} bytes)`);
  return {
    outputMp4Path,
    sizeBytes: fileStat.size,
    renderOutput: stdout
  };
}

/**
 * Runs the full end-to-end video generator pipeline from a brief to a rendered MP4.
 *
 * Pipeline Stages:
 *  1. Planning: Plain brief -> GPT-5.5 -> validated plan.json
 *  2. Image Resolution: Resolves required/optional image slots with gpt-image-2
 *  3. Composition: Deterministic HTML + GSAP compilation
 *  4. Gate Check: Runs `hyperframes check . --json`
 *  5. Repair Loop: Targeted deterministic repairs if gate fails (capped at maxRepairs)
 *  6. Rendering: Renders final MP4 once gate passes
 *
 * @param {string} brief - Plain-language input brief
 * @param {object} [options]
 * @param {string} [options.jobId] - Optional job identifier
 * @param {number} [options.seed=42]
 * @param {boolean} [options.useCache=true]
 * @param {number} [options.maxRepairs=3]
 * @param {boolean} [options.skipRender=false]
 * @param {string} [options.rendersDir="renders"]
 * @returns {Promise<object>} Complete job execution summary
 */
export async function runPipeline(brief, options = {}) {
  const startTime = Date.now();
  const seed = options.seed ?? 42;
  const useCache = options.useCache ?? true;
  const maxRepairs = options.maxRepairs ?? 3;
  const skipRender = options.skipRender ?? false;
  const rendersDir = options.rendersDir || "renders";

  const briefHash = crypto.createHash("sha256").update(brief.trim()).digest("hex").slice(0, 10);
  const jobId = options.jobId || `video-${briefHash}`;
  const outputMp4Path = `${rendersDir}/${jobId}.mp4`;

  console.log("\n=======================================================");
  console.log(`  RUNNING PIPELINE FOR JOB: ${jobId}`);
  console.log(`  Brief: "${brief.slice(0, 70)}..."`);
  console.log("=======================================================\n");

  const stageTimings = {};

  // STAGE 1: Planning
  const t0 = Date.now();
  console.log("[Orchestrator] STAGE 1: Generating structured plan with GPT-5.5...");
  const rawPlan = await planVideo(brief, { seed, useCache });
  const validation = validatePlan(rawPlan);
  if (!validation.success) {
    throw new Error(`[Orchestrator] Plan validation failed: ${validation.error}`);
  }
  let currentPlan = validation.data;
  stageTimings.planningMs = Date.now() - t0;
  console.log(`[Orchestrator] Stage 1 Complete in ${stageTimings.planningMs}ms (${currentPlan.scenes.length} scenes, ${currentPlan.totalDuration}s, ${currentPlan.aspectRatio})`);

  // STAGE 2: Image Resolution
  const t1 = Date.now();
  console.log("[Orchestrator] STAGE 2: Resolving plan images with gpt-image-2...");
  const imageResolution = await resolvePlanImages(currentPlan, { seed, useCache });
  stageTimings.imageResolutionMs = Date.now() - t1;
  console.log(`[Orchestrator] Stage 2 Complete in ${stageTimings.imageResolutionMs}ms (Resolved: ${imageResolution.stats.resolved}/${imageResolution.stats.total})`);

  // STAGE 3, 4 & 5: Composition, Gate Check & Repair Loop
  let gatePassed = false;
  let repairCount = 0;
  let lastCheckResult = null;
  let composedProject = null;

  const t2 = Date.now();
  console.log("[Orchestrator] STAGE 3 & 4: Compiling composition and executing gate checks...");

  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    // Compile deterministic project
    composedProject = composeProject(currentPlan, {
      resolvedImages: imageResolution.resolvedImages
    });

    // Write index.html and meta.json for HyperFrames gate
    await fs.writeFile(path.resolve(process.cwd(), "index.html"), composedProject.html, "utf-8");
    await fs.writeFile(path.resolve(process.cwd(), "meta.json"), JSON.stringify(composedProject.metaJson, null, 2), "utf-8");

    // Execute Gate Check
    lastCheckResult = await runHyperframesGate();

    if (lastCheckResult.ok === true) {
      console.log(`[Orchestrator] HyperFrames Gate Check PASSED on attempt ${attempt} (repairs applied: ${repairCount})`);
      gatePassed = true;
      break;
    }

    console.warn(`[Orchestrator] HyperFrames Gate Check FAILED on attempt ${attempt}. Issues:`, JSON.stringify(lastCheckResult.layout?.findings || lastCheckResult.contrast?.findings || lastCheckResult.lint?.findings || []));

    if (attempt < maxRepairs) {
      repairCount++;
      console.log(`[Orchestrator] Applying targeted deterministic repair ${repairCount}/${maxRepairs}...`);
      const repairResult = applyDeterministicRepair(currentPlan, lastCheckResult, repairCount);
      currentPlan = repairResult.repairedPlan;
      console.log(`[Orchestrator] Applied repairs [${repairResult.repairType}]:`, repairResult.changes);
    }
  }

  stageTimings.compositionAndGateMs = Date.now() - t2;

  if (!gatePassed) {
    const fatalMsg = `[Orchestrator] FATAL: HyperFrames gate failed after ${repairCount} repair attempts.`;
    console.error(fatalMsg);
    throw new Error(fatalMsg);
  }

  // STAGE 6: Rendering
  let renderResult = null;
  if (!skipRender) {
    const t3 = Date.now();
    console.log("[Orchestrator] STAGE 6: Rendering final MP4...");
    renderResult = await renderCompositionToMp4(outputMp4Path);
    stageTimings.renderMs = Date.now() - t3;
  }

  const totalDurationMs = Date.now() - startTime;

  // Build Summary Artifact
  const jobSummary = {
    jobId,
    brief,
    seed,
    totalDurationMs,
    stageTimings,
    plan: currentPlan,
    resolvedImages: imageResolution.resolvedImages,
    repairCount,
    gateOk: gatePassed,
    gateDetails: {
      lintOk: lastCheckResult.lint?.ok,
      runtimeOk: lastCheckResult.runtime?.ok,
      layoutOk: lastCheckResult.layout?.ok,
      contrastOk: lastCheckResult.contrast?.ok
    },
    output: renderResult ? {
      mp4Path: renderResult.outputMp4Path,
      sizeBytes: renderResult.sizeBytes,
      durationSeconds: currentPlan.totalDuration,
      resolution: currentPlan.aspectRatio === "9:16" ? "1080x1920" : "1920x1080"
    } : null,
    completedAt: new Date().toISOString()
  };

  // Persist run metadata
  const metaArtifactPath = path.resolve(process.cwd(), rendersDir, `${jobId}-meta.json`);
  await fs.writeFile(metaArtifactPath, JSON.stringify(jobSummary, null, 2), "utf-8");

  console.log("\n=======================================================");
  console.log(`  PIPELINE COMPLETE FOR: ${jobId}`);
  console.log(`  MP4 Output:   ${outputMp4Path}`);
  console.log(`  Duration:     ${currentPlan.totalDuration}s (${currentPlan.aspectRatio})`);
  console.log(`  Total Time:   ${(totalDurationMs / 1000).toFixed(1)}s`);
  console.log("=======================================================\n");

  return jobSummary;
}

// CLI Entrypoint
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(process.cwd(), "src/orchestrator.js")) {
  const briefArg = process.argv[2] || "Create a high-energy 12-second widescreen promo for CodeStream AI development platform highlighting instant review and 10x developer velocity.";
  runPipeline(briefArg)
    .then(summary => {
      console.log("[CLI] Job Finished Successfully:", summary.jobId);
      process.exit(0);
    })
    .catch(err => {
      console.error("[CLI] Job Failed:", err.message);
      process.exit(1);
    });
}
