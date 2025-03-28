-- Migration number: 0001        2025-03-28T20:35:52.000Z
-- YouTube Channel Analyzer Database Schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS counters;
DROP TABLE IF EXISTS access_logs;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS transcripts;
DROP TABLE IF EXISTS videos;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS search_logs;

-- Channels Table
CREATE TABLE IF NOT EXISTS channels (
    channel_id TEXT PRIMARY KEY,
    channel_name TEXT NOT NULL,
    channel_url TEXT NOT NULL,
    subscriber_count INTEGER,
    video_count INTEGER,
    description TEXT,
    thumbnail_url TEXT,
    last_scraped TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Videos Table
CREATE TABLE IF NOT EXISTS videos (
    video_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    upload_date TIMESTAMP,
    duration INTEGER,  -- in seconds
    view_count INTEGER,
    like_count INTEGER,
    description TEXT,
    thumbnail_url TEXT,
    tags TEXT,
    FOREIGN KEY (channel_id) REFERENCES channels(channel_id)
);

-- Transcripts Table
CREATE TABLE IF NOT EXISTS transcripts (
    transcript_id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    language TEXT,
    content TEXT NOT NULL,
    FOREIGN KEY (video_id) REFERENCES videos(video_id)
);

-- Comments Table
CREATE TABLE IF NOT EXISTS comments (
    comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    author TEXT,
    content TEXT NOT NULL,
    like_count INTEGER,
    date_posted TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(video_id)
);

-- Search Logs Table
CREATE TABLE IF NOT EXISTS search_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    user_ip TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Counters Table (for analytics)
CREATE TABLE IF NOT EXISTS counters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    value INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Access Logs Table
CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    path TEXT,
    accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_videos_channel_id ON videos(channel_id);
CREATE INDEX idx_videos_upload_date ON videos(upload_date);
CREATE INDEX idx_videos_view_count ON videos(view_count);
CREATE INDEX idx_transcripts_video_id ON transcripts(video_id);
CREATE INDEX idx_comments_video_id ON comments(video_id);
CREATE INDEX idx_access_logs_accessed_at ON access_logs(accessed_at);
CREATE INDEX idx_search_logs_timestamp ON search_logs(timestamp);

-- Initial data
INSERT INTO counters (name, value) VALUES 
  ('page_views', 0),
  ('api_calls', 0),
  ('channels_scraped', 0),
  ('videos_scraped', 0);

-- Create virtual tables for full-text search
-- Note: SQLite FTS5 is used for full-text search capabilities
CREATE VIRTUAL TABLE IF NOT EXISTS video_search USING fts5(
    title, 
    description, 
    tags,
    content='videos',
    content_rowid='rowid'
);

CREATE VIRTUAL TABLE IF NOT EXISTS transcript_search USING fts5(
    content,
    content='transcripts',
    content_rowid='transcript_id'
);

-- Create triggers to maintain FTS indexes
CREATE TRIGGER IF NOT EXISTS videos_ai AFTER INSERT ON videos BEGIN
    INSERT INTO video_search(rowid, title, description, tags)
    VALUES (new.rowid, new.title, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS videos_au AFTER UPDATE ON videos BEGIN
    INSERT INTO video_search(video_search, rowid, title, description, tags)
    VALUES('delete', old.rowid, old.title, old.description, old.tags);
    INSERT INTO video_search(rowid, title, description, tags)
    VALUES (new.rowid, new.title, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS videos_ad AFTER DELETE ON videos BEGIN
    INSERT INTO video_search(video_search, rowid, title, description, tags)
    VALUES('delete', old.rowid, old.title, old.description, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS transcripts_ai AFTER INSERT ON transcripts BEGIN
    INSERT INTO transcript_search(rowid, content)
    VALUES (new.transcript_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS transcripts_au AFTER UPDATE ON transcripts BEGIN
    INSERT INTO transcript_search(transcript_search, rowid, content)
    VALUES('delete', old.transcript_id, old.content);
    INSERT INTO transcript_search(rowid, content)
    VALUES (new.transcript_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS transcripts_ad AFTER DELETE ON transcripts BEGIN
    INSERT INTO transcript_search(transcript_search, rowid, content)
    VALUES('delete', old.transcript_id, old.content);
END;
