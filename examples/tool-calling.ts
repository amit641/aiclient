import { ai } from 'aiclient';

const response = await ai('What is the weather in London and Tokyo?', {
  tools: {
    getWeather: {
      description: 'Get the current weather for a city',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'The city name' },
        },
        required: ['city'],
      },
      execute: async ({ city }: { city: string }) => {
        // In a real app, call a weather API here
        const temps: Record<string, string> = {
          London: '15°C, cloudy',
          Tokyo: '22°C, sunny',
        };
        return temps[city] ?? 'Unknown';
      },
    },
  },
});

console.log('Tool calls:', response.toolCalls);
console.log('Tool results:', response.toolResults);
