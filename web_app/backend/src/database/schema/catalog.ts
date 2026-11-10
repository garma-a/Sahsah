// Database names and constraints follow the accepted v1.2 design.
// Cyclic foreign keys are evaluated lazily in pgTable extra configuration.
import * as t from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  mediaAccessScope,
  mediaAssetState,
  mediaKind,
  packPublicationState,
  questionFormat,
  questionMediaRole,
} from "./enums.js";
import { bytea } from "./types.js";
import type { JsonObject } from "./types.js";
import { staffAccounts } from "./staff.js";

export const categorySections = t.pgTable(
  "category_sections",
  {
    id: t.uuid("id").primaryKey().notNull(),
    nameAr: t.text("name_ar").notNull(),
    nameFranco: t.text("name_franco"),
    displayOrder: t.integer("display_order").default(0).notNull(),
  },
  (table): t.PgTableExtraConfigValue[] => [
    t.check("category_sections_display_order_bounds", sql`display_order >= 0`),
    t.check(
      "category_sections_name_bounds",
      sql`length(btrim(name_ar)) > 0 AND char_length(name_ar) <= 160 AND (name_franco IS NULL OR (length(btrim(name_franco)) > 0 AND char_length(name_franco) <= 160))`,
    ),
  ],
);

export const categories = t.pgTable(
  "categories",
  {
    id: t.uuid("id").primaryKey().notNull(),
    nameAr: t.text("name_ar").notNull(),
    nameFranco: t.text("name_franco"),
    displayOrder: t.integer("display_order").default(0).notNull(),
    archivedAt: t.timestamp("archived_at", {
      withTimezone: true,
      mode: "string",
    }),
    sectionId: t.uuid("section_id"),
    descriptionAr: t.text("description_ar"),
    descriptionFranco: t.text("description_franco"),
    // Public artwork only; private gameplay media stays in question_media.
    coverMediaAssetId: t.uuid("cover_media_asset_id"),
  },
  (table): t.PgTableExtraConfigValue[] => [
    t.check("categories_display_order_bounds", sql`display_order >= 0`),
    t.index("categories_section").on(table.sectionId, table.id),
    t
      .foreignKey({
        name: "categories_section",
        columns: [table.sectionId],
        foreignColumns: [categorySections.id],
      })
      .onDelete("no action")
      .onUpdate("no action"),
    t
      .foreignKey({
        name: "categories_cover_asset",
        columns: [table.coverMediaAssetId],
        foreignColumns: [mediaAssets.id],
      })
      .onDelete("no action")
      .onUpdate("no action"),
    t.check(
      "categories_description_bounds",
      sql`(description_ar IS NULL OR (length(btrim(description_ar)) > 0 AND char_length(description_ar) <= 500)) AND (description_franco IS NULL OR (length(btrim(description_franco)) > 0 AND char_length(description_franco) <= 500))`,
    ),
  ],
);

export const questionPacks = t.pgTable(
  "question_packs",
  {
    id: t.uuid("id").primaryKey().notNull(),
    categoryId: t.uuid("category_id").notNull(),
    packNumber: t.integer("pack_number").notNull(),
    contentRevision: t
      .bigint("content_revision", { mode: "bigint" })
      .default(sql`1`)
      .notNull(),
    publicationState: packPublicationState("publication_state")
      .default("draft")
      .notNull(),
    archivedAt: t.timestamp("archived_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: t
      .timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`now()`)
      .notNull(),
    updatedAt: t
      .timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`now()`)
      .notNull(),
  },
  (table): t.PgTableExtraConfigValue[] => [
    t
      .uniqueIndex("question_packs_category_number")
      .on(table.categoryId, table.packNumber),
    t
      .foreignKey({
        name: "packs_category",
        columns: [table.categoryId],
        foreignColumns: [categories.id],
      })
      .onDelete("no action")
      .onUpdate("no action"),
    t.check(
      "question_packs_positive_number_revision",
      sql`pack_number > 0 AND content_revision > 0`,
    ),
    t.check("question_packs_update_order", sql`updated_at >= created_at`),
  ],
);

export const questions = t.pgTable(
  "questions",
  {
    id: t.uuid("id").primaryKey().notNull(),
    packId: t.uuid("pack_id").notNull(),
    slotNumber: t.smallint("slot_number").notNull(),
    promptAr: t.text("prompt_ar").notNull(),
    promptFranco: t.text("prompt_franco"),
    answerAr: t.text("answer_ar").notNull(),
    answerFranco: t.text("answer_franco"),
    format: questionFormat("format").notNull(),
    formatConfig: t
      .jsonb("format_config")
      .$type<JsonObject>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    retiredAt: t.timestamp("retired_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table): t.PgTableExtraConfigValue[] => [
    t
      .uniqueIndex("questions_one_current_per_pack_slot")
      .on(table.packId, table.slotNumber)
      .where(sql`retired_at IS NULL`),
    t
      .foreignKey({
        name: "questions_pack",
        columns: [table.packId],
        foreignColumns: [questionPacks.id],
      })
      .onDelete("no action")
      .onUpdate("no action"),
    t.check(
      "questions_format_config_object",
      sql`jsonb_typeof(format_config) = 'object'`,
    ),
    t.check("questions_slot_bounds", sql`slot_number BETWEEN 1 AND 6`),
  ],
);

export const mediaAssets = t.pgTable(
  "media_assets",
  {
    id: t.uuid("id").primaryKey().notNull(),
    mediaKind: mediaKind("media_kind").notNull(),
    state: mediaAssetState("state").default("pending").notNull(),
    accessScope: mediaAccessScope("access_scope").default("private").notNull(),
    storageProvider: t.text("storage_provider").notNull(),
    storageNamespace: t.text("storage_namespace").notNull(),
    storageKey: t.text("storage_key").notNull(),
    contentType: t.text("content_type"),
    byteSize: t.bigint("byte_size", { mode: "bigint" }),
    widthPx: t.integer("width_px"),
    heightPx: t.integer("height_px"),
    durationMs: t.integer("duration_ms"),
    sha256: bytea("sha256"),
    sourceAssetId: t.uuid("source_asset_id"),
    transformSpec: t
      .jsonb("transform_spec")
      .$type<JsonObject>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    uploadedByStaffId: t.uuid("uploaded_by_staff_id").notNull(),
    createdAt: t
      .timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`now()`)
      .notNull(),
    readyAt: t.timestamp("ready_at", { withTimezone: true, mode: "string" }),
    archivedAt: t.timestamp("archived_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table): t.PgTableExtraConfigValue[] => [
    t
      .uniqueIndex("media_assets_storage_identity")
      .on(table.storageProvider, table.storageNamespace, table.storageKey),
    t.index("media_assets_derivatives").on(table.sourceAssetId, table.id),
    t
      .foreignKey({
        name: "media_assets_source",
        columns: [table.sourceAssetId],
        foreignColumns: [table.id],
      })
      .onDelete("no action")
      .onUpdate("no action"),
    t
      .foreignKey({
        name: "media_assets_staff",
        columns: [table.uploadedByStaffId],
        foreignColumns: [staffAccounts.id],
      })
      .onDelete("no action")
      .onUpdate("no action"),
    t.check(
      "media_assets_provider_bounds",
      sql`length(btrim(storage_provider)) > 0 AND octet_length(storage_provider) <= 32`,
    ),
    t.check(
      "media_assets_namespace_bounds",
      sql`length(btrim(storage_namespace)) > 0 AND octet_length(storage_namespace) <= 128`,
    ),
    t.check(
      "media_assets_key_bounds",
      sql`length(btrim(storage_key)) > 0 AND octet_length(storage_key) <= 1024`,
    ),
    t.check(
      "media_assets_ready_time_pair",
      sql`(state = 'ready') = (ready_at IS NOT NULL)`,
    ),
    t.check(
      "media_assets_ready_order",
      sql`ready_at IS NULL OR ready_at >= created_at`,
    ),
    t.check(
      "media_assets_positive_bytes",
      sql`byte_size IS NULL OR byte_size > 0`,
    ),
    t.check(
      "media_assets_dimension_pair",
      sql`(width_px IS NULL) = (height_px IS NULL)`,
    ),
    t.check(
      "media_assets_positive_dimensions",
      sql`width_px IS NULL OR (width_px > 0 AND height_px > 0)`,
    ),
    t.check(
      "media_assets_positive_duration",
      sql`duration_ms IS NULL OR duration_ms > 0`,
    ),
    t.check(
      "media_assets_checksum_shape",
      sql`sha256 IS NULL OR octet_length(sha256) = 32`,
    ),
    t.check(
      "media_assets_no_direct_self_source",
      sql`source_asset_id IS NULL OR source_asset_id <> id`,
    ),
    t.check(
      "media_assets_transform_object",
      sql`jsonb_typeof(transform_spec) = 'object'`,
    ),
    t.check(
      "media_assets_ready_metadata",
      sql`state <> 'ready' OR (content_type IS NOT NULL AND byte_size IS NOT NULL AND ((media_kind = 'image' AND left(content_type, 6) = 'image/' AND width_px IS NOT NULL AND height_px IS NOT NULL AND duration_ms IS NULL) OR (media_kind = 'audio' AND left(content_type, 6) = 'audio/' AND duration_ms IS NOT NULL AND width_px IS NULL AND height_px IS NULL)))`,
    ),
  ],
);

export const questionMedia = t.pgTable(
  "question_media",
  {
    questionId: t.uuid("question_id").notNull(),
    mediaRole: questionMediaRole("media_role").notNull(),
    variantNumber: t.smallint("variant_number").default(0).notNull(),
    suggestedPoints: t.smallint("suggested_points"),
    mediaAssetId: t.uuid("media_asset_id").notNull(),
  },
  (table): t.PgTableExtraConfigValue[] => [
    t.primaryKey({
      name: "question_media_pkey",
      columns: [table.questionId, table.mediaRole, table.variantNumber],
    }),
    t
      .index("question_media_asset_references")
      .on(table.mediaAssetId, table.questionId),
    t
      .foreignKey({
        name: "question_media_question",
        columns: [table.questionId],
        foreignColumns: [questions.id],
      })
      .onDelete("no action")
      .onUpdate("no action"),
    t
      .foreignKey({
        name: "question_media_asset",
        columns: [table.mediaAssetId],
        foreignColumns: [mediaAssets.id],
      })
      .onDelete("no action")
      .onUpdate("no action"),
    t.check(
      "question_media_variant_shape",
      sql`(media_role = 'hint_image' AND variant_number BETWEEN 0 AND 2 AND suggested_points IS NOT NULL AND suggested_points BETWEEN 1 AND 600) OR (media_role <> 'hint_image' AND variant_number = 0 AND suggested_points IS NULL)`,
    ),
  ],
);
