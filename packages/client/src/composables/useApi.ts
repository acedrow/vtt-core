import type { EnemyListing, GameMap, GameMapSummary, PlayerProfile, TilePaintPreset } from "@gaem/shared";
import { getEnemyListingByName, getEnemyPortraitUrl } from "@gaem/shared";
import { computed } from "vue";

import {
  bundledTileAppearanceUrl,
  isBundledTileAppearanceKey,
} from "../lib/bundledTileAppearances.js";
import {
  bundledTileFeatureUrl,
  isBundledTileFeatureKey,
} from "../lib/bundledTileFeatures.js";
import {
  bundledTileOverlayUrl,
  isBundledTileOverlayKey,
} from "../lib/bundledTileOverlays.js";
import { useSession } from "./useSession.js";

type PlayerProfileOption = PlayerProfile & { isActive?: boolean };

export function useApi() {
  const { apiHeaders, clearSession } = useSession();

  const apiBase = computed(() => {
    if (import.meta.env.VITE_CF_DEV) return "";
    if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
    if (import.meta.env.DEV) return `http://${location.hostname}:3001`;
    return "";
  });

  async function apiFetch(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    for (const [key, value] of Object.entries(apiHeaders())) {
      headers.set(key, value);
    }
    const res = await fetch(`${apiBase.value}${path}`, { ...init, headers });
    if (
      res.status === 401 &&
      path !== "/api/login" &&
      !path.startsWith("/api/player-profiles")
    ) {
      clearSession();
      if (location.pathname !== "/") location.assign("/");
    }
    return res;
  }

  async function fetchPlayerProfiles(): Promise<PlayerProfileOption[]> {
    const res = await apiFetch("/api/player-profiles");
    if (!res.ok) return [];
    const data = (await res.json()) as { profiles: PlayerProfileOption[] };
    return data.profiles;
  }

  async function fetchPortraitUrl(sheetId: string): Promise<string | null> {
    const res = await apiFetch(`/api/character-sheets/${sheetId}/portrait`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  function enemyPortraitUrl(listing: EnemyListing | undefined): string | null {
    return getEnemyPortraitUrl(listing);
  }

  function enemyPortraitUrlForName(name: string | undefined): string | null {
    return enemyPortraitUrl(getEnemyListingByName(name));
  }

  function tileAppearanceApiPath(key: string): string {
    return `/api/tile-appearances/${key}`;
  }

  async function uploadTileAppearance(file: File): Promise<string | null> {
    const res = await apiFetch("/api/tile-appearances", {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: file,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { key?: string };
    return typeof data.key === "string" ? data.key : null;
  }

  async function fetchTileAppearanceUrl(key: string): Promise<string | null> {
    if (isBundledTileAppearanceKey(key)) {
      return bundledTileAppearanceUrl(key);
    }
    if (isBundledTileOverlayKey(key)) {
      return bundledTileOverlayUrl(key);
    }
    if (isBundledTileFeatureKey(key)) {
      return bundledTileFeatureUrl(key);
    }
    const res = await apiFetch(tileAppearanceApiPath(key));
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  function regionImageApiPath(key: string): string {
    return `/api/region-images/${key}`;
  }

  async function uploadRegionImage(file: File): Promise<string | null> {
    const contentType = file.type;
    if (
      contentType !== "image/png" &&
      contentType !== "image/jpeg" &&
      contentType !== "image/webp"
    ) {
      return null;
    }
    const res = await apiFetch("/api/region-images", {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { key?: string };
    return typeof data.key === "string" ? data.key : null;
  }

  async function fetchRegionImageUrl(key: string): Promise<string | null> {
    const res = await apiFetch(regionImageApiPath(key));
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  async function fetchTilePresets(mapId: string): Promise<Record<string, TilePaintPreset>> {
    const res = await apiFetch(`/api/maps/${encodeURIComponent(mapId)}/tile-presets`);
    if (!res.ok) return {};
    const data = (await res.json()) as { presets?: Record<string, TilePaintPreset> };
    return data.presets ?? {};
  }

  async function saveTilePreset(
    mapId: string,
    name: string,
    preset: TilePaintPreset,
  ): Promise<{ ok: true; presets: Record<string, TilePaintPreset> } | { ok: false; error: string }> {
    const res = await apiFetch(
      `/api/maps/${encodeURIComponent(mapId)}/tile-presets/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      presets?: Record<string, TilePaintPreset>;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error ?? "Failed to save preset" };
    }
    return { ok: true, presets: data.presets ?? {} };
  }

  async function deleteTilePreset(
    mapId: string,
    name: string,
  ): Promise<Record<string, TilePaintPreset>> {
    const res = await apiFetch(
      `/api/maps/${encodeURIComponent(mapId)}/tile-presets/${encodeURIComponent(name)}`,
      { method: "DELETE" },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as { presets?: Record<string, TilePaintPreset> };
    return data.presets ?? {};
  }

  async function fetchMaps(): Promise<GameMapSummary[]> {
    const res = await apiFetch("/api/maps");
    if (!res.ok) return [];
    const data = (await res.json()) as { maps?: GameMapSummary[] };
    return data.maps ?? [];
  }

  async function fetchMap(id: string): Promise<GameMap | null> {
    const res = await apiFetch(`/api/maps/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { map?: GameMap };
    return data.map ?? null;
  }

  async function createMap(body: {
    id: string;
    name: string;
    width?: number;
    height?: number;
  }): Promise<GameMapSummary> {
    const res = await apiFetch("/api/maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { map?: GameMapSummary; error?: string } | null;
    if (!res.ok) {
      throw new Error(data?.error ?? "Failed to create map");
    }
    if (!data?.map) {
      throw new Error("Failed to create map");
    }
    return data.map;
  }

  async function deleteMap(id: string): Promise<void> {
    const res = await apiFetch(`/api/maps/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) return;
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Failed to delete map");
  }

  return {
    apiBase,
    apiFetch,
    fetchPlayerProfiles,
    fetchPortraitUrl,
    enemyPortraitUrl,
    enemyPortraitUrlForName,
    tileAppearanceApiPath,
    uploadTileAppearance,
    fetchTileAppearanceUrl,
    regionImageApiPath,
    uploadRegionImage,
    fetchRegionImageUrl,
    fetchTilePresets,
    saveTilePreset,
    deleteTilePreset,
    fetchMaps,
    fetchMap,
    createMap,
    deleteMap,
  };
}
