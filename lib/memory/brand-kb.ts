/**
 * The brand knowledge base for the demo.
 *
 * Deliberately tiny — six snippets is enough to prove retrieval selects the
 * *relevant* guidelines rather than dumping all of them into the prompt.
 *
 * The brand is Samsung Nepal. These are illustrative demo guidelines written
 * for this presentation, not Samsung's actual brand book — the point is to show
 * how any brand's rules constrain generation, and they are editable in the UI.
 *
 * Note for the "Prohibited Language" entry: lib/agents/rule-check.ts parses the
 * quoted terms out of any guideline whose *category* names a prohibition, and
 * scans copy for them deterministically. Quote each banned term.
 */

import { z } from "zod";

export const BrandGuidelineSchema = z.object({
  id: z.string().min(1).max(60),
  category: z.string().min(1).max(80),
  text: z.string().min(10).max(2000),
});

/** Guidelines can be edited in the UI, so anything arriving over the wire is validated. */
export const BrandGuidelinesSchema = z.array(BrandGuidelineSchema).min(1).max(20);

export type BrandGuideline = z.infer<typeof BrandGuidelineSchema>;

export const BRAND_GUIDELINES: BrandGuideline[] = [
  {
    id: "voice-tone",
    category: "Voice & Tone",
    text: "Samsung Nepal speaks with calm confidence — precise, human, and never breathless. Use short declarative sentences and active voice. Address the reader as 'you'. Lead with what the customer can do, not with specifications. No exclamation marks in any channel. Hype, urgency pressure, and countdown language are not permitted. Write in clear English; a single Nepali festival greeting such as 'Happy Dashain' or 'Subha Dashain' is welcome, but do not mix scripts mid-sentence.",
  },
  {
    id: "visual-identity",
    category: "Visual Identity & Colour",
    text: "The palette is Samsung Blue (#1428A0) as the primary brand colour, Deep Black (#101010) for backgrounds, and Pure White (#FFFFFF) for type and surfaces. Samsung Blue is the only accent — never introduce a second accent colour in one asset. The Samsung wordmark is never stretched, recoloured, outlined, or placed on a busy background, and never sits inside a sentence. Product photography must show the device accurately with no exaggerated glow, no fictional screen content, and no drop shadows. Festival creative may use restrained cultural motifs, but never religious iconography or deities.",
  },
  {
    id: "banned-words",
    category: "Prohibited Language",
    text: "The following words and phrases are banned from all Samsung Nepal copy without exception: 'revolutionary', 'game-changer', 'game-changing', 'disrupt', 'disruptive', 'guaranteed', 'best-in-class', 'world-class', 'cutting-edge', 'unbeatable', 'cheapest', 'lowest price ever', 'magical', 'flawless', 'perfect', 'supercharge', 'unlock the power', 'must-buy', 'limited stock', 'hurry', and any use of '#1'. Superlatives about Samsung products are not permitted unless a cited third-party source appears in the same asset.",
  },
  {
    id: "product-naming",
    category: "Product Naming & Tagline",
    text: "The product is written as 'Galaxy S26' on first mention and may be shortened to 'S26' afterwards. Never write 'S-26', 'Galaxy S-26', 'S26 Series' in lowercase, or pluralise as 'S26s'. Always pair the device with Samsung on first mention: 'Samsung Galaxy S26'. The brand line is 'Do what you can't.' It must appear verbatim, sentence case, with the full stop, at most once per asset, and always at the end — never inside a headline or the first line of body copy. If it cannot sit at the end, omit it. Feature names are capitalised exactly: Galaxy AI, One UI, Knox.",
  },
  {
    id: "legal-offer",
    category: "Legal, Pricing & Offer Compliance",
    text: "Any Dashain offer must state the exact discount, the offer window, and that terms apply — for example '10% off, 20 September to 12 October 2026, T&C apply'. Prices are shown in Nepali Rupees as 'NPR 1,49,999' and must state whether VAT is included. Never promise a guaranteed outcome, trade-in value, or delivery date. Do not name or compare against a competitor brand or device. Do not claim nationwide stock or availability that authorised retail partners cannot honour. Any battery life, camera, or performance claim must name its test condition and source in the same asset. Do not reference unannounced features or future launches.",
  },
  {
    id: "channel-format",
    category: "Channel Formatting Rules",
    text: "LinkedIn posts run 80-150 words, open with a specific observation rather than a question, use at most two hashtags, and carry no emoji. Instagram captions stay under 125 characters before the fold, allow up to five hashtags, always include descriptive alt text, and permit a maximum of two emoji. Marketing emails need a subject line under 45 characters, one single call to action, and no more than 120 words of body copy. Every channel must include the offer window when an offer is mentioned. #GalaxyS26 and #SamsungNepal are the only approved campaign hashtags.",
  },
];
