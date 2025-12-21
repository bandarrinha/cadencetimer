import { useRef, useCallback, useEffect } from 'react';

export const useTTS = () => {
    const audioContextRef = useRef(null);

    // Initialize AudioContext on user interaction/mount (needed for some browsers)
    useEffect(() => {
        // We defer creation until needed or interaction, but good to have ref ready
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioContextRef.current = new AudioContext();
        }
    }, []);

    const speak = useCallback((text, rate = 1.0, pitch = 1.0) => {
        if (!('speechSynthesis' in window)) return;

        // Cancel any current speaking
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate; // Speed: 0.1 to 10
        utterance.pitch = pitch; // Pitch: 0 to 2
        utterance.lang = 'pt-BR'; // Portuguese Brazil

        window.speechSynthesis.speak(utterance);
    }, []);

    const playBeep = useCallback((frequency = 440, duration = 0.1, type = 'sine') => {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioContextRef.current = new AudioContext();
            }
        }

        const ctx = audioContextRef.current;
        if (!ctx) return;

        // Create oscillator
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);

        // Connect
        osc.connect(gain);
        gain.connect(ctx.destination);

        // Play
        osc.start();

        // Smooth release
        gain.gain.setValueAtTime(1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.stop(ctx.currentTime + duration);
    }, []);

    return { speak, playBeep };
};
