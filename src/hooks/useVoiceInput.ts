/**
 * Voice Input Hook - Enhanced with status, push-to-talk, error handling
 * Fixed: stable recognition instance, proper event handling
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
  listening: '🎤 Listening... speak now',
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
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const statusRef = useRef<VoiceStatus>(status);
  
  // Keep refs in sync with latest callbacks to avoid stale closures
  const callbacksRef = useRef({ onResult, onInterim, onError, onStatusChange });
  callbacksRef.current = { onResult, onInterim, onError, onStatusChange };

  const isSupported = Boolean(SpeechRecognition);
  const isListening = status === 'listening';

  // Update status helper
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
    recognition.continuous = true; // Keep listening until stopped
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      console.log('[Voice] Recognition started');
      updateStatus('listening');
      setTranscript('');
      setInterimTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        
        if (result.isFinal) {
          finalTranscript += text;
        } else {
          interim += text;
        }
      }

      // Always update interim for live display
      setInterimTranscript(interim);
      callbacksRef.current.onInterim?.(interim);
      
      console.log('[Voice] Result:', { final: finalTranscript, interim });

      if (finalTranscript) {
        let processed = finalTranscript.trim();
        if (autoPunctuation && processed.length > 0 && !/[.!?]$/.test(processed)) {
          processed += '.';
        }
        setTranscript(processed);
        callbacksRef.current.onResult?.(processed);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[Voice] Error:', event.error);
      
      let errorStatus: VoiceStatus = 'error';
      let message = 'Speech recognition error';

      switch (event.error) {
        case 'not-allowed':
          errorStatus = 'permission-denied';
          message = 'Microphone access denied. Please allow microphone access in your browser settings.';
          break;
        case 'no-speech':
          message = 'No speech detected. Please try again.';
          // Don't change status for no-speech, just notify
          callbacksRef.current.onError?.(message);
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

      updateStatus(errorStatus);
      callbacksRef.current.onError?.(message);
    };

    recognition.onend = () => {
      console.log('[Voice] Recognition ended, current status:', statusRef.current);
      // Only reset to idle if not already in an error state
      if (statusRef.current === 'listening' || statusRef.current === 'processing') {
        updateStatus('idle');
      }
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    console.log('[Voice] Recognition initialized successfully');

    return () => {
      console.log('[Voice] Cleaning up recognition');
      recognition.abort();
    };
  }, [language, autoPunctuation, updateStatus]); // Removed status from deps!

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
    try {
      recognition.start();
    } catch (error) {
      console.error('[Voice] Failed to start:', error);
      // If already started, try to stop and restart
      if (error instanceof Error && error.message.includes('already started')) {
        recognition.stop();
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.error('[Voice] Retry failed:', e);
            updateStatus('error');
          }
        }, 100);
      } else {
        updateStatus('error');
      }
    }
  }, [updateStatus]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    
    console.log('[Voice] Stopping...');
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

  return {
    isListening,
    isSupported,
    status,
    statusMessage: STATUS_MESSAGES[status],
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
  };
}
