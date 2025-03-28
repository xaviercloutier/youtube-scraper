import { OpenAI } from 'langchain/llms/openai';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { VectorDatabase } from './vector-database';
import { BufferMemory } from 'langchain/memory';

export interface ConversationalAIConfig {
  openaiApiKey: string;
  vectorDb: VectorDatabase;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class ConversationalAI {
  private config: ConversationalAIConfig;
  private model: OpenAI;
  private chain: ConversationalRetrievalQAChain | null = null;
  private memory: BufferMemory;
  private systemPrompt: string;
  
  constructor(config: ConversationalAIConfig) {
    this.config = config;
    
    // Initialize OpenAI model
    this.model = new OpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: config.modelName || 'gpt-4',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000,
    });
    
    // Initialize memory
    this.memory = new BufferMemory({
      memoryKey: 'chat_history',
      returnMessages: true,
      inputKey: 'question',
      outputKey: 'text',
    });
    
    // Default system prompt
    this.systemPrompt = `You are an AI assistant that helps users understand YouTube content. 
You have access to transcripts, descriptions, and metadata from YouTube videos.
When answering questions:
1. Base your answers on the actual content provided in the context.
2. If the context doesn't contain relevant information, say so rather than making things up.
3. Cite specific videos when providing information, including titles and timestamps when available.
4. Be conversational and helpful, but prioritize accuracy over speculation.
5. If asked about opinions, make it clear you're summarizing the content creator's views, not expressing your own.`;
  }
  
  /**
   * Initialize the conversational chain
   */
  async initialize(): Promise<void> {
    try {
      // Initialize the vector database if not already initialized
      await this.config.vectorDb.initialize();
      
      // Create the retrieval chain
      this.chain = ConversationalRetrievalQAChain.fromLLM(
        this.model,
        await this.config.vectorDb.vectorStore.asRetriever(),
        {
          memory: this.memory,
          returnSourceDocuments: true,
          questionGeneratorTemplate: `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question that captures all relevant context from the conversation.

Chat History:
{chat_history}

Follow Up Input: {question}
Standalone question:`,
          qaTemplate: `${this.systemPrompt}

Context information from YouTube videos:
{context}

Question: {question}
Answer:`,
        }
      );
    } catch (error) {
      console.error('Error initializing conversational AI:', error);
      throw new Error(`Failed to initialize conversational AI: ${error.message}`);
    }
  }
  
  /**
   * Process a user message and generate a response
   */
  async processMessage(message: string): Promise<{
    response: string;
    sources: Array<{
      videoId: string;
      videoTitle: string;
      channelName: string;
      url: string;
      source: string;
      timestamp?: string;
    }>;
  }> {
    if (!this.chain) {
      await this.initialize();
    }
    
    try {
      // Process the message through the chain
      const result = await this.chain.call({
        question: message,
      });
      
      // Extract sources from source documents
      const sources = result.sourceDocuments?.map(doc => ({
        videoId: doc.metadata.videoId,
        videoTitle: doc.metadata.videoTitle,
        channelName: doc.metadata.channelName,
        url: doc.metadata.url,
        source: doc.metadata.source,
        timestamp: doc.metadata.timestamp,
      })) || [];
      
      // Remove duplicate sources
      const uniqueSources = Array.from(
        new Map(sources.map(item => [item.videoId, item])).values()
      );
      
      return {
        response: result.text,
        sources: uniqueSources,
      };
    } catch (error) {
      console.error('Error processing message:', error);
      return {
        response: 'I encountered an error while processing your message. Please try again.',
        sources: [],
      };
    }
  }
  
  /**
   * Clear the conversation history
   */
  async clearHistory(): Promise<void> {
    this.memory.clear();
  }
  
  /**
   * Set a custom system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    
    // Re-initialize the chain to apply the new prompt
    this.chain = null;
  }
  
  /**
   * Get the current conversation history
   */
  async getConversationHistory(): Promise<ChatMessage[]> {
    const history = await this.memory.loadMemoryVariables({});
    return history.chat_history || [];
  }
}
