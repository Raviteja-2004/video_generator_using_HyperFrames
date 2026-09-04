import { composeProject } from "../src/composer/composer.js";

const plan = {
  schemaVersion: "1.1.0", title: "PulseFit", aspectRatio: "9:16", totalDuration: 6,
  palette: { background: "#09090b", surface: "#18181b", primary: "#8b5cf6", text: "#ffffff", subtext: "#a1a1aa" },
  scenes: [
    { id: "s1", template: "title", purpose: "hook", visualEmphasis: "high", textDensity: "low", duration: 3, motionIntent: "scale-up", heading: "PulseFit", subheading: "Your Companion" },
    { id: "s2", template: "cta", purpose: "call-to-action", visualEmphasis: "high", textDensity: "low", duration: 3, motionIntent: "slide-up", heading: "Download Now", ctaText: "Get PulseFit" }
  ]
};

const comp = composeProject(plan);
const forbidden = [">HOOK<",">hook<",">FEATURE-PRESENTATION<",">feature-presentation<",">CALL-TO-ACTION<",">call-to-action<",">OVERVIEW<",">high<",">medium<",">low<"];
const violations = forbidden.filter(p => comp.html.includes(p));
console.log("VIOLATIONS:", violations.length === 0 ? "NONE - CLEAN" : violations.join(", "));
const badgeMatches = comp.html.match(/<div class="badge"[^>]*>([\s\S]*?)<\/div>/g);
console.log("BADGE ELEMENTS:", JSON.stringify(badgeMatches));
const s1idx = comp.html.indexOf('id="s1"');
console.log("S1 EXCERPT:\n" + comp.html.slice(s1idx, s1idx + 500));
