import { ref } from "vue";

const connection = ref<"connecting" | "connected" | "disconnected">("disconnected");
const serverErrorVersion = ref(0);

export function useGameConnection() {
  function reportServerError() {
    serverErrorVersion.value += 1;
  }

  return { connection, serverErrorVersion, reportServerError };
}
