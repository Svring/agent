'use client'

import React from 'react';
import {
  PlanStep,
  PlanStepInstruction,
  // ReasonResult, // Removed
  // BrowserResult, // Removed
  // TerminalResult, // Removed
  // AnswerResult, // Removed
  // ErrorResult, // Removed
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

const renderReportContent = (report: string, instructionType: PlanStepInstruction['type']) => {
  // The report is now just a string. We can check if it starts with "Error:" for basic error styling.
  const isError = report.toLowerCase().startsWith("error:");

  if (isError) {
    return (
      <div className="text-red-500 text-sm flex items-start">
        <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
        <p className="whitespace-pre-wrap">{report}</p>
      </div>
    );
  }

  return (
    <p className="text-sm whitespace-pre-wrap">{report || "(No textual content in report)"}</p>
  );
};

export const PlanPresentation: React.FC<PlanPresentationProps> = ({ plan }) => {
  if (!plan || plan.length === 0) {
    return <p className="text-sm text-muted-foreground">No plan steps to display.</p>;
  }

  const totalSteps = plan.length;
  // A step is considered errored if its report string starts with "Error:", case-insensitive.
  const erroredSteps = plan.filter(step => step.report.toLowerCase().startsWith("error:")).length;
  const successfulSteps = totalSteps - erroredSteps;

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
                      {/* Determine icon based on whether the report string indicates an error */}
                      {step.report.toLowerCase().startsWith("error:") ? (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold mb-1">Instruction:</h3>
                      <p className="text-sm p-2 bg-muted/50 rounded-md whitespace-pre-wrap">
                        {step.instruction.instruction}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-1">Report:</h3>
                      {renderReportContent(step.report, step.instruction.type)}
                    </div>
                    {step.invocations && step.invocations.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-1 flex items-center">
                          <Zap className="h-3.5 w-3.5 mr-1.5 text-orange-500" />
                          Tool Invocations ({step.invocations.length}):
                        </h3>
                        <ul className="list-none pl-0 mt-1 space-y-2">
                          {step.invocations.map((invocation, invIndex) => (
                            <li key={invocation.toolCallId || invIndex} className="text-xs p-2 bg-muted/50 rounded-md shadow-sm">
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="font-medium text-primary">{invocation.toolName || 'N/A'}</span>
                                <Badge variant={invocation.state === 'result' ? 'default' : 'secondary'} className="capitalize text-xs">
                                  {invocation.state}
                                </Badge>
                              </div>
                              {invocation.args && Object.keys(invocation.args).length > 0 && (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-xs">Arguments</summary>
                                  <pre className="text-xs whitespace-pre-wrap bg-background p-1.5 rounded-sm mt-0.5 border">
                                    {JSON.stringify(invocation.args, null, 2)}
                                  </pre>
                                </details>
                              )}
                              {invocation.state === 'result' && typeof invocation.result !== 'undefined' && (
                                <details className="mt-1" open>
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-xs">Result</summary>
                                  <pre className="text-xs whitespace-pre-wrap bg-background p-1.5 rounded-sm mt-0.5 border">
                                    {JSON.stringify(invocation.result, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
