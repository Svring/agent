import { tool } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

export const reportTool = tool({
  description: "Report the current condition of a task, set its status, and store the report in a dedicated file. This tool is used to document the progress or issues encountered during task execution, allowing for tracking and later review. The report is saved in the '.report' directory with a filename that includes a snippet of the content, the status, and a timestamp for easy identification.",
  parameters: z.object({
    message: z.string().describe("A detailed report of the current task condition."),
    status: z.enum(["finished", "undone", "undefined"]).describe("The current status of the task."),
  }),
  execute: async ({ message, status }) => {
    console.log("Task Report:", message);
    console.log("Task Status:", status);
    
    const reportDir = path.join(process.cwd(), ".report");
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const contentSnippet = message.substring(0, 20).replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    const reportFile = path.join(reportDir, `report-${contentSnippet}-${status}-${timestamp}.txt`);
    
    try {
      await fs.mkdir(reportDir, { recursive: true });
      const reportContent = `Task Report: ${message}\nTask Status: ${status}\nTimestamp: ${timestamp}`;
      await fs.writeFile(reportFile, reportContent);
      return `Task report stored successfully with status: ${status} at ${reportFile}`;
    } catch (error) {
      console.error("Error storing report:", error);
      return `Task report logged but failed to store in file with status: ${status}`;
    }
  },
});
