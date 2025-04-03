import { tool } from "ai";
import { z } from "zod";

export const reportTool = tool({
  description: "Report a problem",
  parameters: z.object({
    message: z.string().describe("The message to report"),
  }),
  execute: async ({ message }) => {
    console.log("Reporting problem:", message);
    return "Problem reported successfully";
  },
});