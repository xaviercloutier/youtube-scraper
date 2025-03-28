import React from 'react';
import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex flex-col h-screen">
        <header className="bg-white border-b p-4">
          <h1 className="text-2xl font-bold text-center">YouTube Content Chat Assistant</h1>
          <p className="text-center text-gray-600 mt-1">
            Enter a YouTube channel URL to analyze its content and chat about it
          </p>
        </header>
        
        <div className="flex-1 overflow-hidden">
          <ChatInterface />
        </div>
        
        <footer className="bg-white border-t p-3 text-center text-sm text-gray-500">
          YouTube Content Chat Assistant &copy; {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
