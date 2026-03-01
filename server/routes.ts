import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { parseItemText } from "./parser";
import { evaluateItem } from "./evaluator";
import { aiEvaluateItem } from "./ai-evaluator";
import { getCurrencies, getUniqueItems, searchTrade } from "./ninja";
import { seedDatabase } from "./seed";
import { insertBuildProfileSchema, insertMetaBaseSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await seedDatabase();

  app.post("/api/evaluate", async (req, res) => {
    try {
      const { rawText } = req.body;
      if (!rawText || typeof rawText !== "string") {
        return res.status(400).json({ message: "rawText is required" });
      }

      const parsed = parseItemText(rawText);
      if (!parsed) {
        return res.status(400).json({ message: "Could not parse item text" });
      }

      const metaBases = await storage.getMetaBases();
      const activeProfile = await storage.getActiveProfile();
      const evaluation = await evaluateItem(parsed, metaBases, activeProfile);

      return res.json({ parsed, evaluation });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // AI-enhanced evaluation endpoint
  app.post("/api/evaluate/ai", async (req, res) => {
    try {
      const { rawText } = req.body;
      if (!rawText || typeof rawText !== "string") {
        return res.status(400).json({ message: "rawText is required" });
      }

      const parsed = parseItemText(rawText);
      if (!parsed) {
        return res.status(400).json({ message: "Could not parse item text" });
      }

      const metaBases = await storage.getMetaBases();
      const activeProfile = await storage.getActiveProfile();

      // Run rule-based evaluation first
      const evaluation = await evaluateItem(parsed, metaBases, activeProfile);

      // Then run AI analysis on top
      const aiResult = await aiEvaluateItem(parsed, evaluation, activeProfile);

      if ("error" in aiResult) {
        return res.json({ parsed, evaluation, aiError: aiResult.error });
      }

      // Merge AI analysis into the evaluation
      evaluation.aiAnalysis = aiResult.aiAnalysis;

      return res.json({ parsed, evaluation });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Check if AI is available (has API key)
  app.get("/api/ai/status", (_req, res) => {
    return res.json({
      available: !!process.env.OPENAI_API_KEY,
      model: "gpt-4o",
    });
  });

  app.post("/api/trade/search", async (req, res) => {
    try {
      const { parsed, league } = req.body;
      if (!parsed) {
        return res.status(400).json({ message: "parsed item data required" });
      }
      const result = await searchTrade(parsed, league || "Standard");
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/ninja/currency/:league", async (req, res) => {
    try {
      const league = req.params.league;
      const currencies = await getCurrencies(league);
      return res.json(currencies);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/ninja/uniques/:league", async (req, res) => {
    try {
      const league = req.params.league;
      const uniques = await getUniqueItems(league);
      return res.json(uniques);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/profiles", async (_req, res) => {
    try {
      const profiles = await storage.getProfiles();
      return res.json(profiles);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/profiles", async (req, res) => {
    try {
      const result = insertBuildProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors.map((e) => e.message).join(", ") });
      }
      const profile = await storage.createProfile(result.data);
      return res.status(201).json(profile);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/profiles/:id", async (req, res) => {
    try {
      const { weights } = req.body;
      if (!weights) {
        return res.status(400).json({ message: "weights required" });
      }
      const updated = await storage.updateProfileWeights(req.params.id, weights);
      if (!updated) {
        return res.status(404).json({ message: "Profile not found" });
      }
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/profiles/:id/activate", async (req, res) => {
    try {
      await storage.activateProfile(req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/profiles/:id", async (req, res) => {
    try {
      await storage.deleteProfile(req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/items", async (_req, res) => {
    try {
      const items = await storage.getSavedItems();
      return res.json(items);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/items", async (req, res) => {
    try {
      const { rawText, parsedData, evaluation, notes } = req.body;
      if (!rawText || !parsedData) {
        return res.status(400).json({ message: "rawText and parsedData required" });
      }
      const item = await storage.createSavedItem({
        rawText,
        parsedData,
        evaluation: evaluation || null,
        notes: notes || null,
      });
      return res.status(201).json(item);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/items/:id", async (req, res) => {
    try {
      await storage.deleteSavedItem(req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/bases", async (_req, res) => {
    try {
      const bases = await storage.getMetaBases();
      return res.json(bases);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bases", async (req, res) => {
    try {
      const result = insertMetaBaseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors.map((e) => e.message).join(", ") });
      }
      const existing = await storage.getMetaBaseByName(result.data.name);
      if (existing) {
        return res.status(409).json({ message: "Base already exists" });
      }
      const base = await storage.createMetaBase(result.data);
      return res.status(201).json(base);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/bases/:id", async (req, res) => {
    try {
      await storage.deleteMetaBase(req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
