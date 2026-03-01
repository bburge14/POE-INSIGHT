import {
  type User, type InsertUser,
  type BuildProfile, type InsertBuildProfile,
  type SavedItem, type InsertSavedItem,
  type MetaBase, type InsertMetaBase,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProfiles(): Promise<BuildProfile[]>;
  getProfile(id: string): Promise<BuildProfile | undefined>;
  getActiveProfile(): Promise<BuildProfile | undefined>;
  createProfile(profile: InsertBuildProfile): Promise<BuildProfile>;
  updateProfileWeights(id: string, weights: Record<string, number>): Promise<BuildProfile | undefined>;
  activateProfile(id: string): Promise<void>;
  deleteProfile(id: string): Promise<void>;

  getSavedItems(): Promise<SavedItem[]>;
  getSavedItem(id: string): Promise<SavedItem | undefined>;
  createSavedItem(item: InsertSavedItem): Promise<SavedItem>;
  deleteSavedItem(id: string): Promise<void>;

  getMetaBases(): Promise<MetaBase[]>;
  getMetaBase(id: string): Promise<MetaBase | undefined>;
  getMetaBaseByName(name: string): Promise<MetaBase | undefined>;
  createMetaBase(base: InsertMetaBase): Promise<MetaBase>;
  deleteMetaBase(id: string): Promise<void>;
}

export class MemoryStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private profiles: Map<string, BuildProfile> = new Map();
  private items: Map<string, SavedItem> = new Map();
  private bases: Map<string, MetaBase> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return [...this.users.values()].find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = { id: randomUUID(), ...insertUser };
    this.users.set(user.id, user);
    return user;
  }

  async getProfiles(): Promise<BuildProfile[]> {
    return [...this.profiles.values()].sort(
      (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getProfile(id: string): Promise<BuildProfile | undefined> {
    return this.profiles.get(id);
  }

  async getActiveProfile(): Promise<BuildProfile | undefined> {
    return [...this.profiles.values()].find(p => p.isActive);
  }

  async createProfile(profile: InsertBuildProfile): Promise<BuildProfile> {
    const created: BuildProfile = {
      id: randomUUID(),
      name: profile.name,
      classType: profile.classType,
      weights: profile.weights,
      isActive: profile.isActive ?? false,
      createdAt: new Date(),
    };
    this.profiles.set(created.id, created);
    return created;
  }

  async updateProfileWeights(id: string, weights: Record<string, number>): Promise<BuildProfile | undefined> {
    const profile = this.profiles.get(id);
    if (!profile) return undefined;
    profile.weights = weights;
    return profile;
  }

  async activateProfile(id: string): Promise<void> {
    for (const p of this.profiles.values()) {
      p.isActive = false;
    }
    const profile = this.profiles.get(id);
    if (profile) profile.isActive = true;
  }

  async deleteProfile(id: string): Promise<void> {
    this.profiles.delete(id);
  }

  async getSavedItems(): Promise<SavedItem[]> {
    return [...this.items.values()].sort(
      (a, b) => new Date(b.savedAt!).getTime() - new Date(a.savedAt!).getTime()
    );
  }

  async getSavedItem(id: string): Promise<SavedItem | undefined> {
    return this.items.get(id);
  }

  async createSavedItem(item: InsertSavedItem): Promise<SavedItem> {
    const created: SavedItem = {
      id: randomUUID(),
      rawText: item.rawText,
      parsedData: item.parsedData,
      evaluation: item.evaluation ?? null,
      notes: item.notes ?? null,
      savedAt: new Date(),
    };
    this.items.set(created.id, created);
    return created;
  }

  async deleteSavedItem(id: string): Promise<void> {
    this.items.delete(id);
  }

  async getMetaBases(): Promise<MetaBase[]> {
    return [...this.bases.values()];
  }

  async getMetaBase(id: string): Promise<MetaBase | undefined> {
    return this.bases.get(id);
  }

  async getMetaBaseByName(name: string): Promise<MetaBase | undefined> {
    return [...this.bases.values()].find(b => b.name === name);
  }

  async createMetaBase(base: InsertMetaBase): Promise<MetaBase> {
    const created: MetaBase = {
      id: randomUUID(),
      name: base.name,
      category: base.category,
      tier: base.tier,
      notes: base.notes ?? null,
    };
    this.bases.set(created.id, created);
    return created;
  }

  async deleteMetaBase(id: string): Promise<void> {
    this.bases.delete(id);
  }
}

export const storage = new MemoryStorage();
