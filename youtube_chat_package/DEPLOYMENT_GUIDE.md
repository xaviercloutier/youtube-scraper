# Detailed Deployment Guide for YouTube Content Chat Assistant

This guide will walk you through the complete process of deploying the YouTube Content Chat Assistant application to production.

## Prerequisites

Before you begin, you'll need to create accounts with the following services:

1. **Cloudflare** - For hosting the application and database
2. **Supabase** - For the vector database
3. **OpenAI** - For the AI capabilities

## Step 1: Set Up Supabase Vector Database

1. **Create a Supabase account**:
   - Go to [https://supabase.com/](https://supabase.com/) and sign up
   - Create a new project

2. **Set up the vector database**:
   - Go to the SQL Editor in your Supabase dashboard
   - Run the following SQL to create the vector database:

```sql
-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the embeddings table
CREATE TABLE IF NOT EXISTS youtube_embeddings (
  id bigserial PRIMARY KEY,
  content text,
  metadata jsonb,
  embedding vector(1536)
);

-- Create an index for similarity search
CREATE INDEX ON youtube_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create a function for similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    youtube_embeddings.id,
    youtube_embeddings.content,
    youtube_embeddings.metadata,
    1 - (youtube_embeddings.embedding <=> query_embedding) AS similarity
  FROM youtube_embeddings
  WHERE 1 - (youtube_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY youtube_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

3. **Get your Supabase credentials**:
   - Go to Project Settings > API
   - Copy your project URL (e.g., `https://abcdefghijklm.supabase.co`)
   - Copy your API key (use the "anon" public key)

## Step 2: Set Up OpenAI API

1. **Create an OpenAI account**:
   - Go to [https://platform.openai.com/](https://platform.openai.com/) and sign up

2. **Get your API key**:
   - Go to API Keys in your OpenAI dashboard
   - Create a new secret key
   - Copy the key (you won't be able to see it again)

## Step 3: Set Up Cloudflare

1. **Create a Cloudflare account**:
   - Go to [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) and sign up

2. **Install Wrangler CLI**:
   - Install Node.js if you haven't already
   - Install Wrangler globally: `npm install -g wrangler`
   - Log in to Cloudflare: `wrangler login`

## Step 4: Configure the Application

1. **Update wrangler.toml**:
   - Open the `wrangler.toml` file
   - Update the following values:
     ```toml
     name = "your-app-name" # Choose a unique name
     
     [vars]
     OPENAI_API_KEY = "your-openai-api-key"
     SUPABASE_URL = "your-supabase-url"
     SUPABASE_KEY = "your-supabase-anon-key"
     ```

2. **Create a .env.local file for local development**:
   - Create a file named `.env.local` in the project root
   - Add the following content:
     ```
     OPENAI_API_KEY=your-openai-api-key
     SUPABASE_URL=your-supabase-url
     SUPABASE_KEY=your-supabase-anon-key
     ```

## Step 5: Install Dependencies

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

## Step 6: Create and Initialize the D1 Database

1. **Create a D1 database**:
   ```bash
   npx wrangler d1 create youtube-analyzer-db
   ```

2. **Update wrangler.toml with the database ID**:
   - After creating the database, you'll get a database ID
   - Update the `database_id` in the `wrangler.toml` file:
     ```toml
     [[d1_databases]]
     binding = "DB"
     database_name = "youtube-analyzer-db"
     database_id = "your-database-id" # Update this
     ```

3. **Initialize the database with the schema**:
   ```bash
   npx wrangler d1 execute youtube-analyzer-db --local --file=migrations/0001_initial.sql
   ```

## Step 7: Test Locally

1. **Run the development server**:
   ```bash
   npm run dev
   ```

2. **Open in browser**:
   - Open [http://localhost:3000](http://localhost:3000) to view the application
   - Test the application by entering a YouTube channel URL
   - Try asking questions about the channel's content

## Step 8: Build and Deploy

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Deploy to Cloudflare Pages**:
   ```bash
   npx wrangler deploy
   ```

3. **Initialize the production database**:
   ```bash
   npx wrangler d1 execute youtube-analyzer-db --file=migrations/0001_initial.sql
   ```

4. **Access your deployed application**:
   - After deployment, you'll get a URL for your application
   - Open the URL in your browser to use the application

## Troubleshooting

### Common Issues and Solutions

1. **Database connection errors**:
   - Verify your D1 database ID in `wrangler.toml`
   - Make sure you've initialized the database with the schema

2. **Vector database errors**:
   - Verify your Supabase URL and API key
   - Make sure you've created the vector table and function

3. **OpenAI API errors**:
   - Verify your OpenAI API key
   - Check your OpenAI account has sufficient credits

4. **Deployment errors**:
   - Run `wrangler whoami` to verify you're logged in to Cloudflare
   - Check for any build errors in the console output

### Getting Help

If you encounter issues not covered here:

1. Check the Cloudflare Workers documentation: [https://developers.cloudflare.com/workers/](https://developers.cloudflare.com/workers/)
2. Check the Supabase documentation: [https://supabase.com/docs](https://supabase.com/docs)
3. Check the OpenAI API documentation: [https://platform.openai.com/docs/](https://platform.openai.com/docs/)

## Updating the Application

To update your application after making changes:

1. Make your changes to the code
2. Build the application: `npm run build`
3. Deploy the changes: `npx wrangler deploy`

## Monitoring and Maintenance

1. **Monitor application performance**:
   - Use Cloudflare Analytics to monitor your application
   - Check for any errors in the Cloudflare dashboard

2. **Update dependencies**:
   - Regularly update dependencies to get the latest features and security fixes
   - Run `npm update` to update dependencies

3. **Backup your data**:
   - Regularly backup your D1 and Supabase databases
   - Use `wrangler d1 backup` for D1 backups

## Conclusion

You've now deployed the YouTube Content Chat Assistant to production! Users can enter YouTube channel URLs, and the application will analyze the content and allow them to chat with an AI assistant about the videos.

If you have any questions or need further assistance, please refer to the documentation or reach out for help.
