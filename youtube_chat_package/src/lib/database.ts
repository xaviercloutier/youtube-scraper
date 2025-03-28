import { D1Database } from '@cloudflare/workers-types';

export interface DatabaseClient {
  db: D1Database;
}

export interface Channel {
  channel_id: string;
  channel_name: string;
  channel_url: string;
  subscriber_count?: number;
  video_count?: number;
  description?: string;
  thumbnail_url?: string;
  last_scraped?: string;
}

export interface Video {
  video_id: string;
  channel_id: string;
  title: string;
  url: string;
  upload_date?: string;
  duration?: number;
  view_count?: number;
  like_count?: number;
  description?: string;
  thumbnail_url?: string;
  tags?: string;
}

export interface Transcript {
  transcript_id?: number;
  video_id: string;
  language?: string;
  content: string;
}

export interface Comment {
  comment_id?: number;
  video_id: string;
  author?: string;
  content: string;
  like_count?: number;
  date_posted?: string;
}

export interface SearchLog {
  id?: number;
  query: string;
  user_ip?: string;
  timestamp?: string;
}

export interface Counter {
  id?: number;
  name: string;
  value: number;
  created_at?: string;
}

export interface AccessLog {
  id?: number;
  ip?: string;
  path?: string;
  accessed_at?: string;
}

export class YouTubeDatabase {
  private client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  // Channel operations
  async getChannel(channelId: string): Promise<Channel | null> {
    const { results } = await this.client.db
      .prepare('SELECT * FROM channels WHERE channel_id = ?')
      .bind(channelId)
      .all();
    
    return results.length > 0 ? (results[0] as Channel) : null;
  }

  async listChannels(limit = 20, offset = 0): Promise<Channel[]> {
    const { results } = await this.client.db
      .prepare('SELECT * FROM channels ORDER BY last_scraped DESC LIMIT ? OFFSET ?')
      .bind(limit, offset)
      .all();
    
    return results as Channel[];
  }

  async storeChannel(channel: Channel): Promise<void> {
    const existingChannel = await this.getChannel(channel.channel_id);
    
    if (existingChannel) {
      await this.client.db
        .prepare(`
          UPDATE channels SET
            channel_name = ?,
            channel_url = ?,
            subscriber_count = ?,
            video_count = ?,
            description = ?,
            thumbnail_url = ?,
            last_scraped = CURRENT_TIMESTAMP
          WHERE channel_id = ?
        `)
        .bind(
          channel.channel_name,
          channel.channel_url,
          channel.subscriber_count || 0,
          channel.video_count || 0,
          channel.description || '',
          channel.thumbnail_url || '',
          channel.channel_id
        )
        .run();
    } else {
      await this.client.db
        .prepare(`
          INSERT INTO channels (
            channel_id,
            channel_name,
            channel_url,
            subscriber_count,
            video_count,
            description,
            thumbnail_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          channel.channel_id,
          channel.channel_name,
          channel.channel_url,
          channel.subscriber_count || 0,
          channel.video_count || 0,
          channel.description || '',
          channel.thumbnail_url || ''
        )
        .run();
    }
  }

  // Video operations
  async getVideo(videoId: string): Promise<Video | null> {
    const { results } = await this.client.db
      .prepare('SELECT * FROM videos WHERE video_id = ?')
      .bind(videoId)
      .all();
    
    return results.length > 0 ? (results[0] as Video) : null;
  }

  async listVideos(channelId?: string, limit = 20, offset = 0): Promise<Video[]> {
    let query = 'SELECT * FROM videos';
    let params: any[] = [];
    
    if (channelId) {
      query += ' WHERE channel_id = ?';
      params.push(channelId);
    }
    
    query += ' ORDER BY upload_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const { results } = await this.client.db
      .prepare(query)
      .bind(...params)
      .all();
    
    return results as Video[];
  }

  async storeVideo(video: Video): Promise<void> {
    const existingVideo = await this.getVideo(video.video_id);
    
    if (existingVideo) {
      await this.client.db
        .prepare(`
          UPDATE videos SET
            channel_id = ?,
            title = ?,
            url = ?,
            upload_date = ?,
            duration = ?,
            view_count = ?,
            like_count = ?,
            description = ?,
            thumbnail_url = ?,
            tags = ?
          WHERE video_id = ?
        `)
        .bind(
          video.channel_id,
          video.title,
          video.url,
          video.upload_date || null,
          video.duration || 0,
          video.view_count || 0,
          video.like_count || 0,
          video.description || '',
          video.thumbnail_url || '',
          video.tags || '',
          video.video_id
        )
        .run();
    } else {
      await this.client.db
        .prepare(`
          INSERT INTO videos (
            video_id,
            channel_id,
            title,
            url,
            upload_date,
            duration,
            view_count,
            like_count,
            description,
            thumbnail_url,
            tags
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          video.video_id,
          video.channel_id,
          video.title,
          video.url,
          video.upload_date || null,
          video.duration || 0,
          video.view_count || 0,
          video.like_count || 0,
          video.description || '',
          video.thumbnail_url || '',
          video.tags || ''
        )
        .run();
    }
  }

  // Transcript operations
  async getTranscript(videoId: string): Promise<Transcript | null> {
    const { results } = await this.client.db
      .prepare('SELECT * FROM transcripts WHERE video_id = ?')
      .bind(videoId)
      .all();
    
    return results.length > 0 ? (results[0] as Transcript) : null;
  }

  async storeTranscript(transcript: Transcript): Promise<void> {
    const existingTranscript = await this.getTranscript(transcript.video_id);
    
    if (existingTranscript) {
      await this.client.db
        .prepare(`
          UPDATE transcripts SET
            language = ?,
            content = ?
          WHERE video_id = ?
        `)
        .bind(
          transcript.language || null,
          transcript.content,
          transcript.video_id
        )
        .run();
    } else {
      await this.client.db
        .prepare(`
          INSERT INTO transcripts (
            video_id,
            language,
            content
          ) VALUES (?, ?, ?)
        `)
        .bind(
          transcript.video_id,
          transcript.language || null,
          transcript.content
        )
        .run();
    }
  }

  // Comment operations
  async getComments(videoId: string, limit = 20, offset = 0): Promise<Comment[]> {
    const { results } = await this.client.db
      .prepare('SELECT * FROM comments WHERE video_id = ? ORDER BY like_count DESC LIMIT ? OFFSET ?')
      .bind(videoId, limit, offset)
      .all();
    
    return results as Comment[];
  }

  async storeComment(comment: Comment): Promise<void> {
    await this.client.db
      .prepare(`
        INSERT INTO comments (
          video_id,
          author,
          content,
          like_count,
          date_posted
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        comment.video_id,
        comment.author || '',
        comment.content,
        comment.like_count || 0,
        comment.date_posted || null
      )
      .run();
  }

  // Search operations
  async searchVideos(query: string, limit = 20, offset = 0): Promise<Video[]> {
    const { results } = await this.client.db
      .prepare(`
        SELECT videos.* FROM video_search
        JOIN videos ON video_search.rowid = videos.rowid
        WHERE video_search MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `)
      .bind(query, limit, offset)
      .all();
    
    return results as Video[];
  }

  async searchTranscripts(query: string, limit = 20, offset = 0): Promise<any[]> {
    const { results } = await this.client.db
      .prepare(`
        SELECT videos.*, transcripts.content, transcripts.language,
               snippet(transcript_search, 0, '<b>', '</b>', '...', 15) as snippet
        FROM transcript_search
        JOIN transcripts ON transcript_search.rowid = transcripts.transcript_id
        JOIN videos ON transcripts.video_id = videos.video_id
        WHERE transcript_search MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `)
      .bind(query, limit, offset)
      .all();
    
    return results;
  }

  // Log operations
  async logSearch(query: string, userIp?: string): Promise<void> {
    await this.client.db
      .prepare('INSERT INTO search_logs (query, user_ip) VALUES (?, ?)')
      .bind(query, userIp || null)
      .run();
  }

  async logAccess(path: string, userIp?: string): Promise<void> {
    await this.client.db
      .prepare('INSERT INTO access_logs (path, ip) VALUES (?, ?)')
      .bind(path, userIp || null)
      .run();
  }

  // Counter operations
  async incrementCounter(name: string, amount = 1): Promise<number> {
    const result = await this.client.db
      .prepare(`
        UPDATE counters SET value = value + ?
        WHERE name = ?
        RETURNING value
      `)
      .bind(amount, name)
      .first<{ value: number }>();
    
    return result?.value || 0;
  }

  async getCounter(name: string): Promise<number> {
    const result = await this.client.db
      .prepare('SELECT value FROM counters WHERE name = ?')
      .bind(name)
      .first<{ value: number }>();
    
    return result?.value || 0;
  }

  // Analytics operations
  async getChannelStats(channelId: string): Promise<any> {
    const videoCount = await this.client.db
      .prepare('SELECT COUNT(*) as count FROM videos WHERE channel_id = ?')
      .bind(channelId)
      .first<{ count: number }>();
    
    const viewCount = await this.client.db
      .prepare('SELECT SUM(view_count) as total FROM videos WHERE channel_id = ?')
      .bind(channelId)
      .first<{ total: number }>();
    
    const likeCount = await this.client.db
      .prepare('SELECT SUM(like_count) as total FROM videos WHERE channel_id = ?')
      .bind(channelId)
      .first<{ total: number }>();
    
    const avgViews = await this.client.db
      .prepare('SELECT AVG(view_count) as average FROM videos WHERE channel_id = ?')
      .bind(channelId)
      .first<{ average: number }>();
    
    const avgLikes = await this.client.db
      .prepare('SELECT AVG(like_count) as average FROM videos WHERE channel_id = ?')
      .bind(channelId)
      .first<{ average: number }>();
    
    const topVideos = await this.client.db
      .prepare(`
        SELECT * FROM videos 
        WHERE channel_id = ? 
        ORDER BY view_count DESC 
        LIMIT 5
      `)
      .bind(channelId)
      .all();
    
    return {
      videoCount: videoCount?.count || 0,
      viewCount: viewCount?.total || 0,
      likeCount: likeCount?.total || 0,
      avgViews: avgViews?.average || 0,
      avgLikes: avgLikes?.average || 0,
      topVideos: topVideos.results
    };
  }
}
