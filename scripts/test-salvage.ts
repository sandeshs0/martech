/**
 * Reproduces the Groq `tool_use_failed` 400 seen with the Samsung tagline
 * "Do what you can't." and checks that the verdict is recovered.
 * Run with:  npm run test:salvage    (no API key needed)
 */
import { GuardianVerdictSchema } from "../lib/graph/state";
import { salvageToolArguments as salvage } from "../lib/llm/groq";

// The exact failed_generation Groq returned, apostrophe escape and all.
const FAILED_GENERATION =
  "<function=submit_verdict>" +
  '{"approved": false, "issues": [{"fix": "Use #GalaxyS26 and #SamsungNepal", "guideline": ' +
  '"Channel Formatting Rules", "location": "linkedin.hashtags", "problem": "Incorrect hashtags", ' +
  '"severity": "major"}, {"fix": "Add the brand line \'Do what you can\\\'t.\' at the end", ' +
  '"guideline": "Product Naming & Tagline", "location": "email.body", "problem": ' +
  '"Missing brand line", "severity": "minor"}], "summary": "Several issues found."}' +
  "</function>";

// Shaped like the groq-sdk APIError that carries the rejection.
const groqError = {
  status: 400,
  error: {
    error: {
      message: "Failed to call a function. Please adjust your prompt.",
      type: "invalid_request_error",
      code: "tool_use_failed",
      failed_generation: FAILED_GENERATION,
    },
  },
};

function main() {
  console.log("Raw generation is invalid JSON:");
  const inner = FAILED_GENERATION.replace(/<\/?function[^>]*>/g, "");
  try {
    JSON.parse(inner);
    console.log("  UNEXPECTED: it parsed\n");
  } catch (e) {
    console.log(`  ${(e as Error).message}\n`);
  }

  const recovered = salvage(groqError);
  if (!recovered) {
    console.error("FAIL: nothing salvaged");
    process.exit(1);
  }

  const verdict = GuardianVerdictSchema.parse(JSON.parse(recovered));
  console.log("Recovered and schema-validated:");
  console.log(`  approved: ${verdict.approved}`);
  console.log(`  issues:   ${verdict.issues.length}`);
  for (const issue of verdict.issues) {
    console.log(`    - [${issue.severity}] ${issue.location}: ${issue.fix}`);
  }

  // Nothing to salvage from an unrelated error.
  const unrelated = salvage(new Error("connection reset"));
  console.log(`\nUnrelated error salvages to: ${unrelated}`);

  const pass = verdict.issues.length === 2 && unrelated === null;
  console.log(`\n${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exit(1);
}

main();
