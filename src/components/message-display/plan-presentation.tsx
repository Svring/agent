'use client'

import React from 'react';
import {
  PlanStep,
  PlanStepInstruction,
  ReasonResult,
  BrowserResult,
  TerminalResult,
  AnswerResult,
  ErrorResult,
  ToolInvocation,
} from '@/app/(app)/api/opera/counterfeit/schemas';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, ChevronRight, Code, HardDrive, Info, Search, MessageSquare, Zap, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dotted-dialog";

interface PlanPresentationProps {
  plan: PlanStep[];
}

const getIconForInstructionType = (type: PlanStepInstruction['type']) => {
  switch (type) {
    case 'reason':
      return <Info className="h-4 w-4 mr-2 text-blue-500" />;
    case 'browser':
      return <Search className="h-4 w-4 mr-2 text-green-500" />;
    case 'terminal':
      return <HardDrive className="h-4 w-4 mr-2 text-purple-500" />;
    case 'answer':
      return <MessageSquare className="h-4 w-4 mr-2 text-teal-500" />;
    default:
      return <ChevronRight className="h-4 w-4 mr-2" />;
  }
};

const renderResult = (result: PlanStep['result'], instructionType: PlanStepInstruction['type']) => {
  if (!result) {
    return <p className="text-sm text-muted-foreground">No result yet.</p>;
  }

  if ('error' in result) {
    return (
      <div className="text-red-500 text-sm flex items-start">
        <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Error:</p>
          <p className="whitespace-pre-wrap">{ (result as ErrorResult).error }</p>
        </div>
      </div>
    );
  }

  let content: string | React.ReactNode = '';
  let toolCalls: ToolInvocation[] | undefined | any[] = undefined; // Use any[] to match schema for now
  let toolResults: any[] | undefined = undefined;

  switch (instructionType) {
    case 'reason':
      content = (result as ReasonResult).content;
      break;
    case 'answer':
      content = (result as AnswerResult).content;
      break;
    case 'browser':
      const browserRes = result as BrowserResult;
      content = browserRes.content;
      toolCalls = browserRes.toolCalls;
      toolResults = browserRes.toolResults;
      break;
    case 'terminal':
      const terminalRes = result as TerminalResult;
      content = terminalRes.content;
      toolCalls = terminalRes.toolCalls;
      toolResults = terminalRes.toolResults;
      break;
    default:
      content = 'Unknown result type';
  }

  return (
    <div>
      {typeof content === 'string' ? (
        <p className="text-sm whitespace-pre-wrap">{content || "(No textual content)"}</p>
      ) : (
        content
      )}
      {toolCalls && toolCalls.length > 0 && (
        <div className="mt-2">
          <h4 className="text-xs font-semibold text-muted-foreground flex items-center">
            <Zap className="h-3 w-3 mr-1.5" />
            Tool Calls ({toolCalls.length}):
          </h4>
          <ul className="list-none pl-0 mt-1 space-y-1">
            {toolCalls.map((call, index) => (
              <li key={call.toolCallId || index} className="text-xs p-1.5 bg-muted/50 rounded-md">
                <span className="font-medium">{call.toolName || 'N/A'}</span>
                {call.args && Object.keys(call.args).length > 0 && (
                   <pre className="text-xs whitespace-pre-wrap bg-background p-1 rounded-sm mt-0.5">
                    {JSON.stringify(call.args, null, 2)}
                  </pre>
                )}
                {/* Basic display for corresponding result if available */}
                {toolResults && toolResults.find(res => res.toolCallId === call.toolCallId) && (
                  <div className="mt-0.5 text-xs text-muted-foreground border-l-2 border-primary/30 pl-1.5">
                    <span className="font-semibold">Result:</span> {JSON.stringify(toolResults.find(res => res.toolCallId === call.toolCallId)?.result, null, 2).substring(0, 100) + '...'}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const PlanPresentation: React.FC<PlanPresentationProps> = ({ plan }) => {
  if (!plan || plan.length === 0) {
    return <p className="text-sm text-muted-foreground">No plan steps to display.</p>;
  }

  const totalSteps = plan.length;
  const successfulSteps = plan.filter(step => step.result && !('error' in step.result)).length;
  const erroredSteps = plan.filter(step => step.result && ('error' in step.result)).length;

  return (
    <div className="p-2 bg-muted/20 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <p className="font-medium">Executed Plan Summary:</p>
          <p className="text-xs text-muted-foreground">
            {totalSteps} step(s) executed. {successfulSteps} successful, {erroredSteps} errored.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto text-xs h-7 px-2">
              <Eye className="h-3.5 w-3.5 mr-1.5" /> View Details
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto p-0">
            <DialogHeader className="p-4 border-b sticky top-0 bg-background z-10">
              <DialogTitle>Detailed Plan Execution</DialogTitle>
              <DialogDescription>
                Review each step of the executed plan below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 p-4">
              {plan.map((step, index) => (
                <Card key={step.step || index} className="overflow-hidden shadow-sm">
                  <CardHeader className="p-3 bg-muted/30 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center">
                        {getIconForInstructionType(step.instruction.type)}
                        Step {step.step}: <span className="ml-1.5 font-normal capitalize">{step.instruction.type}</span>
                      </CardTitle>
                      {step.result && !('error' in step.result) && (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      )}
                      {step.result && ('error' in step.result) && (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    <div>
                      <h3 className="text-sm font-semibold mb-1">Instruction:</h3>
                      <p className="text-sm p-2 bg-muted/50 rounded-md whitespace-pre-wrap">
                        {step.instruction.instruction}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-1">Result:</h3>
                      {renderResult(step.result, step.instruction.type)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Optional: DialogFooter if needed */}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
