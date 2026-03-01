import type { ParsedItem, ItemEvaluation, BuildProfile } from "@shared/schema";
import { log } from "./index";

const OPENAI_MODEL = "gpt-4o";

interface AIItemAnalysis {
  verdict: string;
  reasoning: string;
  synergies: string[];
  warnings: string[];
  craftingTips: string[];
  estimatedTier: "S" | "A" | "B" | "C" | "D" | "F";
  keepForBuilds: string[];
}

/**
 * Send an item + its rule-based evaluation + the active build profile
 * to GPT-4o for deeper synergy analysis.
 */
export async function aiEvaluateItem(
  item: ParsedItem,
  ruleEvaluation: ItemEvaluation,
  activeProfile: BuildProfile | null | undefined,
): Promise<{ aiAnalysis: AIItemAnalysis } | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "OPENAI_API_KEY not set. Add it to your environment to enable AI analysis." };
  }

  const buildContext = activeProfile
    ? `The user is playing a "${activeProfile.name}" (${activeProfile.classType}) build with these stat weights (1-10 scale):\n${JSON.stringify(activeProfile.weights, null, 2)}`
    : "No active build profile set.";

  const itemDescription = [
    `Item: ${item.name} (${item.baseType})`,
    `Rarity: ${item.rarity} | Item Class: ${item.itemClass} | iLvl: ${item.itemLevel}`,
    item.defenses ? `Defenses: ${JSON.stringify(item.defenses)}` : null,
    item.requirements ? `Requirements: ${JSON.stringify(item.requirements)}` : null,
    item.implicitMods.length > 0 ? `Implicit Mods:\n${item.implicitMods.map(m => `  - ${m}`).join("\n")}` : null,
    item.explicitMods.length > 0 ? `Explicit Mods:\n${item.explicitMods.map(m => `  - ${m}`).join("\n")}` : null,
    item.corrupted ? "CORRUPTED" : null,
  ].filter(Boolean).join("\n");

  const ruleContext = [
    `Rule-based verdict: ${ruleEvaluation.verdict} (score: ${ruleEvaluation.score}/100)`,
    `Summary: ${ruleEvaluation.verdictSummary}`,
    ruleEvaluation.isMetaBase ? "This is a META BASE." : null,
    ruleEvaluation.isCraftWorthy ? "Flagged as CRAFT WORTHY." : null,
    ruleEvaluation.priceEstimate
      ? `Price estimate: ${ruleEvaluation.priceEstimate.chaosValue}c (${ruleEvaluation.priceEstimate.divineValue}d) via ${ruleEvaluation.priceEstimate.source}`
      : null,
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are an expert Path of Exile 2 item advisor. You analyze items for players and give actionable trade, crafting, and build advice.

Key PoE2 differences from PoE1:
- Sockets are on GEMS, not gear. Do NOT evaluate items based on socket count.
- Gold is a primary currency alongside traditional orbs.
- The current league economy and meta should inform your advice.

Your analysis should:
1. Identify synergies that simple rule-based math might miss (e.g., "no life but the damage scaling is insane for Monk builds")
2. Flag hidden value (e.g., open prefix/suffix potential, niche build demand)
3. Give specific crafting steps if the item is worth improving
4. Be honest — if it's trash, say so plainly

Respond in JSON matching this exact schema:
{
  "verdict": "keep" | "sell" | "craft" | "vendor" | "price_check",
  "reasoning": "2-3 sentence explanation of WHY",
  "synergies": ["list of mod interactions or build synergies you spotted"],
  "warnings": ["any red flags or gotchas"],
  "craftingTips": ["specific next steps if crafting is recommended"],
  "estimatedTier": "S" | "A" | "B" | "C" | "D" | "F",
  "keepForBuilds": ["build archetypes this item is great for"]
}`;

  const userPrompt = `Analyze this PoE2 item:

${itemDescription}

${buildContext}

Rule-based analysis (for reference — you may disagree):
${ruleContext}

Give your expert analysis as JSON.`;

  try {
    log("Sending item to GPT-4o for AI analysis...", "ai");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      log(`OpenAI API error ${response.status}: ${errText}`, "ai");
      return { error: `OpenAI API error: ${response.status} ${response.statusText}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { error: "Empty response from OpenAI" };
    }

    const parsed = JSON.parse(content) as AIItemAnalysis;
    log(`AI analysis complete: tier=${parsed.estimatedTier}, verdict=${parsed.verdict}`, "ai");

    return { aiAnalysis: parsed };
  } catch (err: any) {
    log(`AI evaluation error: ${err.message}`, "ai");
    return { error: `AI analysis failed: ${err.message}` };
  }
}
