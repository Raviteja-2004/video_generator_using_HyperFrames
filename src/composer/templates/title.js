/**
 * Renders the Title scene template.
 * @param {object} scene
 * @param {number} startTime
 * @param {number} duration
 * @param {object} palette
 * @param {string} aspectRatio
 * @returns {{ html: string, timelineJs: string }}
 */
export function renderTitleTemplate(scene, startTime, duration, palette, aspectRatio) {
  const badgeHtml = scene.purpose
    ? `<div class="badge" id="${scene.id}-badge">${scene.purpose.replace("-", " ")}</div>`
    : "";
  const subheadHtml = scene.subheading
    ? `<div class="scene-subheading" id="${scene.id}-sub">${scene.subheading}</div>`
    : "";

  const html = `
    <div id="${scene.id}" class="clip" data-start="${startTime}" data-duration="${duration}">
      <div class="scene-inner" id="${scene.id}-inner">
        ${badgeHtml}
        <h1 class="scene-heading" id="${scene.id}-heading">${scene.heading}</h1>
        ${subheadHtml}
      </div>
    </div>
  `;

  const exitTime = Number((startTime + duration - 0.4).toFixed(2));
  const hardKillTime = Number((startTime + duration).toFixed(2));

  const timelineJs = `
    // Scene: ${scene.id} (title)
    tl.from("#${scene.id}-heading", { opacity: 0, scale: 0.92, y: 30, duration: 0.6, ease: "power3.out" }, ${startTime});
    ${scene.subheading ? `tl.from("#${scene.id}-sub", { opacity: 0, y: 20, duration: 0.5, ease: "power2.out" }, ${Number((startTime + 0.2).toFixed(2))});` : ""}
    ${scene.purpose ? `tl.from("#${scene.id}-badge", { opacity: 0, y: -20, duration: 0.4, ease: "power2.out" }, ${startTime});` : ""}
    tl.to("#${scene.id}-inner", { opacity: 0, y: -20, duration: 0.35, ease: "power2.in" }, ${exitTime});
    tl.set("#${scene.id}-inner", { opacity: 0 }, ${hardKillTime});
  `;

  return { html, timelineJs };
}
