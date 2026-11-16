import { GoogleGenerativeAI } from "@google/generative-ai";
import redisManager from "../config/redis.js";
import logger from "../config/logger.js";

// Retrieve credentials and map to arrays to support key rotation
const getApiKeys = (envKey) => {
  const value = process.env[envKey];
  if (!value) return [];
  return value
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
};

// Pointer tracking indices for active keys
let activeGeminiIndex = 0;
let activeGroqIndex = 0;
let activeHfIndex = 0;

// Helper to calculate approximate tokens as a fallback mechanism
const estimateTokens = (text) => {
  if (!text) return 0;
  return Math.ceil(text.length / 4); // 1 token ≈ 4 characters in English
};

// Redis update logging helper
const trackTokenUsage = async (inputTokens, outputTokens) => {
  try {
    const redisClient = redisManager.client;
    if (redisClient?.status !== "ready") return;
    await redisClient.incrby("ai_analytics:tokens:input", inputTokens);
    await redisClient.incrby("ai_analytics:tokens:output", outputTokens);
    logger.info(
      `[AI Analytics] Tracked token usage. Input: +${inputTokens}, Output: +${outputTokens}`,
    );
  } catch (error) {
    logger.warn(
      `Failed to write token usage analytics to Redis: ${error.message}`,
    );
  }
};

// --- PRIMARY PROVIDER: GEMINI 1.5 FLASH ---
const generateGemini = async (prompt, systemInstruction, attempt = 0) => {
  const geminiKeys = getApiKeys("GEMINI_API_KEY");
  if (geminiKeys.length === 0) {
    throw new Error("No Gemini API keys configured.");
  }

  const keyIndex = activeGeminiIndex % geminiKeys.length;
  const currentKey = geminiKeys[keyIndex];

  try {
    logger.info(
      `Attempting Gemini model text generation using Key Index: ${keyIndex}...`,
    );
    const genAI = new GoogleGenerativeAI(currentKey);
    const model = genAI.getGenerativeModel(
      {
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        ...(systemInstruction && { systemInstruction }),
      },
      { apiVersion: "v1beta", timeout: 8000 },
    );

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const inputTokens =
      response.usageMetadata?.promptTokenCount || estimateTokens(prompt);
    const outputTokens =
      response.usageMetadata?.candidatesTokenCount || estimateTokens(text);
    await trackTokenUsage(inputTokens, outputTokens);

    return text;
  } catch (error) {
    const isRateLimit =
      error.status === 429 ||
      error.message?.includes("429") ||
      error.message?.toLowerCase().includes("quota") ||
      error.message?.toLowerCase().includes("rate limit");

    if (isRateLimit && attempt < geminiKeys.length - 1) {
      logger.warn(
        `Gemini API Key Index ${keyIndex} hit rate limit / quota. Rotating key...`,
      );
      activeGeminiIndex++;
      return generateGemini(prompt, systemInstruction, attempt + 1);
    }

    // Propagate error to trigger next provider in chain
    throw error;
  }
};

// --- SECONDARY PROVIDER: GROQ API CLOUD (Llama 3 70B) ---
const generateGroq = async (prompt, systemInstruction, attempt = 0) => {
  const groqKeys = getApiKeys("GROQ_API_KEY");
  if (groqKeys.length === 0) {
    throw new Error("No Groq API keys configured.");
  }

  const keyIndex = activeGroqIndex % groqKeys.length;
  const currentKey = groqKeys[keyIndex];

  try {
    logger.info(
      `Attempting Groq text generation using Key Index: ${keyIndex}...`,
    );

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentKey}`,
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
          max_completion_tokens: 2048,
          messages: [
            ...(systemInstruction
              ? [{ role: "system", content: systemInstruction }]
              : []),
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        }),
      },
    );

    if (response.status === 429) {
      if (attempt < groqKeys.length - 1) {
        logger.warn(
          `Groq API Key Index ${keyIndex} hit rate limit (429). Rotating key...`,
        );
        activeGroqIndex++;
        return generateGroq(prompt, systemInstruction, attempt + 1);
      }
      throw new Error("All Groq API keys are rate limited.");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Groq API returned error status ${response.status}: ${errorText}`,
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("Malformed completion payload returned by Groq.");
    }

    // Capture token usage from Groq response metadata
    const inputTokens = data.usage?.prompt_tokens || estimateTokens(prompt);
    const outputTokens = data.usage?.completion_tokens || estimateTokens(text);
    await trackTokenUsage(inputTokens, outputTokens);

    return text;
  } catch (error) {
    throw error;
  }
};

// --- TERTIARY PROVIDER: HUGGING FACE INFERENCE API ---
const generateHuggingFace = async (prompt, systemInstruction, attempt = 0) => {
  const hfKeys = getApiKeys("HF_API_KEY");
  if (hfKeys.length === 0) {
    throw new Error("No Hugging Face API keys configured.");
  }

  const keyIndex = activeHfIndex % hfKeys.length;
  const currentKey = hfKeys[keyIndex];

  try {
    logger.info(
      `Attempting Hugging Face text generation using Key Index: ${keyIndex}...`,
    );

    // Using Meta Llama-3 instruction tuned model on Hugging Face Serverless Inference
    const response = await fetch(
      "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct",
      {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentKey}`,
        },
        body: JSON.stringify({
          inputs: systemInstruction
            ? `<|system|>\n${systemInstruction}\n<|user|>\n${prompt}\n<|assistant|>\n`
            : prompt,
          parameters: { max_new_tokens: 1024, temperature: 0.7 },
        }),
      },
    );

    if (response.status === 429) {
      if (attempt < hfKeys.length - 1) {
        logger.warn(
          `Hugging Face API Key Index ${keyIndex} rate limited (429). Rotating key...`,
        );
        activeHfIndex++;
        return generateHuggingFace(prompt, systemInstruction, attempt + 1);
      }
      throw new Error("All Hugging Face API keys are rate limited.");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Hugging Face API returned error status ${response.status}: ${errorText}`,
      );
    }

    const data = await response.json();
    // Hugging Face returns completions inside text array objects
    let text = "";
    if (Array.isArray(data)) {
      text = data[0]?.generated_text || "";
    } else {
      text = data.generated_text || "";
    }

    // Clean up template tokens if returned by llama tokenizer
    text = text.replace(/<\|system\|>|<\|user\|>|<\|assistant\|>/g, "").trim();

    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(text);
    await trackTokenUsage(inputTokens, outputTokens);

    return text;
  } catch (error) {
    throw error;
  }
};

// --- PUBLIC ROUTED API ENTRY POINT ---
export const generateText = async (prompt, systemInstruction = "") => {
  // 1. Try Gemini
  try {
    return await generateGemini(prompt, systemInstruction);
  } catch (geminiError) {
    logger.error(
      `Gemini generation failed: ${geminiError.message}. Initiating failover to Groq...`,
    );
  }

  // 2. Try Groq
  try {
    return await generateGroq(prompt, systemInstruction);
  } catch (groqError) {
    logger.error(
      `Groq generation failed: ${groqError.message}. Initiating failover to Hugging Face...`,
    );
  }

  // 3. Try Hugging Face
  try {
    return await generateHuggingFace(prompt, systemInstruction);
  } catch (hfError) {
    logger.error(
      `Hugging Face generation failed: ${hfError.message}. No tertiary fallback remaining.`,
    );
    throw new Error(
      `AI Orchestration Layer exhausted all providers. Final error: ${hfError.message}`,
    );
  }
};

// Semantic Embeddings Generation (uses Gemini model text-embedding-004)
export const generateEmbeddings = async (text, attempt = 0) => {
  const geminiKeys = getApiKeys("GEMINI_API_KEY");
  if (geminiKeys.length === 0) {
    throw new Error("No Gemini API keys configured for Embeddings generation.");
  }

  const keyIndex = activeGeminiIndex % geminiKeys.length;
  const currentKey = geminiKeys[keyIndex];

  try {
    const genAI = new GoogleGenerativeAI(currentKey);
    const model = genAI.getGenerativeModel(
      { model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001" },
      { timeout: 8000 },
    );
    const result = await model.embedContent(text);
    const embedding = result.embedding;

    // Track 1 token per 4 chars for embedding tracking
    const tokens = estimateTokens(text);
    await trackTokenUsage(tokens, 0);

    return embedding.values;
  } catch (error) {
    // Basic retry hook for embeddings
    const isRateLimit = error.status === 429 || error.message?.includes("429");
    if (isRateLimit && attempt < geminiKeys.length - 1) {
      logger.warn(
        "Gemini embedding generation rate limited. Retrying with key rotation...",
      );
      activeGeminiIndex++;
      return generateEmbeddings(text, attempt + 1);
    }
    throw error;
  }
};

// Fetch current token statistics from Redis
export const getTokenAnalytics = async () => {
  try {
    const redisClient = redisManager.getClient();
    if (redisClient.status !== "ready")
      return { input: 0, output: 0, total: 0, available: false };
    const input = parseInt(
      (await redisClient.get("ai_analytics:tokens:input")) || "0",
      10,
    );
    const output = parseInt(
      (await redisClient.get("ai_analytics:tokens:output")) || "0",
      10,
    );
    return { input, output, total: input + output };
  } catch (error) {
    logger.error("Failed to get token analytics from Redis:", error);
    return { input: 0, output: 0, total: 0 };
  }
};
