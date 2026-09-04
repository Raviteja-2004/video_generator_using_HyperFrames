/**
 * Renders the Call to Action (CTA) scene template.
 * @param {object} scene
 * @param {number} startTime
 * @param {number} duration
 * @param {object} palette
 * @param {string} aspectRatio
 * @returns {{ html: string, timelineJs: string }}
 */
export function renderCtaTemplate(scene, startTime, duration, palette, aspectRatio) {
  const isPortrait = aspectRatio === "9:16";
  const subtextHtml = scene.ctaSubtext
    ? `<div class="cta-subtext" id="${scene.id}-sub">${scene.ctaSubtext}</div>`
    : "";

  const html = `
    <div id="${scene.id}" class="clip" data-start="${startTime}" data-duration="${duration}">
      <div class="scene-inner" id="${scene.id}-inner">
        <h2 class="scene-heading" id="${scene.id}-heading" style="font-size: ${isPortrait ? "64px" : "76px"}">${scene.heading}</h2>
        <a href="#" class="cta-button" id="${scene.id}-btn">${scene.ctaText || "Get Started"}</a>
        ${subtextHtml}
      </div>
    </div>
  `;

  const exitTime = Number((startTime + duration - 0.4).toFixed(2));
  const hardKillTime = Number((startTime + duration).toFixed(2));

  const timelineJs = `
    // Scene: ${scene.id} (cta)
    tl.from("#${scene.id}-heading", { opacity: 0, y: 30, duration: 0.6, ease: "power3.out" }, ${startTime});
    tl.from("#${scene.id}-btn", {
      opacity: 0,
      scale: 0.8,
      duration: 0.6,
      ease: "back.out(1.4)"
    }, ${Number((startTime + 0.2).toFixed(2))});
    ${scene.ctaSubtext ? `tl.from("#${scene.id}-sub", { opacity: 0, y: 15, duration: 0.4, ease: "power2.out" }, ${Number((startTime + 0.35).toFixed(2))});` : ""}
    tl.to("#${scene.id}-inner", { opacity: 0, duration: 0.35, ease: "power2.in" }, ${exitTime});
    tl.set("#${scene.id}-inner", { opacity: 0 }, ${hardKillTime});
  `;

  return { html, timelineJs };
}
