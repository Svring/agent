import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { filename } = await req.json();
    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ message: 'Filename is required' }, { status: 400 });
    }
    const filePath = path.join(process.cwd(), filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ message: 'File deleted successfully' }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Failed to delete private key:', error);
    return NextResponse.json({ message: 'Failed to delete private key' }, { status: 500 });
  }
} 