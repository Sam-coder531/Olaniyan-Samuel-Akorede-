# Chat-inspired assistant

An independent, ChatGPT-inspired interface built with Next.js. Chats are stored in the current browser's local storage; they are not synced to Supabase. Search, new chat, and deletion work locally.

## Run

```sh
npm install
npm run dev
```

To enable AI responses, set `GROQ_API_KEY` in the server environment and optionally `GROQ_MODEL` (defaults to `llama-3.3-70b-versatile`). Without a key, the interface reports that the AI service is not configured. Never expose the key to the browser. The chat endpoint currently has no authentication or rate limiting; add both and usage controls before configuring a paid API key on a public deployment.

The connected Supabase project is not used for chat storage or authentication. This avoids writing private conversations into an existing shared database without an explicit data model and access policies.
