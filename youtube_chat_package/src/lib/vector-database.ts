import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { SupabaseVectorStore } from 'langchain/vectorstores/supabase';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export interface VectorDBConfig {
  supabaseUrl: string;
  supabaseKey: string;
  openaiApiKey: string;
  tableName: string;
}

export interface VideoChunk {
  videoId: string;
  channelId: string;
  title: string;
  content: string;
  metadata: {
    videoTitle: string;
    channelName: string;
    url: string;
    timestamp?: string;
    viewCount?: number;
    uploadDate?: string;
    source: 'transcript' | 'description' | 'title' | 'comments';
  };
}

export class VectorDatabase {
  private config: VectorDBConfig;
  private supabaseClient;
  private embeddings;
  private vectorStore: SupabaseVectorStore | null = null;
  
  constructor(config: VectorDBConfig) {
    this.config = config;
    this.supabaseClient = createClient(config.supabaseUrl, config.supabaseKey);
    this.embeddings = new OpenAIEmbeddings({ openAIApiKey: config.openaiApiKey });
  }
  
  /**
   * Initialize the vector store
   */
  async initialize(): Promise<void> {
    this.vectorStore = await SupabaseVectorStore.fromExistingIndex(
      this.embeddings,
      {
        client: this.supabaseClient,
        tableName: this.config.tableName,
        queryName: 'match_documents',
      }
    );
  }
  
  /**
   * Process video transcript and metadata for vector storage
   */
  async processVideoContent(
    videoId: string,
    channelId: string,
    title: string,
    transcript: string,
    description: string,
    metadata: {
      channelName: string;
      url: string;
      viewCount?: number;
      uploadDate?: string;
    }
  ): Promise<void> {
    // Create text splitter for chunking content
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    // Process transcript
    if (transcript) {
      const transcriptChunks = await textSplitter.createDocuments(
        [transcript],
        [
          {
            videoId,
            channelId,
            videoTitle: title,
            channelName: metadata.channelName,
            url: metadata.url,
            viewCount: metadata.viewCount,
            uploadDate: metadata.uploadDate,
            source: 'transcript',
          },
        ]
      );
      
      // Add to vector store
      if (this.vectorStore) {
        await this.vectorStore.addDocuments(transcriptChunks);
      }
    }
    
    // Process description
    if (description) {
      const descriptionChunks = await textSplitter.createDocuments(
        [description],
        [
          {
            videoId,
            channelId,
            videoTitle: title,
            channelName: metadata.channelName,
            url: metadata.url,
            viewCount: metadata.viewCount,
            uploadDate: metadata.uploadDate,
            source: 'description',
          },
        ]
      );
      
      // Add to vector store
      if (this.vectorStore) {
        await this.vectorStore.addDocuments(descriptionChunks);
      }
    }
    
    // Process title as a separate document
    const titleDoc = await textSplitter.createDocuments(
      [title],
      [
        {
          videoId,
          channelId,
          videoTitle: title,
          channelName: metadata.channelName,
          url: metadata.url,
          viewCount: metadata.viewCount,
          uploadDate: metadata.uploadDate,
          source: 'title',
        },
      ]
    );
    
    // Add to vector store
    if (this.vectorStore && titleDoc.length > 0) {
      await this.vectorStore.addDocuments(titleDoc);
    }
  }
  
  /**
   * Process comments for vector storage
   */
  async processComments(
    videoId: string,
    channelId: string,
    title: string,
    comments: { author: string; content: string; likeCount?: number }[],
    metadata: {
      channelName: string;
      url: string;
    }
  ): Promise<void> {
    if (!comments || comments.length === 0) return;
    
    // Create text splitter for chunking content
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    // Process each comment
    for (const comment of comments) {
      if (!comment.content) continue;
      
      const commentText = `${comment.author}: ${comment.content}`;
      
      const commentChunks = await textSplitter.createDocuments(
        [commentText],
        [
          {
            videoId,
            channelId,
            videoTitle: title,
            channelName: metadata.channelName,
            url: metadata.url,
            likeCount: comment.likeCount,
            author: comment.author,
            source: 'comments',
          },
        ]
      );
      
      // Add to vector store
      if (this.vectorStore) {
        await this.vectorStore.addDocuments(commentChunks);
      }
    }
  }
  
  /**
   * Perform a similarity search on the vector store
   */
  async similaritySearch(query: string, k: number = 5): Promise<any[]> {
    if (!this.vectorStore) {
      await this.initialize();
    }
    
    if (this.vectorStore) {
      return await this.vectorStore.similaritySearch(query, k);
    }
    
    return [];
  }
  
  /**
   * Delete all vectors for a specific video
   */
  async deleteVideoVectors(videoId: string): Promise<void> {
    await this.supabaseClient
      .from(this.config.tableName)
      .delete()
      .eq('metadata->>videoId', videoId);
  }
  
  /**
   * Delete all vectors for a specific channel
   */
  async deleteChannelVectors(channelId: string): Promise<void> {
    await this.supabaseClient
      .from(this.config.tableName)
      .delete()
      .eq('metadata->>channelId', channelId);
  }
  
  /**
   * Get statistics about the vector database
   */
  async getStats(): Promise<{ totalDocuments: number; channels: number; videos: number }> {
    const { count: totalDocuments } = await this.supabaseClient
      .from(this.config.tableName)
      .select('*', { count: 'exact', head: true });
    
    const { data: channelData } = await this.supabaseClient
      .from(this.config.tableName)
      .select('metadata->>channelId')
      .limit(1000);
    
    const { data: videoData } = await this.supabaseClient
      .from(this.config.tableName)
      .select('metadata->>videoId')
      .limit(1000);
    
    // Count unique channels and videos
    const uniqueChannels = new Set();
    const uniqueVideos = new Set();
    
    channelData?.forEach(item => {
      if (item['metadata->>channelId']) {
        uniqueChannels.add(item['metadata->>channelId']);
      }
    });
    
    videoData?.forEach(item => {
      if (item['metadata->>videoId']) {
        uniqueVideos.add(item['metadata->>videoId']);
      }
    });
    
    return {
      totalDocuments: totalDocuments || 0,
      channels: uniqueChannels.size,
      videos: uniqueVideos.size,
    };
  }
}
