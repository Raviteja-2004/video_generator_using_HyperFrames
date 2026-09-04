/**
 * Renders the Stat Highlight scene template.
 * @param {object} scene
 * @param {number} startTime
 * @param {number} duration
 * @param {object} palette
 * @param {string} aspectRatio
 * @returns {{ html: string, timelineJs: string }}
 */
export function renderStatHighlightTemplate(scene, startTime, duration, palette, aspectRatio) {
  const stat = scene.stat || { value: "", label: "" };

  const html = `
    <div id="${scene.id}" class="clip" data-start="${startTime}" data-duration="${duration}">
      <div class="scene-inner" id="${scene.id}-inner">
        <h2 class="scene-heading" id="${scene.id}-heading" style="font-size: ${aspectRatio === "9:16" ? "56px" : "64px"}">${scene.heading}</h2>
        <div class="stat-container" id="${scene.id}-container">
          <div class="stat-value" id="${scene.id}-val">${stat.value}</div>
          <div class="stat-label" id="${scene.id}-lbl">${stat.label}</div>
        </div>
      </div>
    </div>
  `;

  const exitTime = Number((startTime + duration - 0.4).toFixed(2));
  const hardKillTime = Number((startTime + duration).toFixed(2));

  const timelineJs = `
    // Scene: ${scene.id} (stat-highlight)
    tl.from("#${scene.id}-heading", { opacity: 0, y: 20, duration: 0.5, ease: "power2.out" }, ${startTime});
    tl.from("#${scene.id}-val", {
      opacity: 0,
      scale: 0.6,
      duration: 0.7,
      ease: "back.out(1.5)"
    }, ${Number((startTime + 0.15).toFixed(2))});
    tl.from("#${scene.id}-lbl", { opacity: 0, y: 20, duration: 0.5, ease: "power2.out" }, ${Number((startTime + 0.35).toFixed(2))});
    tl.to("#${scene.id}-inner", { opacity: 0, y: -25, duration: 0.35, ease: "power2.in" }, ${exitTime});
    tl.set("#${scene.id}-inner", { opacity: 0 }, ${hardKillTime});
  `;

  return { html, timelineJs };
}
