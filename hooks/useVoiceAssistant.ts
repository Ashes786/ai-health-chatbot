// hooks/useVoiceAssistant.ts

import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { speak as ttsSpeak, stop as ttsStop } from '../lib/tts';
import { Message, ServiceAction, SuggestedService } from '../types';
import { requestRecordingPermissions, startRecording, stopRecordingGetUri, transcribeAudioUri } from '../lib/asr';
import { callLLM } from '../lib/llm';
import { callServiceAction } from '../lib/fitwellApi';

function makeId(prefix = '') {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

export function useVoiceAssistant() {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: makeId('m_'),
      role: 'assistant',
      text: "Hi, I'm Fitwell — your voice healthcare assistant. Tell me how you're feeling or ask a health question.",
      timestamp: Date.now()
    }
  ]);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoListen, setAutoListen] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>('en');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [pendingAction, setPendingAction] = useState<ServiceAction | null>(null);
  const [lastSuggestedServices, setLastSuggestedServices] = useState<SuggestedService[] | undefined>(undefined);

  // Refs to avoid circular hook dependencies between callbacks
  const recordingRef = useRef<Audio.Recording | null>(null);
  const startListeningRef = useRef<(() => Promise<void>) | null>(null);
  const stopListeningRef = useRef<(() => Promise<void>) | null>(null);
  const processUserMessageRef = useRef<((text: string) => Promise<void>) | null>(null);
  const executePendingActionRef = useRef<((action: ServiceAction) => Promise<void>) | null>(null);
  const autoListenRef = useRef<boolean>(autoListen);

  useEffect(() => {
    autoListenRef.current = autoListen;
  }, [autoListen]);

  // Pre-request microphone permission when the hook mounts if autoListen is enabled
  useEffect(() => {
    (async () => {
      try {
        const ok = await requestRecordingPermissions();
        setPermissionGranted(ok);
      } catch (e) {
        setPermissionGranted(false);
      }
    })();
  }, []);

  // Helper to push messages
  const pushMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // TTS wrapper that uses the lib/tts implementation to restart listening safely
  const speak = useCallback(async (text: string, opts?: { lang?: string; voice?: string }) => {
    if (!text) return;
    setIsProcessing(true);
    try {
      // Decide preferred TTS provider: prefer ElevenLabs for Urdu if configured
      const globalAny = global as any;
      const preferEleven = !!(globalAny.__ELEVEN_API_KEY && globalAny.__ELEVEN_VOICE_ID);
      const provider = opts?.lang === 'ur' && preferEleven ? 'eleven' : opts?.provider || (globalAny.__COQUI_TTS_URL ? 'coqui' : undefined);
      await ttsSpeak(text, { lang: opts?.lang || language, voice: opts?.voice, provider: provider as any });
    } catch (err) {
      console.warn('tts speak error', err);
    }
    setIsProcessing(false);
    if (autoListenRef.current) {
      // Resume listening immediately without extra delay
      startListeningRef.current?.();
    }
  }, [language]);

  // Start listening (recording)
  const startListening = useCallback(async () => {
    try {
      // If TTS is playing, stop it so the user can interrupt
      try {
        await ttsStop();
      } catch (e) {
        // ignore
      }

      // Only request permissions if we haven't already granted
      let ok = permissionGranted;
      if (!ok) {
        ok = await requestRecordingPermissions();
        setPermissionGranted(ok);
      }
      if (!ok) {
        pushMessage({ id: makeId('m_'), role: 'assistant', text: 'I need permission to access the microphone.', timestamp: Date.now() });
        return;
      }

      setIsRecording(true);
      const rec = await startRecording();
      recordingRef.current = rec;

      // Safety: auto-stop after 12s to avoid very long recordings
      setTimeout(async () => {
        if (recordingRef.current === rec && recordingRef.current) {
          stopListeningRef.current?.();
        }
      }, 12000);
    } catch (err) {
      console.error('startListening error', err);
      setIsRecording(false);
    }
  }, [pushMessage, permissionGranted]);

  // Stop listening and process audio
  const stopListening = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec) {
      setIsRecording(false);
      return;
    }

    setIsRecording(false);
    recordingRef.current = null;

    const uri = await stopRecordingGetUri(rec);
    if (!uri) {
      pushMessage({ id: makeId('m_'), role: 'assistant', text: "I couldn't capture the audio.", timestamp: Date.now() });
      return;
    }

    setIsProcessing(true);
    const transcript = await transcribeAudioUri(uri);
    setIsProcessing(false);

    // Add user message
    const userMsg: Message = { id: makeId('u_'), role: 'user', text: transcript, timestamp: Date.now() };
    pushMessage(userMsg);

    // Confirmation flow handling
    if (awaitingConfirmation && pendingAction) {
      const lc = transcript.toLowerCase();
      const positive = /\b(yes|yeah|yep|sure|please|affirmative|do it|confirm)\b/.test(lc);
      const negative = /\b(no|not now|cancel|don't|dont|nope)\b/.test(lc);
      if (positive) {
        executePendingActionRef.current?.(pendingAction);
        return;
      } else if (negative) {
        pushMessage({ id: makeId('m_'), role: 'assistant', text: 'Okay, I will not proceed with that.', timestamp: Date.now() });
        setAwaitingConfirmation(false);
        setPendingAction(null);
        return;
      }
      // else fall through to normal processing
    }

    // Normal flow: delegate to the current processUserMessage implementation
    if (processUserMessageRef.current) {
      processUserMessageRef.current(transcript);
    } else {
      // Fallback
      pushMessage({ id: makeId('m_'), role: 'assistant', text: "Sorry, I couldn't process that right now.", timestamp: Date.now() });
    }
  }, [awaitingConfirmation, pendingAction, pushMessage]);

  // Process user text via LLM
  const processUserMessage = useCallback(async (text: string) => {
    setIsProcessing(true);
    try {
      const llmResp = await callLLM(text, messages);
      // Push assistant message
      const assistantMsg: Message = {
        id: makeId('a_'),
        role: 'assistant',
        text: llmResp.reply,
        timestamp: Date.now(),
        suggestedServices: llmResp.suggestedServices
      };
      pushMessage(assistantMsg);

      setLastSuggestedServices(llmResp.suggestedServices);

      // If LLM expects confirmation for an action, set pendingAction
      if (llmResp.awaitingConfirmation && llmResp.action) {
        setPendingAction(llmResp.action);
        setAwaitingConfirmation(true);
      } else {
        setAwaitingConfirmation(false);
        setPendingAction(null);
      }

      // Speak the assistant reply and auto-resume listening if enabled
      speak(llmResp.reply, { lang: language });
    } catch (err) {
      console.error('processUserMessage error', err);
      pushMessage({ id: makeId('m_'), role: 'assistant', text: "Sorry, I couldn't process that right now.", timestamp: Date.now() });
    } finally {
      setIsProcessing(false);
    }
  }, [messages, pushMessage, speak, language]);

  // Execute a service action directly (from UI button or confirmation)
  const executePendingAction = useCallback(async (action: ServiceAction) => {
    setIsProcessing(true);
    setAwaitingConfirmation(false);
    setPendingAction(null);

    pushMessage({ id: makeId('m_'), role: 'assistant', text: 'Okay, I am booking that for you now...', timestamp: Date.now() });

    try {
      const res = await callServiceAction(action);
      // Summarize result
      if (res && res.success !== false) {
        const successText = `All set! Your booking/order is confirmed. Reference: ${res.bookingId || res.orderId || res.order_id || 'N/A'}.`;
        pushMessage({ id: makeId('m_'), role: 'assistant', text: successText, timestamp: Date.now() });
        speak(successText);
      } else {
        const err = res?.error || 'unknown error';
        const failText = `I couldn't complete the booking: ${err}`;
        pushMessage({ id: makeId('m_'), role: 'assistant', text: failText, timestamp: Date.now() });
        speak(failText);
      }
    } catch (err) {
      console.error('executePendingAction error', err);
      const failText = 'There was an error completing the request.';
      pushMessage({ id: makeId('m_'), role: 'assistant', text: failText, timestamp: Date.now() });
      speak(failText);
    } finally {
      setIsProcessing(false);
    }
  }, [pushMessage, speak]);

  // Wire refs to the current implementations to avoid circular dependencies
  useEffect(() => {
    processUserMessageRef.current = processUserMessage;
  }, [processUserMessage]);

  useEffect(() => {
    executePendingActionRef.current = executePendingAction;
  }, [executePendingAction]);

  useEffect(() => {
    startListeningRef.current = startListening;
    stopListeningRef.current = stopListening;
  }, [startListening, stopListening]);

  // Allow sending typed messages from UI
  const sendText = useCallback(async (text: string) => {
    if (!text || !text.trim()) return;
    const trimmed = text.trim();
    const userMsg: Message = { id: makeId('u_'), role: 'user', text: trimmed, timestamp: Date.now() };
    pushMessage(userMsg);
    // use the ref-based implementation
    if (processUserMessageRef.current) {
      processUserMessageRef.current(trimmed);
    }
  }, [pushMessage]);

  const toggleAutoListen = useCallback(() => {
    setAutoListen((s) => !s);
  }, []);

  // UI action to execute a specific suggested service
  const executeSuggestedService = useCallback(async (svc: SuggestedService) => {
    if (!svc.actionTemplate) {
      pushMessage({ id: makeId('m_'), role: 'assistant', text: 'No action template available for that service.', timestamp: Date.now() });
      return;
    }
    // Ask for confirmation before executing
    setPendingAction(svc.actionTemplate);
    setAwaitingConfirmation(true);
    const confirmText = `Do you want me to ${svc.title.toLowerCase()}?`;
    pushMessage({ id: makeId('m_'), role: 'assistant', text: confirmText, timestamp: Date.now() });
    speak(confirmText, { lang: language });
  }, [pushMessage, speak, language]);

  // Cleanup: stop any speech on unmount
  useEffect(() => {
    return () => {
      ttsStop();
    };
  }, []);

  return {
    messages,
    isRecording,
    isProcessing,
    autoListen,
    language,
    setLanguage,
    awaitingConfirmation,
    pendingAction,
    lastSuggestedServices,
    startListening,
    stopListening,
    sendText,
    toggleAutoListen,
    executePendingAction,
    executeSuggestedService,
    setMessages
  } as const;
}