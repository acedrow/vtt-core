export type ContentPackMeta = {
  id: string;
  version: string;
};

let registered: ContentPackMeta | null = null;

export function getContentPackMeta(): ContentPackMeta | null {
  return registered;
}

export function setContentPackMeta(meta: ContentPackMeta | null): void {
  registered = meta;
}

export function assertContentPackRegistered(): void {
  if (!registered) {
    throw new Error("Content pack not registered. Call registerContentPack() at boot.");
  }
}
