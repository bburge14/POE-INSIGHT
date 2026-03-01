import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import type { ParsedItem, TradeSearchResult, TradeStatFilter } from "@shared/schema";
import {
  ExternalLink,
  ShoppingCart,
  Search,
  ArrowRight,
  Target,
  SlidersHorizontal,
} from "lucide-react";

interface TradeListingsProps {
  item: ParsedItem;
}

function StatFilterRow({ filter }: { filter: TradeStatFilter }) {
  const valuePercent = filter.max > filter.min
    ? ((filter.value - filter.min) / (filter.max - filter.min)) * 100
    : 50;

  return (
    <div className="space-y-1" data-testid={`stat-filter-${filter.statName.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Target className="h-3 w-3 text-primary shrink-0" />
          <span className="text-xs font-medium truncate">{filter.statName}</span>
          {filter.tierLabel && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
              {filter.tierLabel}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground font-mono">{filter.min}</span>
          <span className="text-xs text-muted-foreground">-</span>
          <span className="text-xs text-muted-foreground font-mono">{filter.max}</span>
        </div>
      </div>
      <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-primary/30 rounded-full"
          style={{ width: "100%" }}
        />
        <div
          className="absolute top-0 h-full w-1.5 bg-primary rounded-full"
          style={{ left: `${Math.min(Math.max(valuePercent, 0), 100)}%`, transform: "translateX(-50%)" }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground truncate pl-5">{filter.modText}</p>
    </div>
  );
}

export function TradeListings({ item }: TradeListingsProps) {
  const searchMutation = useMutation({
    mutationFn: async (parsed: ParsedItem) => {
      const res = await apiRequest("POST", "/api/trade/search", {
        parsed,
        league: "Fate of the Vaal",
      });
      return res.json() as Promise<TradeSearchResult>;
    },
  });

  useEffect(() => {
    if (item) {
      searchMutation.mutate(item);
    }
  }, [item.name, item.baseType]);

  const tradeUrl = searchMutation.data?.tradeUrl || "https://www.pathofexile.com/trade2/search/poe2/Fate+of+the+Vaal";
  const ninjaUrl = item.rarity === "Unique"
    ? `https://poe.ninja/poe2/economy/vaal/unique-${getItemCategory(item.itemClass)}?name=${encodeURIComponent(item.name)}`
    : `https://poe.ninja/poe2/economy/vaal/currency`;

  const statFilters = searchMutation.data?.statFilters || [];

  return (
    <Card className="border-border" data-testid="card-trade-listings">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold">Trade & Market</h3>
        </div>
        <Badge variant="outline" className="text-[10px]">
          Fate of the Vaal
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {searchMutation.isPending && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-40" />
          </div>
        )}

        {!searchMutation.isPending && searchMutation.data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="default"
                asChild
                data-testid="button-open-trade"
              >
                <a href={tradeUrl} target="_blank" rel="noopener noreferrer">
                  <Search className="h-4 w-4 mr-2" />
                  Search Trade Site
                </a>
              </Button>
              <Button
                variant="secondary"
                asChild
                data-testid="button-open-ninja"
              >
                <a href={ninjaUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on poe.ninja
                </a>
              </Button>
            </div>

            {statFilters.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">
                        Recommended Stat Filters
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {statFilters.length} filters
                    </Badge>
                  </div>
                  <div className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
                    {statFilters.map((filter, i) => (
                      <StatFilterRow key={i} filter={filter} />
                    ))}
                  </div>
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-1">
                    <p className="text-[11px] font-medium text-primary">How to use these filters:</p>
                    <ol className="text-[10px] text-muted-foreground space-y-0.5 list-decimal list-inside">
                      <li>Click "Search Trade Site" above to open the trade site</li>
                      <li>Click "+ Add Stat Filter" in the Stat Filters section</li>
                      <li>Search for each stat name and set the min value from the ranges shown</li>
                      <li>Click Search to find similarly-rolled items and their prices</li>
                    </ol>
                  </div>
                </div>
              </>
            )}

            {searchMutation.data.listings.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Search Info</p>
                  {searchMutation.data.listings.map((hint) => (
                    <div key={hint.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-xs" data-testid="text-search-hint-name">{hint.itemName}</span>
                      </div>
                      {hint.itemMods && hint.itemMods.length > 0 && (
                        <div className="space-y-0.5 ml-5">
                          {hint.itemMods.map((mod, i) => (
                            <p key={i} className="text-[10px] text-muted-foreground">{mod}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-2 flex-wrap">
              {item.rarity === "Unique" && (
                <Badge variant="secondary" className="text-[10px]">
                  Unique — check poe.ninja for avg price
                </Badge>
              )}
              {item.rarity === "Rare" && (
                <Badge variant="secondary" className="text-[10px]">
                  Rare — use stat filters on trade site
                </Badge>
              )}
              {searchMutation.data.itemCategory && (
                <Badge variant="outline" className="text-[10px]">
                  {searchMutation.data.itemCategory}
                </Badge>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function getItemCategory(itemClass: string): string {
  const map: Record<string, string> = {
    "Body Armours": "armour",
    "Helmets": "armour",
    "Gloves": "armour",
    "Boots": "armour",
    "Shields": "armour",
    "Wands": "weapon",
    "Sceptres": "weapon",
    "Staves": "weapon",
    "Daggers": "weapon",
    "Claws": "weapon",
    "One Hand Swords": "weapon",
    "Two Hand Swords": "weapon",
    "One Hand Axes": "weapon",
    "Two Hand Axes": "weapon",
    "One Hand Maces": "weapon",
    "Two Hand Maces": "weapon",
    "Bows": "weapon",
    "Crossbows": "weapon",
    "Quarterstaves": "weapon",
    "Amulets": "accessory",
    "Rings": "accessory",
    "Belts": "accessory",
  };
  return map[itemClass] || "armour";
}
