import { generateBaseStyles } from "./styles.js";
import { renderTitleTemplate } from "./templates/title.js";
import { renderFeatureCalloutTemplate } from "./templates/feature-callout.js";
import { renderStatHighlightTemplate } from "./templates/stat-highlight.js";
import { renderImageHeroTemplate } from "./templates/image-hero.js";
import { renderCtaTemplate } from "./templates/cta.js";

/**
 * Maps template identifiers to their corresponding renderer functions.
 */
const TEMPLATE_RENDERERS = {
  "title": renderTitleTemplate,
  "feature-callout": renderFeatureCalloutTemplate,
  "stat-highlight": renderStatHighlightTemplate,
  "image-hero": renderImageHeroTemplate,
  "cta": renderCtaTemplate
};

/**
 * Assembles a complete HyperFrames composition project from a validated plan.
 * @param {object} plan - Validated PlanSchema object
 * @param {object} [options]
 * @param {Record<string, string>} [options.resolvedImages={}] - Map of scene.id -> resolved local image path
 * @returns {{ html: string, metaJson: object, motionJson: object, width: number, height: number }}
 */
export function composeProject(plan, options = {}) {
  const resolvedImages = options.resolvedImages || {};

  const isPortrait = plan.aspectRatio === "9:16";
  const width = isPortrait ? 1080 : 1920;
  const height = isPortrait ? 1920 : 1080;
  const totalDuration = plan.totalDuration;

  let currentStartTime = 0;
  const renderedScenesHtml = [];
  const timelineStatements = [];
  const motionAssertions = [];

  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i];
    const startTime = Number(currentStartTime.toFixed(2));
    const duration = scene.duration;
    const renderer = TEMPLATE_RENDERERS[scene.template];

    if (!renderer) {
      throw new Error(`Unknown scene template: "${scene.template}" in scene ${scene.id}`);
    }

    const resolvedImage = resolvedImages[scene.id];
    const { html, timelineJs } = renderer(
      scene,
      startTime,
      duration,
      plan.palette,
      plan.aspectRatio,
      resolvedImage
    );

    renderedScenesHtml.push(html);
    timelineStatements.push(timelineJs);

    // Build deterministic motion assertions
    motionAssertions.push({
      selector: `#${scene.id}`,
      appearsBy: Number((startTime + 0.6).toFixed(2)),
      before: Number((startTime + duration).toFixed(2)),
      staysInFrame: true,
      keepsMoving: true
    });

    currentStartTime += duration;
  }

  const baseStyles = generateBaseStyles(plan.palette, plan.aspectRatio, width, height);

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${escapeHtml(plan.title)}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
${baseStyles}
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${totalDuration}"
      data-width="${width}"
      data-height="${height}"
    >
${renderedScenesHtml.join("\n")}
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

${timelineStatements.join("\n")}

      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;

  const metaJson = {
    id: "main",
    name: plan.title,
    width,
    height,
    fps: 30,
    duration: totalDuration
  };

  const motionJson = {
    composition: "main",
    assertions: motionAssertions
  };

  return {
    html,
    metaJson,
    motionJson,
    width,
    height
  };
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
