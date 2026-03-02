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

// PoE-accurate rarity text colors
export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case "Normal": return "text-[#c8c8c8]";      // PoE Normal white-gray
    case "Magic": return "text-[#8888ff]";         // PoE Magic blue
    case "Rare": return "text-[#ffff77]";          // PoE Rare yellow
    case "Unique": return "text-[#af6025]";        // PoE Unique orange-brown
    default: return "text-[#c8c8c8]";
  }
}

// PoE-accurate rarity border colors
export function getRarityBorderColor(rarity: string): string {
  switch (rarity) {
    case "Normal": return "border-[#c8c8c8]/20 poe-item-normal";
    case "Magic": return "border-[#8888ff]/30 poe-item-magic";
    case "Rare": return "border-[#ffff77]/25 poe-item-rare";
    case "Unique": return "border-[#af6025]/35 poe-item-unique";
    default: return "border-[#c8c8c8]/20 poe-item-normal";
  }
}

// PoE-style dark rarity background tints
export function getRarityBgColor(rarity: string): string {
  switch (rarity) {
    case "Normal": return "bg-[#1a1a1a]/60";
    case "Magic": return "bg-[#0a0a2a]/50";
    case "Rare": return "bg-[#1a1a0a]/50";
    case "Unique": return "bg-[#1a0f05]/60";
    default: return "bg-[#1a1a1a]/60";
  }
}
