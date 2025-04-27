import { createOpenAI } from "@ai-sdk/openai";
import { experimental_generateImage as generateImage } from "ai";

const openai = createOpenAI({
  baseURL: process.env.SEALOS_USW_BASE_URL,
  apiKey: process.env.SEALOS_USW_API_KEY,
  compatibility: 'compatible'
});

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const { image } = await generateImage({
    model: openai.image('gpt-image-1'),
    prompt,
    size: '1024x1024',
    providerOptions: {
      openai: { 
        quality: 'high',
      },
    },
  });

  return new Response(JSON.stringify({ image }), { status: 200 });
}
