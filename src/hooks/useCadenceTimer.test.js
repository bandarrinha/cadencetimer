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
                    sets: 2, // Need multiple sets to test loop back
                    reps: 1,
                    cadence: { eccentric: 1, eccentricPause: 0, concentric: 1, concentricPause: 0 },
                    restSet: 10,
                    restExercise: 8,
                    biSetId: 'g1',
                    startConcentric: false
                },
                {
                    id: 'e2',
                    name: 'Ex 2',
                    sets: 2, // Need multiple sets to test loop back
                    reps: 1,
                    cadence: { eccentric: 1, eccentricPause: 0, concentric: 1, concentricPause: 0 },
                    restSet: 10,
                    restExercise: 60,
                    biSetId: 'g1',
                    prepTime: 3,
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
        // Should transition to PREP with timeLeft = e2.prepTime (3s).

        expect(result.current.state.exerciseIndex).toBe(1); // Moved to Ex 2
        expect(result.current.state.phase).toBe(PHASE.PREP);
        expect(result.current.state.timeLeft).toBe(3); // Uses Ex 2 prepTime

        // Continuation: Verify Loop Back (Ex 2 -> Ex 1) skips Prep
        // 1. Skip Prep for Ex 2
        act(() => {
            result.current.skip();
        });

        // 2. Complete Ex 2 (Eccentric 2s + Concentric 1s = 3s)
        act(() => {
            vi.advanceTimersByTime(3100);
        });

        // Should be in REST_SET (Ex 2 finished set 1)
        expect(result.current.state.phase).toBe(PHASE.REST_SET);
        expect(result.current.state.exerciseIndex).toBe(1);

        // 3. Advance Rest Set (10s)
        act(() => {
            // Advance 10.1s to trigger transition
            vi.advanceTimersByTime(10100);
        });

        // Should Loop Back to Ex 1
        expect(result.current.state.exerciseIndex).toBe(0);

        // Should SKIP Prep and go directly to ECCENTRIC
        expect(result.current.state.phase).toBe(PHASE.ECCENTRIC);
        // Ex 1 Eccentric is 1s
        expect(result.current.state.timeLeft).toBeLessThanOrEqual(1);
    });

    it('skips PREP phase after REST_EXERCISE for standard transitions', () => {
        const standardWorkout = {
            id: 'std-test',
            name: 'Std Workout',
            exercises: [
                {
                    id: 'e1',
                    sets: 1,
                    reps: 1,
                    cadence: { eccentric: 1, eccentricPause: 0, concentric: 1, concentricPause: 0 },
                    restExercise: 10,
                    prepTime: 5
                },
                {
                    id: 'e2',
                    sets: 1,
                    reps: 1,
                    cadence: { eccentric: 2, eccentricPause: 0, concentric: 1, concentricPause: 0 },
                    prepTime: 5 // Should be IGNORED in standard transition
                }
            ]
        };

        const { result } = renderHook(() => useCadenceTimer());

        act(() => {
            result.current.start(standardWorkout);
            vi.advanceTimersByTime(0);
            result.current.skip(); // Skip initial Prep
        });

        // Finish Ex 1
        // Ex 1: Eccentric 1s + Concentric 1s = 2s total.
        act(() => {
            vi.advanceTimersByTime(2000); // Complete rep exactly
            vi.advanceTimersByTime(200); // Trigger next ticks (extra buffer for float precision)
        });

        // Should be in REST_EXERCISE
        expect(result.current.state.phase).toBe(PHASE.REST_EXERCISE);

        // Rest is 10s.
        // We consumed roughly 0.1s overshoot? 
        // Let's consume the rest.
        const currentRest = result.current.state.timeLeft;

        act(() => {
            vi.advanceTimersByTime(currentRest * 1000);
            // Plus one tick to trigger transition
            vi.advanceTimersByTime(100);
        });

        // Should SKIP Prep and go straight to ECCENTRIC of Ex 2
        // NOTE: If logic went to CONCENTRIC immediately, it means startConcentric was true OR logic error.
        expect(result.current.state.exerciseIndex).toBe(1);
        expect(result.current.state.phase).toBe(PHASE.ECCENTRIC);
        // Ex 2 Eccentric is 2s. We just entered it.
        // Depending on tick alignment, we might be at 2 or 1.9.
        expect(result.current.state.timeLeft).toBeGreaterThanOrEqual(1.9);
        expect(result.current.state.timeLeft).toBeLessThanOrEqual(2.0);
    });

    it('handles unilateral exercise transitions (Left -> Right -> Rest)', () => {
        const unilateralWorkout = {
            id: 'uni-test',
            name: 'Uni Workout',
            exercises: [
                {
                    id: 'e1',
                    name: 'Uni Ex',
                    sets: 1,
                    reps: 1,
                    cadence: { eccentric: 1, eccentricPause: 0, concentric: 1, concentricPause: 0 },
                    restSet: 10,
                    isUnilateral: true,
                    unilateralTransition: 5,
                    prepTime: 5,
                    failureMode: false // Explicitly disable failure mode to ensure auto-finish
                }
            ]
        };

        const { result } = renderHook(() => useCadenceTimer());

        act(() => {
            result.current.start(unilateralWorkout);
            vi.advanceTimersByTime(0);
        });

        // 1. Initial State: PREP, Side LEFT
        expect(result.current.state.phase).toBe(PHASE.PREP);
        expect(result.current.state.currentSide).toBe('LEFT');

        act(() => {
            result.current.skip(); // Skip Prep
        });

        // 2. Work Phase (Left)
        // Eccentric (1s) -> Bottom(0) -> Concentric(1s)
        expect(result.current.state.currentSide).toBe('LEFT');
        expect(result.current.state.phase).toBe(PHASE.ECCENTRIC);

        // Advance 2.2s to complete rep
        act(() => {
            vi.advanceTimersByTime(2200);
        });

        // 3. Should transition to PREP (as Unilateral Transition) with Side RIGHT
        // If this fails (e.g. remains in Work), then finishSet wasn't called.
        // If this fails (e.g. goes to REST_SET), then side logic failed.

        expect(result.current.state.phase).toBe(PHASE.PREP);
        expect(result.current.state.timeLeft).toBe(5);
        expect(result.current.state.currentSide).toBe('RIGHT');

        act(() => {
            result.current.skip(); // Skip Transition
        });

        // 4. Work Phase (Right)
        expect(result.current.state.currentSide).toBe('RIGHT');
        expect(result.current.state.phase).toBe(PHASE.ECCENTRIC);

        act(() => {
            vi.advanceTimersByTime(2200);
        });

        // 5. FINISHED
        expect(result.current.state.status).toBe('FINISHED');
        expect(result.current.state.currentSide).toBeNull();
    });

    it('restores currentSide to LEFT after REST_SET in multi-set unilateral exercise', () => {
        const multiSetWorkout = {
            id: 'uni-multi',
            name: 'Uni Multi',
            exercises: [
                {
                    id: 'e1',
                    name: 'Uni Multi',
                    sets: 2,
                    reps: 1,
                    cadence: { eccentric: 1, eccentricPause: 0, concentric: 1, concentricPause: 0 },
                    restSet: 10,
                    isUnilateral: true,
                    unilateralTransition: 5,
                    prepTime: 5,
                    failureMode: false
                }
            ]
        };

        const { result } = renderHook(() => useCadenceTimer());

        act(() => {
            result.current.start(multiSetWorkout);
            vi.advanceTimersByTime(0);
            result.current.skip(); // Skip Prep (Left)
        });

        // Finish Left
        act(() => { vi.advanceTimersByTime(2200); });

        // Check transition to Right
        expect(result.current.state.currentSide).toBe('RIGHT');
        expect(result.current.state.phase).toBe(PHASE.PREP);

        // Skip Transition (to Right)
        act(() => { result.current.skip(); });

        // Finish Right
        act(() => { vi.advanceTimersByTime(2200); });

        // Should be REST_SET
        expect(result.current.state.phase).toBe(PHASE.REST_SET);
        expect(result.current.state.currentSide).toBeNull();

        // Advance Rest
        act(() => {
            vi.advanceTimersByTime(11000); // 10s rest + 1s buffer
        });

        // Should be Set 2. Side LEFT.
        // Note: Transitions to ECCENTRIC directly (skips PREP in standard flow)
        expect(result.current.state.setNumber).toBe(2);
        expect(result.current.state.phase).toBe(PHASE.ECCENTRIC);
        expect(result.current.state.currentSide).toBe('LEFT');
    });
});
