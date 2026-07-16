export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
  PLAYER_KV: KVNamespace;
  MAP_KV: KVNamespace;
  PORTRAIT_R2: R2Bucket;
  RANDOM_ORG_API_KEY: string;
  GM_PASSWORD: string;
  PLAYER_PASSWORD: string;
  AUTH_SECRET: string;
}
