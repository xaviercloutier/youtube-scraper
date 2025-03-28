# YouTube Content Chat Assistant

A web application that allows you to chat with YouTube channel content. Ask questions about videos without watching them!

## Features

- **YouTube Channel Analysis**: Enter any YouTube channel URL to extract and analyze its content
- **Conversational Interface**: Chat naturally with an AI assistant about the channel's videos
- **Semantic Search**: Ask questions and get answers based on video content
- **Source Attribution**: See which videos contain the information in responses
- **Direct Links**: Jump to specific timestamps in videos for source verification

## How It Works

1. **Content Extraction**: The application scrapes YouTube channels to extract video metadata, transcripts, and other content
2. **Vector Database**: Content is processed into vector embeddings for semantic search
3. **Conversational AI**: A powerful language model answers questions based on the extracted content
4. **Web Interface**: User-friendly chat interface for interacting with the system

## Technology Stack

- **Frontend**: Next.js with React and Tailwind CSS
- **Backend**: Cloudflare Workers with D1 Database
- **AI**: OpenAI GPT-4 for conversational capabilities
- **Vector Search**: Supabase Vector Store for semantic search
- **Deployment**: Cloudflare Pages for hosting

## Deployment Instructions

1. **Set up environment variables**:
   - Create a `.env.local` file with the following variables:
     ```
     OPENAI_API_KEY=your_openai_api_key
     SUPABASE_URL=your_supabase_url
     SUPABASE_KEY=your_supabase_key
     ```

2. **Set up Supabase Vector Store**:
   - Create a new Supabase project
   - Create a new table called `youtube_embeddings` with the pgvector extension
   - Use the following SQL to create the table:
     ```sql
     CREATE EXTENSION IF NOT EXISTS vector;

     CREATE TABLE IF NOT EXISTS youtube_embeddings (
       id bigserial PRIMARY KEY,
       content text,
       metadata jsonb,
       embedding vector(1536)
     );

     CREATE INDEX ON youtube_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
     ```

3. **Deploy to Cloudflare**:
   - Update the `wrangler.toml` file with your specific configuration
   - Run the following commands:
     ```
     npm install
     npm run build
     npx wrangler d1 create youtube-analyzer-db
     npx wrangler d1 execute youtube-analyzer-db --local --file=migrations/0001_initial.sql
     npx wrangler deploy
     ```

## Local Development

1. **Install dependencies**:
   ```
   npm install
   ```

2. **Set up local database**:
   ```
   npx wrangler d1 execute DB --local --file=migrations/0001_initial.sql
   ```

3. **Run development server**:
   ```
   npm run dev
   ```

4. **Open in browser**:
   Open [http://localhost:3000](http://localhost:3000) to view the application

## Usage Examples

- "What topics does this channel cover?"
- "Summarize the main points from the most popular video"
- "What advice does the creator give about [specific topic]?"
- "Find videos where they talk about [specific subject]"
- "What are the key takeaways from their content?"

## Limitations

- The system can only analyze publicly available YouTube content
- Transcript quality depends on what's available from YouTube
- Very large channels may take longer to process
- The system only knows about the content it has processed, not about new uploads

## Future Enhancements

- User authentication for saving favorite channels
- Scheduled updates to keep content fresh
- Multi-channel comparison
- Advanced analytics on content themes and trends
- Mobile application version
