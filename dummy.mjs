// Script to download an image, convert to base64, and send a POST request to AI proxy for image description

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

async function describeImage() {
    const imageUrl = 'https://img.picui.cn/free/2025/04/23/68089a172ce08.png';
    const url = 'https://aiproxy.usw.sealos.io/v1/messages';
    const headers = {
        'Authorization': 'Bearer sk-Yx2FiiiPuF9QS4CivU4Wqfr6SdtYaBgOJSeba9NqqRLEYicU',
        'Content-Type': 'application/json'
    };

    // Download the image
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');
    console.log('Base64 Image Data:', base64Image);

    const body = JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        messages: [{
            role: 'user',
            content: [{
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: base64Image
                }
            }, {
                type: 'text',
                text: 'Describe this image.'
            }]
        }]
    });

    try {
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body
        });
        const data = await apiResponse.json();
        console.log('Response:', data);
    } catch (error) {
        console.error('Error:', error);
    }
}

describeImage(); 