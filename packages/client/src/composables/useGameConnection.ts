import { ref } from "vue";

const connection = ref<"connecting" | "connected" | "disconnected">("disconnected");

export function useGameConnection() {
  return { connection };
}
