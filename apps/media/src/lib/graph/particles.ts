import { ParticleState } from "./types";

/**
 * Advances all particle positions by one animation frame.
 * Wraps progress at 1.0 to create a continuous loop.
 *
 * @param particlesMap - Mutable particle state map keyed by edge id
 * @param speed - Progress increment per frame (default: 0.003)
 */
export function advanceParticles(
  particlesMap: Map<string, ParticleState[]>,
  speed = 0.003
): void {
  for (const particles of particlesMap.values()) {
    for (const p of particles) {
      p.progress = (p.progress + speed) % 1;
    }
  }
}

/**
 * Initializes a set of particles for a link.
 *
 * @param count - Number of particles per link
 * @returns Array of particle states
 */
export function seedParticles(count = 4): ParticleState[] {
  return Array.from({ length: count }, (_, i) => ({
    progress: i * (1 / count),
  }));
}
