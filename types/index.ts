// types/index.ts

export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  // Suggestions produced by the assistant (service mode)
  suggestedServices?: SuggestedService[];
  metadata?: Record<string, any>;
}

export interface SuggestedService {
  id: string;
  type: 'doctor' | 'lab' | 'pharmacy' | 'appointment' | 'other';
  title: string;
  description?: string;
  // Action template the app can execute (sent to Fitwell Hub)
  actionTemplate?: ServiceAction;
}

export interface ServiceAction {
  type: 'book_doctor' | 'book_lab' | 'order_medicine' | 'other';
  params?: Record<string, any>;
}

export interface LLMResponse {
  reply: string;
  mode: 'chat' | 'service';
  suggestedServices?: SuggestedService[];
  awaitingConfirmation?: boolean;
  action?: ServiceAction;
}