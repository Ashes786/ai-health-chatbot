// lib/asr.ts

/* global fetch, FormData */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// ASR API configuration (set these in your runtime environment)
const ASR_API_URL = (global as any).__ASR_API_URL || process.env.ASR_API_URL || '';
const ASR_API_KEY = (global as any).__ASR_API_KEY || process.env.ASR_API_KEY || '';

/**
 * Request microphone/recording permissions. Returns true if granted.
 */
export async function requestRecordingPermissions(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('requestRecordingPermissions error', err);
    return false;
  }
}

/**
 * Start recording audio using expo-av. Returns an Audio.Recording instance.
 */
export async function startRecording(): Promise<Audio.Recording> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true
  });

  const recording = new Audio.Recording();
  try {
    await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
    await recording.startAsync();
    return recording;
  } catch (err) {
    console.error('startRecording failed', err);
    throw err;
  }
}

/**
 * Stop and unload a recording and return the local file URI.
 */
export async function stopRecordingGetUri(recording: Audio.Recording): Promise<string | null> {
  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    return uri || null;
  } catch (err) {
    console.error('stopRecordingGetUri error', err);
    try {
      await recording.stopAndUnloadAsync();
    } catch (_) {}
    return null;
  }
}

/**
 * Transcribe an audio file at the given uri by sending it to a configured ASR API.
 * Falls back to web SpeechRecognition when running in a browser and to a placeholder
 * message when no ASR endpoint is configured.
 */
export async function transcribeAudioUri(uri?: string): Promise<string> {
  // Web fallback: use SpeechRecognition API in browsers (useful for expo web)
  if (Platform.OS === 'web') {
    return transcribeWithWebSpeech();
  }

  if (!ASR_API_URL) {
    console.warn('ASR_API_URL not configured. Returning placeholder transcription.');
    return '(transcription unavailable - ASR not configured)';
  }

  if (!uri) {
    console.warn('No audio uri provided for transcription');
    return '(no audio)';
  }

  // Build multipart form data for the audio file
  const form = new FormData();
  const filename = uri.split('/').pop() || 'recording.wav';
  // In React Native fetch multipart uploads, file objects are described like this
  form.append('file', { uri, name: filename, type: 'audio/wav' } as any);

  try {
    const res = await fetch(ASR_API_URL, {
      method: 'POST',
      headers: {
        ...(ASR_API_KEY ? { Authorization: `Bearer ${ASR_API_KEY}` } : {})
        // NOTE: Do NOT set Content-Type here; fetch will set the multipart boundary.
      },
      body: form
    });

    if (!res.ok) {
      const txt = await res.text();
      console.warn('ASR API returned non-OK:', res.status, txt);
      return '(transcription failed)';
    }

    const json = await res.json();
    // Expectation: ASR returns { transcript: '...' } or { text: '...' }
    return json.transcript || json.text || JSON.stringify(json);
  } catch (err) {
    console.error('transcribeAudioUri error', err);
    return '(transcription error)';
  }
}

/**
 * Helper to transcribe speech using browser SpeechRecognition (webkit prefix handled).
 */
function transcribeWithWebSpeech(): Promise<string> {
  return new Promise((resolve) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      resolve('(speech recognition not available in this browser)');
      return;
    }

    const recognizer = new SpeechRecognition();
    recognizer.lang = 'en-US';
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;

    recognizer.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      resolve(transcript);
    };

    recognizer.onerror = (e: any) => {
      console.warn('web SpeechRecognition error', e);
      resolve('(speech recognition error)');
    };

    try {
      recognizer.start();
    } catch (err) {
      console.warn('web SpeechRecognition start failed', err);
      resolve('(speech recognition error)');
    }
  });
}