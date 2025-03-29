import { NextResponse } from 'next/server';
import * as toml from '@iarna/toml';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
    try {
        // Read the TOML file from the resources directory
        const configPath = path.join(process.cwd(), 'src', 'config', 'providerConfig.toml');
        const fileContent = await fs.readFile(configPath, 'utf-8');
        
        // Parse the TOML content
        const config = toml.parse(fileContent);
        
        return NextResponse.json(config);
    } catch (error) {
        console.error('Failed to load provider configuration:', error);
        return NextResponse.json(
            { error: 'Failed to load provider configuration' },
            { status: 500 }
        );
    }
} 