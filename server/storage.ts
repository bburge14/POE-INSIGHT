import {
  type User, type InsertUser,
  type BuildProfile, type InsertBuildProfile,
  type SavedItem, type InsertSavedItem,
  type MetaBase, type InsertMetaBase,
  users, buildProfiles, savedItems, metaBases,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

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

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getProfiles(): Promise<BuildProfile[]> {
    return db.select().from(buildProfiles).orderBy(desc(buildProfiles.createdAt));
  }

  async getProfile(id: string): Promise<BuildProfile | undefined> {
    const [profile] = await db.select().from(buildProfiles).where(eq(buildProfiles.id, id));
    return profile;
  }

  async getActiveProfile(): Promise<BuildProfile | undefined> {
    const [profile] = await db.select().from(buildProfiles).where(eq(buildProfiles.isActive, true));
    return profile;
  }

  async createProfile(profile: InsertBuildProfile): Promise<BuildProfile> {
    const [created] = await db.insert(buildProfiles).values(profile).returning();
    return created;
  }

  async updateProfileWeights(id: string, weights: Record<string, number>): Promise<BuildProfile | undefined> {
    const [updated] = await db.update(buildProfiles).set({ weights }).where(eq(buildProfiles.id, id)).returning();
    return updated;
  }

  async activateProfile(id: string): Promise<void> {
    await db.update(buildProfiles).set({ isActive: false });
    await db.update(buildProfiles).set({ isActive: true }).where(eq(buildProfiles.id, id));
  }

  async deleteProfile(id: string): Promise<void> {
    await db.delete(buildProfiles).where(eq(buildProfiles.id, id));
  }

  async getSavedItems(): Promise<SavedItem[]> {
    return db.select().from(savedItems).orderBy(desc(savedItems.savedAt));
  }

  async getSavedItem(id: string): Promise<SavedItem | undefined> {
    const [item] = await db.select().from(savedItems).where(eq(savedItems.id, id));
    return item;
  }

  async createSavedItem(item: InsertSavedItem): Promise<SavedItem> {
    const [created] = await db.insert(savedItems).values(item).returning();
    return created;
  }

  async deleteSavedItem(id: string): Promise<void> {
    await db.delete(savedItems).where(eq(savedItems.id, id));
  }

  async getMetaBases(): Promise<MetaBase[]> {
    return db.select().from(metaBases);
  }

  async getMetaBase(id: string): Promise<MetaBase | undefined> {
    const [base] = await db.select().from(metaBases).where(eq(metaBases.id, id));
    return base;
  }

  async getMetaBaseByName(name: string): Promise<MetaBase | undefined> {
    const [base] = await db.select().from(metaBases).where(eq(metaBases.name, name));
    return base;
  }

  async createMetaBase(base: InsertMetaBase): Promise<MetaBase> {
    const [created] = await db.insert(metaBases).values(base).returning();
    return created;
  }

  async deleteMetaBase(id: string): Promise<void> {
    await db.delete(metaBases).where(eq(metaBases.id, id));
  }
}

export const storage = new DatabaseStorage();
