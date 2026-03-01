import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TrendingUp, Search, Coins, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NinjaCurrency, NinjaUniqueItem } from "@shared/schema";
import { useState, useMemo } from "react";

type SortKey = "name" | "value" | "volume";
type SortDir = "asc" | "desc";

export default function Market() {
  const [league, setLeague] = useState("Fate of the Vaal");
  const [tab, setTab] = useState<"currency" | "uniques">("currency");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const currencyQuery = useQuery<NinjaCurrency[]>({
    queryKey: ["/api/ninja/currency", league],
    enabled: tab === "currency",
  });

  const uniquesQuery = useQuery<NinjaUniqueItem[]>({
    queryKey: ["/api/ninja/uniques", league],
    enabled: tab === "uniques",
  });

  const filteredCurrencies = useMemo(() => {
    let items = currencyQuery.data || [];
    if (search) {
      items = items.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
    }
    items = [...items].sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return mult * a.name.localeCompare(b.name);
      if (sortKey === "value") return mult * (a.chaosValue - b.chaosValue);
      return mult * ((a.volume || 0) - (b.volume || 0));
    });
    return items;
  }, [currencyQuery.data, search, sortKey, sortDir]);

  const filteredUniques = useMemo(() => {
    let items = uniquesQuery.data || [];
    if (search) {
      items = items.filter(
        (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.baseType.toLowerCase().includes(search.toLowerCase())
      );
    }
    items = [...items].sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return mult * a.name.localeCompare(b.name);
      if (sortKey === "value") return mult * (a.chaosValue - b.chaosValue);
      return mult * (a.listingCount - b.listingCount);
    });
    return items;
  }, [uniquesQuery.data, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const isLoading = tab === "currency" ? currencyQuery.isLoading : uniquesQuery.isLoading;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Market Prices</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live pricing data from poe.ninja for currency and unique items.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={league} onValueChange={setLeague}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-league">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Fate of the Vaal">Fate of the Vaal</SelectItem>
            <SelectItem value="Standard">Standard</SelectItem>
            <SelectItem value="Hardcore">Hardcore</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          <Button
            variant={tab === "currency" ? "default" : "secondary"}
            size="sm"
            onClick={() => { setTab("currency"); setSearch(""); }}
            data-testid="button-tab-currency"
          >
            <Coins className="h-3.5 w-3.5 mr-1.5" />
            Currency
          </Button>
          <Button
            variant={tab === "uniques" ? "default" : "secondary"}
            size="sm"
            onClick={() => { setTab("uniques"); setSearch(""); }}
            data-testid="button-tab-uniques"
          >
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            Uniques
          </Button>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-market"
          />
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 py-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-4 w-32" />
                <div className="flex-1" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && tab === "currency" && (
        <div className="space-y-1">
          <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground font-medium">
            <div className="w-8" />
            <button onClick={() => toggleSort("name")} className="flex-1 flex items-center gap-1 text-left" data-testid="button-sort-name">
              Name <ArrowUpDown className="h-3 w-3" />
            </button>
            <button onClick={() => toggleSort("value")} className="w-24 text-right flex items-center justify-end gap-1" data-testid="button-sort-value">
              Chaos <ArrowUpDown className="h-3 w-3" />
            </button>
            <button onClick={() => toggleSort("volume")} className="w-20 text-right flex items-center justify-end gap-1">
              Volume <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
          {filteredCurrencies.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No currencies found. Try changing your search or league.
              </CardContent>
            </Card>
          )}
          {filteredCurrencies.map((c) => (
            <Card key={c.id} className="hover-elevate" data-testid={`card-currency-${c.id}`}>
              <CardContent className="flex items-center gap-4 py-3">
                {c.icon ? (
                  <img src={c.icon} alt={c.name} className="h-8 w-8 object-contain" />
                ) : (
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                    <Coins className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="flex-1 text-sm font-medium truncate">{c.name}</span>
                <span className="w-24 text-right font-mono text-sm text-primary" data-testid={`text-chaos-${c.id}`}>
                  {c.chaosValue >= 1 ? c.chaosValue.toFixed(1) : c.chaosValue.toFixed(4)}c
                </span>
                <span className="w-20 text-right text-xs text-muted-foreground">
                  {c.volume ? c.volume.toLocaleString() : "-"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && tab === "uniques" && (
        <div className="space-y-1">
          <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground font-medium">
            <div className="w-8" />
            <button onClick={() => toggleSort("name")} className="flex-1 flex items-center gap-1 text-left" data-testid="button-sort-name">
              Name <ArrowUpDown className="h-3 w-3" />
            </button>
            <div className="w-24 text-right">Base</div>
            <button onClick={() => toggleSort("value")} className="w-24 text-right flex items-center justify-end gap-1" data-testid="button-sort-value">
              Chaos <ArrowUpDown className="h-3 w-3" />
            </button>
            <button onClick={() => toggleSort("volume")} className="w-20 text-right flex items-center justify-end gap-1">
              Listings <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
          {filteredUniques.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No unique items found. Try changing your search or league.
              </CardContent>
            </Card>
          )}
          {filteredUniques.map((u) => (
            <Card key={u.id} className="hover-elevate" data-testid={`card-unique-${u.id}`}>
              <CardContent className="flex items-center gap-4 py-3">
                {u.icon ? (
                  <img src={u.icon} alt={u.name} className="h-8 w-8 object-contain" />
                ) : (
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="flex-1 text-sm font-medium text-orange-400 truncate">{u.name}</span>
                <span className="w-24 text-right text-xs text-muted-foreground truncate">{u.baseType}</span>
                <span className="w-24 text-right font-mono text-sm text-primary" data-testid={`text-chaos-unique-${u.id}`}>
                  {u.chaosValue.toFixed(1)}c
                </span>
                <span className="w-20 text-right text-xs text-muted-foreground">
                  {u.listingCount?.toLocaleString() || "-"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
