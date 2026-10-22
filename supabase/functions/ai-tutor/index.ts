import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const CANDIDATE_MODELS = [
  "qwen/qwen3.8-27b",
  "qwen/qwen3.6-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
];
const ALLOWED_GATES = new Set([
  "H", "X", "Y", "Z", "S", "T", "Rx", "Ry", "Rz", "CNOT", "CZ", "SWAP", "M",
]);
const MAX_DAILY_REQUESTS = 50;
const MAX_PER_MINUTE = 10;

type ChatRequest = {
  mode: "chat";
  userMessage: string;
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>;
  currentModule: number | null;
  currentTopic: string | null;
};

type CircuitOperation = {
  gate: string;
  target: number;
  control?: number;
  col: number;
  angle?: number;
};

type CircuitRequest = {
  mode: "explain_circuit";
  nQubits: number;
  ops: CircuitOperation[];
};

type TutorRequest = ChatRequest | CircuitRequest;

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(body), { headers, status });
}

function allowedOrigins() {
  return (Deno.env.get("AI_TUTOR_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function safeRequestPayload(value: unknown): TutorRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request body must be a JSON object.");
  }
  const body = value as Record<string, unknown>;
  const mode = body.mode === "explain_circuit" ? "explain_circuit" : body.mode ?? "chat";
  if (mode !== "chat" && mode !== "explain_circuit") {
    throw new Error("Unsupported tutor mode.");
  }

  if (mode === "chat") {
    const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
    if (!userMessage || userMessage.length > 3000) {
      throw new Error("A message between 1 and 3000 characters is required.");
    }
    const history = Array.isArray(body.chatHistory) ? body.chatHistory.slice(-10) : [];
    const chatHistory = history.map((entry) => {
      if (!entry || typeof entry !== "object") throw new Error("Invalid chat history.");
      const message = entry as Record<string, unknown>;
      const role = message.role === "user" ? "user" : message.role === "assistant" || message.role === "ai" ? "assistant" : null;
      const text = typeof message.text === "string" ? message.text : typeof message.content === "string" ? message.content : "";
      if (!role || text.length > 1500) throw new Error("Invalid chat history.");
      return { role, content: text };
    });
    return {
      mode: "chat",
      userMessage,
      chatHistory,
      currentModule: typeof body.currentModule === "number" && Number.isInteger(body.currentModule)
        ? body.currentModule
        : null,
      currentTopic: typeof body.currentTopic === "string" ? body.currentTopic.slice(0, 160) : null,
    };
  }

  const nQubits = body.nQubits;
  const ops = body.ops;
  if (!Number.isInteger(nQubits) || (nQubits as number) < 1 || (nQubits as number) > 20 ||
      !Array.isArray(ops) || ops.length > 100) {
    throw new Error("Circuit explanation requires 1-20 qubits and at most 100 operations.");
  }
  const cleanOps = ops.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid circuit operation.");
    const op = entry as Record<string, unknown>;
    if (typeof op.gate !== "string" || !ALLOWED_GATES.has(op.gate) ||
        !Number.isInteger(op.target) || (op.target as number) < 0 || (op.target as number) >= (nQubits as number) ||
        !Number.isInteger(op.col) || (op.col as number) < 0) {
      throw new Error("Invalid circuit operation.");
    }
    if (["CNOT", "CZ", "SWAP"].includes(op.gate) &&
        (!Number.isInteger(op.control) || (op.control as number) < 0 ||
         (op.control as number) >= (nQubits as number) || op.control === op.target)) {
      throw new Error("Invalid control qubit.");
    }
    if (["Rx", "Ry", "Rz"].includes(op.gate) &&
        (typeof op.angle !== "number" || !Number.isFinite(op.angle))) {
      throw new Error("Rotation gates require a finite angle.");
    }
    return {
      gate: op.gate,
      target: op.target as number,
      control: typeof op.control === "number" ? op.control : undefined,
      col: op.col as number,
      angle: typeof op.angle === "number" ? op.angle : undefined,
    };
  });
  return { mode: "explain_circuit", nQubits: nQubits as number, ops: cleanOps };
}

function promptForRequest(request: TutorRequest) {
  const systemPrompt = `You are an expert quantum computing tutor. Teach accurately and progressively in structured Markdown. Use Dirac notation where useful. Never claim a mission is complete, award XP, or invent simulator results.`;
  if (request.mode === "explain_circuit") {
    const sorted = request.ops.filter((op) => op.gate !== "M").sort((a, b) => a.col - b.col);
    const gateSequence = sorted.map((op, index) => {
      if (op.gate === "CNOT" || op.gate === "CZ" || op.gate === "SWAP") {
        return `Step ${index + 1}: ${op.gate} (control q[${op.control}], target q[${op.target}])`;
      }
      if (op.angle !== undefined) {
        return `Step ${index + 1}: ${op.gate}(${(op.angle * 180 / Math.PI).toFixed(0)} degrees) on q[${op.target}]`;
      }
      return `Step ${index + 1}: ${op.gate} on q[${op.target}]`;
    }).join("\n");
    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Explain this ${request.nQubits}-qubit circuit:\n${gateSequence}\nDescribe the purpose, step-by-step state changes, quantum phenomena, and one useful next experiment.` },
    ];
  }
  return [
    { role: "system", content: `${systemPrompt}\nStudent context: module ${request.currentModule ?? "unspecified"}, topic ${request.currentTopic ?? "Quantum Computing"}.` },
    ...request.chatHistory,
    { role: "user", content: request.userMessage },
  ];
}

async function authenticateUser(request: Request, supabaseUrl: string, anonKey: string) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user?.id === "string" ? user.id : null;
}

async function consumeQuota(userId: string, supabaseUrl: string, serviceKey: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_ai_tutor_quota`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_daily_limit: MAX_DAILY_REQUESTS,
      p_minute_limit: MAX_PER_MINUTE,
    }),
  });
  if (!response.ok) throw new Error("Tutor quota service is unavailable.");
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

serve(async (req) => {
  const originHeader = req.headers.get("Origin");
  const origin = originHeader?.replace(/\/$/, "") ?? null;
  const origins = allowedOrigins();
  if (origin && !origins.includes(origin)) {
    return jsonResponse({ error: "Origin is not allowed." }, 403, null);
  }
  if (req.method === "OPTIONS") {
    return origin
      ? new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Vary": "Origin",
        },
      })
      : new Response(null, { status: 403 });
  }
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, origin);
  if (!origins.length) return jsonResponse({ error: "Tutor origin allowlist is not configured." }, 503, origin);
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return jsonResponse({ error: "Request body could not be read." }, 400, origin);
  }
  if (new TextEncoder().encode(bodyText).length > 100_000) {
    return jsonResponse({ error: "Request body is too large." }, 413, origin);
  }

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const groqApiKey = Deno.env.get("GROQ_API_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey || !groqApiKey) {
    return jsonResponse({ error: "Tutor service is not configured." }, 503, origin);
  }

  try {
    const userId = await authenticateUser(req, supabaseUrl, anonKey);
    if (!userId) return jsonResponse({ error: "Authentication is required." }, 401, origin);

    let payload: ReturnType<typeof safeRequestPayload>;
    try {
      payload = safeRequestPayload(JSON.parse(bodyText));
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : "Invalid request." }, 400, origin);
    }

    const quota = await consumeQuota(userId, supabaseUrl, serviceKey);
    if (!quota || quota.allowed !== true) {
      return jsonResponse({
        error: "Tutor request limit reached. Please try again later.",
        daily_remaining: Number(quota?.daily_remaining || 0),
        minute_remaining: Number(quota?.minute_remaining || 0),
      }, 429, origin);
    }

    const messages = promptForRequest(payload);
    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1024, top_p: 0.9, stream: false }),
        });
        if (!response.ok) continue;
        const data = await response.json();
        const text = String(data.choices?.[0]?.message?.content || "")
          .replace(/^\uFEFF/, "")
          .replace(/<think\b[^>]*>[\s\S]*?(<\/think>|$)/gi, "")
          .replace(/<analysis\b[^>]*>[\s\S]*?(<\/analysis>|$)/gi, "")
          .replace(/<\/?(?:think|analysis)>/gi, "")
          .replace(/<\|(?:im_start|im_end|assistant|user|system)\|>/gi, "")
          .replace(/^\s*(?:assistant|ai)\s*:\s*/i, "")
          .trim();
        if (text) return jsonResponse({ text }, 200, origin);
      } catch (error) {
        console.warn(`Tutor provider request failed for ${model}:`, error);
      }
    }
    return jsonResponse({ error: "AI tutor providers are temporarily unavailable." }, 502, origin);
  } catch (error) {
    console.error("AI tutor request failed:", error);
    return jsonResponse({ error: "AI tutor service is temporarily unavailable." }, 503, origin);
  }
});
