import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import type { ParsedItem, TradeSearchResult, TradeStatFilter, TradeListing } from "@shared/schema";
import {
  ExternalLink,
  ShoppingCart,
  Search,
  ArrowRight,
  Target,
  SlidersHorizontal,
  Coins,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface TradeListingsProps {
  item: ParsedItem;
}

const CURRENCY_LABELS: Record<string, string> = {
  chaos: "c",
  divine: "div",
  exalted: "ex",
  alch: "alch",
  vaal: "vaal",
  unknown: "?",
};

function formatPrice(listing: TradeListing): string {
  const label = CURRENCY_LABELS[listing.price.currency] || listing.price.currency;
  if (listing.price.amount === 0) return "N/A";
  return `${listing.price.amount % 1 === 0 ? listing.price.amount : listing.price.amount.toFixed(1)} ${label}`;
}

function formatTimeAgo(indexed: string): string {
  if (!indexed || indexed === "average") return indexed || "";
  try {
    const date = new Date(indexed);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "";
  }
}

function PriceOverview({ listings }: { listings: TradeListing[] }) {
  const pricedListings = listings.filter(l => l.price.amount > 0 && l.id !== "hint-unique" && l.id !== "hint-search-base");
  if (pricedListings.length === 0) return null;

  const prices = pricedListings.map(l => l.price.amount).sort((a, b) => a - b);
  const lowest = prices[0];
  const median = prices[Math.floor(prices.length / 2)];
  const currency = pricedListings[0].price.currency;
  const label = CURRENCY_LABELS[currency] || currency;

  return (
    <div className="grid grid-cols-3 gap-3 p-3 rounded-md bg-card border border-border">
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
          <TrendingDown className="h-3 w-3" /> Lowest
        </p>
        <p className="text-sm font-mono font-bold text-green-400">
          {lowest % 1 === 0 ? lowest : lowest.toFixed(1)} {label}
        </p>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
          <Coins className="h-3 w-3" /> Median
        </p>
        <p className="text-sm font-mono font-bold text-primary">
          {median % 1 === 0 ? median : median.toFixed(1)} {label}
        </p>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
          <TrendingUp className="h-3 w-3" /> Listings
        </p>
        <p className="text-sm font-mono font-bold text-foreground">
          {pricedListings.length}
        </p>
      </div>
    </div>
  );
}

function ListingRow({ listing }: { listing: TradeListing }) {
  const isHint = listing.id.startsWith("hint-");
  const isNinja = listing.id === "ninja-price";

  if (isHint) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-3 w-3 text-primary shrink-0" />
          <span className="text-xs" data-testid="text-search-hint-name">{listing.itemName}</span>
        </div>
        {listing.itemMods && listing.itemMods.length > 0 && (
          <div className="space-y-0.5 ml-5">
            {listing.itemMods.map((mod, i) => (
              <p key={i} className="text-[10px] text-muted-foreground">{mod}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 ${isNinja ? "bg-primary/5 rounded px-2 -mx-2" : ""}`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Coins className="h-3 w-3 text-primary shrink-0" />
        <span className="text-xs font-mono font-semibold text-primary whitespace-nowrap">
          {formatPrice(listing)}
        </span>
        {listing.itemName && (
          <span className="text-[10px] text-muted-foreground truncate">{listing.itemName}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {listing.listed && (
          <span className="text-[10px] text-muted-foreground">{formatTimeAgo(listing.listed)}</span>
        )}
        <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
          {listing.seller}
        </span>
      </div>
    </div>
  );
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
  const listings = searchMutation.data?.listings || [];
  const totalResults = searchMutation.data?.total || 0;
  const hasRealListings = listings.some(l => !l.id.startsWith("hint-") && l.price.amount > 0);

  return (
    <Card className="border-border" data-testid="card-trade-listings">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold">Trade & Market</h3>
        </div>
        <div className="flex items-center gap-2">
          {totalResults > 0 && (
            <Badge variant="default" className="text-[10px]">
              {totalResults} found
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            Fate of the Vaal
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {searchMutation.isPending && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-40" />
          </div>
        )}

        {!searchMutation.isPending && searchMutation.data && (
          <>
            {/* Price overview for real listings */}
            <PriceOverview listings={listings} />

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="default"
                asChild
                data-testid="button-open-trade"
              >
                <a href={tradeUrl} target="_blank" rel="noopener noreferrer">
                  <Search className="h-4 w-4 mr-2" />
                  {hasRealListings ? `View All ${totalResults} Listings` : "Search Trade Site"}
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

            {/* Real listings */}
            {hasRealListings && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Live Listings (lowest price first)
                  </p>
                  <div className="divide-y divide-border">
                    {listings
                      .filter(l => !l.id.startsWith("hint-") && l.price.amount > 0)
                      .map((listing) => (
                        <ListingRow key={listing.id} listing={listing} />
                      ))}
                  </div>
                </div>
              </>
            )}

            {/* Hints (only show if no real listings) */}
            {!hasRealListings && listings.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Search Info</p>
                  {listings.map((hint) => (
                    <ListingRow key={hint.id} listing={hint} />
                  ))}
                </div>
              </>
            )}

            {/* Stat filters */}
            {statFilters.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">
                        Stat Filters {hasRealListings ? "(used for search)" : "(recommended)"}
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
                  {!hasRealListings && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-1">
                      <p className="text-[11px] font-medium text-primary">How to use these filters:</p>
                      <ol className="text-[10px] text-muted-foreground space-y-0.5 list-decimal list-inside">
                        <li>Click "Search Trade Site" above to open the trade site</li>
                        <li>Click "+ Add Stat Filter" in the Stat Filters section</li>
                        <li>Search for each stat name and set the min value from the ranges shown</li>
                        <li>Click Search to find similarly-rolled items and their prices</li>
                      </ol>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex gap-2 flex-wrap">
              {item.rarity === "Unique" && (
                <Badge variant="secondary" className="text-[10px]">
                  Unique — {hasRealListings ? "live prices shown" : "check poe.ninja for avg price"}
                </Badge>
              )}
              {item.rarity === "Rare" && (
                <Badge variant="secondary" className="text-[10px]">
                  Rare — {hasRealListings ? "similar items shown" : "use stat filters on trade site"}
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
