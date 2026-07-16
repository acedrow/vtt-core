import { assertContentPackRegistered } from "./content-pack-state.js";
import type { OverworldConvoyType } from "./types.js";

export type ConvoyCompletionOption = {
  name: string;
  description: string;
};

export type ConvoyTypeInfo = {
  id: OverworldConvoyType;
  name: string;
  summary: string;
  escort: string;
  completionOptions: ConvoyCompletionOption[];
};

export const CONVOY_TYPES: ConvoyTypeInfo[] = [];

export function replaceConvoysCatalog(types: ConvoyTypeInfo[]): void {
  CONVOY_TYPES.length = 0;
  CONVOY_TYPES.push(...types);
}

export function getConvoyTypeInfo(id: OverworldConvoyType): ConvoyTypeInfo | undefined {
  assertContentPackRegistered();
  return CONVOY_TYPES.find((c) => c.id === id);
}
