import type { ParsedItem, ItemEvaluation, ItemVerdict } from "@shared/schema";
import { getRarityColor, getRarityBorderColor, getRarityBgColor } from "@/lib/item-parser";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, AlertTriangle, Star, Flame, Hammer, ShoppingCart, Archive, HelpCircle, ArrowRight, Coins, Wrench, Users, ExternalLink } from "lucide-react";

interface ItemDisplayProps {
  item: ParsedItem;
  evaluation?: ItemEvaluation | null;
}

export function ItemDisplay({ item, evaluation }: ItemDisplayProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className={`border ${getRarityBorderColor(item.rarity)} ${getRarityBgColor(item.rarity)}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div className="min-w-0">
              <h3 className={`text-lg font-bold ${getRarityColor(item.rarity)} truncate`} data-testid="text-item-name">
                {item.name}
              </h3>
              {item.name !== item.baseType && (
                <p className="text-sm text-muted-foreground" data-testid="text-item-base">{item.baseType}</p>
              )}
            </div>
            <Badge variant="outline" className={`shrink-0 ${getRarityColor(item.rarity)}`} data-testid="badge-item-rarity">
              {item.rarity}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
              <span data-testid="text-item-class">{item.itemClass}</span>
              {item.itemLevel > 0 && (
                <span data-testid="text-item-level">
                  iLvl: <span className={item.itemLevel >= 80 ? "text-green-400 font-semibold" : ""}>{item.itemLevel}</span>
                </span>
              )}
            </div>

            {item.defenses && (
              <div className="flex gap-3 flex-wrap text-sm">
                {item.defenses.armour && item.defenses.armour > 0 && (
                  <span className="text-red-300">Armour: {item.defenses.armour}</span>
                )}
                {item.defenses.evasion && item.defenses.evasion > 0 && (
                  <span className="text-green-300">Evasion: {item.defenses.evasion}</span>
                )}
                {item.defenses.energyShield && item.defenses.energyShield > 0 && (
                  <span className="text-blue-300">ES: {item.defenses.energyShield}</span>
                )}
              </div>
            )}

            {Object.keys(item.requirements).length > 0 && (
              <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                <span className="opacity-60">Requires:</span>
                {item.requirements.level && <span>Lvl {item.requirements.level}</span>}
                {item.requirements.str && <span className="text-red-400">Str {item.requirements.str}</span>}
                {item.requirements.dex && <span className="text-green-400">Dex {item.requirements.dex}</span>}
                {item.requirements.int && <span className="text-blue-400">Int {item.requirements.int}</span>}
              </div>
            )}

            {item.implicitMods.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  {item.implicitMods.map((mod, i) => (
                    <p key={i} className="text-sm text-blue-300" data-testid={`text-implicit-mod-${i}`}>{mod}</p>
                  ))}
                </div>
              </>
            )}

            {item.explicitMods.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  {item.explicitMods.map((mod, i) => (
                    <p key={i} className="text-sm text-blue-200" data-testid={`text-explicit-mod-${i}`}>{mod}</p>
                  ))}
                </div>
              </>
            )}

            {item.sockets && (
              <p className="text-xs text-muted-foreground">Sockets: {item.sockets}</p>
            )}

            <div className="flex gap-2 flex-wrap">
              {item.corrupted && <Badge variant="destructive" className="text-xs">Corrupted</Badge>}
              {item.unidentified && <Badge variant="secondary" className="text-xs">Unidentified</Badge>}
            </div>
          </CardContent>
        </Card>

        {evaluation && <VerdictCard evaluation={evaluation} />}
      </div>

      {evaluation && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            {evaluation.tradeAdvice && <TradeAdviceCard evaluation={evaluation} />}
            {evaluation.craftingAdvice && evaluation.craftingAdvice.length > 0 && <CraftingCard evaluation={evaluation} />}
          </div>
          <div className="space-y-4">
            {evaluation.buildFits && evaluation.buildFits.length > 0 && <BuildFitsCard evaluation={evaluation} />}
            <AnalysisCard evaluation={evaluation} />
          </div>
        </div>
      )}
    </div>
  );
}

const VERDICT_CONFIG: Record<ItemVerdict, { icon: typeof ShoppingCart; label: string; colorClass: string; bgClass: string }> = {
  sell: { icon: ShoppingCart, label: "SELL", colorClass: "text-green-400", bgClass: "bg-green-950/50 border-green-800/50" },
  craft: { icon: Hammer, label: "CRAFT", colorClass: "text-blue-400", bgClass: "bg-blue-950/50 border-blue-800/50" },
  keep: { icon: CheckCircle, label: "KEEP", colorClass: "text-primary", bgClass: "bg-amber-950/50 border-amber-800/50" },
  vendor: { icon: Archive, label: "VENDOR", colorClass: "text-red-400", bgClass: "bg-red-950/50 border-red-800/50" },
  price_check: { icon: HelpCircle, label: "PRICE CHECK", colorClass: "text-purple-400", bgClass: "bg-purple-950/50 border-purple-800/50" },
};

function VerdictCard({ evaluation }: { evaluation: ItemEvaluation }) {
  const config = VERDICT_CONFIG[evaluation.verdict];
  const VerdictIcon = config.icon;

  return (
    <Card className={`border ${config.bgClass}`} data-testid="card-evaluation">
      <CardContent className="pt-5 pb-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md ${config.bgClass}`}>
            <VerdictIcon className={`h-6 w-6 ${config.colorClass}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-lg font-bold tracking-tight ${config.colorClass}`} data-testid="text-verdict">
                {config.label}
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${i < Math.round(evaluation.score / 20) ? "text-primary fill-primary" : "text-muted"}`}
                  />
                ))}
                <span className="text-xs text-muted-foreground ml-1">{evaluation.score}/100</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-verdict-summary">{evaluation.verdictSummary}</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {evaluation.isGoodBase && (
            <Badge variant="default" className="text-xs gap-1">
              <CheckCircle className="h-3 w-3" /> Good Base
            </Badge>
          )}
          {evaluation.isMetaBase && (
            <Badge className="text-xs gap-1 bg-purple-600 text-white border-purple-500">
              <Flame className="h-3 w-3" /> Meta Base
            </Badge>
          )}
          {evaluation.isCraftWorthy && (
            <Badge className="text-xs gap-1 bg-green-700 text-white border-green-600">
              <CheckCircle className="h-3 w-3" /> Craft Worthy
            </Badge>
          )}
        </div>

        {evaluation.reasons.length > 0 && (
          <div className="space-y-1">
            {evaluation.reasons.slice(0, 3).map((reason, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TradeAdviceCard({ evaluation }: { evaluation: ItemEvaluation }) {
  return (
    <Card className="border-border" data-testid="card-trade-advice">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Coins className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-sm font-semibold">Trade Advice</h3>
      </CardHeader>
      <CardContent className="space-y-2">
        {evaluation.tradeAdvice!.estimatedValue && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Estimated Value:</span>
            <span className="text-sm font-mono font-semibold text-primary" data-testid="text-estimated-value">
              {evaluation.tradeAdvice!.estimatedValue}
            </span>
          </div>
        )}
        <p className="text-xs text-muted-foreground" data-testid="text-trade-reasoning">{evaluation.tradeAdvice!.reasoning}</p>

        {evaluation.priceEstimate && (
          <div className="flex gap-4 flex-wrap text-sm pt-1">
            <div>
              <span className="text-muted-foreground text-xs">poe.ninja</span>
              <p className="font-mono font-semibold text-primary" data-testid="text-chaos-value">
                {evaluation.priceEstimate.chaosValue.toFixed(1)}c
              </p>
            </div>
            {evaluation.priceEstimate.divineValue > 0 && (
              <div>
                <span className="text-muted-foreground text-xs">Divine Value</span>
                <p className="font-mono font-semibold text-orange-400" data-testid="text-divine-value">
                  {evaluation.priceEstimate.divineValue.toFixed(2)}d
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CraftingCard({ evaluation }: { evaluation: ItemEvaluation }) {
  return (
    <Card className="border-border" data-testid="card-crafting-advice">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Wrench className="h-4 w-4 text-blue-400 shrink-0" />
        <h3 className="text-sm font-semibold">Crafting Steps</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {evaluation.craftingAdvice!.map((step, i) => (
            <div key={i} className="flex gap-3" data-testid={`card-craft-step-${i}`}>
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-bold shrink-0">
                  {step.step}
                </div>
                {i < evaluation.craftingAdvice!.length - 1 && (
                  <div className="w-px h-full bg-muted mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <p className="text-sm font-medium">{step.action}</p>
                {step.currency && (
                  <Badge variant="secondary" className="text-xs mt-1 gap-1">
                    <ArrowRight className="h-2.5 w-2.5" />
                    {step.currency}
                  </Badge>
                )}
                <p className="text-xs text-muted-foreground mt-1">{step.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-700 text-white border-green-600",
  medium: "bg-yellow-700 text-white border-yellow-600",
  low: "bg-muted text-muted-foreground",
};

function BuildFitsCard({ evaluation }: { evaluation: ItemEvaluation }) {
  if (!evaluation.buildFits || evaluation.buildFits.length === 0) return null;

  return (
    <Card className="border-border" data-testid="card-build-fits">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Users className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-sm font-semibold">Build Fit Analysis</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {evaluation.buildFits.map((fit, i) => (
          <div key={i} className="space-y-1.5" data-testid={`build-fit-${i}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{fit.archetype}</span>
                <Badge className={`text-[10px] shrink-0 ${CONFIDENCE_COLORS[fit.confidence]}`}>
                  {fit.confidence}
                </Badge>
              </div>
              {fit.ninjaUrl && (
                <Button size="sm" variant="ghost" asChild className="shrink-0">
                  <a href={fit.ninjaUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-ninja-builds-${i}`}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Builds
                  </a>
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1 ml-0">
              {fit.relevantMods.slice(0, 4).map((mod, j) => (
                <span key={j} className="text-[10px] text-muted-foreground">
                  {j > 0 && " · "}{mod.replace(/[+-]?\d+\.?\d*%?\s*/, "").trim()}
                </span>
              ))}
            </div>
            {i < evaluation.buildFits!.length - 1 && <Separator />}
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground pt-1">
          Based on mod analysis. Click "Builds" to see matching builds on poe.ninja.
        </p>
      </CardContent>
    </Card>
  );
}

function AnalysisCard({ evaluation }: { evaluation: ItemEvaluation }) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <AlertTriangle className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-sm font-semibold">Analysis Details</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {evaluation.reasons.length > 3 && (
          <div className="space-y-1">
            {evaluation.reasons.slice(3).map((reason, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        )}

        {evaluation.modScores && evaluation.modScores.length > 0 && (
          <>
            {evaluation.reasons.length > 3 && <Separator />}
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">Mod Scores (Build Weight)</p>
              <div className="space-y-1.5">
                {evaluation.modScores.map((ms, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{ms.mod}</p>
                    </div>
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(ms.score, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right shrink-0">{ms.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
