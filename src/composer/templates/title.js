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
  const isPortrait = aspectRatio === "9:16";

  const subheadHtml = scene.subheading
    ? `<div class="scene-subheading" id="${scene.id}-sub">${scene.subheading}</div>`
    : "";

  const html = `
    <div id="${scene.id}" class="clip" data-start="${startTime}" data-duration="${duration}">
      <div class="bg-layer">
        <div class="bg-orb bg-orb-1" id="${scene.id}-orb1"></div>
        <div class="bg-orb bg-orb-2" id="${scene.id}-orb2"></div>
        <div class="bg-grid"></div>
        <div class="bg-accent-bar" id="${scene.id}-bar"></div>
      </div>
      <div class="scene-inner" id="${scene.id}-inner">
        <div class="eyebrow" id="${scene.id}-eyebrow">
          <span class="eyebrow-dot"></span>
          NOW LIVE
        </div>
        <h1 class="scene-heading" id="${scene.id}-heading">${scene.heading}</h1>
        <div class="divider-line" id="${scene.id}-div"></div>
        ${subheadHtml}
      </div>
    </div>
  `;

  const exitTime = Number((startTime + duration - 0.5).toFixed(2));
  const hardKillTime = Number((startTime + duration).toFixed(2));

  const timelineJs = `
    // Scene: ${scene.id} (title)
    // Background orbs drift
    tl.fromTo("#${scene.id}-orb1", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 0.22, duration: 1.2, ease: "power2.out" }, ${startTime});
    tl.fromTo("#${scene.id}-orb2", { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 0.12, duration: 1.4, ease: "power2.out" }, ${Number((startTime + 0.1).toFixed(2))});
    tl.fromTo("#${scene.id}-bar", { scaleY: 0, opacity: 0, transformOrigin: "top center" }, { scaleY: 1, opacity: 0.7, duration: 0.9, ease: "power3.out" }, ${Number((startTime + 0.05).toFixed(2))});
    // Eyebrow pill slides in from top
    tl.fromTo("#${scene.id}-eyebrow", { opacity: 0, y: -28, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(1.8)" }, ${Number((startTime + 0.2).toFixed(2))});
    // Heading slams in with overshoot
    tl.fromTo("#${scene.id}-heading", { opacity: 0, y: 80, scale: 0.88 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "expo.out" }, ${Number((startTime + 0.35).toFixed(2))});
    // Divider wipes in
    tl.fromTo("#${scene.id}-div", { scaleX: 0, opacity: 0, transformOrigin: "left center" }, { scaleX: 1, opacity: 1, duration: 0.5, ease: "power3.out" }, ${Number((startTime + 0.65).toFixed(2))});
    ${scene.subheading ? `tl.fromTo("#${scene.id}-sub", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, ${Number((startTime + 0.75).toFixed(2))});` : ""}
    // Exit: whole inner slides up + fades
    tl.to("#${scene.id}-inner", { opacity: 0, y: -40, scale: 0.96, duration: 0.45, ease: "power2.in" }, ${exitTime});
    tl.set("#${scene.id}-inner", { opacity: 0 }, ${hardKillTime});
  `;

  return { html, timelineJs };
}
