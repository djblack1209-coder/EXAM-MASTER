import cloud from '@lafjs/cloud';

interface FunctionContext {
  body: any;
  query: any;
  headers: any;
  method: string;
}

export default async function (ctx: FunctionContext) {
  const { body } = ctx;
  const { imageUrl, imageBase64 } = body;

  if (!imageUrl && !imageBase64) {
    return {
      code: 400,
      msg: 'Missing imageUrl or imageBase64 in request body'
    };
  }

  // Retrieve Zhipu API Key from environment variables
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return {
      code: 500,
      msg: 'ZHIPU_API_KEY environment variable is not set'
    };
  }

  // Construct the image content object based on OpenAI vision API format
  let imageContent;
  if (imageBase64) {
    // Ensure base64 string has the correct data URI prefix if it doesn't already
    const base64Data = imageBase64.startsWith('data:image') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    imageContent = {
      type: 'image_url',
      image_url: {
        url: base64Data
      }
    };
  } else {
    imageContent = {
      type: 'image_url',
      image_url: {
        url: imageUrl
      }
    };
  }

  const prompt = `Please extract all text from this image. 
Specifically format all math equations in LaTeX. 
Keep the original layout structure as much as possible. 
Return only the extracted markdown text.`;

  // We can use cloud for logging or other laf-specific features if needed
  // For now, it's just here as standard import
  const db = cloud.database();

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4v',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              imageContent
            ]
          }
        ],
        temperature: 0.1, // Low temperature for more deterministic OCR results
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Zhipu API Error:', errorData);
      return {
        code: response.status,
        msg: 'Failed to call OCR API',
        error: errorData
      };
    }

    const data: any = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || '';

    // Record usage log
    try {
      await db.collection('api_logs').add({
        api: 'api-ocr-glm',
        createdAt: new Date(),
        status: 'success'
      });
    } catch (dbError) {
      console.error('Failed to write log', dbError);
    }

    return {
      code: 0,
      data: {
        markdown: extractedText
      },
      msg: 'Success'
    };
  } catch (error: any) {
    console.error('OCR Request Exception:', error);
    return {
      code: 500,
      msg: 'Internal Server Error during OCR processing',
      error: error.message
    };
  }
}
