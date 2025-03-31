import { NextResponse } from 'next/server';
import { deleteEmbedding } from '@/db/actions/Embeddings';

/**
 * API handler for embedding deletion
 * 
 * @param request - The incoming request object
 * @returns A NextResponse with appropriate status and message
 */
export async function DELETE(request: Request) {
  // Extract ID from the URL parameters
  const url = new URL(request.url);
  const idParam = url.searchParams.get('id');
  
  // Validate the ID parameter
  if (!idParam) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Missing embedding ID',
        error: 'The embedding ID is required as a query parameter'
      }, 
      { status: 400 }
    );
  }
  
  // Parse the ID to a number
  const embeddingId = parseInt(idParam, 10);
  if (isNaN(embeddingId)) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Invalid ID format',
        error: 'The embedding ID must be a valid number'
      }, 
      { status: 400 }
    );
  }
  
  try {
    // Attempt to delete the embedding
    const isDeleted = await deleteEmbedding(embeddingId);
    
    if (isDeleted) {
      return NextResponse.json(
        { 
          success: true, 
          message: 'Embedding deleted successfully',
          data: { id: embeddingId }
        }, 
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Deletion failed',
          error: 'The embedding could not be deleted or does not exist'
        }, 
        { status: 404 }
      );
    }
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Embedding deletion error (ID: ${embeddingId}):`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Server error',
        error: errorMessage
      }, 
      { status: 500 }
    );
  }
}
