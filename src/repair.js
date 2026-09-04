/**
 * Targeted Deterministic Repair System for HyperFrames Gate Failures.
 * Analyzes gate findings and applies targeted corrections without arbitrary LLM mutations.
 */

/**
 * Classifies HyperFrames gate findings into actionable repair categories.
 * @param {object} checkJson - Raw JSON from `hyperframes check . --json`
 * @returns {Array<{ category: string, description: string, rawFinding: any }>}
 */
export function classifyGateFindings(checkJson) {
  const findings = [];

  // 1. Contrast Findings
  if (checkJson.contrast && !checkJson.contrast.ok) {
    for (const f of checkJson.contrast.findings || []) {
      findings.push({
        category: "CONTRAST",
        description: f.message || `Contrast failure between ${f.foreground} and ${f.background}`,
        rawFinding: f
      });
    }
  }

  // 2. Layout & Overflow Findings
  if (checkJson.layout && !checkJson.layout.ok) {
    for (const f of checkJson.layout.findings || []) {
      findings.push({
        category: "LAYOUT",
        description: f.message || `Layout issue at selector ${f.selector}`,
        rawFinding: f
      });
    }
  }

  // 3. Lint Findings
  if (checkJson.lint && !checkJson.lint.ok) {
    for (const f of checkJson.lint.findings || []) {
      findings.push({
        category: "LINT",
        description: f.message || `Lint issue: ${f.ruleId}`,
        rawFinding: f
      });
    }
  }

  // 4. Runtime / General Errors
  if (checkJson.runtime && !checkJson.runtime.ok) {
    for (const f of checkJson.runtime.findings || []) {
      findings.push({
        category: "RUNTIME",
        description: f.message || "Runtime evaluation failure in browser context",
        rawFinding: f
      });
    }
  }

  return findings;
}

/**
 * Applies targeted deterministic repairs to a video plan based on gate findings.
 * @param {object} originalPlan - Validated PlanSchema object
 * @param {object} checkJson - Gate check output
 * @param {number} attempt - Current repair attempt index (1-based)
 * @returns {{ repairedPlan: object, repairType: string, changes: string[] }}
 */
export function applyDeterministicRepair(originalPlan, checkJson, attempt = 1) {
  const plan = JSON.parse(JSON.stringify(originalPlan)); // Deep clone
  const findings = classifyGateFindings(checkJson);
  const changes = [];
  const categories = new Set(findings.map(f => f.category));

  if (categories.has("CONTRAST")) {
    // Targeted high-contrast palette repair
    const oldPalette = { ...plan.palette };
    plan.palette = {
      background: "#07070a", // Deep obsidian dark for maximum contrast
      surface: "#13131a",    // Elevated dark card surface
      primary: "#8b5cf6",    // High-contrast vibrant primary accent
      text: "#ffffff",       // Pure high-contrast white
      subtext: "#a1a1aa"     // Clear legible light gray
    };
    changes.push(`Repaired palette for WCAG compliance: background ${oldPalette.background} -> ${plan.palette.background}, primary ${oldPalette.primary} -> ${plan.palette.primary}, text ${oldPalette.text} -> ${plan.palette.text}`);
  }

  if (categories.has("LAYOUT")) {
    // Layout repair: clamp text length or adjust text density
    for (const scene of plan.scenes) {
      if (scene.heading && scene.heading.length > 80) {
        const oldHeading = scene.heading;
        scene.heading = scene.heading.slice(0, 75).trim() + "...";
        changes.push(`Truncated excessive heading in scene "${scene.id}": "${oldHeading}" -> "${scene.heading}"`);
      }
      if (scene.features && scene.features.length > 3) {
        scene.features = scene.features.slice(0, 3);
        changes.push(`Reduced feature count to 3 cards in scene "${scene.id}" to prevent layout collision`);
      }
    }
  }

  if (categories.has("LINT") || categories.has("RUNTIME")) {
    // Timing / ID normalization
    let sumDuration = 0;
    for (const scene of plan.scenes) {
      scene.duration = Number(Math.max(1.5, Math.min(scene.duration, 10)).toFixed(2));
      sumDuration += scene.duration;
    }
    plan.totalDuration = Number(sumDuration.toFixed(2));
    changes.push(`Synchronized total duration to sum of scene durations: ${plan.totalDuration}s`);
  }

  // Fallback generic safe tightening if no specific category matched but gate failed
  if (changes.length === 0) {
    plan.palette.background = "#09090b";
    plan.palette.text = "#ffffff";
    changes.push("Applied baseline safe palette normalization");
  }

  return {
    repairedPlan: plan,
    repairType: Array.from(categories).join("+") || "GENERAL",
    changes
  };
}
