import { ai } from '../dist/index.js';

// OpenAI (default)
await ai('Hello!');

// Anthropic Claude
await ai('Hello!', { provider: 'anthropic' });

// Google Gemini
await ai('Hello!', { provider: 'google' });

// Local model via Ollama
await ai('Hello!', { provider: 'ollama', model: 'llama3.1' });
