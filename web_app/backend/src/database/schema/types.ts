import { customType } from "drizzle-orm/pg-core";

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

// Runtime validation belongs to the pricing/publication services, not these types.
export type QuantityTier = {
  minimum_quantity: number;
  discount_bps: number;
  is_active: boolean;
};
export type ShopBundle = {
  quantity: 1 | 2 | 5;
  is_active: boolean;
  display_order: number;
};
