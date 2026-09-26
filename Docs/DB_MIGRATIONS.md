# Database Model Evolution & Migration Guide

This document describes how to update database models in Orbit and ensure changes are safely propagated across the application, indexes, and existing data.

---

## 1. Architecture Overview

Orbit enforces a strict 4-step pipeline for every database schema change:

```
┌─────────────────────────┐      ┌─────────────────────────┐
│ 1. Zod Validation Rules │ ───> │ 2. Mongoose Model Specs │
│ (*.schema.ts)           │      │ (*.model.ts)            │
└─────────────────────────┘      └─────────────────────────┘
             │                                │
             ▼                                ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│ 3. Repository Adapters  │ ───> │ 4. Migration Scripts    │
│ (*.repository.ts)       │      │ (migrations/*.ts)       │
└─────────────────────────┘      └─────────────────────────┘
```

---

## 2. Step-by-Step Guide for Modifying a DB Model

### Step 1: Update the Mongoose Schema & Interface

File path: `orbitserver/src/modules/<domain>/<domain>.model.ts`

1. Update the TypeScript interface:
   Add the new field to the interface extending `Document`. Define whether it is optional (`?`) or required.
2. Update the Mongoose schema:
   Add the field definition with explicit `type`, `default`, and constraints.
3. Define indexes if the field will be queried:
   ```ts
   CardSchema.index({ workspaceId: 1, customField: 1 });
   ```

### Step 2: Update the Zod Contracts

File path: `orbitserver/src/modules/<domain>/<domain>.schema.ts`

1. Add the new field to the appropriate Zod input/output schemas:
   ```ts
   export const updateCardSchema = z.object({
     customField: z.string().trim().max(100).optional(),
   });
   ```
2. Zod is the single source of truth for all network requests. Requests with undeclared or invalid fields are rejected with a 422 status code before reaching the service layer.

### Step 3: Update the Repository Layer

File path: `orbitserver/src/modules/<domain>/<domain>.repository.ts`

1. Only files ending with `.repository.ts` are permitted to import and query Mongoose models directly.
2. Update repository query projections and update methods to include the new field.

### Step 4: Synchronize Database Indexes

Run the automated index synchronization tool:

```bash
npm run sync-indexes --workspace=orbitserver
```

This script:

- Compares declared indexes in Mongoose schemas against physical indexes in MongoDB.
- Creates new compound and unique indexes with background building.
- Removes orphaned indexes safely without table locks.

### Step 5: Write & Run Migration Scripts (for existing data)

When modifying existing records, populate defaults or restructure documents using migrations:

1. Create a migration template:
   ```bash
   npm run migrate:create --workspace=orbitserver add_custom_field_to_cards
   ```
2. Implement the `up` and `down` transforms in `orbitserver/migrations/<timestamp>_add_custom_field_to_cards.ts`:
   ```ts
   import type { Db } from "mongodb";

   export async function up(db: Db): Promise<void> {
     await db
       .collection("cards")
       .updateMany(
         { customField: { $exists: false } },
         { $set: { customField: "default_value" } },
       );
   }

   export async function down(db: Db): Promise<void> {
     await db
       .collection("cards")
       .updateMany({}, { $unset: { customField: "" } });
   }
   ```
3. Apply pending migrations:
   ```bash
   npm run migrate
   ```
4. Check migration status:
   ```bash
   npm run migrate:status
   ```

---

## 3. Best Practices for Production Deployments

- **Additive Changes First**: Add new fields with default values before deploying code that reads them.
- **Two-Phase Deprecation**: Never delete a database column in the same release that stops writing to it.
- **Index Guard**: Always define compound indexes with tenant isolation keys first (e.g., `{ workspaceId: 1, ... }`).
