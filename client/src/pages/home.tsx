import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ItemDisplay } from "@/components/item-display";
import { TradeListings } from "@/components/trade-listings";
import { parseItemText } from "@/lib/item-parser";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ParsedItem, ItemEvaluation } from "@shared/schema";
import {
  Clipboard,
  Zap,
  Trash2,
  Bookmark,
  Loader2,
  ClipboardPaste,
  Sparkles,
  Brain,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const EXAMPLE_ITEM = `Item Class: Body Armours
Rarity: Rare
Storm Crown
Expert Vaal Regalia
--------
Energy Shield: 412
--------
Requirements:
Level: 68
Int: 154
Item Level: 84
--------
+18% to Fire Resistance
--------
+94 to maximum Life
+38% to Cold Resistance
+29% to Lightning Resistance
12% increased Rarity of Items found
+42 to maximum Energy Shield`;

export default function Home() {
  const [rawText, setRawText] = useState("");
  const [parsedItem, setParsedItem] = useState<ParsedItem | null>(null);
  const [evaluation, setEvaluation] = useState<ItemEvaluation | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const { toast } = useToast();

  // Check if AI is available on the backend
  const { data: aiStatus } = useQuery<{ available: boolean; model: string }>({
    queryKey: ["/api/ai/status"],
    staleTime: 60_000,
  });

  const evaluateMutation = useMutation({
    mutationFn: async (text: string) => {
      const endpoint = aiEnabled ? "/api/evaluate/ai" : "/api/evaluate";
      const res = await apiRequest("POST", endpoint, { rawText: text });
      return res.json();
    },
    onSuccess: (data: { parsed: ParsedItem; evaluation: ItemEvaluation; aiError?: string }) => {
      setParsedItem(data.parsed);
      setEvaluation(data.evaluation);
      setAiError(data.aiError || null);
      if (data.aiError) {
        toast({ title: "AI Unavailable", description: data.aiError, variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Evaluation Error", description: err.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!parsedItem) return;
      await apiRequest("POST", "/api/items", {
        rawText,
        parsedData: parsedItem,
        evaluation,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Item Saved", description: "Item has been saved to your collection." });
    },
    onError: (err: Error) => {
      toast({ title: "Save Error", description: err.message, variant: "destructive" });
    },
  });

  const handleParse = useCallback(() => {
    if (!rawText.trim()) {
      toast({ title: "No Input", description: "Paste an item's text first (Ctrl+C in PoE2).", variant: "destructive" });
      return;
    }
    const parsed = parseItemText(rawText);
    if (!parsed) {
      toast({ title: "Parse Failed", description: "Could not parse the item text. Make sure it's a valid PoE2 clipboard format.", variant: "destructive" });
      return;
    }
    setParsedItem(parsed);
    setEvaluation(null);
    setAiError(null);
    evaluateMutation.mutate(rawText);
  }, [rawText, toast, evaluateMutation]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRawText(text);
      toast({ title: "Pasted", description: "Item text pasted from clipboard." });
    } catch {
      toast({ title: "Clipboard Error", description: "Could not read clipboard. Try pasting manually.", variant: "destructive" });
    }
  }, [toast]);

  const handleLoadExample = useCallback(() => {
    setRawText(EXAMPLE_ITEM);
    toast({ title: "Example Loaded", description: "A sample rare item has been loaded." });
  }, [toast]);

  const handleClear = useCallback(() => {
    setRawText("");
    setParsedItem(null);
    setEvaluation(null);
    setAiError(null);
  }, []);

  const hasResults = parsedItem && !evaluateMutation.isPending;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Item Advisor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paste your PoE2 item text (Ctrl+C in game) to get instant crafting and trade advice.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Switch
              id="ai-toggle"
              checked={aiEnabled}
              onCheckedChange={setAiEnabled}
              data-testid="switch-ai-toggle"
            />
            <Label
              htmlFor="ai-toggle"
              className={`flex items-center gap-1.5 text-sm cursor-pointer ${aiEnabled ? "text-purple-400" : "text-muted-foreground"}`}
            >
              <Brain className={`h-4 w-4 ${aiEnabled ? "text-purple-400" : ""}`} />
              AI Analysis
            </Label>
          </div>
          {aiEnabled && !aiStatus?.available && (
            <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-600">
              No API Key
            </Badge>
          )}
          {aiEnabled && aiStatus?.available && (
            <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-600">
              GPT-4o
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-primary" />
            Item Input
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePasteFromClipboard}
              data-testid="button-paste"
            >
              <Clipboard className="h-3.5 w-3.5 mr-1" />
              Paste
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleLoadExample}
              data-testid="button-example"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Example
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <Textarea
              placeholder="Paste your item text here...&#10;&#10;Hover over an item in PoE2 and press Ctrl+C, then paste it here."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="min-h-[140px] font-mono text-xs resize-none"
              data-testid="input-item-text"
            />
            <div className="flex md:flex-col gap-2">
              <Button
                onClick={handleParse}
                disabled={evaluateMutation.isPending || !rawText.trim()}
                className={`flex-1 md:flex-none ${aiEnabled ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                data-testid="button-analyze"
              >
                {evaluateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : aiEnabled ? (
                  <Brain className="h-4 w-4 mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                {aiEnabled ? "AI Analyze" : "Analyze"}
              </Button>
              <Button
                variant="secondary"
                onClick={handleClear}
                disabled={!rawText && !parsedItem}
                data-testid="button-clear"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!parsedItem && !evaluateMutation.isPending && (
            <div className="flex items-center gap-6 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 font-mono text-xs">1</Badge>
                <span>Hover item in PoE2</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 font-mono text-xs">2</Badge>
                <span>Ctrl+C to copy</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 font-mono text-xs">3</Badge>
                <span>Paste & Analyze</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {evaluateMutation.isPending && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3"><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Separator />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      )}

      {hasResults && (
        <div className="space-y-4">
          <ItemDisplay item={parsedItem} evaluation={evaluation} />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-item"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bookmark className="h-4 w-4 mr-2" />
              )}
              Save to Collection
            </Button>
          </div>

          <TradeListings item={parsedItem} />
        </div>
      )}
    </div>
  );
}
