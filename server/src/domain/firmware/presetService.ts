import { eq } from "drizzle-orm";
import type { Db } from "../../infra/db/client.js";
import { buildPresets } from "../../infra/db/schema.js";
import { ConflictError, NotFoundError } from "../errors.js";

export interface CreatePresetInput {
  name: string;
  baseVersion: string;
  env: string;
  overrides: string;
  buildFlags: string;
}

/** Saved build configurations so a user doesn't retype the same overrides every time. */
export class PresetService {
  constructor(private readonly db: Db) {}

  list() {
    return this.db.select().from(buildPresets).orderBy(buildPresets.name).all();
  }

  create(input: CreatePresetInput) {
    const existing = this.db.select().from(buildPresets).where(eq(buildPresets.name, input.name)).get();
    if (existing) throw new ConflictError(`A preset named "${input.name}" already exists`);
    return this.db.insert(buildPresets).values(input).returning().get();
  }

  delete(id: number) {
    const existing = this.db.select().from(buildPresets).where(eq(buildPresets.id, id)).get();
    if (!existing) throw new NotFoundError("Build preset", id);
    this.db.delete(buildPresets).where(eq(buildPresets.id, id)).run();
  }
}
