/**
 * Generates the base global CSS for the composition based on palette and aspect ratio.
 * @param {object} palette
 * @param {string} aspectRatio - "16:9" or "9:16"
 * @param {number} width
 * @param {number} height
 * @returns {string} CSS stylesheet
 */
export function generateBaseStyles(palette, aspectRatio, width, height) {
  const isPortrait = aspectRatio === "9:16";

  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }

    :root {
      --bg-color: ${palette.background};
      --surface-color: ${palette.surface};
      --primary-color: ${palette.primary};
      --text-color: ${palette.text};
      --subtext-color: ${palette.subtext};
      --canvas-width: ${width}px;
      --canvas-height: ${height}px;
      --base-font-size: ${isPortrait ? "32px" : "28px"};
      --heading-size: ${isPortrait ? "72px" : "84px"};
      --subheading-size: ${isPortrait ? "38px" : "40px"};
      --card-padding: ${isPortrait ? "40px 32px" : "48px 56px"};
    }

    html, body {
      margin: 0;
      padding: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background-color: var(--bg-color);
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: var(--text-color);
    }

    #root {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: radial-gradient(circle at 50% 30%, ${palette.surface}44 0%, var(--bg-color) 80%);
    }

    /* Standard full-canvas clip container */
    .clip {
      position: absolute;
      top: 0;
      left: 0;
      width: ${width}px;
      height: ${height}px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: ${isPortrait ? "80px 48px" : "80px 120px"};
      text-align: center;
      overflow: hidden;
    }

    .scene-inner {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      position: relative;
    }

    /* Reusable Typography & UI components */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: ${isPortrait ? "12px 28px" : "14px 32px"};
      border-radius: 9999px;
      background: ${palette.surface};
      border: 2px solid ${palette.primary}66;
      color: var(--primary-color);
      font-size: ${isPortrait ? "26px" : "28px"};
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: ${isPortrait ? "36px" : "40px"};
    }

    .scene-heading {
      font-size: var(--heading-size);
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.03em;
      color: var(--text-color);
      max-width: ${isPortrait ? "900px" : "1400px"};
      word-wrap: break-word;
    }

    .scene-subheading {
      font-size: var(--subheading-size);
      font-weight: 500;
      line-height: 1.4;
      color: var(--subtext-color);
      margin-top: ${isPortrait ? "28px" : "32px"};
      max-width: ${isPortrait ? "850px" : "1200px"};
      word-wrap: break-word;
    }

    /* Template: Feature Callout */
    .features-grid {
      display: flex;
      flex-direction: ${isPortrait ? "column" : "row"};
      justify-content: center;
      align-items: stretch;
      gap: ${isPortrait ? "24px" : "32px"};
      margin-top: ${isPortrait ? "44px" : "56px"};
      width: 100%;
      max-width: ${isPortrait ? "900px" : "1500px"};
    }

    .feature-card {
      flex: 1;
      display: flex;
      flex-direction: ${isPortrait ? "row" : "column"};
      align-items: center;
      gap: ${isPortrait ? "24px" : "20px"};
      padding: var(--card-padding);
      background: var(--surface-color);
      border-radius: 24px;
      border: 2px solid ${palette.surface}ee;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
      text-align: ${isPortrait ? "left" : "center"};
    }

    .feature-icon {
      width: ${isPortrait ? "56px" : "64px"};
      height: ${isPortrait ? "56px" : "64px"};
      border-radius: 16px;
      background: ${palette.primary}22;
      border: 2px solid var(--primary-color);
      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--primary-color);
      font-weight: 800;
      font-size: ${isPortrait ? "26px" : "30px"};
      flex-shrink: 0;
    }

    .feature-text {
      font-size: ${isPortrait ? "32px" : "30px"};
      font-weight: 700;
      color: var(--text-color);
      line-height: 1.3;
    }

    /* Template: Stat Highlight */
    .stat-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-top: 24px;
    }

    .stat-value {
      font-size: ${isPortrait ? "140px" : "180px"};
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.04em;
      background: linear-gradient(135deg, #ffffff 30%, var(--primary-color) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 24px;
      filter: drop-shadow(0 15px 30px ${palette.primary}44);
    }

    .stat-label {
      font-size: ${isPortrait ? "42px" : "48px"};
      font-weight: 600;
      color: var(--subtext-color);
      max-width: ${isPortrait ? "800px" : "1100px"};
    }

    /* Template: Image Hero */
    .hero-layout {
      display: flex;
      flex-direction: ${isPortrait ? "column" : "row"};
      align-items: center;
      justify-content: center;
      gap: ${isPortrait ? "40px" : "80px"};
      width: 100%;
      max-width: ${isPortrait ? "900px" : "1500px"};
      margin-top: 32px;
    }

    .hero-text-side {
      flex: 1;
      text-align: ${isPortrait ? "center" : "left"};
    }

    .hero-media-side {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .hero-image-box {
      width: ${isPortrait ? "500px" : "540px"};
      height: ${isPortrait ? "500px" : "540px"};
      border-radius: 32px;
      background: radial-gradient(circle at 30% 30%, ${palette.primary}33 0%, var(--surface-color) 100%);
      border: 3px solid ${palette.primary}55;
      box-shadow: 0 30px 60px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: relative;
      overflow: hidden;
    }

    .hero-image-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: 28px;
    }

    .hero-placeholder-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 32px;
      width: 100%;
      height: 100%;
    }

    .hero-placeholder-icon {
      font-size: 72px;
      margin-bottom: 16px;
    }

    .hero-placeholder-text {
      font-size: 24px;
      font-weight: 600;
      color: var(--subtext-color);
      text-align: center;
      max-width: 85%;
      word-wrap: break-word;
    }

    /* Template: CTA */
    .cta-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: ${isPortrait ? "28px 64px" : "32px 80px"};
      border-radius: 9999px;
      background: var(--primary-color);
      color: #000000;
      font-size: ${isPortrait ? "40px" : "44px"};
      font-weight: 800;
      text-decoration: none;
      box-shadow: 0 20px 50px ${palette.primary}66;
      margin-top: ${isPortrait ? "48px" : "56px"};
      letter-spacing: -0.01em;
    }

    .cta-subtext {
      font-size: ${isPortrait ? "28px" : "32px"};
      color: var(--subtext-color);
      margin-top: 24px;
      font-weight: 500;
    }
  `;
}
