import { NextRequest, NextResponse } from 'next/server';
import { YouTubeScraper } from '@/lib/youtube-scraper';
import { YouTubeDatabase } from '@/lib/database';
import { VectorDatabase } from '@/lib/vector-database';
import { ConversationalAI } from '@/lib/conversational-ai';

// Initialize database client
const dbClient = { db: process.env.DB };

// Initialize YouTube scraper
const scraper = new YouTubeScraper();

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
    const { channelUrl } = await request.json();

    if (!channelUrl) {
      return NextResponse.json(
        { error: 'Channel URL is required' },
        { status: 400 }
      );
    }

    // Extract channel ID
    const channelId = scraper.extractChannelId(channelUrl);
    if (!channelId) {
      return NextResponse.json(
        { error: 'Invalid YouTube channel URL' },
        { status: 400 }
      );
    }

    // Initialize database
    const db = new YouTubeDatabase(dbClient);

    // Check if channel already exists
    const existingChannel = await db.getChannel(channelId);
    
    if (existingChannel) {
      // Channel already processed, return existing data
      const videos = await db.listVideos(channelId, 100, 0);
      
      return NextResponse.json({
        channelId,
        channelName: existingChannel.channel_name,
        videoCount: videos.length,
        message: 'Channel already processed',
      });
    }

    // Scrape channel and videos
    const { channel, videos } = await scraper.scrapeChannelWithVideos(channelUrl, 20);

    // Store channel in database
    await db.storeChannel({
      channel_id: channel.channelId,
      channel_name: channel.channelName,
      channel_url: channel.channelUrl,
      subscriber_count: channel.subscriberCount,
      video_count: channel.videoCount,
      description: channel.description,
      thumbnail_url: channel.thumbnailUrl,
    });

    // Process each video
    for (const video of videos) {
      // Store video in database
      await db.storeVideo({
        video_id: video.videoId,
        channel_id: channel.channelId,
        title: video.title,
        url: video.url,
        upload_date: video.uploadDate,
        duration: video.duration,
        view_count: video.viewCount,
        like_count: video.likeCount,
        description: video.description,
        thumbnail_url: video.thumbnailUrl,
        tags: video.tags?.join(', '),
      });

      // Fetch transcript
      const transcript = await scraper.fetchTranscript(video.videoId);
      
      if (transcript) {
        // Store transcript in database
        await db.storeTranscript({
          video_id: video.videoId,
          language: transcript.language,
          content: transcript.segments.map(s => `[${s.start}s] ${s.text}`).join('\n'),
        });

        // Process for vector database
        await vectorDb.processVideoContent(
          video.videoId,
          channel.channelId,
          video.title,
          transcript.segments.map(s => `[${s.start}s] ${s.text}`).join('\n'),
          video.description || '',
          {
            channelName: channel.channelName,
            url: video.url,
            viewCount: video.viewCount,
            uploadDate: video.uploadDate,
          }
        );
      }
    }

    return NextResponse.json({
      channelId,
      channelName: channel.channelName,
      videoCount: videos.length,
      message: 'Channel processed successfully',
    });
  } catch (error) {
    console.error('Error processing channel:', error);
    return NextResponse.json(
      { error: 'Failed to process channel' },
      { status: 500 }
    );
  }
}
