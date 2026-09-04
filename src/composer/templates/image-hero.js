/**
 * Renders the Image Hero scene template.
 * @param {object} scene
 * @param {number} startTime
 * @param {number} duration
 * @param {object} palette
 * @param {string} aspectRatio
 * @param {string} [resolvedImagePath]
 * @returns {{ html: string, timelineJs: string }}
 */
export function renderImageHeroTemplate(scene, startTime, duration, palette, aspectRatio, resolvedImagePath) {
  const isPortrait = aspectRatio === "9:16";
  const subheadHtml = scene.subheading
    ? `<div class="scene-subheading" id="${scene.id}-sub" style="margin-top: 16px; font-size: 28px">${scene.subheading}</div>`
    : "";

  const mediaContent = resolvedImagePath
    ? `<img src="${resolvedImagePath}" alt="${scene.heading.replace(/"/g, "&quot;")}" />`
    : `
      <div class="hero-placeholder-content">
        <div class="hero-placeholder-icon">✦</div>
        <div class="hero-placeholder-text">${scene.imageSlot?.prompt ? scene.imageSlot.prompt.slice(0, 60) + "..." : "Hero Visual"}</div>
      </div>
    `;

  const html = `
    <div id="${scene.id}" class="clip" data-start="${startTime}" data-duration="${duration}">
      <div class="scene-inner" id="${scene.id}-inner">
        <div class="hero-layout" id="${scene.id}-layout">
          <div class="hero-text-side">
            <div class="badge" id="${scene.id}-badge">Overview</div>
            <h2 class="scene-heading" id="${scene.id}-heading" style="font-size: ${isPortrait ? "54px" : "60px"}; text-align: ${isPortrait ? "center" : "left"}">${scene.heading}</h2>
            ${subheadHtml}
          </div>
          <div class="hero-media-side">
            <div class="hero-image-box" id="${scene.id}-box">
              ${mediaContent}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const exitTime = Number((startTime + duration - 0.4).toFixed(2));
  const hardKillTime = Number((startTime + duration).toFixed(2));

  const timelineJs = `
    // Scene: ${scene.id} (image-hero)
    tl.from("#${scene.id}-heading", { opacity: 0, x: -30, duration: 0.6, ease: "power3.out" }, ${startTime});
    tl.from("#${scene.id}-badge", { opacity: 0, scale: 0.8, duration: 0.4, ease: "power2.out" }, ${startTime});
    tl.from("#${scene.id}-box", {
      opacity: 0,
      scale: 0.85,
      rotate: 2,
      duration: 0.7,
      ease: "back.out(1.3)"
    }, ${Number((startTime + 0.1).toFixed(2))});
    tl.to("#${scene.id}-inner", { opacity: 0, scale: 0.95, duration: 0.35, ease: "power2.in" }, ${exitTime});
    tl.set("#${scene.id}-inner", { opacity: 0 }, ${hardKillTime});
  `;

  return { html, timelineJs };
}
