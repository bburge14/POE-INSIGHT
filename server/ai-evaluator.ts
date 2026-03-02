import type { ParsedItem, ItemEvaluation, BuildProfile, AIItemAnalysis } from "@shared/schema";
import { log } from "./index";

const OPENAI_MODEL = "gpt-4o";

/**
 * Send an item + its rule-based evaluation + the active build profile
 * to GPT-4o for deeper synergy analysis and expert crafting advice.
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

  const openSlots = countOpenSlots(item);
  const itemDescription = [
    `Item: ${item.name} (${item.baseType})`,
    `Rarity: ${item.rarity} | Item Class: ${item.itemClass} | iLvl: ${item.itemLevel}`,
    item.defenses ? `Defenses: ${JSON.stringify(item.defenses)}` : null,
    item.requirements ? `Requirements: ${JSON.stringify(item.requirements)}` : null,
    item.implicitMods.length > 0 ? `Implicit Mods:\n${item.implicitMods.map(m => `  - ${m}`).join("\n")}` : null,
    item.explicitMods.length > 0 ? `Explicit Mods:\n${item.explicitMods.map(m => `  - ${m}`).join("\n")}` : null,
    `Open mod slots estimate: ~${openSlots.prefixes} prefixes, ~${openSlots.suffixes} suffixes`,
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

  const systemPrompt = `You are an elite Path of Exile 2 crafting expert and item advisor. You have encyclopedic knowledge of PoE2 crafting mechanics and give the most actionable, specific crafting advice possible.

## KEY POE2 DIFFERENCES FROM POE1
- Sockets are on GEMS, not gear. Do NOT evaluate items based on socket count.
- Gold is a primary currency alongside traditional orbs.
- The equivalent of Meta-crafting in PoE2 are Omens, which modify how crafting currencies behave.
- Desecrating replaces unveiling from PoE1.
- Graveyard crafting is a new system for targeted mod selection.

## POE2 CRAFTING CURRENCIES & METHODS
You must recommend the SPECIFIC crafting approach based on the item state:

**Basic Currencies:**
- Orb of Transmutation: Normal → Magic (1 mod)
- Orb of Augmentation: Add mod to Magic item (if <2 mods)
- Regal Orb: Magic → Rare (adds 1 mod)
- Orb of Alchemy: Normal → Rare (random mods)
- Chaos Orb: Reroll all mods on a Rare (full random)
- Exalted Orb: Add 1 random mod to Rare with open affix
- Orb of Annulment: Remove 1 random mod from Rare
- Divine Orb: Reroll VALUES of existing mods (keeps mod types)
- Vaal Orb: Corrupt — can add implicit, brick, or do nothing

**Advanced Crafting:**
- Crafting Bench: Guaranteed specific mods (Life, Res, Damage, etc.) — cheap and reliable
- Essences: Force one guaranteed mod + random others (like targeted Alchemy)
- Fossils: Bias mod pools toward/away from certain tags
- Omens: Modify the next crafting currency used (e.g., Omen of Whittling = Exalt only adds prefixes)
- Graveyard: Targeted crafting by selecting from curated mod pools

## CRAFTING STRATEGIES BY ITEM STATE
- **Normal + good base + iLvl 80+**: Alt-spam or Essence for targeted mod, then Regal
- **Magic with 1 great mod**: Augment if open slot, then Regal. If Regal hits well, proceed to bench/exalt
- **Magic with 2 great mods**: Regal immediately. This is the dream start
- **Rare with 1-2 open slots + good mods**: Bench craft the best guaranteed mod, or Exalt if mods are exceptional
- **Rare with bad mods + good base**: Chaos spam, or Annul risky mods if 1-2 are great
- **Rare fully modded + mixed quality**: Divine Orb if the mod types are right but values are low
- **Corrupted**: Nothing can be done. Evaluate as-is

## MOD TIER KNOWLEDGE
- iLvl 80+: Unlocks T2+ tiers on most mods
- iLvl 82+: Unlocks T1 on many mods
- iLvl 84+: Unlocks the absolute highest tiers
- iLvl 86+: Required for T0/special mods on some bases

## WHAT MAKES GREAT CRAFTING ADVICE
1. Be SPECIFIC: "Craft +70-89 Maximum Life on bench (costs 1 Exalted Orb)" not "add life"
2. Consider COST: A 5-chaos craft strategy is different from a 5-divine strategy
3. Know WHEN TO STOP: "This item has peaked — sell as-is" is valid advice
4. Suggest ALTERNATIVES: "If you can't afford Exalts, bench craft resistance instead"
5. Flag RISKS: "Annulling here is a 1/4 chance to remove your best mod"
6. Consider the BUILD: Recommend mods that synergize with the user's build profile
7. Know PREFIX vs SUFFIX: Life, flat damage, defenses = prefixes. Resistances, speed, crit = suffixes

Respond in JSON matching this exact schema:
{
  "verdict": "keep" | "sell" | "craft" | "vendor" | "price_check",
  "reasoning": "2-3 sentence explanation of WHY",
  "synergies": ["list of mod interactions or build synergies you spotted"],
  "warnings": ["any red flags or gotchas"],
  "craftingTips": ["specific actionable crafting steps — be detailed and specific"],
  "craftingPlan": {
    "summary": "1-2 sentence overview of the recommended crafting strategy",
    "steps": [
      {
        "step": 1,
        "action": "Specific action to take",
        "currency": "Currency/method to use",
        "reason": "Why this step",
        "risk": "low" | "medium" | "high",
        "estimatedCost": "Rough cost in chaos/divine (optional)"
      }
    ],
    "targetMods": ["List of specific mods you're trying to hit"],
    "estimatedTotalCost": "Rough total investment estimate",
    "stopCondition": "When to stop crafting and sell/use"
  },
  "estimatedTier": "S" | "A" | "B" | "C" | "D" | "F",
  "keepForBuilds": ["build archetypes this item is great for"],
  "craftOfExileUrl": "https://www.craftofexile.com/?game=poe2 (always include this link for users to simulate)"
}`;

  const userPrompt = `Analyze this PoE2 item and give me your BEST crafting advice:

${itemDescription}

${buildContext}

Rule-based analysis (for reference — you may disagree):
${ruleContext}

Focus heavily on crafting advice. Be specific about:
- Exactly which currency to use and why
- What mods to target and what tier to aim for
- Whether to bench craft, essence, fossil, or raw currency
- Risk assessment for each step
- When to stop investing
- Cost estimates

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
        max_tokens: 1500,
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

function countOpenSlots(item: ParsedItem): { prefixes: number; suffixes: number } {
  const maxMods = item.rarity === "Rare" ? 6 : item.rarity === "Magic" ? 2 : 0;
  const currentMods = item.explicitMods.length;
  const openSlots = Math.max(0, maxMods - currentMods);
  const estimatedPrefixes = Math.min(openSlots, Math.ceil(openSlots / 2));
  const estimatedSuffixes = openSlots - estimatedPrefixes;
  return { prefixes: estimatedPrefixes, suffixes: estimatedSuffixes };
}
