// lib/tts.ts

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';

let currentSound: Audio.Sound | null = null;

function uint8ToBase64(uint8: Uint8Array) {
  // Convert Uint8Array to base64 string (safe in RN)
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const chunk = uint8.subarray(i, Math.min(i + chunkSize, uint8.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk) as any);
  }
  // @ts-ignore btoa may not exist in RN, but try
  try {
    // @ts-ignore
    return btoa(binary);
  } catch (e) {
    // Fallback encoding
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let result = '';
    let i = 0;
    while (i < binary.length) {
      const b1 = binary.charCodeAt(i++) & 0xff;
      if (i === binary.length) {
        result += chars.charAt(b1 >> 2);
        result += chars.charAt((b1 & 0x3) << 4);
        result += '==';
        break;
      }
      const b2 = binary.charCodeAt(i++);
      if (i === binary.length) {
        result += chars.charAt(b1 >> 2);
        result += chars.charAt(((b1 & 0x3) << 4) | ((b2 & 0xF0) >> 4));
        result += chars.charAt((b2 & 0xF) << 2);
        result += '=';
        break;
      }
      const b3 = binary.charCodeAt(i++);
      result += chars.charAt(b1 >> 2);
      result += chars.charAt(((b1 & 0x3) << 4) | ((b2 & 0xF0) >> 4));
      result += chars.charAt(((b2 & 0xF) << 2) | ((b3 & 0xC0) >> 6));
      result += chars.charAt(b3 & 0x3F);
    }
    return result;
  }
}

export async function stop() {
  try {
    if (currentSound) {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      currentSound = null;
    }
  } catch (err) {
    console.warn('tts.stop error', err);
  }
  try {
    Speech.stop();
  } catch (e) {
    // ignore
  }
}

async function playFile(fileUri: string) {
  try {
    await stop();
    const { sound } = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true });
    currentSound = sound;
    return new Promise<void>((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status) return;
        if (status.didJustFinish) {
          (async () => {
            try {
              await sound.unloadAsync();
            } catch (e) {}
            if (currentSound === sound) currentSound = null;
          })();
          resolve();
        }
      });
    });
  } catch (err) {
    console.warn('playFile error', err);
    throw err;
  }
}

/**
 * speak - High-quality TTS that prefers Coqui (if configured) then a generic TTS endpoint, then falls back to expo-speech.
 * opts.voice: provider voice id
 * opts.lang: language code (e.g., 'ur' for Urdu)
 * opts.provider: optional 'coqui'|'generic'
 */
export async function speak(text: string, opts?: { voice?: string; lang?: string; provider?: 'eleven' | 'coqui' | 'generic' }) {
  if (!text) return;

  const elevenKey = (global as any).__ELEVEN_API_KEY;
  const elevenVoice = opts?.voice || (global as any).__ELEVEN_VOICE_ID;
  const coquiUrl = (global as any).__COQUI_TTS_URL;
  const coquiKey = (global as any).__COQUI_API_KEY;
  const genericTtsUrl = (global as any).__TTS_API_URL;
  const genericTtsKey = (global as any).__TTS_API_KEY;

  // Prefer ElevenLabs if configured and available
  if ((opts && opts.provider === 'eleven') || (elevenKey && elevenVoice)) {
    try {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${elevenVoice}`;
      const headers: any = {
        'Content-Type': 'application/json',
        'xi-api-key': elevenKey
      };
      const body = { text };
      const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (resp.ok) {
        const contentType = (resp.headers && resp.headers.get && resp.headers.get('content-type')) || '';
        if (contentType.startsWith('audio/')) {
          const arrayBuffer = await resp.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          const base64 = uint8ToBase64(uint8);
          const ext = contentType.split('/')[1].split(';')[0] || 'mp3';
          const fileUri = `${FileSystem.cacheDirectory}tts_eleven_${Date.now()}.${ext}`;
          await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
          await playFile(fileUri);
          return;
        }
      } else {
        console.warn('ElevenLabs TTS non-ok', await resp.text());
      }
    } catch (err) {
      console.warn('ElevenLabs TTS error', err);
    }
  }

  // Try Coqui if configured and either explicitly requested or available.
  if ((opts && opts.provider === 'coqui') || coquiUrl) {
    try {
      const payload: any = { text };
      if (opts?.voice) payload.voice = opts.voice;
      if (opts?.lang) payload.lang = opts.lang;
      // Coqui-compatible API often accepts format selection
      payload.format = payload.format || 'wav';

      const headers: any = { 'Content-Type': 'application/json' };
      if (coquiKey) headers['Authorization'] = `Bearer ${coquiKey}`;

      const resp = await fetch(coquiUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
      const contentType = (resp.headers && resp.headers.get && resp.headers.get('content-type')) || '';

      // Binary audio
      if (contentType.startsWith('audio/')) {
        const arrayBuffer = await resp.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        const base64 = uint8ToBase64(uint8);
        const ext = contentType.split('/')[1].split(';')[0] || 'wav';
        const fileUri = `${FileSystem.cacheDirectory}tts_coqui_${Date.now()}.${ext}`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        await playFile(fileUri);
        return;
      }

      // JSON response with audio base64 or url
      if (contentType.includes('application/json')) {
        const json = await resp.json();
        if (json.audio) {
          // audio is base64
          const ext = json.ext || 'wav';
          const fileUri = `${FileSystem.cacheDirectory}tts_coqui_${Date.now()}.${ext}`;
          await FileSystem.writeAsStringAsync(fileUri, json.audio, { encoding: FileSystem.EncodingType.Base64 });
          await playFile(fileUri);
          return;
        }
        if (json.url) {
          const ext = json.ext || 'mp3';
          const fileUri = `${FileSystem.cacheDirectory}tts_coqui_${Date.now()}.${ext}`;
          await FileSystem.downloadAsync(json.url, fileUri);
          await playFile(fileUri);
          return;
        }
        console.warn('Coqui JSON response missing audio/url', json);
      }

      // Some providers may return text or other structured output; fall through to generic
      console.warn('Coqui TTS unexpected response type', contentType);
    } catch (err) {
      console.warn('Coqui TTS failed, falling back', err);
    }
  }

  // Try generic TTS endpoint if configured (same handling as above)
  if ((opts && opts.provider === 'generic') || genericTtsUrl) {
    try {
      const payload: any = { text };
      if (opts?.voice) payload.voice = opts.voice;
      if (opts?.lang) payload.lang = opts.lang;

      const headers: any = { 'Content-Type': 'application/json' };
      if (genericTtsKey) headers['Authorization'] = `Bearer ${genericTtsKey}`;

      const resp = await fetch(genericTtsUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
      const contentType = (resp.headers && resp.headers.get && resp.headers.get('content-type')) || '';

      if (contentType.startsWith('audio/')) {
        const arrayBuffer = await resp.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        const base64 = uint8ToBase64(uint8);
        const ext = contentType.split('/')[1].split(';')[0] || 'wav';
        const fileUri = `${FileSystem.cacheDirectory}tts_generic_${Date.now()}.${ext}`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        await playFile(fileUri);
        return;
      }

      if (contentType.includes('application/json')) {
        const json = await resp.json();
        if (json.audio) {
          const ext = json.ext || 'wav';
          const fileUri = `${FileSystem.cacheDirectory}tts_generic_${Date.now()}.${ext}`;
          await FileSystem.writeAsStringAsync(fileUri, json.audio, { encoding: FileSystem.EncodingType.Base64 });
          await playFile(fileUri);
          return;
        }
        if (json.url) {
          const ext = json.ext || 'mp3';
          const fileUri = `${FileSystem.cacheDirectory}tts_generic_${Date.now()}.${ext}`;
          await FileSystem.downloadAsync(json.url, fileUri);
          await playFile(fileUri);
          return;
        }
        console.warn('Generic TTS JSON missing audio/url', json);
      }

      console.warn('Generic TTS unexpected response type', contentType);
    } catch (err) {
      console.warn('Generic TTS failed, falling back to expo-speech', err);
    }
  }

  // Final fallback: use expo-speech (this supports many locales but quality is platform-dependent)
  return new Promise<void>((resolve) => {
    try {
      Speech.stop();
      Speech.speak(text, {
        language: opts?.lang,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: (e) => {
          console.warn('expo-speech.onError', e);
          resolve();
        }
      });
    } catch (err) {
      console.warn('expo-speech fallback failed', err);
      resolve();
    }
  });
}