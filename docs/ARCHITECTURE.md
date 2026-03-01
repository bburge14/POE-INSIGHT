# Exile-Insight: System Architecture

## Overview

Exile-Insight is a **read-only** desktop application for Path of Exile 2 that provides
real-time trade advice and build optimization. It parses Path of Building exports,
monitors the PoE2 Public Stash API, and scores item deals against the user's build needs.

## System Architecture Diagram

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[UIOverlay<br/>Electron + Tailwind CSS<br/>Dark-mode Dashboard]
        NOTIFY[Notification System<br/>Top-5 Deal Alerts]
    end

    subgraph "Application Core"
        APP[Application Controller<br/>Event Bus & Orchestration]
        EVAL[ItemEvaluator<br/>Deal Scoring Engine]
        BUILD[BuildEvaluator<br/>Stat Weights & Requirements]
        AI[AI Advisor<br/>LLM Synergy Analysis]
    end

    subgraph "Data Ingestion Layer"
        POB[BuildParser<br/>PoB XML/String Parser]
        FETCH[DataFetcher<br/>PoE2 Public Stash API Client]
        RATE[RateLimiter<br/>retry-after Compliance]
        BUFFER[StreamBuffer<br/>10s Debounce Window]
    end

    subgraph "Persistence Layer"
        DB[(SQLite Database<br/>Market Price Cache)]
        HIST[Price History<br/>Rolling Averages]
    end

    subgraph "External Systems"
        POE_API[PoE2 Public Stash API<br/>READ-ONLY]
        LLM_API[LLM API<br/>OpenAI-compatible]
        POB_FILE[PoB Export String/XML]
    end

    %% User interactions
    UI -->|Import Build| POB
    UI -->|Start Monitoring| APP
    UI -->|Display Deals| NOTIFY

    %% Core flow
    POB -->|Parsed Build Profile| BUILD
    BUILD -->|Stat Weight Vector| EVAL
    APP -->|Orchestrate| FETCH
    FETCH -->|Raw Items| BUFFER
    BUFFER -->|Batched Items| EVAL
    EVAL -->|Complex Items| AI
    EVAL -->|Scored Deals| APP
    AI -->|Synergy Analysis| EVAL
    APP -->|Top Deals| UI

    %% Data persistence
    EVAL -->|Cache Prices| DB
    DB -->|Historical Avg| EVAL
    DB -->|Price Trends| HIST
    HIST -->|Avg Price Data| EVAL

    %% External connections
    FETCH -->|HTTP GET| RATE
    RATE -->|Throttled Requests| POE_API
    AI -->|API Call| LLM_API
    POB_FILE -->|Import| POB

    %% Styling
    classDef external fill:#1a1a2e,stroke:#e94560,color:#eee
    classDef core fill:#16213e,stroke:#0f3460,color:#eee
    classDef data fill:#0f3460,stroke:#533483,color:#eee
    classDef ui fill:#533483,stroke:#e94560,color:#eee
    classDef db fill:#1a1a2e,stroke:#533483,color:#eee

    class POE_API,LLM_API,POB_FILE external
    class APP,EVAL,BUILD,AI core
    class POB,FETCH,RATE,BUFFER data
    class UI,NOTIFY ui
    class DB,HIST db
```

## Module Dependency Flow

```mermaid
graph LR
    subgraph "Modules"
        BP[BuildParser]
        BE[BuildEvaluator]
        DF[DataFetcher]
        IE[ItemEvaluator]
        AA[AI Advisor]
        DB[Database]
        UO[UIOverlay]
    end

    BP --> BE
    BE --> IE
    DF --> IE
    DB --> IE
    IE --> AA
    IE --> UO
    DB --> DF

    style BP fill:#0f3460,color:#eee
    style BE fill:#0f3460,color:#eee
    style DF fill:#16213e,color:#eee
    style IE fill:#e94560,color:#eee
    style AA fill:#533483,color:#eee
    style DB fill:#1a1a2e,color:#eee
    style UO fill:#533483,color:#eee
```

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant UI as UIOverlay
    participant BP as BuildParser
    participant BE as BuildEvaluator
    participant DF as DataFetcher
    participant BUF as StreamBuffer
    participant IE as ItemEvaluator
    participant AI as AI Advisor
    participant DB as SQLite Cache
    participant API as PoE2 API

    User->>UI: Import PoB string
    UI->>BP: Parse export string
    BP->>BP: Decode Base64 + Inflate
    BP->>BP: Parse XML tree
    BP->>BE: CharacterBuild object
    BE->>BE: Calculate stat weight vector
    BE->>BE: Identify unmet requirements
    BE->>IE: BuildProfile with weights

    User->>UI: Start monitoring
    UI->>DF: Begin polling

    loop Every poll interval (respecting rate limits)
        DF->>API: GET /public-stash-tabs?id={next_change_id}
        API-->>DF: Stash tab data + next_change_id
        DF->>BUF: Raw items stream
    end

    loop Every 10 seconds (debounce window)
        BUF->>IE: Batched items array
        IE->>DB: Lookup historical prices
        DB-->>IE: Average prices for stat tiers
        IE->>IE: Calculate DPS/EHP delta
        IE->>IE: Calculate price vs market avg

        alt Complex rare item
            IE->>AI: Request synergy analysis
            AI-->>IE: Tier rating + explanation
        end

        IE->>IE: Compute final Deal Score
        IE->>DB: Cache new price data
        IE-->>UI: Top 5 deals (sorted by score)
    end

    UI->>User: Display deal notifications
```

## Item Deal JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ItemDeal",
  "type": "object",
  "required": ["id", "item", "dealScore", "evaluation", "pricing", "timestamp"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique deal identifier"
    },
    "item": {
      "$ref": "#/definitions/PoE2Item"
    },
    "dealScore": {
      "type": "number",
      "minimum": 0,
      "maximum": 100,
      "description": "Composite score: 0-100 where 100 is an unmissable deal"
    },
    "evaluation": {
      "$ref": "#/definitions/DealEvaluation"
    },
    "pricing": {
      "$ref": "#/definitions/PriceAnalysis"
    },
    "aiAnalysis": {
      "$ref": "#/definitions/AIAnalysis"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  },
  "definitions": {
    "PoE2Item": {
      "type": "object",
      "required": ["id", "name", "baseType", "itemLevel", "rarity", "mods"],
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "baseType": { "type": "string" },
        "itemLevel": { "type": "integer" },
        "rarity": {
          "type": "string",
          "enum": ["Normal", "Magic", "Rare", "Unique"]
        },
        "category": {
          "type": "string",
          "enum": [
            "weapon", "armour", "accessory", "gem", "jewel",
            "flask", "currency", "gold"
          ]
        },
        "mods": {
          "type": "object",
          "properties": {
            "implicit": { "type": "array", "items": { "$ref": "#/definitions/Mod" } },
            "explicit": { "type": "array", "items": { "$ref": "#/definitions/Mod" } },
            "enchant": { "type": "array", "items": { "$ref": "#/definitions/Mod" } }
          }
        },
        "requirements": {
          "type": "object",
          "properties": {
            "level": { "type": "integer" },
            "str": { "type": "integer" },
            "dex": { "type": "integer" },
            "int": { "type": "integer" }
          }
        },
        "influences": {
          "type": "array",
          "items": { "type": "string" }
        },
        "stash": {
          "type": "object",
          "properties": {
            "accountName": { "type": "string" },
            "stashName": { "type": "string" },
            "league": { "type": "string" }
          }
        },
        "listingPrice": {
          "$ref": "#/definitions/Price"
        }
      }
    },
    "Mod": {
      "type": "object",
      "required": ["text", "stats"],
      "properties": {
        "text": { "type": "string" },
        "tier": { "type": "integer" },
        "stats": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "value": { "type": "number" },
              "min": { "type": "number" },
              "max": { "type": "number" }
            }
          }
        }
      }
    },
    "Price": {
      "type": "object",
      "required": ["amount", "currency"],
      "properties": {
        "amount": { "type": "number" },
        "currency": {
          "type": "string",
          "description": "PoE2 currency type: exalted, divine, chaos, gold, etc."
        }
      }
    },
    "DealEvaluation": {
      "type": "object",
      "required": ["dpsChange", "ehpChange", "meetsRequirements"],
      "properties": {
        "dpsChange": {
          "type": "object",
          "properties": {
            "absolute": { "type": "number" },
            "percentage": { "type": "number" }
          }
        },
        "ehpChange": {
          "type": "object",
          "properties": {
            "absolute": { "type": "number" },
            "percentage": { "type": "number" }
          }
        },
        "statContributions": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "value": { "type": "number" },
              "weight": { "type": "number" },
              "weightedValue": { "type": "number" }
            }
          }
        },
        "meetsRequirements": { "type": "boolean" },
        "unmetRequirements": {
          "type": "array",
          "items": { "type": "string" }
        },
        "isUpgrade": { "type": "boolean" }
      }
    },
    "PriceAnalysis": {
      "type": "object",
      "required": ["currentPrice", "marketAverage", "priceRatio"],
      "properties": {
        "currentPrice": { "$ref": "#/definitions/Price" },
        "marketAverage": { "$ref": "#/definitions/Price" },
        "priceRatio": {
          "type": "number",
          "description": "currentPrice / marketAverage. Below 0.8 = good deal."
        },
        "priceHistory": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "timestamp": { "type": "string", "format": "date-time" },
              "price": { "$ref": "#/definitions/Price" }
            }
          }
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Confidence in market avg based on sample size"
        }
      }
    },
    "AIAnalysis": {
      "type": "object",
      "properties": {
        "tier": {
          "type": "string",
          "enum": ["S", "A", "B", "C", "D", "F"]
        },
        "reasoning": { "type": "string" },
        "synergies": {
          "type": "array",
          "items": { "type": "string" }
        },
        "warnings": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  }
}
```

## Key Design Decisions

### 1. Stat Weights as Vectors
Character stats are treated as a weighted vector. When a stat is **required** (e.g.,
50 Strength to equip gear), its weight approaches infinity until satisfied, then drops
to near-zero. This prevents recommending stats the build doesn't need.

### 2. PoE2 Socket System
PoE2 moved sockets from gear to gems. The evaluator ignores socket counts on gear
and instead focuses purely on stat values, mod rolls, and build synergies.

### 3. Stream Debouncing
The Public Stash API is a firehose. A 10-second buffer window collects items, scores
them, and only surfaces the top 5 deals per cycle. This keeps the UI responsive.

### 4. Rate Limit Compliance
The DataFetcher respects `retry-after` headers and implements exponential backoff.
This is critical — GGG will IP-ban aggressive scrapers.

### 5. Gold & Currency Accuracy
PoE2 introduces Gold as a primary currency alongside traditional orbs. The price
normalization layer converts all currencies to a common base (Exalted Orbs) for
accurate cross-currency comparison.

### 6. Read-Only Compliance
The application **never** sends inputs to the game client. It only reads the public
API and displays information. Zero automation, zero interaction with the game process.
