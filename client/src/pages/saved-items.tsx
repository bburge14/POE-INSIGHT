import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemDisplay } from "@/components/item-display";
import { getRarityColor } from "@/lib/item-parser";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SavedItem } from "@shared/schema";
import { Trash2, Bookmark, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState } from "react";

export default function SavedItems() {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const query = useQuery<SavedItem[]>({
    queryKey: ["/api/items"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Deleted", description: "Item removed from collection." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (query.isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Saved Items</h1>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const items = query.data || [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Saved Items</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your collection of analyzed items.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">{items.length} items</Badge>
      </div>

      {items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Bookmark className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No saved items yet. Analyze an item and click "Save to Collection" to add it here.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const parsed = item.parsedData;
          const isExpanded = expandedId === item.id;

          return (
            <Card key={item.id} data-testid={`card-saved-item-${item.id}`}>
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <button
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    data-testid={`button-expand-${item.id}`}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <span className={`text-sm font-medium ${getRarityColor(parsed.rarity)} truncate block`}>
                        {parsed.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {parsed.itemClass} {parsed.itemLevel > 0 ? `| iLvl ${parsed.itemLevel}` : ""}
                      </span>
                    </div>
                  </button>
                  <Badge variant="outline" className={`shrink-0 text-xs ${getRarityColor(parsed.rarity)}`}>
                    {parsed.rarity}
                  </Badge>
                  {item.evaluation && (
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                      {(item.evaluation as any).score}/100
                    </span>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(item.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${item.id}`}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {isExpanded && (
                  <div className="mt-4">
                    <ItemDisplay
                      item={parsed}
                      evaluation={item.evaluation as any}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
