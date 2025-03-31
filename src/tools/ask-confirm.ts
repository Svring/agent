import { tool } from 'ai';
import { z } from 'zod';

// Client-side tool definition (no execute function)
export const askForConfirmationTool = tool({
  description: 'Ask the user for confirmation before proceeding with an action.',
  parameters: z.object({
    message: z.string().describe('The confirmation question to ask the user.'),
  }),
  // No execute function needed here - it's handled client-side in the UI
});
