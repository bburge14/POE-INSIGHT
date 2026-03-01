import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BuildProfile } from "@shared/schema";
import { Plus, Trash2, Save, Swords, Loader2, Star, CheckCircle } from "lucide-react";
import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const DEFAULT_STATS = [
  "Maximum Life",
  "Fire Resistance",
  "Cold Resistance",
  "Lightning Resistance",
  "Chaos Resistance",
  "Physical Damage",
  "Attack Speed",
  "Critical Strike Chance",
  "Critical Strike Multiplier",
  "Spell Damage",
  "Energy Shield",
  "Armour",
  "Evasion Rating",
  "Movement Speed",
  "Mana",
  "Life Regeneration",
  "Elemental Damage",
];

const CLASS_TYPES = [
  "Warrior",
  "Ranger",
  "Witch",
  "Mercenary",
  "Monk",
  "Sorceress",
];

export default function BuildWeights() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState("Warrior");

  const query = useQuery<BuildProfile[]>({
    queryKey: ["/api/profiles"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const weights: Record<string, number> = {};
      DEFAULT_STATS.forEach((s) => (weights[s] = 5));
      await apiRequest("POST", "/api/profiles", {
        name: newName,
        classType: newClass,
        weights,
        isActive: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      setCreateOpen(false);
      setNewName("");
      toast({ title: "Created", description: "Build profile created." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, weights }: { id: string; weights: Record<string, number> }) => {
      await apiRequest("PATCH", `/api/profiles/${id}`, { weights });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/profiles/${id}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({ title: "Activated", description: "Build profile set as active." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({ title: "Deleted", description: "Build profile removed." });
    },
  });

  if (query.isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Build Weights</h1>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const profiles = query.data || [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Build Weights</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure stat importance for your build to improve item evaluations.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-profile">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Build Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Profile Name</Label>
                <Input
                  placeholder="e.g., Lightning Monk"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  data-testid="input-profile-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={newClass} onValueChange={setNewClass}>
                  <SelectTrigger data-testid="select-class">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASS_TYPES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
                data-testid="button-create-profile"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Profile
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {profiles.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Swords className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No build profiles yet. Create one to configure stat weights for item evaluation.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            onUpdate={(weights) => updateMutation.mutate({ id: profile.id, weights })}
            onActivate={() => activateMutation.mutate(profile.id)}
            onDelete={() => deleteMutation.mutate(profile.id)}
            isUpdating={updateMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  onUpdate,
  onActivate,
  onDelete,
  isUpdating,
}: {
  profile: BuildProfile;
  onUpdate: (weights: Record<string, number>) => void;
  onActivate: () => void;
  onDelete: () => void;
  isUpdating: boolean;
}) {
  const [weights, setWeights] = useState<Record<string, number>>(
    (profile.weights as Record<string, number>) || {}
  );
  const [dirty, setDirty] = useState(false);

  const handleWeightChange = useCallback((stat: string, value: number) => {
    setWeights((prev) => ({ ...prev, [stat]: value }));
    setDirty(true);
  }, []);

  return (
    <Card data-testid={`card-profile-${profile.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Swords className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{profile.name}</h3>
            <p className="text-xs text-muted-foreground">{profile.classType}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {profile.isActive && (
            <Badge variant="default" className="text-xs gap-1">
              <CheckCircle className="h-3 w-3" /> Active
            </Badge>
          )}
          {!profile.isActive && (
            <Button size="sm" variant="ghost" onClick={onActivate} data-testid={`button-activate-${profile.id}`}>
              <Star className="h-3.5 w-3.5 mr-1" />
              Set Active
            </Button>
          )}
          {dirty && (
            <Button
              size="sm"
              variant="default"
              onClick={() => { onUpdate(weights); setDirty(false); }}
              disabled={isUpdating}
              data-testid={`button-save-${profile.id}`}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={onDelete} data-testid={`button-delete-profile-${profile.id}`}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {Object.entries(weights).map(([stat, value]) => (
            <div key={stat} className="flex items-center gap-3">
              <span className="text-xs w-40 shrink-0 truncate">{stat}</span>
              <Slider
                min={0}
                max={10}
                step={1}
                value={[value]}
                onValueChange={([v]) => handleWeightChange(stat, v)}
                className="flex-1"
              />
              <span className="text-xs font-mono w-6 text-right text-muted-foreground">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
