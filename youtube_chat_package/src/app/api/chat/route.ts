import { NextRequest, NextResponse } from 'next/server';
import { YouTubeDatabase } from '@/lib/database';
import { VectorDatabase } from '@/lib/vector-database';
import { ConversationalAI } from '@/lib/conversational-ai';

// Initialize database client
const dbClient = { db: process.env.DB };

// Initialize vector database
const vectorDb = new VectorDatabase({
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  tableName: 'youtube_embeddings',
});

// Initialize conversational AI
const conversationalAI = new ConversationalAI({
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  vectorDb,
  modelName: 'gpt-4',
  temperature: 0.7,
});

export async function POST(request: NextRequest) {
  try {
    const { message, channelId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Initialize database
    const db = new YouTubeDatabase(dbClient);

    // Log the chat request
    await db.logAccess('/api/chat', request.headers.get('x-forwarded-for') || '');

    // Process the message
    const result = await conversationalAI.processMessage(message);

    // Enhance response with additional video information if needed
    if (result.sources && result.sources.length > 0) {
      for (const source of result.sources) {
        if (source.videoId) {
          // Get more details about the video if needed
          const videoDetails = await db.getVideo(source.videoId);
          if (videoDetails) {
            // Add any additional information you want to include
            source.url = videoDetails.url;
            
            // Format timestamp if available
            if (source.timestamp) {
              const timestampMatch = source.timestamp.match(/\[(\d+(?:\.\d+)?)s\]/);
              if (timestampMatch) {
                const seconds = parseFloat(timestampMatch[1]);
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = Math.floor(seconds % 60);
                source.timestamp = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
                
                // Add timestamp to URL if not already there
                if (!source.url.includes('&t=')) {
                  source.url += `&t=${Math.floor(seconds)}`;
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      response: result.response,
      sources: result.sources,
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process message',
        response: 'I encountered an error while processing your message. Please try again.',
        sources: []
      },
      { status: 500 }
    );
  }
}
