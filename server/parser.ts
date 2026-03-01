import type { ParsedItem } from "@shared/schema";

export function parseItemText(raw: string): ParsedItem | null {
  if (!raw || !raw.trim()) return null;

  const lines = raw.trim().split("\n").map((l) => l.trim());

  let itemClass = "";
  let rarity: ParsedItem["rarity"] = "Normal";
  let name = "";
  let baseType = "";
  let itemLevel = 0;
  const requirements: ParsedItem["requirements"] = {};
  const implicitMods: string[] = [];
  const explicitMods: string[] = [];
  const defenses: NonNullable<ParsedItem["defenses"]> = {};
  let sockets: string | undefined;
  let corrupted = false;
  let unidentified = false;

  for (const line of lines) {
    if (line.startsWith("Item Class:")) {
      itemClass = line.replace("Item Class:", "").trim();
    }
    if (line.startsWith("Rarity:")) {
      const r = line.replace("Rarity:", "").trim();
      if (r === "Normal" || r === "Magic" || r === "Rare" || r === "Unique") {
        rarity = r;
      }
    }
    if (line.startsWith("Item Level:")) {
      itemLevel = parseInt(line.replace("Item Level:", "").trim(), 10) || 0;
    }
    if (line.startsWith("Armour:")) {
      defenses.armour = parseInt(line.replace("Armour:", "").trim(), 10) || 0;
    }
    if (line.startsWith("Evasion Rating:") || line.startsWith("Evasion:")) {
      defenses.evasion = parseInt(line.replace(/Evasion( Rating)?:/, "").trim(), 10) || 0;
    }
    if (line.startsWith("Energy Shield:")) {
      defenses.energyShield = parseInt(line.replace("Energy Shield:", "").trim(), 10) || 0;
    }
    if (line.startsWith("Sockets:")) {
      sockets = line.replace("Sockets:", "").trim();
    }
    if (line === "Corrupted") corrupted = true;
    if (line === "Unidentified") unidentified = true;
  }

  const reqIdx = lines.findIndex((l) => l === "Requirements:");
  if (reqIdx >= 0) {
    for (let i = reqIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith("--------") || l === "") break;
      if (l.startsWith("Level:")) requirements.level = parseInt(l.replace("Level:", "").trim(), 10) || 0;
      if (l.startsWith("Str:")) requirements.str = parseInt(l.replace("Str:", "").trim(), 10) || 0;
      if (l.startsWith("Dex:")) requirements.dex = parseInt(l.replace("Dex:", "").trim(), 10) || 0;
      if (l.startsWith("Int:")) requirements.int = parseInt(l.replace("Int:", "").trim(), 10) || 0;
    }
  }

  const rarityIdx = lines.findIndex((l) => l.startsWith("Rarity:"));
  if (rarityIdx >= 0) {
    if (rarity === "Rare" || rarity === "Unique") {
      if (rarityIdx + 1 < lines.length) name = lines[rarityIdx + 1];
      if (rarityIdx + 2 < lines.length && !lines[rarityIdx + 2].startsWith("--------")) {
        baseType = lines[rarityIdx + 2];
      } else {
        baseType = name;
      }
    } else {
      if (rarityIdx + 1 < lines.length) {
        name = lines[rarityIdx + 1];
        baseType = name;
      }
    }
  }

  const separatorIndices: number[] = [];
  lines.forEach((line, i) => {
    if (line.startsWith("--------")) separatorIndices.push(i);
  });

  const sections: string[][] = [];
  let start = 0;
  for (const sepIdx of separatorIndices) {
    sections.push(lines.slice(start, sepIdx));
    start = sepIdx + 1;
  }
  sections.push(lines.slice(start));

  const isMod = (l: string) =>
    (l.includes("%") || l.includes("+") || l.includes("to ") ||
      l.includes("increased") || l.includes("reduced") || l.includes("more") ||
      l.includes("Adds") || l.includes("Gain") || l.includes("Regenerate")) &&
    !l.startsWith("Item") && !l.startsWith("Requirements") &&
    !l.startsWith("Level:") && !l.startsWith("Str:") && !l.startsWith("Dex:") &&
    !l.startsWith("Int:") && !l.startsWith("Armour:") && !l.startsWith("Evasion") &&
    !l.startsWith("Energy Shield:") && !l.startsWith("Sockets:");

  const modSections = sections.filter((s) => s.some(isMod));

  if (modSections.length >= 2) {
    modSections[0].forEach((l) => {
      if (l && isMod(l)) implicitMods.push(l);
    });
    modSections.slice(1).flat().forEach((l) => {
      if (l && isMod(l) && l !== "Corrupted" && l !== "Unidentified") {
        explicitMods.push(l);
      }
    });
  } else if (modSections.length === 1) {
    modSections[0].forEach((l) => {
      if (l && isMod(l)) explicitMods.push(l);
    });
  }

  if (!name && !baseType) return null;

  return {
    itemClass: itemClass || "Unknown",
    rarity,
    name: name || baseType,
    baseType: baseType || name,
    itemLevel,
    requirements,
    implicitMods,
    explicitMods,
    defenses: Object.keys(defenses).length > 0 ? defenses : undefined,
    sockets,
    corrupted,
    unidentified,
  };
}
