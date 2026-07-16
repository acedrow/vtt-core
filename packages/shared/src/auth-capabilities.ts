import type { GaemRole } from "./types.js";

export type AuthCapabilities = {
  role: GaemRole;
  gmPermissions?: boolean;
};

export function hasGmCapabilities(ctx: AuthCapabilities): boolean {
  return ctx.role === "gm" || ctx.gmPermissions === true;
}

export function canGrantGmPermissions(ctx: AuthCapabilities): boolean {
  return ctx.role === "gm";
}
