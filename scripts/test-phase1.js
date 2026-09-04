import fs from "node:fs/promises";
import path from "node:path";
import { planVideo } from "../src/planner.js";

const BRIEFS = [
  {
    id: "brief-1",
    name: "Developer Tool Ad (Widescreen 16:9, 12s, 4 scenes)",
    text: "A 12 second ad for an AI developer tool called 'CodeStream', dark theme with vibrant purple neon accent, featuring title, three key feature callouts (Instant Code Review, Real-time Refactoring, Zero Latency), 10x developer velocity stat, and ends with a call to action to start free trial."
  },
  {
    id: "brief-2",
    name: "Fitness App Reel (Vertical 9:16, 15s, 5 scenes)",
    text: "A 15 second vertical TikTok/Reels mobile promo for 'PulseFit' workout companion, portrait 9:16 aspect ratio, sleek dark slate theme with neon emerald green accent. Starts with bold hero hook, showcases an animated UI hero illustration of heart rate tracking, highlights real-time coaching features, shows a 99.4% goal completion stat, and ends with 'Download on iOS & Android' CTA."
  },
  {
    id: "brief-3",
    name: "Design Conference Announcement (Widescreen 16:9, 9s, 3 scenes)",
    text: "A 9 second cinematic announcement for 'DesignX Global 2026', widescreen 16:9, dark theme with electric cyan accent, minimal text. Scene 1 announces the conference date in Tokyo, Scene 2 highlights '50+ World Class Speakers & 10k Attendees', Scene 3 invites registration with 'Secure Your Seat Now'."
  }
];

async function run() {
  console.log("=== PHASE 1 PLANNER VALIDATION ===");

  // Ensure briefs directory exists
  await fs.mkdir(path.resolve(process.cwd(), "briefs"), { recursive: true });

  // 1. Generate the 3 genuinely different plans
  for (const item of BRIEFS) {
    console.log(`\n--- Generating Plan for: ${item.name} ---`);
    const plan = await planVideo(item.text, { maxTokens: 4096 });
    const planPath = path.resolve(process.cwd(), `briefs/${item.id}-plan.json`);
    await fs.writeFile(planPath, JSON.stringify(plan, null, 2), "utf-8");
    console.log(`Saved plan to ${planPath}`);
  }

  // 2. Deliberately trigger failure path to produce plan-error.json
  console.log(`\n--- Testing Forced Failure Path (Token Starvation / MaxTokens=20) ---`);
  try {
    await planVideo("Create a video for a luxury coffee brand", {
      maxTokens: 20, // Intentionally too small to return full valid JSON
      maxAttempts: 3,
      errorArtifactPath: "briefs/plan-error.json"
    });
    console.error("ERROR: Expected failure path to throw, but it succeeded.");
  } catch (err) {
    console.log(`Successfully caught expected failure: ${err.message}`);
    console.log(`Verified error artifact at briefs/plan-error.json`);
  }

  console.log("\n=== PHASE 1 COMPLETE ===");
}

run().catch((err) => {
  console.error("FATAL ERROR in Phase 1 test:", err);
  process.exit(1);
});
