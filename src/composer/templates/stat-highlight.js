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
  const isPortrait = aspectRatio === "9:16";
  const stat = scene.stat || { value: "", label: "" };

  const html = `
    <div id="${scene.id}" class="clip" data-start="${startTime}" data-duration="${duration}">
      <div class="bg-layer">
        <div class="bg-orb bg-orb-1" id="${scene.id}-orb1" style="opacity:0.22; width:${isPortrait ? "700px" : "1000px"}; height:${isPortrait ? "700px" : "1000px"}; top:-20%; right:-15%;"></div>
        <div class="bg-orb bg-orb-2" id="${scene.id}-orb2"></div>
        <div class="stat-scene-bg">
          <div class="stat-ring stat-ring-1" id="${scene.id}-ring1"></div>
          <div class="stat-ring stat-ring-2" id="${scene.id}-ring2"></div>
        </div>
      </div>
      <div class="scene-inner" id="${scene.id}-inner">
        <div class="stat-label-top" id="${scene.id}-ltop">${scene.heading}</div>
        <div class="stat-container" id="${scene.id}-container">
          <div class="stat-value" id="${scene.id}-val">${stat.value}</div>
          <div class="stat-divider" id="${scene.id}-sdiv"></div>
          <div class="stat-label" id="${scene.id}-lbl">${stat.label}</div>
        </div>
      </div>
    </div>
  `;

  const exitTime = Number((startTime + duration - 0.5).toFixed(2));
  const hardKillTime = Number((startTime + duration).toFixed(2));

  const timelineJs = `
    // Scene: ${scene.id} (stat-highlight)
    // Rings expand outward
    tl.fromTo("#${scene.id}-ring1", { scale: 0.1, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2, ease: "power2.out" }, ${startTime});
    tl.fromTo("#${scene.id}-ring2", { scale: 0.1, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.0, ease: "power2.out" }, ${Number((startTime + 0.1).toFixed(2))});
    tl.fromTo("#${scene.id}-orb1", { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 0.22, duration: 1.4, ease: "power2.out" }, ${startTime});
    tl.fromTo("#${scene.id}-orb2", { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 0.12, duration: 1.2, ease: "power2.out" }, ${Number((startTime + 0.15).toFixed(2))});
    // Heading label slides down from top
    tl.fromTo("#${scene.id}-ltop", { opacity: 0, y: -30 }, { opacity: 0.9, y: 0, duration: 0.5, ease: "power3.out" }, ${Number((startTime + 0.2).toFixed(2))});
    // Stat number slams in with scale overshoot
    tl.fromTo("#${scene.id}-val", { opacity: 0, scale: 0.3, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: "back.out(1.6)" }, ${Number((startTime + 0.35).toFixed(2))});
    // Divider wipes
    tl.fromTo("#${scene.id}-sdiv", { scaleX: 0, opacity: 0, transformOrigin: "left center" }, { scaleX: 1, opacity: 0.6, duration: 0.5, ease: "power3.out" }, ${Number((startTime + 0.85).toFixed(2))});
    // Label fades up
    tl.fromTo("#${scene.id}-lbl", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, ${Number((startTime + 1.0).toFixed(2))});
    // Exit: scale down and fade
    tl.to("#${scene.id}-inner", { opacity: 0, scale: 0.94, duration: 0.45, ease: "power2.in" }, ${exitTime});
    tl.set("#${scene.id}-inner", { opacity: 0 }, ${hardKillTime});
  `;

  return { html, timelineJs };
}
