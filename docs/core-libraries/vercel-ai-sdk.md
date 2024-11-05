# Vercel AI SDK Documentation

## Overview

The Vercel AI SDK is used in our platform for building conversational AI features, streaming text responses, and integrating with various AI models. This document outlines our implementation standards and best practices.

## Installation and Setup

```bash
npm install ai
```

## Core Concepts

### 1. Streaming Responses

```typescript
// app/api/chat/route.ts
import { OpenAIStream, StreamingTextResponse } from 'ai';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    stream: true,
    messages,
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
```

### 2. Client Implementation

```typescript
// app/components/Chat.tsx
import { useChat } from "ai/react";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          {message.role === "user" ? "User: " : "AI: "}
          {message.content}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Say something..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

## Implementation Patterns

### 1. Custom Chat UI

```typescript
// components/ChatInterface.tsx
import { useChat } from "ai/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
      initialMessages: [
        {
          id: "welcome",
          role: "assistant",
          content: "How can I help you with your English learning today?",
        },
      ],
    });

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`rounded-lg px-4 py-2 max-w-[80%] ${
                message.role === "user"
                  ? "bg-primary text-white"
                  : "bg-secondary"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Sending..." : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

### 2. Language Learning Assistant

```typescript
// app/api/tutor/route.ts
import { OpenAIStream, StreamingTextResponse } from 'ai';
import OpenAI from 'openai';
import { languageLearningPrompt } from '@/lib/prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { messages, level, focusArea } = await req.json();

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    stream: true,
    messages: [
      {
        role: 'system',
        content: languageLearningPrompt(level, focusArea),
      },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
```

### 3. Error Handling

```typescript
// lib/ai-error-handling.ts
import { OpenAIError } from 'openai';

export async function handleAIError(error: unknown) {
  if (error instanceof OpenAIError) {
    switch (error.code) {
      case 'rate_limit_exceeded':
        return new Response('Rate limit exceeded. Please try again later.', {
          status: 429,
        });
      case 'invalid_api_key':
        console.error('Invalid API key');
        return new Response('Internal server error', { status: 500 });
      default:
        console.error('OpenAI API error:', error);
        return new Response('AI service unavailable', { status: 503 });
    }
  }

  console.error('Unexpected error:', error);
  return new Response('Internal server error', { status: 500 });
}
```

## Advanced Features

### 1. Context Management

```typescript
// lib/context-manager.ts
interface ConversationContext {
  level: string;
  lessonTopics: string[];
  corrections: string[];
}

export class ContextManager {
  private context: ConversationContext;

  constructor(initialContext: ConversationContext) {
    this.context = initialContext;
  }

  updateContext(newContext: Partial<ConversationContext>) {
    this.context = { ...this.context, ...newContext };
  }

  getPrompt(): string {
    return `
      Current level: ${this.context.level}
      Topics covered: ${this.context.lessonTopics.join(', ')}
      Previous corrections: ${this.context.corrections.join(', ')}
    `;
  }
}
```

### 2. Response Processing

```typescript
// lib/response-processor.ts
export class ResponseProcessor {
  static async processGrammarCorrection(text: string) {
    const corrections = [];
    const segments = text.split('\n');

    for (const segment of segments) {
      if (segment.includes('CORRECTION:')) {
        corrections.push({
          original: segment.split('CORRECTION:')[0].trim(),
          corrected: segment.split('CORRECTION:')[1].trim(),
          explanation: segment.split('EXPLANATION:')[1]?.trim(),
        });
      }
    }

    return corrections;
  }
}
```

## Performance Optimization

### 1. Message Batching

```typescript
// hooks/useMessageBatching.ts
import { useState, useCallback } from 'react';

export function useMessageBatching(threshold = 5) {
  const [messageQueue, setMessageQueue] = useState<string[]>([]);

  const addToQueue = useCallback((message: string) => {
    setMessageQueue((prev) => [...prev, message]);
  }, []);

  const processQueue = useCallback(async () => {
    if (messageQueue.length >= threshold) {
      // Process messages in batch
      const batch = messageQueue.join('\n');
      setMessageQueue([]);
      return batch;
    }
    return null;
  }, [messageQueue, threshold]);

  return { addToQueue, processQueue };
}
```

### 2. Stream Processing

```typescript
// lib/stream-processor.ts
export async function* processStream(
  stream: ReadableStream,
  processor: (chunk: string) => string
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const processed = processor(chunk);
      yield processed;
    }
  } finally {
    reader.releaseLock();
  }
}
```

## Testing

### 1. Mock Implementations

```typescript
// __tests__/ai-mock.ts
export const mockUseChat = () => {
  return {
    messages: [
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! How can I help you?',
      },
    ],
    input: '',
    handleInputChange: jest.fn(),
    handleSubmit: jest.fn(),
    isLoading: false,
  };
};
```

### 2. Integration Tests

```typescript
// __tests__/chat.test.ts
import { render, fireEvent, waitFor } from "@testing-library/react";
import { Chat } from "@/components/Chat";

describe("Chat Component", () => {
  it("sends messages and receives responses", async () => {
    const { getByPlaceholderText, getByText } = render(<Chat />);

    const input = getByPlaceholderText("Type your message...");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.submit(getByText("Send"));

    await waitFor(() => {
      expect(getByText(/Hello/)).toBeInTheDocument();
    });
  });
});
```

## Security Considerations

### 1. Input Sanitization

```typescript
// lib/sanitize.ts
export function sanitizeUserInput(input: string): string {
  // Remove potential XSS
  input = input.replace(/<[^>]*>/g, '');

  // Remove potential SQL injection
  input = input.replace(/['";]/g, '');

  return input.trim();
}
```

### 2. Rate Limiting

```typescript
// middleware.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
});

export async function middleware(request: Request) {
  const ip = request.headers.get('x-forwarded-for');
  const { success } = await ratelimit.limit(ip ?? '');

  if (!success) {
    return new Response('Too Many Requests', { status: 429 });
  }
}
```

## Monitoring and Analytics

### 1. Usage Tracking

```typescript
// lib/ai-analytics.ts
interface AIMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latency: number;
}

export class AIAnalytics {
  static async trackUsage(metrics: AIMetrics) {
    await fetch('/api/analytics', {
      method: 'POST',
      body: JSON.stringify(metrics),
    });
  }
}
```

### 2. Error Monitoring

```typescript
// lib/ai-monitoring.ts
export class AIMonitoring {
  static async logError(error: Error, context: any) {
    console.error('AI Error:', {
      error: error.message,
      stack: error.stack,
      context,
    });

    // Send to error tracking service
    await fetch('/api/error-tracking', {
      method: 'POST',
      body: JSON.stringify({
        error: error.message,
        context,
      }),
    });
  }
}
```
