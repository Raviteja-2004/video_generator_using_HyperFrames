/**
 * Renders the Feature Callout scene template.
 * @param {object} scene
 * @param {number} startTime
 * @param {number} duration
 * @param {object} palette
 * @param {string} aspectRatio
 * @returns {{ html: string, timelineJs: string }}
 */
export function renderFeatureCalloutTemplate(scene, startTime, duration, palette, aspectRatio) {
  const features = scene.features || [];

  const cardsHtml = features.map((feat, idx) => `
    <div class="feature-card" id="${scene.id}-card-${idx}">
      <div class="feature-icon">0${idx + 1}</div>
      <div class="feature-text">${feat}</div>
    </div>
  `).join("\n");

  const html = `
    <div id="${scene.id}" class="clip" data-start="${startTime}" data-duration="${duration}">
      <div class="scene-inner" id="${scene.id}-inner">
        <h2 class="scene-heading" id="${scene.id}-heading" style="font-size: ${aspectRatio === "9:16" ? "60px" : "68px"}">${scene.heading}</h2>
        <div class="features-grid" id="${scene.id}-grid">
          ${cardsHtml}
        </div>
      </div>
    </div>
  `;

  const exitTime = Number((startTime + duration - 0.4).toFixed(2));
  const hardKillTime = Number((startTime + duration).toFixed(2));

  const timelineJs = `
    // Scene: ${scene.id} (feature-callout)
    tl.from("#${scene.id}-heading", { opacity: 0, y: 25, duration: 0.5, ease: "power3.out" }, ${startTime});
    tl.from("#${scene.id} .feature-card", {
      opacity: 0,
      y: 35,
      stagger: 0.15,
      duration: 0.6,
      ease: "back.out(1.2)"
    }, ${Number((startTime + 0.15).toFixed(2))});
    tl.to("#${scene.id}-inner", { opacity: 0, scale: 0.95, duration: 0.35, ease: "power2.in" }, ${exitTime});
    tl.set("#${scene.id}-inner", { opacity: 0 }, ${hardKillTime});
  `;

  return { html, timelineJs };
}
