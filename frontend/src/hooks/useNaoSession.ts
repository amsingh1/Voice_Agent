import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    QiSession: new (address: string) => NaoQiSession;
  }
}

interface NaoSocket {
  on: (event: string, handler: (...args: unknown[]) => void) => NaoSocket;
  disconnect: () => void;
}

interface NaoQiSession {
  socket: () => NaoSocket;
  service: (name: string) => { done: (cb: (svc: unknown) => void) => { fail: (cb: (err: unknown) => void) => void } };
}

// Behaviour map from tata_export (tested and confirmed working on NAOqi 2.1)
const BEHAVIOR_MAP: Record<string, string[]> = {
  '.-': [
    'Stand/Emotions/Negative/Shocked_1',
    'Stand/Emotions/Neutral/Annoyed_1',
    'Stand/Emotions/Neutral/AskForAttention_3',
    'Stand/Emotions/Neutral/Embarrassed_1',
  ],
  '-.': [
    'Stand/BodyTalk/Speaking/BodyTalk_1', 'Stand/BodyTalk/Speaking/BodyTalk_2',
    'Stand/BodyTalk/Speaking/BodyTalk_3', 'Stand/BodyTalk/Speaking/BodyTalk_4',
    'Stand/BodyTalk/Speaking/BodyTalk_5', 'Stand/BodyTalk/Speaking/BodyTalk_6',
    'Stand/BodyTalk/Speaking/BodyTalk_7', 'Stand/BodyTalk/Speaking/BodyTalk_8',
    'Stand/BodyTalk/Speaking/BodyTalk_9', 'Stand/BodyTalk/Speaking/BodyTalk_10',
    'Stand/BodyTalk/Speaking/BodyTalk_11', 'Stand/BodyTalk/Speaking/BodyTalk_12',
    'Stand/BodyTalk/Speaking/BodyTalk_13', 'Stand/BodyTalk/Speaking/BodyTalk_14',
    'Stand/BodyTalk/Speaking/BodyTalk_15', 'Stand/BodyTalk/Speaking/BodyTalk_16',
    'Stand/BodyTalk/Speaking/BodyTalk_17', 'Stand/BodyTalk/Speaking/BodyTalk_18',
    'Stand/BodyTalk/Speaking/BodyTalk_19', 'Stand/BodyTalk/Speaking/BodyTalk_20',
    'Stand/BodyTalk/Speaking/BodyTalk_21', 'Stand/BodyTalk/Speaking/BodyTalk_22',
  ],
  '.-.': [
    'Stand/Emotions/Negative/Angry_1', 'Stand/Emotions/Negative/Angry_3',
    'Stand/Emotions/Negative/Angry_4', 'Stand/Emotions/Negative/Disappointed_1',
    'Stand/Emotions/Negative/Frustrated_1', 'Stand/Emotions/Neutral/Confused_1',
  ],
  '|.': ['Stand/Emotions/Negative/Anxious_1'],
  '..|': [],
  '|..': [],
  '.|': [
    'Stand/BodyTalk/Listening/ListeningLeft_1',
    'Stand/BodyTalk/Listening/ListeningRight_1',
  ],
  '|-': [
    'Stand/BodyTalk/Thinking/Remember_1', 'Stand/BodyTalk/Thinking/Remember_2',
    'Stand/BodyTalk/Thinking/Remember_3', 'Stand/Emotions/Neutral/Mischievous_1',
  ],
  '-|': ['Stand/Emotions/Neutral/Hello_1'],
  '||': ['Stand/Emotions/Neutral/Hello_1'],
  '|.|': ['Stand/BodyTalk/Listening/Listening_2'],
  '.|.': ['Stand/Emotions/Negative/Bored_1', 'Stand/Emotions/Negative/Bored_2'],
  '.-|': ['Stand/Emotions/Negative/Fear_1', 'Stand/Emotions/Neutral/Suspicious_1'],  // .|- in tata_export
  '-|-': [
    'Stand/Emotions/Negative/Surprised_1', 'Stand/Emotions/Negative/Surprised_2',
    'Stand/Emotions/Negative/Surprised_3',
  ],
};

// NAO robot speaks at roughly 13 characters per second when using its TTS
const CHARS_PER_SECOND = 13;

export function useNaoSession() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qiSessionRef = useRef<NaoQiSession | null>(null);
  const behaviorManagerRef = useRef<unknown>(null);
  const basicAwarenessRef = useRef<unknown>(null);
  const postureRef = useRef<unknown>(null);
  const pendingTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const runBehavior = useCallback((name: string) => {
    if (!behaviorManagerRef.current) return;
    (behaviorManagerRef.current as { runBehavior: (n: string) => void }).runBehavior(name);
  }, []);

  const connect = useCallback((ip: string) => {
    if (isConnecting || isConnected) return;

    if (!window.QiSession) {
      setError('qimessaging.js not loaded — check that the script tag is present in index.html');
      return;
    }

    setError(null);
    setIsConnecting(true);
    console.log(`[NAO] Connecting to ${ip}:80 via qimessaging.js`);

    const qi = new window.QiSession(`${ip}:80`);
    qiSessionRef.current = qi;

    qi.socket()
      .on('connect', () => {
        console.log('[NAO] QiSession connected');
        setIsConnected(true);
        setIsConnecting(false);

        // ALBehaviorManager — drives body animations
        qi.service('ALBehaviorManager').done((bm) => {
          behaviorManagerRef.current = bm;
          console.log('[NAO] ALBehaviorManager ready');
        }).fail((err) => {
          console.warn('[NAO] ALBehaviorManager unavailable:', err);
        });

        // ALRobotPosture — stand/sit/rest commands
        qi.service('ALRobotPosture').done((posture) => {
          postureRef.current = posture;
          console.log('[NAO] ALRobotPosture ready');
        }).fail((err) => {
          console.warn('[NAO] ALRobotPosture unavailable:', err);
        });

        // ALBasicAwareness — disable auto-distraction so robot stays focused
        qi.service('ALBasicAwareness').done((ba) => {
          basicAwarenessRef.current = ba;
          const svc = ba as { setStimulusDetectionEnabled: (s: string, v: boolean) => void };
          ['Movement', 'People', 'Sound', 'Touch'].forEach((stimulus) =>
            svc.setStimulusDetectionEnabled(stimulus, false)
          );
          console.log('[NAO] ALBasicAwareness: auto-stimuli disabled');
        }).fail((err) => {
          console.warn('[NAO] ALBasicAwareness unavailable:', err);
        });
      })
      .on('disconnect', () => {
        console.log('[NAO] QiSession disconnected');
        setIsConnected(false);
        setIsConnecting(false);
        behaviorManagerRef.current = null;
        basicAwarenessRef.current = null;
        postureRef.current = null;
      })
      .on('error', (err) => {
        console.error('[NAO] Connection error:', err);
        setError(`NAO connection failed: ${err}`);
        setIsConnected(false);
        setIsConnecting(false);
      });
  }, [isConnecting, isConnected]);

  const standUp = useCallback(() => {
    if (!postureRef.current) return;
    const svc = postureRef.current as { goToPosture: (p: string, speed: number) => void };
    console.log('[NAO] Standing up');
    svc.goToPosture('Stand', 0.5);
  }, []);

  const sit = useCallback(() => {
    if (!postureRef.current) return;
    const svc = postureRef.current as { goToPosture: (p: string, speed: number) => void };
    console.log('[NAO] Sitting');
    svc.goToPosture('Sit', 0.5);
  }, []);

  const rest = useCallback(() => {
    if (!postureRef.current) return;
    const svc = postureRef.current as { goToPosture: (p: string, speed: number) => void };
    console.log('[NAO] Going to rest posture');
    svc.goToPosture('Crouch', 0.5);
  }, []);

  const disconnect = useCallback(() => {
    pendingTimeoutsRef.current.forEach(clearTimeout);
    pendingTimeoutsRef.current = [];

    if (qiSessionRef.current) {
      qiSessionRef.current.socket().disconnect();
      qiSessionRef.current = null;
    }
    behaviorManagerRef.current = null;
    basicAwarenessRef.current = null;
    postureRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  /**
   * Parse behaviour tags embedded in the AI transcript and trigger matching
   * NAO animations with a delay proportional to where the tag appears in the
   * text — so the gesture lines up with when the robot reaches that word.
   *
   * Tags use the same format confirmed working in tata_export, e.g. [-.]
   * for BodyTalk gestures or [||] for a greeting wave.
   */
  const scheduleBehaviors = useCallback((transcript: string) => {
    // Clear any animations queued from the previous response
    pendingTimeoutsRef.current.forEach(clearTimeout);
    pendingTimeoutsRef.current = [];

    if (!behaviorManagerRef.current || !isConnected) return;

    const msPerChar = 1000 / CHARS_PER_SECOND;
    const tagRegex = /\[([^\]]+)\]/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(transcript)) !== null) {
      const tag = match[1];
      const charPosition = match.index;
      const behaviors = BEHAVIOR_MAP[tag];

      if (behaviors && behaviors.length > 0) {
        const chosen = behaviors[Math.floor(Math.random() * behaviors.length)];
        const delayMs = charPosition * msPerChar;

        const id = setTimeout(() => runBehavior(chosen), delayMs);
        pendingTimeoutsRef.current.push(id);
        console.log(`[NAO] Scheduled "${chosen}" in ${delayMs.toFixed(0)}ms (tag [${tag}] @ char ${charPosition})`);
      }
    }
  }, [isConnected, runBehavior]);

  // Cleanup on unmount
  useEffect(() => () => disconnect(), [disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    runBehavior,
    scheduleBehaviors,
    standUp,
    sit,
    rest,
  };
}
