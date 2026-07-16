const installed = new Map<string, object>();

export function replaceCombatModules(modules: Record<string, object>): void {
  installed.clear();
  for (const [key, mod] of Object.entries(modules)) {
    installed.set(key, mod);
  }
}

export function clearCombatModules(): void {
  installed.clear();
}

export function combatMod(key: string): object {
  const mod = installed.get(key);
  if (!mod) {
    throw new Error(`Combat module "${key}" is not installed (register content pack first)`);
  }
  return mod;
}
