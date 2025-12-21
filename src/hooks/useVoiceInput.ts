/**
 * Voice Input Hook - Continuous dictation with accumulation
 * Fixed: accumulates text, auto-restarts on timeout, stable instance
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'error' | 'not-supported' | 'permission-denied';

interface UseVoiceInputOptions {
  onResult?: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  language?: string;
  autoPunctuation?: boolean;
}

interface UseVoiceInputReturn {
  isListening: boolean;
  isSupported: boolean;
  status: VoiceStatus;
  statusMessage: string;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  clearTranscript: () => void;
}

// Check for browser support
const SpeechRecognition =
  typeof window !== 'undefined'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item: (index: number) => SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item: (index: number) => SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

const STATUS_MESSAGES: Record<VoiceStatus, string> = {
  idle: 'Click mic to speak',
  listening: '🎤 Listening... click to stop',
  processing: 'Processing...',
  error: 'Error occurred',
  'not-supported': 'Voice not supported. Try Chrome.',
  'permission-denied': 'Microphone blocked. Enable in browser settings.',
};

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { onResult, onInterim, onError, onStatusChange, language = 'en-US', autoPunctuation = true } = options;
  
  const [status, setStatus] = useState<VoiceStatus>(() => {
    if (!SpeechRecognition) return 'not-supported';
    return 'idle';
  });
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const statusRef = useRef<VoiceStatus>(status);
  const shouldRestartRef = useRef(false); // Track if we want to auto-restart
  const accumulatedTextRef = useRef(''); // Accumulated final text
  
  // Keep refs in sync with latest callbacks
  const callbacksRef = useRef({ onResult, onInterim, onError, onStatusChange });
  callbacksRef.current = { onResult, onInterim, onError, onStatusChange };

  const isSupported = Boolean(SpeechRecognition);
  const isListening = status === 'listening';

  const updateStatus = useCallback((newStatus: VoiceStatus) => {
    statusRef.current = newStatus;
    setStatus(newStatus);
    callbacksRef.current.onStatusChange?.(newStatus);
  }, []);

  // Initialize recognition ONCE on mount
  useEffect(() => {
    if (!SpeechRecognition) {
      updateStatus('not-supported');
      return;
    }

    console.log('[Voice] Initializing SpeechRecognition...');
    const recognition = new SpeechRecognition() as SpeechRecognitionInstance;
    recognition.continuous = true; // Keep listening
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      console.log('[Voice] Recognition started');
      updateStatus('listening');
      setInterimTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let newFinalText = '';
      let interim = '';

      // Process results from the latest batch
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        
        if (result.isFinal) {
          newFinalText += text;
        } else {
          interim += text;
        }
      }

      // Show current interim text (combined with accumulated)
      const displayInterim = accumulatedTextRef.current + (accumulatedTextRef.current ? ' ' : '') + interim;
      setInterimTranscript(interim);
      callbacksRef.current.onInterim?.(displayInterim);
      
      console.log('[Voice] Result:', { accumulated: accumulatedTextRef.current, newFinal: newFinalText, interim });

      // If we got final text, accumulate it
      if (newFinalText) {
        // Add space between accumulated sentences
        if (accumulatedTextRef.current) {
          accumulatedTextRef.current += ' ';
        }
        
        let processed = newFinalText.trim();
        if (autoPunctuation && processed.length > 0 && !/[.!?,]$/.test(processed)) {
          processed += '.';
        }
        
        accumulatedTextRef.current += processed;
        
        // Notify with full accumulated text
        callbacksRef.current.onResult?.(accumulatedTextRef.current);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[Voice] Error:', event.error);
      
      let message = 'Speech recognition error';

      switch (event.error) {
        case 'not-allowed':
          updateStatus('permission-denied');
          shouldRestartRef.current = false;
          message = 'Microphone access denied. Please allow in browser settings.';
          callbacksRef.current.onError?.(message);
          return;
        case 'no-speech':
          // No speech detected - this is normal, don't treat as error
          console.log('[Voice] No speech detected, will auto-restart if still listening');
          return;
        case 'network':
          message = 'Network error. Please check your connection.';
          break;
        case 'aborted':
          // User stopped - not an error
          return;
        default:
          message = event.message || 'Speech recognition error';
      }

      callbacksRef.current.onError?.(message);
    };

    recognition.onend = () => {
      console.log('[Voice] Recognition ended, shouldRestart:', shouldRestartRef.current);
      
      // Auto-restart if we're supposed to still be listening
      if (shouldRestartRef.current) {
        console.log('[Voice] Auto-restarting...');
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.error('[Voice] Auto-restart failed:', e);
            updateStatus('idle');
            shouldRestartRef.current = false;
          }
        }, 100);
      } else {
        updateStatus('idle');
        setInterimTranscript('');
      }
    };

    recognitionRef.current = recognition;
    console.log('[Voice] Recognition initialized');

    return () => {
      console.log('[Voice] Cleanup');
      shouldRestartRef.current = false;
      recognition.abort();
    };
  }, [language, autoPunctuation, updateStatus]);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      console.warn('[Voice] No recognition instance');
      return;
    }
    
    if (statusRef.current === 'listening') {
      console.log('[Voice] Already listening');
      return;
    }
    
    console.log('[Voice] Starting...');
    shouldRestartRef.current = true; // Enable auto-restart
    accumulatedTextRef.current = ''; // Clear accumulated text on new session
    
    try {
      recognition.start();
    } catch (error) {
      console.error('[Voice] Failed to start:', error);
      if (error instanceof Error && error.message.includes('already started')) {
        recognition.stop();
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.error('[Voice] Retry failed:', e);
            updateStatus('error');
            shouldRestartRef.current = false;
          }
        }, 100);
      } else {
        updateStatus('error');
        shouldRestartRef.current = false;
      }
    }
  }, [updateStatus]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    
    console.log('[Voice] Stopping...');
    shouldRestartRef.current = false; // Disable auto-restart
    
    try {
      recognition.stop();
    } catch (error) {
      console.error('[Voice] Failed to stop:', error);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (statusRef.current === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  const clearTranscript = useCallback(() => {
    accumulatedTextRef.current = '';
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    isSupported,
    status,
    statusMessage: STATUS_MESSAGES[status],
    transcript: accumulatedTextRef.current,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
  };
}
