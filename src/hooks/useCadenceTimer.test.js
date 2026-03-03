import { describe, it, expect } from 'vitest';
import { timerReducer, PHASE } from './useCadenceTimer';

// Helper: create a minimal exercise config
function makeExercise(overrides = {}) {
    return {
        id: 'e1',
        name: 'Test Exercise',
        sets: 3,
        reps: 3,
        failureMode: false,
        startConcentric: false,
        isIsometric: false,
        cadence: { eccentric: 3, eccentricPause: 1, concentric: 2, concentricPause: 1 },
        restSet: 45,
        restExercise: 60,
        biSetId: null,
        prepTime: 5,
        peakContraction: { enabled: false, duration: 3, position: 'after_concentric' },
        ...overrides
    };
}

// Helper: create a state ready for transition
function makeState(exercise, phase, overrides = {}) {
    return {
        status: 'RUNNING',
        exerciseIndex: 0,
        setNumber: 1,
        repNumber: 0,
        actualReps: 0,
        phase,
        timeLeft: 0, // expired, ready for transition
        phaseDuration: 0,
        workout: { id: 'w1', exercises: [exercise] },
        weightData: [],
        currentSide: null,
        nextStartSide: 'LEFT',
        peakContractionDone: false,
        isometricTime: 0,
        totalWorkoutTime: 0,
        ...overrides
    };
}

// Simulate a sequence of phase transitions by sending SKIP_PHASE actions
function collectPhaseSequence(initialState, maxSteps = 20) {
    let state = initialState;
    const phases = [state.phase];

    for (let i = 0; i < maxSteps; i++) {
        const nextState = timerReducer(state, { type: 'SKIP_PHASE' });
        if (nextState.phase === state.phase && nextState.timeLeft === state.timeLeft) break;
        phases.push(nextState.phase);
        if (nextState.phase === PHASE.REST_SET || nextState.phase === PHASE.FINISHED) break;
        state = nextState;
    }

    return { phases, finalState: state };
}

describe('useCadenceTimer - Peak Contraction', () => {
    describe('No peak contraction (disabled)', () => {
        it('follows standard phase order without PEAK_CONTRACTION', () => {
            const ex = makeExercise();
            const state = makeState(ex, PHASE.PREP);
            const { phases } = collectPhaseSequence(state);

            expect(phases[0]).toBe(PHASE.PREP);
            expect(phases[1]).toBe(PHASE.ECCENTRIC);
            expect(phases[2]).toBe(PHASE.BOTTOM_HOLD);
            expect(phases[3]).toBe(PHASE.CONCENTRIC);
            expect(phases[4]).toBe(PHASE.TOP_HOLD);
            expect(phases).not.toContain(PHASE.PEAK_CONTRACTION);
        });
    });

    describe('after_concentric position', () => {
        it('inserts PEAK_CONTRACTION after CONCENTRIC', () => {
            const ex = makeExercise({
                peakContraction: { enabled: true, duration: 3, position: 'after_concentric' }
            });
            const state = makeState(ex, PHASE.PREP);
            const { phases } = collectPhaseSequence(state);

            expect(phases[0]).toBe(PHASE.PREP);
            expect(phases[1]).toBe(PHASE.ECCENTRIC);
            expect(phases[2]).toBe(PHASE.BOTTOM_HOLD);
            expect(phases[3]).toBe(PHASE.CONCENTRIC);
            expect(phases[4]).toBe(PHASE.PEAK_CONTRACTION);
            expect(phases[5]).toBe(PHASE.TOP_HOLD);
        });

        it('uses configured duration for peak contraction', () => {
            const ex = makeExercise({
                peakContraction: { enabled: true, duration: 4, position: 'after_concentric' }
            });
            const state = makeState(ex, PHASE.CONCENTRIC);
            const next = timerReducer(state, { type: 'SKIP_PHASE' });
            expect(next.phase).toBe(PHASE.PEAK_CONTRACTION);
            expect(next.timeLeft).toBe(4);
            expect(next.phaseDuration).toBe(4);
        });
    });

    describe('before_concentric position', () => {
        it('inserts PEAK_CONTRACTION before CONCENTRIC', () => {
            const ex = makeExercise({
                peakContraction: { enabled: true, duration: 3, position: 'before_concentric' }
            });
            const state = makeState(ex, PHASE.PREP);
            const { phases } = collectPhaseSequence(state);

            expect(phases[0]).toBe(PHASE.PREP);
            expect(phases[1]).toBe(PHASE.ECCENTRIC);
            expect(phases[2]).toBe(PHASE.BOTTOM_HOLD);
            expect(phases[3]).toBe(PHASE.PEAK_CONTRACTION);
            expect(phases[4]).toBe(PHASE.CONCENTRIC);
            expect(phases[5]).toBe(PHASE.TOP_HOLD);
        });
    });

    describe('mid_concentric position', () => {
        it('splits concentric in two halves with PEAK in between', () => {
            const ex = makeExercise({
                cadence: { eccentric: 3, eccentricPause: 1, concentric: 4, concentricPause: 1 },
                peakContraction: { enabled: true, duration: 3, position: 'mid_concentric' }
            });
            const state = makeState(ex, PHASE.PREP);
            const { phases } = collectPhaseSequence(state);

            expect(phases[0]).toBe(PHASE.PREP);
            expect(phases[1]).toBe(PHASE.ECCENTRIC);
            expect(phases[2]).toBe(PHASE.BOTTOM_HOLD);
            expect(phases[3]).toBe(PHASE.CONCENTRIC); // first half
            expect(phases[4]).toBe(PHASE.PEAK_CONTRACTION);
            expect(phases[5]).toBe(PHASE.CONCENTRIC); // second half
            expect(phases[6]).toBe(PHASE.TOP_HOLD);
        });

        it('first and second concentric halves use exact half duration', () => {
            const ex = makeExercise({
                cadence: { eccentric: 3, eccentricPause: 1, concentric: 5, concentricPause: 1 },
                peakContraction: { enabled: true, duration: 3, position: 'mid_concentric' }
            });
            const state = makeState(ex, PHASE.BOTTOM_HOLD);
            const afterBottom = timerReducer(state, { type: 'SKIP_PHASE' });
            expect(afterBottom.phase).toBe(PHASE.CONCENTRIC);
            expect(afterBottom.timeLeft).toBe(2.5); // 5/2 = 2.5

            const afterFirstCon = timerReducer(afterBottom, { type: 'SKIP_PHASE' });
            expect(afterFirstCon.phase).toBe(PHASE.PEAK_CONTRACTION);
            expect(afterFirstCon.timeLeft).toBe(3);

            const afterPeak = timerReducer(afterFirstCon, { type: 'SKIP_PHASE' });
            expect(afterPeak.phase).toBe(PHASE.CONCENTRIC);
            expect(afterPeak.timeLeft).toBe(2.5); // 5/2 = 2.5
            expect(afterPeak.peakContractionDone).toBe(true);
        });
    });

    describe('inverted order (startConcentric=true)', () => {
        it('inserts PEAK correctly with after_concentric in inverted order', () => {
            const ex = makeExercise({
                startConcentric: true,
                peakContraction: { enabled: true, duration: 3, position: 'after_concentric' }
            });
            const state = makeState(ex, PHASE.PREP);
            const { phases } = collectPhaseSequence(state);

            // Inverted: PREP -> CON -> PEAK -> TOP -> ECC -> BOTTOM -> ...
            expect(phases[0]).toBe(PHASE.PREP);
            expect(phases[1]).toBe(PHASE.CONCENTRIC);
            expect(phases[2]).toBe(PHASE.PEAK_CONTRACTION);
            expect(phases[3]).toBe(PHASE.TOP_HOLD);
            expect(phases[4]).toBe(PHASE.ECCENTRIC);
            expect(phases[5]).toBe(PHASE.BOTTOM_HOLD);
        });

        it('inserts PEAK correctly with before_concentric in inverted order', () => {
            const ex = makeExercise({
                startConcentric: true,
                peakContraction: { enabled: true, duration: 3, position: 'before_concentric' }
            });
            const state = makeState(ex, PHASE.PREP);
            const { phases } = collectPhaseSequence(state);

            // Inverted: PREP -> PEAK -> CON -> TOP -> ECC -> BOTTOM -> ...
            expect(phases[0]).toBe(PHASE.PREP);
            expect(phases[1]).toBe(PHASE.PEAK_CONTRACTION);
            expect(phases[2]).toBe(PHASE.CONCENTRIC);
            expect(phases[3]).toBe(PHASE.TOP_HOLD);
        });
    });

    describe('peak contraction resets between reps', () => {
        it('peakContractionDone resets to false at each new rep', () => {
            const ex = makeExercise({
                reps: 2,
                cadence: { eccentric: 3, eccentricPause: 1, concentric: 4, concentricPause: 1 },
                peakContraction: { enabled: true, duration: 3, position: 'mid_concentric' }
            });
            const state = makeState(ex, PHASE.PREP);
            const { phases } = collectPhaseSequence(state);

            const peakCount = phases.filter(p => p === PHASE.PEAK_CONTRACTION).length;
            expect(peakCount).toBe(2);
        });
    });
});
