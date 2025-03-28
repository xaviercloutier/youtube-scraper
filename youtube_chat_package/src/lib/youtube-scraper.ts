import { load } from 'cheerio';

export interface ChannelInfo {
  channelId: string;
  channelName: string;
  channelUrl: string;
  subscriberCount?: number;
  videoCount?: number;
  description?: string;
  thumbnailUrl?: string;
}

export interface VideoInfo {
  videoId: string;
  title: string;
  url: string;
  channelId: string;
  uploadDate?: string;
  duration?: number;
  viewCount?: number;
  likeCount?: number;
  description?: string;
  thumbnailUrl?: string;
  tags?: string[];
}

export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

export interface TranscriptInfo {
  videoId: string;
  language?: string;
  segments: TranscriptSegment[];
}

export interface CommentInfo {
  videoId: string;
  author?: string;
  content: string;
  likeCount?: number;
  datePosted?: string;
}

export class YouTubeScraper {
  private readonly API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
  private readonly YOUTUBE_BASE_URL = 'https://www.youtube.com';
  
  /**
   * Extract channel ID from a YouTube channel URL
   */
  extractChannelId(channelUrl: string): string | null {
    // Handle different URL formats
    const patterns = [
      /youtube\.com\/@([^\/\?]+)/,      // @username format
      /youtube\.com\/channel\/([^\/\?]+)/, // channel ID format
      /youtube\.com\/c\/([^\/\?]+)/,     // custom URL format
      /youtube\.com\/user\/([^\/\?]+)/   // legacy username format
    ];
    
    for (const pattern of patterns) {
      const match = channelUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }
  
  /**
   * Extract video ID from a YouTube video URL
   */
  extractVideoId(videoUrl: string): string | null {
    const patterns = [
      /youtube\.com\/watch\?v=([^&]+)/,  // Standard watch URL
      /youtu\.be\/([^\/\?]+)/,           // Short URL
      /youtube\.com\/embed\/([^\/\?]+)/  // Embed URL
    ];
    
    for (const pattern of patterns) {
      const match = videoUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }
  
  /**
   * Scrape channel information from a YouTube channel URL
   */
  async scrapeChannel(channelUrl: string): Promise<ChannelInfo> {
    try {
      // Make request to channel page
      const response = await fetch(channelUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch channel: ${response.status}`);
      }
      
      const html = await response.text();
      const $ = load(html);
      
      // Extract channel ID
      const channelId = this.extractChannelId(channelUrl) || '';
      
      // Extract channel name
      const channelName = $('meta[property="og:title"]').attr('content') || 
                         $('title').text().replace(' - YouTube', '') || 
                         channelId;
      
      // Extract subscriber count (this is approximate as it's displayed as text)
      let subscriberCount = 0;
      const subscriberText = $('#subscriber-count').text();
      if (subscriberText) {
        // Parse text like "1.2M subscribers"
        const match = subscriberText.match(/([0-9.]+)([KMB])?/i);
        if (match) {
          let count = parseFloat(match[1]);
          const unit = match[2]?.toUpperCase();
          
          if (unit === 'K') count *= 1000;
          else if (unit === 'M') count *= 1000000;
          else if (unit === 'B') count *= 1000000000;
          
          subscriberCount = Math.round(count);
        }
      }
      
      // Extract video count
      let videoCount = 0;
      const videoCountText = $('a[href$="/videos"] yt-formatted-string').text();
      if (videoCountText) {
        const match = videoCountText.match(/([0-9,]+)/);
        if (match) {
          videoCount = parseInt(match[1].replace(/,/g, ''));
        }
      }
      
      // Extract description
      const description = $('meta[property="og:description"]').attr('content') || '';
      
      // Extract thumbnail URL
      const thumbnailUrl = $('meta[property="og:image"]').attr('content') || '';
      
      return {
        channelId,
        channelName,
        channelUrl,
        subscriberCount,
        videoCount,
        description,
        thumbnailUrl
      };
    } catch (error) {
      console.error('Error scraping channel:', error);
      throw new Error(`Failed to scrape channel: ${error.message}`);
    }
  }
  
  /**
   * Scrape video links from a YouTube channel
   */
  async scrapeVideoLinks(channelUrl: string, maxVideos: number = 50): Promise<string[]> {
    try {
      // Navigate to videos tab
      const videosUrl = `${channelUrl}/videos`;
      const response = await fetch(videosUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch videos page: ${response.status}`);
      }
      
      const html = await response.text();
      const $ = load(html);
      
      // Extract video links
      const videoLinks: string[] = [];
      
      // Find video elements and extract links
      $('a#video-title-link, a#video-title').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('/watch?v=')) {
          const fullUrl = href.startsWith('http') ? href : `https://www.youtube.com${href}`;
          videoLinks.push(fullUrl);
          
          if (videoLinks.length >= maxVideos) {
            return false; // Break the loop
          }
        }
      });
      
      return videoLinks;
    } catch (error) {
      console.error('Error scraping video links:', error);
      throw new Error(`Failed to scrape video links: ${error.message}`);
    }
  }
  
  /**
   * Scrape video information from a YouTube video URL
   */
  async scrapeVideo(videoUrl: string): Promise<VideoInfo> {
    try {
      // Make request to video page
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }
      
      const html = await response.text();
      const $ = load(html);
      
      // Extract video ID
      const videoId = this.extractVideoId(videoUrl) || '';
      
      // Extract title
      const title = $('meta[property="og:title"]').attr('content') || 
                   $('title').text().replace(' - YouTube', '') || 
                   videoId;
      
      // Extract channel ID and name
      const channelUrl = $('link[itemprop="name"][href]').attr('href') || '';
      const channelId = this.extractChannelId(channelUrl) || '';
      
      // Extract upload date
      let uploadDate: string | undefined;
      const dateText = $('meta[itemprop="datePublished"]').attr('content');
      if (dateText) {
        uploadDate = dateText;
      }
      
      // Extract duration
      let duration = 0;
      const durationText = $('meta[itemprop="duration"]').attr('content');
      if (durationText) {
        // Parse ISO 8601 duration format (PT1H2M3S)
        const match = durationText.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (match) {
          const hours = parseInt(match[1] || '0');
          const minutes = parseInt(match[2] || '0');
          const seconds = parseInt(match[3] || '0');
          duration = hours * 3600 + minutes * 60 + seconds;
        }
      }
      
      // Extract view count
      let viewCount = 0;
      const viewCountText = $('meta[itemprop="interactionCount"]').attr('content');
      if (viewCountText) {
        viewCount = parseInt(viewCountText);
      }
      
      // Extract like count (this is harder to get reliably)
      let likeCount = 0;
      // YouTube often uses JavaScript to populate like counts, so this might not work reliably
      
      // Extract description
      const description = $('meta[property="og:description"]').attr('content') || '';
      
      // Extract thumbnail URL
      const thumbnailUrl = $('meta[property="og:image"]').attr('content') || 
                          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      
      // Extract tags
      const tags: string[] = [];
      $('meta[property="og:video:tag"]').each((_, element) => {
        const tag = $(element).attr('content');
        if (tag) {
          tags.push(tag);
        }
      });
      
      return {
        videoId,
        title,
        url: videoUrl,
        channelId,
        uploadDate,
        duration,
        viewCount,
        likeCount,
        description,
        thumbnailUrl,
        tags
      };
    } catch (error) {
      console.error('Error scraping video:', error);
      throw new Error(`Failed to scrape video: ${error.message}`);
    }
  }
  
  /**
   * Attempt to fetch video transcript
   * Note: This is challenging without using the YouTube API or specialized libraries
   */
  async fetchTranscript(videoId: string): Promise<TranscriptInfo | null> {
    try {
      // This is a simplified approach - in a real implementation, you would need
      // to use a specialized library or the YouTube API to get transcripts reliably
      
      // For demonstration purposes, we'll return a mock transcript
      // In a real implementation, you would need to handle this differently
      
      return {
        videoId,
        language: 'en',
        segments: [
          { start: 0, duration: 5, text: "This is a placeholder transcript." },
          { start: 5, duration: 5, text: "In a real implementation, you would need to use the YouTube API or a specialized library." }
        ]
      };
    } catch (error) {
      console.error('Error fetching transcript:', error);
      return null;
    }
  }
  
  /**
   * Process a batch of videos from a channel
   */
  async processVideoBatch(videoUrls: string[]): Promise<VideoInfo[]> {
    const results: VideoInfo[] = [];
    
    for (const url of videoUrls) {
      try {
        const videoInfo = await this.scrapeVideo(url);
        results.push(videoInfo);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error processing video ${url}:`, error);
        // Continue with next video
      }
    }
    
    return results;
  }
  
  /**
   * Scrape a channel and its videos
   */
  async scrapeChannelWithVideos(channelUrl: string, maxVideos: number = 50): Promise<{
    channel: ChannelInfo;
    videos: VideoInfo[];
  }> {
    // Scrape channel info
    const channelInfo = await this.scrapeChannel(channelUrl);
    
    // Scrape video links
    const videoLinks = await this.scrapeVideoLinks(channelUrl, maxVideos);
    
    // Process videos in batches to avoid overwhelming the server
    const batchSize = 5;
    const videos: VideoInfo[] = [];
    
    for (let i = 0; i < videoLinks.length; i += batchSize) {
      const batch = videoLinks.slice(i, i + batchSize);
      const batchResults = await this.processVideoBatch(batch);
      videos.push(...batchResults);
    }
    
    return {
      channel: channelInfo,
      videos
    };
  }
}
