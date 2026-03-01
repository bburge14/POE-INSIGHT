import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MetaBase } from "@shared/schema";
import { Plus, Trash2, Shield, Loader2, Search } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const CATEGORIES = [
  "Body Armour",
  "Helmet",
  "Gloves",
  "Boots",
  "Shield",
  "One Hand Weapon",
  "Two Hand Weapon",
  "Bow",
  "Wand",
  "Sceptre",
  "Staff",
  "Ring",
  "Amulet",
  "Belt",
  "Quiver",
];

const TIERS = ["S", "A", "B"];

export default function MetaBases() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Body Armour");
  const [newTier, setNewTier] = useState("S");
  const [newNotes, setNewNotes] = useState("");
  const [searchText, setSearchText] = useState("");

  const query = useQuery<MetaBase[]>({
    queryKey: ["/api/bases"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/bases", {
        name: newName,
        category: newCategory,
        tier: newTier,
        notes: newNotes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
      setCreateOpen(false);
      setNewName("");
      setNewNotes("");
      toast({ title: "Added", description: "Meta base added." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/bases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
      toast({ title: "Deleted", description: "Meta base removed." });
    },
  });

  const bases = (query.data || []).filter(
    (b) =>
      !searchText ||
      b.name.toLowerCase().includes(searchText.toLowerCase()) ||
      b.category.toLowerCase().includes(searchText.toLowerCase())
  );

  const groupedBases = CATEGORIES.reduce(
    (acc, cat) => {
      const items = bases.filter((b) => b.category === cat);
      if (items.length > 0) acc[cat] = items;
      return acc;
    },
    {} as Record<string, MetaBase[]>
  );

  const tierColor = (tier: string) => {
    switch (tier) {
      case "S": return "text-orange-400 border-orange-600/50";
      case "A": return "text-purple-400 border-purple-600/50";
      case "B": return "text-blue-400 border-blue-600/50";
      default: return "";
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Meta Bases</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure which item bases are considered "meta" for crafting advice.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-base">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Base
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Meta Base</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Base Name</Label>
                <Input
                  placeholder="e.g., Tense Crossbow"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  data-testid="input-base-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tier</Label>
                  <Select value={newTier} onValueChange={setNewTier}>
                    <SelectTrigger data-testid="select-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIERS.map((t) => (
                        <SelectItem key={t} value={t}>{t}-Tier</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  placeholder="e.g., Best for Lightning builds"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  data-testid="input-base-notes"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
                data-testid="button-create-base"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                Add Meta Base
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search bases..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="pl-9"
          data-testid="input-search-bases"
        />
      </div>

      {query.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {!query.isLoading && Object.keys(groupedBases).length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Shield className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No meta bases configured. Add bases to improve crafting advice accuracy.
            </p>
          </CardContent>
        </Card>
      )}

      {Object.entries(groupedBases).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{category}</h3>
          <div className="space-y-1">
            {items.map((base) => (
              <Card key={base.id} data-testid={`card-base-${base.id}`}>
                <CardContent className="flex items-center gap-3 py-3">
                  <Shield className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium flex-1">{base.name}</span>
                  <Badge variant="outline" className={`text-xs ${tierColor(base.tier)}`}>
                    {base.tier}-Tier
                  </Badge>
                  {base.notes && (
                    <span className="text-xs text-muted-foreground max-w-32 truncate hidden sm:inline">{base.notes}</span>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(base.id)}
                    data-testid={`button-delete-base-${base.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
