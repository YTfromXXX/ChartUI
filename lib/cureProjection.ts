export const Gravity = 0.035;

export function calculateVortexBpm(time: number): number {
  const cornerPhases = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  const vortexEnergy = cornerPhases.reduce((sum, phase) => sum + Math.abs(Math.sin(time * 0.00035 + phase)), 0) / 4;
  return Math.round(48 + vortexEnergy * 72);
}

export async function digestProjectionSnapshot(snapshot: object): Promise<string> {
  const serialized = JSON.stringify(snapshot);
  if (globalThis.crypto?.subtle) {
    const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
    const hex = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `sha256:${hex}`;
  }

  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash = Math.imul(hash ^ serialized.charCodeAt(index), 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
