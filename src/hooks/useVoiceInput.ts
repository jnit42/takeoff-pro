/**
 * Voice Input Hook - Enhanced with status, push-to-talk, error handling
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'error' | 'not-supported' | 'permission-denied';

interface UseVoiceInputOptions {
  onResult?: (transcript: string) => void;
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
  idle: 'Click to speak',
  listening: 'Listening... speak now',
  processing: 'Processing...',
  error: 'Error occurred',
  'not-supported': 'Voice not supported in this browser. Try Chrome.',
  'permission-denied': 'Microphone access denied. Please allow in browser settings.',
};

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { onResult, onError, onStatusChange, language = 'en-US', autoPunctuation = true } = options;
  
  const [status, setStatus] = useState<VoiceStatus>(() => {
    if (!SpeechRecognition) return 'not-supported';
    return 'idle';
  });
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const isSupported = Boolean(SpeechRecognition);
  const isListening = status === 'listening';

  const updateStatus = useCallback((newStatus: VoiceStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  useEffect(() => {
    if (!SpeechRecognition) {
      updateStatus('not-supported');
      return;
    }

    const recognition = new SpeechRecognition() as SpeechRecognitionInstance;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      setInterimTranscript(interim);

      if (finalTranscript) {
        // Auto-punctuation: add period if missing at end
        let processed = finalTranscript.trim();
        if (autoPunctuation && processed.length > 0 && !/[.!?]$/.test(processed)) {
          processed += '.';
        }
        setTranscript(processed);

        if (onResult) {
          onResult(processed);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      
      let errorStatus: VoiceStatus = 'error';
      let message = 'Speech recognition error';

      switch (event.error) {
        case 'not-allowed':
          errorStatus = 'permission-denied';
          message = 'Microphone access denied. Please allow microphone access in your browser settings.';
          break;
        case 'no-speech':
          message = 'No speech detected. Please try again.';
          updateStatus('idle');
          break;
        case 'network':
          message = 'Network error. Please check your connection.';
          break;
        case 'aborted':
          message = 'Speech recognition stopped.';
          updateStatus('idle');
          return;
        default:
          message = event.message || 'Speech recognition error';
      }

      updateStatus(errorStatus);
      
      if (onError) {
        onError(message);
      }
    };
    recognition.onend = () => {
      if (status !== 'permission-denied' && status !== 'not-supported') {
        updateStatus('idle');
      }
      setInterimTranscript('');
    };

    recognition.onstart = () => {
      updateStatus('listening');
      setTranscript('');
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [language, onResult, onError, autoPunctuation, updateStatus, status]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    
    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      updateStatus('error');
    }
  }, [isListening, updateStatus]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    
    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

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
