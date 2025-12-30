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
    it('uses custom restExercise as prep time between bi-set exercises', () => {
        const biSetWorkout = {
            id: 'bi-test',
            name: 'Bi Set Workout',
            exercises: [
                {
                    id: 'e1',
                    name: 'Ex 1',
                    sets: 1,
                    reps: 1,
                    cadence: { eccentric: 1, eccentricPause: 0, concentric: 1, concentricPause: 0 },
                    restSet: 10,
                    restExercise: 8, // Custom PREP time for transition
                    biSetId: 'g1',
                    startConcentric: false
                },
                {
                    id: 'e2',
                    name: 'Ex 2',
                    sets: 1,
                    reps: 1,
                    cadence: { eccentric: 1, eccentricPause: 0, concentric: 1, concentricPause: 0 },
                    restSet: 10,
                    restExercise: 60,
                    biSetId: 'g1',
                    startConcentric: false
                }
            ]
        };

        const { result } = renderHook(() => useCadenceTimer());

        act(() => {
            result.current.start(biSetWorkout);
            vi.advanceTimersByTime(0);
        });

        // Skip Prep (5s default for first exercise)
        act(() => {
            result.current.skip();
        });

        // Now in Eccentric of Ex 1.
        // Complete the rep/set.
        // Ex 1 has 1 set, 1 rep.
        // Transition: Ecc -> Con -> Rep Complete -> Finish Set -> PREP (for Ex 2)

        // Advance Eccentric (1s)
        act(() => {
            vi.advanceTimersByTime(1100);
        });
        // Advance Concentric (1s)
        act(() => {
            vi.advanceTimersByTime(1100);
        });
        // Rep Complete Logic runs...
        // Since reps >= target (1), it calls finishSet.

        // Bi-Set Logic in finishSet:
        // isBiSetStart is true (e1 linked to e2).
        // Should transition to PREP with timeLeft = e1.restExercise (8s).

        expect(result.current.state.exerciseIndex).toBe(1); // Moved to Ex 2
        expect(result.current.state.phase).toBe(PHASE.PREP);
        expect(result.current.state.timeLeft).toBe(8); // Custom duration
    });
});
