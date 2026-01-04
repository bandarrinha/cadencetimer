
import { timerReducer, PHASE } from './useCadenceTimer';
import { describe, test, expect } from 'vitest';

// Mock Data
const MOCK_EXERCISE_LEFT = {
    id: 'ex-1',
    name: 'Ex Left',
    sets: 3,
    reps: 10,
    cadence: { eccentric: 1, eccentricPause: 0, concentric: 1, concentricPause: 0 },
    restSet: 10,
    restExercise: 10,
    prepTime: 5,
    isUnilateral: true,
    startSide: 'LEFT'
};

const MOCK_EXERCISE_RIGHT = {
    ...MOCK_EXERCISE_LEFT,
    id: 'ex-2',
    name: 'Ex Right',
    startSide: 'RIGHT'
};

const MOCK_WORKOUT = {
    id: 'w-1',
    exercises: [MOCK_EXERCISE_LEFT, MOCK_EXERCISE_RIGHT]
};

const INITIAL_STATE = {
    status: 'IDLE',
    exerciseIndex: 0,
    setNumber: 1,
    repNumber: 0,
    actualReps: 0,
    phase: PHASE.IDLE,
    timeLeft: 0,
    phaseDuration: 0,
    workout: null,
    weightData: [],
    currentSide: null,
    nextStartSide: 'LEFT'
};

describe('timerReducer Unilateral Start Side', () => {

    test('Initializes with configured start side (Left)', () => {
        const action = { type: 'START' };
        // INIT first
        let state = timerReducer(INITIAL_STATE, { type: 'INIT', payload: MOCK_WORKOUT });
        state = timerReducer(state, action);

        expect(state.currentSide).toBe('LEFT');
        expect(state.nextStartSide).toBe('LEFT');
    });

    test('Initializes with configured start side (Right)', () => {
        const workoutRight = { ...MOCK_WORKOUT, exercises: [MOCK_EXERCISE_RIGHT] };

        let state = timerReducer(INITIAL_STATE, { type: 'INIT', payload: workoutRight });
        state = timerReducer(state, { type: 'START' });

        expect(state.currentSide).toBe('RIGHT');
        expect(state.nextStartSide).toBe('RIGHT');
    });

    test('Transitions to Next Exercise with correct start side', () => {
        // Start with Ex Left (Index 0)
        let state = timerReducer(INITIAL_STATE, { type: 'INIT', payload: MOCK_WORKOUT });
        state = timerReducer(state, { type: 'START' });

        // Fast forward to finish workout
        // Actually we just want to test transition logic.
        // Let's manually set state to REST_EXERCISE at end of Ex 0
        state = {
            ...state,
            phase: PHASE.REST_EXERCISE,
            exerciseIndex: 0,
            timeLeft: 0
        };

        // Tick to trigger transition
        state = timerReducer(state, { type: 'TICK', payload: 1 });

        // Should be at Ex 1 (Right)
        expect(state.exerciseIndex).toBe(1);
        expect(state.currentSide).toBe('RIGHT');
        expect(state.nextStartSide).toBe('RIGHT');
    });

    test('Bi-Set Transition respects start side', () => {
        // Setup Bi-Set: Ex 1 (Right) -> Ex 2 (Left)
        const Ex1 = { ...MOCK_EXERCISE_RIGHT, biSetId: 'bi-1', id: 'ex-1' };
        const Ex2 = { ...MOCK_EXERCISE_LEFT, biSetId: 'bi-1', id: 'ex-2' };
        const workout = { exercises: [Ex1, Ex2] };

        let state = timerReducer(INITIAL_STATE, { type: 'INIT', payload: workout });
        state = timerReducer(state, { type: 'START' });

        // Verify Start
        expect(state.currentSide).toBe('RIGHT');

        // Verify Finish Set logic (Ex 1 -> Ex 2)
        // We need to simulate finishing the first side, then second side.

        // 1. Finish Right (Start) -> Transition to Left
        state = timerReducer(state, { type: 'REGISTER_FAILURE' }); // Force finish Side 1
        expect(state.currentSide).toBe('LEFT'); // Other side

        // 2. Finish Left (End) -> Transition to Ex 2
        state = timerReducer(state, { type: 'REGISTER_FAILURE' }); // Force finish Side 2

        // Should be Prep for Ex 2
        expect(state.exerciseIndex).toBe(1);
        expect(state.currentSide).toBe('LEFT'); // Ex 2 starts Left
        expect(state.nextStartSide).toBe('LEFT');
    });

    test('Bi-Set Loop Back respects start side', () => {
        // Setup Bi-Set: Ex 1 (Right) -> Ex 2 (Left)
        const Ex1 = { ...MOCK_EXERCISE_RIGHT, biSetId: 'bi-1', id: 'ex-1' };
        const Ex2 = { ...MOCK_EXERCISE_LEFT, biSetId: 'bi-1', id: 'ex-2' };
        const workout = { exercises: [Ex1, Ex2] };

        let state = timerReducer(INITIAL_STATE, { type: 'INIT', payload: workout });
        state = timerReducer(state, { type: 'START' });

        // Advance to Ex 2
        state = { ...state, exerciseIndex: 1, currentSide: 'LEFT', nextStartSide: 'LEFT', setNumber: 1 };

        // Finish Ex 2 (Left -> Right)
        state = timerReducer(state, { type: 'REGISTER_FAILURE' }); // Finish Side 1 (Left) -> Right
        expect(state.currentSide).toBe('RIGHT');

        state = timerReducer(state, { type: 'REGISTER_FAILURE' }); // Finish Side 2 (Right) -> Rest Set

        expect(state.phase).toBe(PHASE.REST_SET);

        // Tick to trigger Loop Back (Rest expired)
        state = { ...state, timeLeft: 0 };
        state = timerReducer(state, { type: 'TICK', payload: 1 });

        // Should loop back to Ex 1
        expect(state.exerciseIndex).toBe(0);
        expect(state.currentSide).toBe('RIGHT'); // Ex 1 defaults to Right
        expect(state.nextStartSide).toBe('RIGHT'); // Should have updated nextStartSide
    });

});
