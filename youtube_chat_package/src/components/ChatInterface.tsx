'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Youtube, RefreshCw } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: Array<{
    videoId: string;
    videoTitle: string;
    channelName: string;
    url: string;
    source: string;
    timestamp?: string;
  }>;
}

interface ChatInterfaceProps {
  channelId?: string;
  channelName?: string;
  onNewChat?: () => void;
}

export default function ChatInterface({ channelId, channelName, onNewChat }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: channelId 
        ? `Welcome! I'm your YouTube content assistant for ${channelName || 'this channel'}. Ask me anything about the videos, and I'll try to help you understand the content better.`
        : 'Welcome! Please enter a YouTube channel URL to start analyzing content.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChannelLoaded, setIsChannelLoaded] = useState(!!channelId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // If no channel is loaded and input looks like a YouTube URL
    if (!isChannelLoaded && (input.includes('youtube.com/') || input.includes('youtu.be/'))) {
      await handleChannelInput(input);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call API to get response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          channelId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        sources: data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle channel URL input
  const handleChannelInput = async (url: string) => {
    setIsLoading(true);

    const loadingMessage: Message = {
      id: Date.now().toString(),
      role: 'system',
      content: `Processing YouTube channel: ${url}. This may take a few minutes as I extract and analyze the content...`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, loadingMessage]);

    try {
      // Call API to process channel
      const response = await fetch('/api/process-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelUrl: url }),
      });

      if (!response.ok) {
        throw new Error('Failed to process channel');
      }

      const data = await response.json();

      const successMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: `Successfully processed ${data.channelName}! I've analyzed ${data.videoCount} videos. You can now ask me anything about the content.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, successMessage]);
      setIsChannelLoaded(true);

      // Notify parent component if needed
      if (onNewChat) {
        onNewChat();
      }
    } catch (error) {
      console.error('Error processing channel:', error);
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: 'Sorry, I encountered an error processing the YouTube channel. Please check the URL and try again.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press (Enter to send)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear chat history
  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'system',
        content: 'Chat history cleared. How can I help you with this YouTube channel?',
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full max-h-screen bg-gray-50">
      {/* Chat header */}
      <div className="bg-white border-b p-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Youtube className="h-6 w-6 text-red-600" />
          <h2 className="text-lg font-medium">
            {channelName ? `Chat with ${channelName}` : 'YouTube Content Assistant'}
          </h2>
        </div>
        <button
          onClick={handleClearChat}
          className="text-gray-500 hover:text-gray-700"
          title="Clear chat history"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-3xl rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.role === 'system'
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-white border text-gray-800'
              }`}
            >
              <div className="flex items-center space-x-2 mb-2">
                {message.role === 'user' ? (
                  <User className="h-5 w-5" />
                ) : (
                  <Bot className="h-5 w-5" />
                )}
                <span className="font-medium">
                  {message.role === 'user' ? 'You' : message.role === 'system' ? 'System' : 'Assistant'}
                </span>
                <span className="text-xs opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div className="whitespace-pre-wrap">{message.content}</div>

              {/* Sources section */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <p className="text-sm font-medium mb-1">Sources:</p>
                  <ul className="text-sm space-y-1">
                    {message.sources.map((source, index) => (
                      <li key={index}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {source.videoTitle}
                        </a>
                        <span className="text-xs text-gray-500">
                          {' '}
                          ({source.channelName})
                          {source.timestamp && ` at ${source.timestamp}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t bg-white p-4">
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
              isChannelLoaded
                ? "Ask anything about this channel's content..."
                : "Enter a YouTube channel URL (e.g., https://www.youtube.com/@channelname)"
            }
            className="flex-1 border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {isChannelLoaded
            ? "I've analyzed this channel's content and can answer questions about it."
            : "Start by entering a YouTube channel URL to analyze its content."}
        </p>
      </div>
    </div>
  );
}
