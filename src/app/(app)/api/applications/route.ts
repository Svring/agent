import { NextResponse } from 'next/server';
import { listApplications, createApplication, getApplicationDetails } from '@/db/actions/Applications';
import type { Application } from '@/payload-types'; // Adjust path as necessary

/**
 * GET handler to list all applications or get specific application details.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');

    if (appId) {
      const details = await getApplicationDetails(appId);
      if (!details) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      }
      return NextResponse.json(details);
    }

    const applications = await listApplications();
    return NextResponse.json(applications);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

/**
 * POST handler to create a new application.
 * Expects { name: string, description: string, version?: string } in the request body.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, version } = body;

    if (!name || !description) {
      return NextResponse.json({ error: 'Application name and description are required' }, { status: 400 });
    }

    const newApplicationData: { name: string; description: string; version?: string } = {
      name,
      description,
      version, // Include version if provided
    };

    const newApplication = await createApplication(newApplicationData);

    if (!newApplication) {
      // Use the error logged in createApplication for specifics
      return NextResponse.json({ error: 'Failed to create application' }, { status: 500 });
    }

    return NextResponse.json(newApplication, { status: 201 }); // 201 Created status
  } catch (error) {
    console.error('API Error creating application:', error);
    // Handle potential JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    // Handle errors thrown from createApplication (like missing fields)
    if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error during application creation' }, { status: 500 });
  }
} 