/**
 * Creative image generation.
 *
 * Deliberately kept outside the LangGraph pipeline. Image generation is the
 * slowest and least reliable step in the stack, and a failure here must not be
 * able to take down a pipeline run that already succeeded. The frontend calls
 * this after the graph finishes, so the demo degrades to "structured creative
 * spec, no render" instead of erroring out.
 *
 * Three interchangeable providers: Gemini, Together (FLUX.1 schnell free), and
 * Fal (FLUX.1 schnell, paid). The first one with a configured key wins, and
 * IMAGE_PROVIDER can force a specific choice. Whichever answers reports its own
 * model name back to the UI, so the screen never claims the wrong one.
 */
import { generateFalImage } from "./fal";
import { GEMINI_IMAGE_MODEL, geminiGenerateImage } from "./gemini";
import { togetherGenerateImage } from "./together";

export type ImageProvider = "gemini" | "together" | "fal";

export type GeneratedImage = {
  url: string;
  width: number;
  height: number;
  prompt: string;
  provider: ImageProvider;
  model: string;
  latencyMs: number;
};

/**
 * Builds the image prompt from the Creative Director's own output.
 *
 * The palette is injected as named colours so the render matches the spec the
 * agent produced, and text is explicitly suppressed — diffusion models render
 * garbled lettering, and the headline is laid over the image in the UI anyway.
 */
export function buildImagePrompt(
  imageConcept: string,
  palette: { name: string; hex: string }[],
): string {
  const colours = palette.map((p) => `${p.name} ${p.hex}`).join(", ");
  return [
    imageConcept,
    colours ? `Colour palette: ${colours}.` : "",
    "Editorial advertising photography, generous negative space, high detail.",
    "No text, no words, no letters, no numbers, no logos, no watermarks, no people.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * First configured provider wins. IMAGE_PROVIDER overrides the order when more
 * than one key is present, so you can force a specific one without editing env.
 */
export function activeProvider(): ImageProvider {
  const forced = process.env.IMAGE_PROVIDER?.trim() as ImageProvider | undefined;
  if (forced === "gemini" || forced === "together" || forced === "fal") return forced;
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  if (process.env.TOGETHER_API_KEY?.trim()) return "together";
  return "fal";
}

export async function generateCreativeImage(
  imageConcept: string,
  palette: { name: string; hex: string }[],
): Promise<GeneratedImage> {
  const prompt = buildImagePrompt(imageConcept, palette);
  const provider = activeProvider();
  const startedAt = Date.now();

  if (provider === "gemini") {
    const { url, mimeType } = await geminiGenerateImage(prompt);
    return {
      url,
      // Gemini does not report dimensions; the UI only needs the renderable URL.
      width: 0,
      height: 0,
      prompt,
      provider,
      model: `${GEMINI_IMAGE_MODEL} (${mimeType})`,
      latencyMs: Date.now() - startedAt,
    };
  }

  if (provider === "together") {
    const { url, width, height } = await togetherGenerateImage(prompt);
    return {
      url,
      width,
      height,
      prompt,
      provider,
      model: "FLUX.1 [schnell] Free",
      latencyMs: Date.now() - startedAt,
    };
  }

  const { url, width, height } = await generateFalImage(prompt);
  return {
    url,
    width,
    height,
    prompt,
    provider,
    model: "FLUX.1 [schnell]",
    latencyMs: Date.now() - startedAt,
  };
}
