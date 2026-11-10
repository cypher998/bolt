import "dotenv/config";
import express from "express";
import { getSystemPrompt } from "./prompts.js";
import { basePrompt as nodePrompt } from "./default/node.js";
import { basePrompt as reactPrompt } from "./default/react.js";
import { BASE_PROMPT } from "./prompts.js";

const app = express();
app.use(express.json());


const port = process.env.PORT || 3000;
// ---- Groq setup -------------------------------------------------------------
// Groq exposes an OpenAI-compatible REST API, so a plain fetch() is enough.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
// gpt-oss-120b can output up to 65,536 tokens; reasoning tokens count toward this.
const CHAT_MAX_TOKENS = Number(process.env.CHAT_MAX_TOKENS) || 8000;

if (!GROQ_API_KEY) {
  console.warn("GROQ_API_KEY is missing in be/.env");
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

class GroqError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function groqChat(options: {
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  reasoningEffort?: "low" | "medium" | "high";
}) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_completion_tokens: options.maxTokens,
      // gpt-oss is a reasoning model: keep thinking short so tokens go to the answer.
      reasoning_effort: options.reasoningEffort ?? "low",
      // Don't send the model's chain-of-thought back; we only need the final answer.
      include_reasoning: false,
    }),
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GroqError(data?.error?.message || `Groq request failed (${res.status})`, res.status);
  }

  const choice = data.choices?.[0];
  return {
    text: (choice?.message?.content ?? "") as string,
    finishReason: (choice?.finish_reason ?? "unknown") as string,
  };
}
// -----------------------------------------------------------------------------

app.post("/template", async (req, res) => {
  const userPrompt = req.body.userPrompt;
  try {
    const { text } = await groqChat({
      messages: [
        { role: "system", content: "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra" },
        { role: "user", content: userPrompt },
      ],
      // Small budget, but leave headroom for the (low-effort) reasoning tokens.
      maxTokens: 500,
    });

    const answer = text.trim().toLowerCase();
    if (answer === "node") {
      res.json({
        prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${nodePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
        uiPrompts: [nodePrompt],
      })
      return;
    } else {
      res.json({
        prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactPrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
        uiPrompts: [reactPrompt],
      })
      return;
    }
  } catch (e: any) {
    console.error(e);
    res.status(e?.status || 500).json({ message: e?.message || "Something went wrong. Please try again." });
  }
})

app.post("/chat", async (req, res) => {
  const messages = req.body.messages;
  try {
    const { text, finishReason } = await groqChat({
      messages: [
        { role: "system", content: getSystemPrompt() },
        ...messages,
      ],
      maxTokens: CHAT_MAX_TOKENS,
      reasoningEffort: "low",
    });

    if (!text.trim()) {
      console.error(`/chat: empty response from model (finish_reason: ${finishReason})`);
      res.status(502).json({
        message: finishReason === "length"
          ? "The model ran out of tokens before writing an answer. Increase CHAT_MAX_TOKENS in be/.env."
          : `The model returned an empty response (finish_reason: ${finishReason}).`,
      });
      return;
    }

    res.json({ response: text });
  } catch (e: any) {
    // Pass Groq's error (e.g. 401 bad key, 429 rate limit) to the frontend.
    console.error(e);
    res.status(e?.status || 500).json({ message: e?.message || String(e) });
  }
})

app.listen(3000, () => {
  console.log(`Server running on port 3000`)
})
