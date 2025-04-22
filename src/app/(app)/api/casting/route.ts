import { castingManager } from '@/backstage/casting-manager';

export async function GET(req: Request) {
  const models = castingManager.getModelOptions();
  const tools = castingManager.getToolOptions();

  return new Response(JSON.stringify({ models, tools }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
