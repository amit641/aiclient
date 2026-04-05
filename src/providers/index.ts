import { registerProvider, getProvider, hasProvider, listProviders } from './registry.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';
import { OllamaProvider } from './ollama.js';

// Register built-in providers
registerProvider('openai', new OpenAIProvider());
registerProvider('anthropic', new AnthropicProvider());
registerProvider('google', new GoogleProvider());
registerProvider('ollama', new OllamaProvider());

export { registerProvider, getProvider, hasProvider, listProviders };
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { GoogleProvider } from './google.js';
export { OllamaProvider } from './ollama.js';
