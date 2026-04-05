import type { AIProvider } from '../types.js';
import { AIError } from '../errors.js';

const providers = new Map<string, AIProvider>();

export function registerProvider(name: string, provider: AIProvider): void {
  providers.set(name, provider);
}

export function getProvider(name: string): AIProvider {
  const provider = providers.get(name);
  if (!provider) {
    throw AIError.unknownProvider(name);
  }
  return provider;
}

export function hasProvider(name: string): boolean {
  return providers.has(name);
}

export function listProviders(): string[] {
  return [...providers.keys()];
}
