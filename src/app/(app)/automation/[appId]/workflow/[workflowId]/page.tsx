'use client';

// NOTE: The parent component is linking to /automation/{appId}/workflows/{id}
// but this component is in /automation/[appId]/workflow/[workflowId]
// There is a mismatch between singular "workflow" and plural "workflows"
// This component will work, but the URL routing needs to be consistent

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Loader2, 
  Plus, 
  Edit, 
  Trash2, 
  MoveUp, 
  MoveDown, 
  Save, 
  X, 
  MousePointer, 
  MousePointerClick,
  Type, 
  Keyboard,
  Image
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getWorkflowById, updateWorkflow, deleteWorkflow } from '@/db/actions/Workflows';
import type { Workflow, WorkflowStep } from '@/tools/general/workflow-use/workflow-use-type';

// Define a simple Badge component since it doesn't exist in the project
const Badge = ({ 
  children, 
  variant = 'default'
}: { 
  children: React.ReactNode; 
  variant?: 'default' | 'outline' | 'secondary' | 'destructive'; 
}) => {
  const baseClasses = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
  const variantClasses = {
    default: "bg-primary text-primary-foreground",
    outline: "border border-muted-foreground/30 text-muted-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive text-destructive-foreground"
  };
  
  return (
    <span className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </span>
  );
};

// UI Components
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
);

const ErrorDisplay = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
    <p className="text-destructive">{message}</p>
  </div>
);

// Helper function to get icon for an action
const getActionIcon = (action: string) => {
  switch (action) {
    case 'screenshot':
      return <Image className="h-4 w-4" />;
    case 'left_click':
    case 'right_click':
    case 'middle_click':
    case 'double_click':
      return <MousePointerClick className="h-4 w-4" />;
    case 'left_click_drag':
    case 'mouse_move':
    case 'cursor_position':
      return <MousePointer className="h-4 w-4" />;
    case 'type':
      return <Type className="h-4 w-4" />;
    case 'key':
      return <Keyboard className="h-4 w-4" />;
    default:
      return <MousePointerClick className="h-4 w-4" />;
  }
};

// Helper function to get display name for an action
const getActionDisplayName = (action: string) => {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function WorkflowPage() {
  const { appId, workflowId } = useParams<{ appId: string; workflowId: string }>();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchWorkflow = async () => {
      if (!workflowId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const workflow = await getWorkflowById(workflowId);
        if (!workflow) {
          setError('Workflow not found');
          return;
        }
        setWorkflow(workflow);
      } catch (err) {
        console.error('Error fetching workflow:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWorkflow();
  }, [workflowId]);

  // Handler for deleting the workflow
  const handleDeleteWorkflow = async () => {
    if (!workflow || !confirm('Are you sure you want to delete this workflow?')) return;
    
    try {
      const success = await deleteWorkflow(workflow.id.toString());
      if (success) {
        router.push(`/automation/${appId}`);
      } else {
        setError('Failed to delete workflow');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay message={error} />;
  if (!workflow) return <ErrorDisplay message="Workflow not found" />;

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      {/* Header with back button and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/automation/${appId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{workflow.name}</h1>
          {workflow.description && (
            <p className="text-sm text-muted-foreground ml-2">
              {workflow.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDeleteWorkflow}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Workflow info card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Workflow Details</CardTitle>
              <CardDescription>
                Created: {new Date(workflow.createdAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <Badge variant="outline">
              Steps: {workflow.steps.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {workflow.sequenceDescription && (
            <div className="mb-4 p-3 bg-muted rounded-md">
              <h3 className="text-sm font-medium mb-1">Sequence Description</h3>
              <p className="text-sm text-muted-foreground">{workflow.sequenceDescription}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Steps list */}
      <h2 className="text-xl font-semibold mt-6 mb-2">Workflow Steps</h2>
      {workflow.steps.length > 0 ? (
        <div className="space-y-3">
          {workflow.steps.map((step, index) => (
            <Card key={step.id || index} className="border-l-4 border-l-primary">
              <CardHeader className="px-4 py-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      {getActionIcon(step.action)}
                    </div>
                    <div>
                      <div className="font-medium">{getActionDisplayName(step.action)}</div>
                      <div className="text-sm text-muted-foreground">{step.description}</div>
                    </div>
                  </div>
                  <Badge variant="outline">{index + 1}</Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 py-2 text-sm">
                {/* Step details based on action type */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {step.coordinates && (
                    <div>
                      <span className="text-muted-foreground">Coordinates: </span>
                      <span>x: {step.coordinates.x}, y: {step.coordinates.y}</span>
                    </div>
                  )}
                  {step.endCoordinates && (
                    <div>
                      <span className="text-muted-foreground">End Coordinates: </span>
                      <span>x: {step.endCoordinates.x}, y: {step.endCoordinates.y}</span>
                    </div>
                  )}
                  {step.text && (
                    <div>
                      <span className="text-muted-foreground">Text: </span>
                      <span>"{step.text}"</span>
                    </div>
                  )}
                  {step.delay && step.delay > 0 && (
                    <div>
                      <span className="text-muted-foreground">Delay: </span>
                      <span>{step.delay}ms</span>
                    </div>
                  )}
                  {step.condition && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Condition: </span>
                      <span>{step.condition}</span>
                    </div>
                  )}
                  {step.onError && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">On Error: </span>
                      <span>{step.onError}</span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="px-4 py-2 flex justify-end gap-2 border-t">
                <Button variant="ghost" size="sm">
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0}
                  >
                    <MoveUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === workflow.steps.length - 1}
                  >
                    <MoveDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center border rounded-lg">
          <p className="text-muted-foreground">No steps in this workflow</p>
        </div>
      )}

      <div className="py-4 flex justify-center">
        <Button className="w-full max-w-xs">
          <Plus className="h-4 w-4 mr-2" />
          Add Step
        </Button>
      </div>
    </div>
  );
}