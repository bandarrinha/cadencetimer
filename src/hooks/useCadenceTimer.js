import { useReducer, useEffect, useRef, useCallback } from 'react';

// Definitions
export const PHASE = {
    IDLE: 'IDLE',
    PREP: 'PREP', // Get ready before first rep
    ECCENTRIC: 'ECCENTRIC',
    BOTTOM_HOLD: 'BOTTOM_HOLD',
    CONCENTRIC: 'CONCENTRIC',
    TOP_HOLD: 'TOP_HOLD',
    REST_SET: 'REST_SET',
    REST_EXERCISE: 'REST_EXERCISE',
    FINISHED: 'FINISHED',
    ISOMETRIC_WORK: 'ISOMETRIC_WORK'
};

const initialState = {
    status: 'IDLE', // IDLE, RUNNING, PAUSED
    exerciseIndex: 0,
    setNumber: 1, // 1-based
    repNumber: 0, // Completed reps
    actualReps: 0, // Actual reps performed (for failure mode)
    phase: PHASE.IDLE,
    timeLeft: 0,
    phaseDuration: 0, // To calc progress
    workout: null, // Will be populated on start
    weightData: [], // Stores history: { exerciseId, set, reps, weight, duration }
    isometricTime: 0 // Track time for pure isometric exercises
};

function timerReducer(state, action) {
    switch (action.type) {
        case 'INIT':
            return {
                ...initialState,
                status: 'IDLE',
                workout: action.payload,
                weightData: []
            };
        case 'START':
            return {
                ...state,
                status: 'RUNNING',
                phase: PHASE.PREP,
                timeLeft: 5,
                phaseDuration: 5,
                setNumber: 1,
                repNumber: 0,
                actualReps: 0,
                isometricTime: 0,
                exerciseIndex: 0
            };
        case 'PAUSE':
            return { ...state, status: 'PAUSED' };
        case 'RESUME':
            return { ...state, status: 'RUNNING' };
        case 'TICK': {
            if (state.status !== 'RUNNING') return state;

            const newTime = state.timeLeft - action.payload;

            // Isometric Logic
            let newIsoTime = state.isometricTime;
            if (state.phase === PHASE.ISOMETRIC_WORK) {
                newIsoTime += action.payload;
            }

            if (newTime > 0) {
                return { ...state, timeLeft: newTime, isometricTime: newIsoTime };
            }

            return transitionPhase({ ...state, isometricTime: newIsoTime });
        }
        case 'SKIP_PHASE':
            return transitionPhase(state);

        case 'REGISTER_FAILURE':
            // User clicked "Failure" button.
            // Finish current set immediately.
            return finishSet(state, true); // true = forced/manual finish

        case 'LOG_SET_DATA':
            // Payload: { weight }
            // We update the last history entry or a temporary holding area? 
            // Best to store in weightData array. WE assume this is regarding the PREVIOUS set just finished.
            // Identifying which set? state.exerciseIndex and state.setNumber might have already advanced if we are in Rest.
            // Actually, if we are in Rest Set, we just finished Set X. 
            // If we are in Rest Exercise, we just finished Set X (Last set).

            // Let's rely on UI to pass full data or we deduce?
            // Let's just append to weightData.

            // Find if we already have data for this set? Update it.
            const { exerciseId, setNumber, weight, reps } = action.payload;

            const existingIndex = state.weightData.findIndex(w =>
                w.exerciseId === exerciseId && w.setNumber === setNumber
            );

            let newWeightData = [...state.weightData];
            if (existingIndex >= 0) {
                newWeightData[existingIndex] = { ...newWeightData[existingIndex], weight }; // Update weight
            } else {
                newWeightData.push({ exerciseId, setNumber, reps, weight });
            }

            return { ...state, weightData: newWeightData };

        default:
            return state;
    }
}

// Helper to determine next phase based on config
function getNextPhase(phase, cadence, startConcentric) {
    // Standard: Prep -> Eccentric -> Bottom -> Concentric -> Top -> (Rep Complete)
    // Inverted: Prep -> Concentric -> Top -> Eccentric -> Bottom -> (Rep Complete)

    // We treat "Rep Complete" as a transition loop back to start phase

    const isStandard = !startConcentric;

    switch (phase) {
        case PHASE.PREP:
            if (isStandard) return getPhaseOrNext(PHASE.ECCENTRIC, cadence);
            return getPhaseOrNext(PHASE.CONCENTRIC, cadence);

        case PHASE.ECCENTRIC:
            return getPhaseOrNext(PHASE.BOTTOM_HOLD, cadence,
                isStandard ? PHASE.CONCENTRIC : 'REP_COMPLETE'); // If standard, go to concentric. If inverted, rep done.

        case PHASE.BOTTOM_HOLD:
            return getPhaseOrNext(isStandard ? PHASE.CONCENTRIC : 'REP_COMPLETE', cadence);

        case PHASE.CONCENTRIC:
            return getPhaseOrNext(PHASE.TOP_HOLD, cadence,
                isStandard ? 'REP_COMPLETE' : PHASE.ECCENTRIC);

        case PHASE.TOP_HOLD:
            return getPhaseOrNext(isStandard ? 'REP_COMPLETE' : PHASE.ECCENTRIC, cadence);

        default:
            return null;
    }
}

// Logic to skip 0s phases. Returns { phase, duration }
// nextPhaseName: The desired phase.
// nextCylePhase: If desired phase is 0s, what's after that? (Recursive)
// Actually we can just hardcode the flow map.
function getPhaseOrNext(targetPhase, cadence, nextFallbackTarget) {
    if (targetPhase === 'REP_COMPLETE') return { phase: 'REP_COMPLETE' };

    // Map phase to cadence key
    let duration = 0;
    let nextPossible = null;
    let afterNext = null;

    // This recursive jumping is tricky. Let's simplify.
    // We expect the calling function to handle "if duration 0, call again".

    // Better: Helper that checks duration and returns if > 0.
    return { phase: targetPhase }; // Defer check to state machine transition to solve recursion.
}


function transitionPhase(state) {
    const { workout, exerciseIndex, phase } = state;
    const currentExercise = workout.exercises[exerciseIndex];
    const cadence = currentExercise.cadence;
    const startConcentric = currentExercise.startConcentric || false;

    // Helper: map phase enum to cadence duration value
    const getDuration = (p) => {
        switch (p) {
            case PHASE.ECCENTRIC: return cadence.eccentric;
            case PHASE.BOTTOM_HOLD: return cadence.eccentricPause;
            case PHASE.CONCENTRIC: return cadence.concentric;
            case PHASE.TOP_HOLD: return cadence.concentricPause;
            default: return 0;
        }
    };

    // Determine Order
    // Order 1 (Std): ECC -> BOTTOM -> CON -> TOP -> Loop
    // Order 2 (Inv): CON -> TOP -> ECC -> BOTTOM -> Loop

    const orderStd = [PHASE.ECCENTRIC, PHASE.BOTTOM_HOLD, PHASE.CONCENTRIC, PHASE.TOP_HOLD];
    const orderInv = [PHASE.CONCENTRIC, PHASE.TOP_HOLD, PHASE.ECCENTRIC, PHASE.BOTTOM_HOLD];
    const order = startConcentric ? orderInv : orderStd;

    if (phase === PHASE.REST_EXERCISE) {
        // Transition to Next Exercise
        return {
            ...state,
            exerciseIndex: exerciseIndex + 1,
            phase: PHASE.PREP,
            timeLeft: 5, // Default prep time
            phaseDuration: 5,
            setNumber: 1,
            repNumber: 0,
            actualReps: 0
        };
    }

    if (phase === PHASE.PREP || phase.includes('REST')) {
        // Start flow logic

        // Check if Isometric Exercise
        if (currentExercise.isIsometric) {
            // Isometric Flow: PREP -> ISOMETRIC_WORK -> REST
            // Duration is target reps (interpreted as seconds)
            // But if failure mode is on, we might set duration to infinity or large number
            const targetDuration = currentExercise.reps; // Reps field holds seconds

            return {
                ...state,
                phase: PHASE.ISOMETRIC_WORK,
                timeLeft: targetDuration, // Counts down target
                phaseDuration: targetDuration,
                isometricTime: 0 // Reset counter
            };
        }

        // Standard Flow
        return enterPhase(state, order[0], getDuration(order[0]), order);
    }

    // Find current index in order
    const idx = order.indexOf(phase);
    if (idx === -1) {
        // Should not happen unless logic err OR custom phase like ISOMETRIC_WORK
        if (phase === PHASE.ISOMETRIC_WORK) {
            // If we are here, timeLeft <= 0 (timer expired)
            if (!currentExercise.failureMode) {
                // Not failure mode -> Finish set directly
                return finishSet(state);
            } else {
                // Failure mode is ON. Add time buffer.
                return {
                    ...state,
                    timeLeft: 60,
                    phaseDuration: state.phaseDuration + 60
                };
            }
        }
        return state;
    }

    // Next in chain?
    if (idx < order.length - 1) {
        const nextP = order[idx + 1];
        return enterPhase(state, nextP, getDuration(nextP), order);
    } else {
        // End of chain -> Rep Complete
        return completeRep(state, order);
    }
}

// Recursively find next valid phase (skipping 0s)
function enterPhase(state, phase, duration, orderList) {
    if (duration > 0) {
        return {
            ...state,
            phase,
            timeLeft: duration,
            phaseDuration: duration
        };
    }

    // If duration is 0, skip to next
    const idx = orderList.indexOf(phase);
    if (idx < orderList.length - 1) {
        // Next in list
        const nextP = orderList[idx + 1];
        // Need to get duration for nextP. 
        // We need access to 'cadence' here. But 'state' has it via workout.
        const exercise = state.workout.exercises[state.exerciseIndex];
        const cad = exercise.cadence;
        const getDur = (p) => {
            if (p === PHASE.ECCENTRIC) return cad.eccentric;
            if (p === PHASE.BOTTOM_HOLD) return cad.eccentricPause;
            if (p === PHASE.CONCENTRIC) return cad.concentric;
            if (p === PHASE.TOP_HOLD) return cad.concentricPause;
            return 0;
        };
        return enterPhase(state, nextP, getDur(nextP), orderList);
    } else {
        // End of list -> Complete Rep
        return completeRep(state, orderList);
    }
}

function finishSet(state) {
    const { workout, exerciseIndex, setNumber, actualReps } = state;
    const currentExercise = workout.exercises[exerciseIndex];

    // Log data internally to state.weightData for immediate storage if needed?
    // We already have actualReps updated in state.
    // If manualFailure, actualReps is current.

    // Record this set in local history (state.weightData) defaults to 0kg until updated
    // Record this set in local history (state.weightData) defaults to 0kg until updated
    const setLog = {
        exerciseId: currentExercise.id,
        setNumber,
        reps: currentExercise.isIsometric ? 0 : actualReps,
        time: currentExercise.isIsometric ? state.isometricTime : 0,
        weight: 0 // Default, user can update in rest screen
    };

    // Append to weightData
    const newWeightData = [...state.weightData, setLog];

    // Next Logic
    const isExerciseDone = setNumber >= currentExercise.sets;

    if (isExerciseDone) {
        if (exerciseIndex >= workout.exercises.length - 1) {
            // Workout Done
            // TODO: Save to permanent history here or in UI?
            // UI can detect PHASE.FINISHED and save. Use Effect.
            return {
                ...state,
                weightData: newWeightData,
                phase: PHASE.FINISHED,
                status: 'FINISHED',
                timeLeft: 0
            };
        } else {
            // Next Exercise
            return {
                ...state,
                weightData: newWeightData,
                phase: PHASE.REST_EXERCISE,
                timeLeft: currentExercise.restExercise,
                phaseDuration: currentExercise.restExercise
            };
        }
    } else {
        // Next Set
        return {
            ...state,
            weightData: newWeightData,
            phase: PHASE.REST_SET,
            timeLeft: currentExercise.restSet,
            phaseDuration: currentExercise.restSet,
            setNumber: setNumber + 1,
            repNumber: 0,
            actualReps: 0
        };
    }
}

function completeRep(state, orderList) {
    const { workout, exerciseIndex, repNumber } = state;
    const currentExercise = workout.exercises[exerciseIndex];
    const newRepCount = repNumber + 1; // Completed Target Reps
    const newActualReps = state.actualReps + 1;

    const isFailureMode = currentExercise.failureMode;

    // In failure mode, we keep going until manual stop.
    // But we still update counters.

    if (!isFailureMode && newRepCount >= currentExercise.reps) {
        // Limit reached, finish set
        return finishSet({ ...state, repNumber: newRepCount, actualReps: newActualReps });
    }

    // Loop
    const firstPhase = orderList[0];
    const exercise = state.workout.exercises[state.exerciseIndex];
    const cad = exercise.cadence;
    const getDur = (p) => {
        if (p === PHASE.ECCENTRIC) return cad.eccentric;
        if (p === PHASE.BOTTOM_HOLD) return cad.eccentricPause;
        if (p === PHASE.CONCENTRIC) return cad.concentric;
        if (p === PHASE.TOP_HOLD) return cad.concentricPause;
        return 0;
    };

    return enterPhase({
        ...state,
        repNumber: newRepCount,
        actualReps: newActualReps
    }, firstPhase, getDur(firstPhase), orderList);
}

export const useCadenceTimer = () => {
    const [state, dispatch] = useReducer(timerReducer, initialState);
    const lastTimeRef = useRef(0);

    const tick = useCallback(() => {
        const now = Date.now();
        const delta = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;
        dispatch({ type: 'TICK', payload: delta });
    }, []);

    useEffect(() => {
        if (state.status === 'RUNNING') {
            lastTimeRef.current = Date.now();
            const interval = setInterval(tick, 100);
            return () => clearInterval(interval);
        }
    }, [state.status, tick]);

    const start = useCallback((workout) => {
        dispatch({ type: 'INIT', payload: workout });
        setTimeout(() => dispatch({ type: 'START' }), 0);
    }, []);

    const pause = useCallback(() => dispatch({ type: 'PAUSE' }), []);
    const resume = useCallback(() => dispatch({ type: 'RESUME' }), []);
    const skip = useCallback(() => dispatch({ type: 'SKIP_PHASE' }), []);

    const registerFailure = useCallback(() => dispatch({ type: 'REGISTER_FAILURE' }), []);

    const logSetData = useCallback((exerciseId, setNumber, reps, weight) => {
        dispatch({ type: 'LOG_SET_DATA', payload: { exerciseId, setNumber, reps, weight } });
    }, []);

    return {
        state,
        start,
        pause,
        resume,
        skip,
        registerFailure,
        logSetData
    };
};
