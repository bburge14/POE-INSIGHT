import type { ParsedItem } from "@shared/schema";

export function parseItemText(raw: string): ParsedItem | null {
  if (!raw || !raw.trim()) return null;

  const lines = raw.trim().split("\n").map((l) => l.trim());
  const separatorIndices: number[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith("--------")) {
      separatorIndices.push(i);
    }
  });

  let itemClass = "";
  let rarity: ParsedItem["rarity"] = "Normal";
  let name = "";
  let baseType = "";
  let itemLevel = 0;
  const requirements: ParsedItem["requirements"] = {};
  const implicitMods: string[] = [];
  const explicitMods: string[] = [];
  const defenses: ParsedItem["defenses"] = {};
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
    if (line.startsWith("Level:")) {
      requirements.level = parseInt(line.replace("Level:", "").trim(), 10) || 0;
    }
    if (line.startsWith("Str:")) {
      requirements.str = parseInt(line.replace("Str:", "").trim(), 10) || 0;
    }
    if (line.startsWith("Dex:")) {
      requirements.dex = parseInt(line.replace("Dex:", "").trim(), 10) || 0;
    }
    if (line.startsWith("Int:")) {
      requirements.int = parseInt(line.replace("Int:", "").trim(), 10) || 0;
    }
  }

  const nonSepLines = lines.filter(
    (l) =>
      !l.startsWith("--------") &&
      !l.startsWith("Item Class:") &&
      !l.startsWith("Rarity:")
  );

  if (rarity === "Rare" || rarity === "Unique") {
    const itemClassIdx = lines.findIndex((l) => l.startsWith("Rarity:"));
    if (itemClassIdx >= 0 && itemClassIdx + 1 < lines.length) {
      name = lines[itemClassIdx + 1];
      if (itemClassIdx + 2 < lines.length && !lines[itemClassIdx + 2].startsWith("--------")) {
        baseType = lines[itemClassIdx + 2];
      } else {
        baseType = name;
      }
    }
  } else if (rarity === "Magic") {
    const rarityIdx = lines.findIndex((l) => l.startsWith("Rarity:"));
    if (rarityIdx >= 0 && rarityIdx + 1 < lines.length) {
      name = lines[rarityIdx + 1];
      baseType = name;
    }
  } else {
    const rarityIdx = lines.findIndex((l) => l.startsWith("Rarity:"));
    if (rarityIdx >= 0 && rarityIdx + 1 < lines.length) {
      name = lines[rarityIdx + 1];
      baseType = name;
    }
  }

  if (separatorIndices.length >= 2) {
    const sections: string[][] = [];
    let start = 0;
    for (const sepIdx of separatorIndices) {
      sections.push(lines.slice(start, sepIdx));
      start = sepIdx + 1;
    }
    sections.push(lines.slice(start));

    const modSections = sections.filter((s) => {
      return s.some(
        (l) =>
          (l.includes("%") || l.includes("+") || l.includes("to ") || l.includes("increased") || l.includes("reduced") || l.includes("more") || l.includes("Adds")) &&
          !l.startsWith("Item") &&
          !l.startsWith("Requirements") &&
          !l.startsWith("Level:") &&
          !l.startsWith("Str:") &&
          !l.startsWith("Dex:") &&
          !l.startsWith("Int:") &&
          !l.startsWith("Armour:") &&
          !l.startsWith("Evasion") &&
          !l.startsWith("Energy Shield:")
      );
    });

    if (modSections.length >= 2) {
      const implicitSection = modSections[0];
      const explicitSection = modSections.slice(1);
      implicitSection.forEach((l) => {
        if (l && !l.startsWith("--------") && l.trim()) implicitMods.push(l);
      });
      explicitSection.flat().forEach((l) => {
        if (l && !l.startsWith("--------") && l.trim() && l !== "Corrupted" && l !== "Unidentified") {
          explicitMods.push(l);
        }
      });
    } else if (modSections.length === 1) {
      modSections[0].forEach((l) => {
        if (l && !l.startsWith("--------") && l.trim()) explicitMods.push(l);
      });
    }
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

export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case "Normal": return "text-gray-300";
    case "Magic": return "text-blue-400";
    case "Rare": return "text-yellow-400";
    case "Unique": return "text-orange-400";
    default: return "text-gray-300";
  }
}

export function getRarityBorderColor(rarity: string): string {
  switch (rarity) {
    case "Normal": return "border-gray-600";
    case "Magic": return "border-blue-600/50";
    case "Rare": return "border-yellow-600/50";
    case "Unique": return "border-orange-600/50";
    default: return "border-gray-600";
  }
}

export function getRarityBgColor(rarity: string): string {
  switch (rarity) {
    case "Normal": return "bg-gray-900/50";
    case "Magic": return "bg-blue-950/30";
    case "Rare": return "bg-yellow-950/30";
    case "Unique": return "bg-orange-950/30";
    default: return "bg-gray-900/50";
  }
}
