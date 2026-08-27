/**
 * Phase 7 verification. Run with:  npm run test:image
 * Runs twice, because the checkpoint is "works reliably twice in a row, or we cut it".
 */
import { activeProvider, buildImagePrompt, generateCreativeImage } from "../lib/tools/image";

const IMAGE_CONCEPT =
  "Abstract data visualization with glowing nodes and minimalist lines on a dark deep indigo background, illuminated by soft architectural light, modern and sleek";

const PALETTE = [
  { name: "Deep Indigo", hex: "#1B1B3A" },
  { name: "Signal Amber", hex: "#FFB627" },
  { name: "Bone White", hex: "#F4F1EC" },
];

async function main() {
  console.log(`Provider: ${activeProvider()}`);
  console.log("Prompt:\n" + buildImagePrompt(IMAGE_CONCEPT, PALETTE) + "\n");

  for (const attempt of [1, 2]) {
    const image = await generateCreativeImage(IMAGE_CONCEPT, PALETTE);
    console.log(
      `Attempt ${attempt}: ${image.model} · ${image.width}x${image.height} · ${image.latencyMs}ms`,
    );
    console.log(`  ${image.url}\n`);
  }
}

main().catch((error) => {
  console.error("FAILED:", error);
  process.exit(1);
});
