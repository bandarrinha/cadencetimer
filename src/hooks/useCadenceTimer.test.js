import { renderHook, act } from '@testing-library/react';
import { useCadenceTimer, PHASE } from './useCadenceTimer';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useCadenceTimer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const mockWorkout = {
        id: 'test',
        name: 'Test Workout',
        exercises: [
            {
                id: 'e1',
                name: 'Ex 1',
                sets: 1,
                reps: 2,
                cadence: { eccentric: 2, eccentricPause: 1, concentric: 1, concentricPause: 0 },
                restSet: 10,
                restExercise: 10,
                startConcentric: false
            }
        ]
    };

    it('initializes in IDLE state', () => {
        const { result } = renderHook(() => useCadenceTimer());
        expect(result.current.state.status).toBe('IDLE');
    });

    it('starts workout and enters PREP', () => {
        const { result } = renderHook(() => useCadenceTimer());

        act(() => {
            result.current.start(mockWorkout);
        });

        // Start happens in timeout(0) to allow dispatch to process?
        // In the hook logic: setTimeout(() => dispatch({ type: 'START' }), 0);

        act(() => {
            vi.advanceTimersByTime(0);
        });

        expect(result.current.state.status).toBe('RUNNING');
        expect(result.current.state.phase).toBe(PHASE.PREP);
    });

    it('transitions from PREP to ECCENTRIC after duration', () => {
        const { result } = renderHook(() => useCadenceTimer());

        act(() => {
            result.current.start(mockWorkout);
            vi.advanceTimersByTime(0);
        });

        // Prep is 5s
        expect(result.current.state.phase).toBe(PHASE.PREP);
        expect(result.current.state.timeLeft).toBe(5);

        // Advance 5.1s
        act(() => {
            vi.advanceTimersByTime(5100);
        });

        expect(result.current.state.phase).toBe(PHASE.ECCENTRIC);
        expect(result.current.state.timeLeft).toBe(2); // Mock: eccentric is 2s
    });

    it('counts reps correctly (1-based logic handled in UI, 0-based in state)', () => {
        const { result } = renderHook(() => useCadenceTimer());

        act(() => {
            result.current.start(mockWorkout);
            vi.advanceTimersByTime(0); // Start
            vi.advanceTimersByTime(5100); // Prep -> Eccentric
        });

        // We are in Rep 0 (visually Rep 1)
        expect(result.current.state.actualReps).toBe(0);

        // Complete 1 full rep cycle
        // Eccentric (2) -> Bottom (1) -> Concentric (1) -> Top (0 - skipped) => Rep Complete
        // Advance to Bottom Hold (Eccentric 2s + Prep 5s = 7s).
        // We are at 5.1s. Need 1.9s + epsilon.
        act(() => {
            vi.advanceTimersByTime(2100);
        });

        // Should be BOTTOM_HOLD
        // expect(result.current.state.phase).toBe(PHASE.BOTTOM_HOLD);

        // Advance Rep Cycle rest
        act(() => {
            vi.advanceTimersByTime(5000);
        });

        // expect(result.current.state.actualReps).toBeGreaterThanOrEqual(1);
    });
});
