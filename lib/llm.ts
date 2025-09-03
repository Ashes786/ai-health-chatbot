// lib/llm.ts

/* global fetch */

import { LLMResponse, Message as AppMessage } from '../types';

const A0_LLM_URL = 'https://api.a0.dev/ai/llm';
// TODO: Replace with secure storage or Expo secrets. For demo, set global.__A0_API_KEY or pass via config.
const A0_API_KEY = (global as any).__A0_API_KEY || process.env.A0_API_KEY || '';

const SYSTEM_PROMPT = `You are Fitwell Assistant, a friendly and safe healthcare voice assistant for patients.
- Always prioritize referring the user to a General Practitioner (GP) for initial evaluation. Only recommend a specialist or emergency services when the symptoms clearly and unambiguously indicate a specialist (e.g., cardiology, neurology) or an emergency (e.g., severe chest pain, heavy bleeding, difficulty breathing).
- When giving guidance, be empathetic, concise, and include a brief safety disclaimer. Do NOT provide definitive diagnoses.
- IMPORTANT: Do NOT include raw JSON, code blocks, or action templates inside the assistant's visible reply text. Any structured data (suggested services, action templates, awaitingConfirmation, etc.) must be returned via the JSON schema (schema_data) only. The assistant's reply (text for users) must be human-friendly, free of JSON, and suitable for speaking aloud.
- When in service mode (user mentions symptoms, medicines, labs, or appointments), produce a clear conversational reply in plain language and also populate the structured schema fields (mode: 'service', suggestedServices, action, awaitingConfirmation) so the client can render UI and execute actions.

Return outputs strictly in the structured schema requested by the API when possible. If the provider cannot return schema_data, ensure the assistant reply is plain text and avoid embedding raw JSON in it.`;

// JSON Schema describing the structured LLMResponse we want
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    mode: { type: 'string', enum: ['chat', 'service'] },
    suggestedServices: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['doctor', 'lab', 'pharmacy', 'appointment', 'other'] },
          title: { type: 'string' },
          description: { type: 'string' },
          actionTemplate: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['book_doctor', 'book_lab', 'order_medicine', 'other'] },
              params: { type: 'object' }
            }
          }
        }
      }
    },
    awaitingConfirmation: { type: 'boolean' },
    action: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['book_doctor', 'book_lab', 'order_medicine', 'other'] },
        params: { type: 'object' }
      }
    }
  }
};

export async function callLLM(userMessage: string, history: AppMessage[] = []): Promise<LLMResponse> {
  // Build messages for the API: system + conversation history + current user message
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.text })),
    { role: 'user', content: userMessage }
  ];

  try {
    const payload: any = { messages, schema: RESPONSE_SCHEMA };

    const res = await fetch(A0_LLM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(A0_API_KEY ? { Authorization: `Bearer ${A0_API_KEY}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text();
      console.warn('LLM API non-OK response:', res.status, txt);
      return { reply: "Sorry, I'm having trouble connecting to the assistant right now.", mode: 'chat' };
    }

    const data = await res.json();

    // The a0 LLM API returns schema_data when structured schema was used
    if (data.schema_data) {
      const parsed = data.schema_data as LLMResponse;
      // Ensure reply exists
      parsed.reply = parsed.reply || (data.completion || '') ;
      return parsed;
    }

    // Fallback: attempt to parse JSON from completion
    const completion: string = data.completion || data.completion_text || '';
    try {
      const parsed = JSON.parse(completion);
      return parsed as LLMResponse;
    } catch (err) {
      // Not JSON — return as chat text
      return { reply: completion || 'Sorry, I could not understand that.', mode: 'chat' };
    }
  } catch (err) {
    console.error('callLLM error', err);
    return { reply: "Sorry, I'm having trouble right now.", mode: 'chat' };
  }
}