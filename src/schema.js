import { z } from "zod";

export const SCHEMA_VERSION = "1.1.0";

// Allowed scene template identifiers
export const SceneTemplateEnum = z.enum([
  "title",
  "feature-callout",
  "stat-highlight",
  "image-hero",
  "cta"
]);

// Allowed aspect ratios (strictly 16:9 and 9:16)
export const AspectRatioEnum = z.enum(["16:9", "9:16"]);

// Palette schema
export const PaletteSchema = z.object({
  background: z.string().regex(/^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{3}$/, "Must be valid hex color"),
  surface: z.string().regex(/^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{3}$/, "Must be valid hex color"),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{3}$/, "Must be valid hex color (accent color)"),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{3}$/, "Must be valid hex color").optional(),
  text: z.string().regex(/^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{3}$/, "Must be valid hex color"),
  subtext: z.string().regex(/^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{3}$/, "Must be valid hex color")
});

// Image slot schema with explicit required flag for fallback gating
export const ImageSlotSchema = z.object({
  prompt: z.string().min(5, "Image prompt must be descriptive"),
  style: z.string().default("modern vector flat minimalist illustration neon dark theme"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("1:1"),
  required: z.boolean().default(false).describe("If true, image failure must fail the build rather than silently degrade")
});

// Stat highlight data schema
export const StatDataSchema = z.object({
  value: z.string().min(1, "Stat value is required (e.g. '10x', '99.9%', '500M+')"),
  label: z.string().min(2, "Stat label is required")
});

// Scene schema with semantic intent for composer
export const SceneSchema = z.object({
  id: z.string().min(1),
  template: SceneTemplateEnum,
  purpose: z.enum(["hook", "feature-presentation", "social-proof", "call-to-action", "announcement"]).default("feature-presentation"),
  visualEmphasis: z.enum(["high", "medium", "subtle"]).default("high"),
  textDensity: z.enum(["low", "medium", "high"]).default("medium"),
  duration: z.number().min(1.5).max(10, "Per-scene duration between 1.5s and 10s"),
  motionIntent: z.string().min(2, "Motion intent description required (e.g. 'slide-up', 'stagger-reveal', 'counter-zoom')"),
  heading: z.string().min(1, "Heading cannot be empty"),
  subheading: z.string().optional(),
  features: z.array(z.string().min(1)).max(4).optional(),
  stat: StatDataSchema.optional(),
  ctaText: z.string().optional(),
  ctaSubtext: z.string().optional(),
  imageSlot: ImageSlotSchema.optional()
}).superRefine((scene, ctx) => {
  if (scene.template === "feature-callout" && (!scene.features || scene.features.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Template 'feature-callout' requires at least one feature item in 'features' array",
      path: ["features"]
    });
  }
  if (scene.template === "stat-highlight" && !scene.stat) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Template 'stat-highlight' requires 'stat' object with 'value' and 'label'",
      path: ["stat"]
    });
  }
  if (scene.template === "cta" && !scene.ctaText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Template 'cta' requires 'ctaText'",
      path: ["ctaText"]
    });
  }
  if (scene.template === "image-hero" && !scene.imageSlot) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Template 'image-hero' requires 'imageSlot'",
      path: ["imageSlot"]
    });
  }
});

// Complete Plan Schema
export const PlanSchema = z.object({
  schemaVersion: z.string().default(SCHEMA_VERSION),
  title: z.string().min(1, "Title is required"),
  aspectRatio: AspectRatioEnum,
  totalDuration: z.number().min(3).max(60, "Total duration must be between 3s and 60s"),
  palette: PaletteSchema,
  scenes: z.array(SceneSchema).min(2, "Plan must contain at least 2 scenes")
}).superRefine((plan, ctx) => {
  const sumDuration = plan.scenes.reduce((acc, s) => acc + s.duration, 0);
  const diff = Math.abs(sumDuration - plan.totalDuration);
  if (diff > 0.05) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Total duration (${plan.totalDuration}s) must equal the sum of scene durations (${sumDuration.toFixed(2)}s)`,
      path: ["totalDuration"]
    });
  }
});

/**
 * Validates raw plan object against schema.
 * @param {unknown} data
 * @returns {{ success: boolean, data?: z.infer<typeof PlanSchema>, error?: string, issues?: z.ZodIssue[] }}
 */
export function validatePlan(data) {
  const result = PlanSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const formattedError = result.error.issues
    .map(i => `[${i.path.join(".") || "root"}]: ${i.message}`)
    .join("; ");
  return { success: false, error: formattedError, issues: result.error.issues };
}
