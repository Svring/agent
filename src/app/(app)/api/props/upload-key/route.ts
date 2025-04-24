import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    // Get file buffer and name
    // @ts-ignore
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // @ts-ignore
    const originalName = file.name || 'private_key';
    const safeName = originalName.startsWith('private_key') ? originalName : `private_key_${originalName}`;
    const savePath = path.join(process.cwd(), 'src', 'auth', 'props', safeName);

    // Save file
    fs.writeFileSync(savePath, buffer);

    return NextResponse.json({
      message: 'File uploaded successfully',
      path: savePath
    }, { status: 200 });
  } catch (error) {
    console.error('Failed to upload private key:', error);
    return NextResponse.json({ message: 'Failed to upload private key' }, { status: 500 });
  }
} 