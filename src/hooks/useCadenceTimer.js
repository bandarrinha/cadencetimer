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
    startTime: null, // Timestamp when workout started
    finishTime: null, // Timestamp when workout finished
    totalWorkoutTime: 0, // Duration in seconds
    currentSide: null, // 'LEFT', 'RIGHT' or null (for non-unilateral or rest)
    nextStartSide: 'LEFT' // Usage: which side to start with on next set
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
                timeLeft: state.workout.exercises[0].prepTime || 5,
                phaseDuration: state.workout.exercises[0].prepTime || 5,
                setNumber: 1,
                repNumber: 0,
                actualReps: 0,
                isometricTime: 0,
                exerciseIndex: 0,
                startTime: Date.now(), // Capture start time
                finishTime: null,
                currentSide: state.workout.exercises[0].isUnilateral ? 'LEFT' : null,
                nextStartSide: 'LEFT'
            };
        case 'PAUSE':
            return { ...state, status: 'PAUSED' };
        case 'RESUME':
            return { ...state, status: 'RUNNING' };
        case 'TICK': {
            const newTime = state.timeLeft - action.payload;

            // Isometric Logic
            let newIsoTime = state.isometricTime;
            if (state.phase === PHASE.ISOMETRIC_WORK) {
                newIsoTime += action.payload;
            }

            if (newTime > 0) {
                return { ...state, timeLeft: newTime, isometricTime: newIsoTime, totalWorkoutTime: state.totalWorkoutTime + action.payload };
            }

            return transitionPhase({ ...state, isometricTime: newIsoTime, totalWorkoutTime: state.totalWorkoutTime + action.payload });
        }
        case 'SKIP_PHASE':
            return transitionPhase(state);

        case 'REGISTER_FAILURE':
            // User clicked "Failure" button.
            // Finish current set immediately.
            return finishSet(state, true); // true = forced/manual finish

        case 'SET_START_SIDE':
            return { ...state, nextStartSide: action.payload };

        case 'LOG_SET_DATA': {
            // Payload: { weight, reps, side }
            const { exerciseId, setNumber, weight, reps, time, side } = action.payload;

            // Use findLastIndex to ensure we update the MOST RECENT entry for this exercise/set combo.
            let existingIndex = -1;
            for (let i = state.weightData.length - 1; i >= 0; i--) {
                const w = state.weightData[i];
                // Match Side as well if provided
                const sideMatch = side ? w.side === side : true;
                if (w.exerciseId === exerciseId && w.setNumber === setNumber && sideMatch) {
                    existingIndex = i;
                    break;
                }
            }

            let newWeightData = [...state.weightData];
            if (existingIndex >= 0) {
                newWeightData[existingIndex] = { ...newWeightData[existingIndex], weight, reps, ...(time !== undefined ? { time } : {}) };
            } else {
                const exDef = state.workout.exercises.find(e => e.id === exerciseId);
                newWeightData.push({
                    exerciseId,
                    setNumber,
                    reps,
                    weight,
                    time: time || 0,
                    biSetId: exDef ? exDef.biSetId : null,
                    side: side || null
                });
            }

            return { ...state, weightData: newWeightData };
        }



        case 'FINISH_WORKOUT':
            return {
                ...state,
                phase: PHASE.FINISHED,
                status: 'FINISHED',
                timeLeft: 0,
                finishTime: Date.now()
            };

        default:
            return state;
    }
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
        // Transition to Next Exercise -> SKIP PREP (Go directly to Work)
        const nextExercise = workout.exercises[exerciseIndex + 1];

        // We need to calculate the initial phase for the next exercise
        const startConcentricNext = nextExercise.startConcentric || false;
        const nextOrder = startConcentricNext ? orderInv : orderStd;
        const firstPhase = nextOrder[0];

        // Need cadence for next exercise to determine duration
        const nextCadence = nextExercise.cadence;
        const nextGetDur = (p) => {
            if (p === PHASE.ECCENTRIC) return nextCadence.eccentric;
            if (p === PHASE.BOTTOM_HOLD) return nextCadence.eccentricPause;
            if (p === PHASE.CONCENTRIC) return nextCadence.concentric;
            if (p === PHASE.TOP_HOLD) return nextCadence.concentricPause;
            return 0;
        };

        return {
            ...state,
            exerciseIndex: exerciseIndex + 1,
            phase: firstPhase, // Direct to work phase
            timeLeft: nextGetDur(firstPhase),
            phaseDuration: nextGetDur(firstPhase),
            setNumber: 1,
            repNumber: 0,
            actualReps: 0,
            currentSide: nextExercise.isUnilateral ? 'LEFT' : null,
            nextStartSide: 'LEFT'
        };
    }

    if (phase === PHASE.PREP || phase.includes('REST')) {
        // Bi-Set Loop Back Logic
        // If we are coming from REST_SET, and current exercise is the 2nd of a bi-set,
        // we need to switch active exercise back to the 1st of the pair.
        // NOTE: finishSet already incremented setNumber.
        if (phase === PHASE.REST_SET) {
            const isBiSetEnd = currentExercise.biSetId &&
                workout.exercises[exerciseIndex - 1]?.biSetId === currentExercise.biSetId;
            if (isBiSetEnd) {
                // Loop back to the first exercise of the Bi-Set -> SKIP PREP (Direct to work)
                const targetExercise = workout.exercises[exerciseIndex - 1];

                // Calculate initial phase for target exercise (Ex 1)
                const startConcentricTarget = targetExercise.startConcentric || false;
                const targetOrder = startConcentricTarget ? orderInv : orderStd;
                const firstPhaseTarget = targetOrder[0];

                // Get cadence duration
                const targetCadence = targetExercise.cadence;
                const targetGetDur = (p) => {
                    if (p === PHASE.ECCENTRIC) return targetCadence.eccentric;
                    if (p === PHASE.BOTTOM_HOLD) return targetCadence.eccentricPause;
                    if (p === PHASE.CONCENTRIC) return targetCadence.concentric;
                    if (p === PHASE.TOP_HOLD) return targetCadence.concentricPause;
                    return 0;
                };

                return {
                    ...state,
                    exerciseIndex: exerciseIndex - 1,
                    phase: firstPhaseTarget, // Direct to work
                    timeLeft: targetGetDur(firstPhaseTarget),
                    phaseDuration: targetGetDur(firstPhaseTarget),
                    // setNumber is already correct (N+1)
                    repNumber: 0,
                    actualReps: 0,
                    currentSide: targetExercise.isUnilateral ? (state.nextStartSide || 'LEFT') : null
                };
            }
        }

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
        const nextSide = (phase === PHASE.REST_SET && currentExercise.isUnilateral)
            ? (state.nextStartSide || 'LEFT')
            : state.currentSide;

        return enterPhase({ ...state, currentSide: nextSide }, order[0], getDuration(order[0]), order);
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

    // Log data internally
    const previousSetData = state.weightData.filter(d => d.exerciseId === currentExercise.id).pop();
    const suggestedWeight = previousSetData ? previousSetData.weight : 0;

    const setLog = {
        exerciseId: currentExercise.id,
        setNumber,
        reps: currentExercise.isIsometric ? 0 : actualReps,
        time: currentExercise.isIsometric ? state.isometricTime : 0,
        weight: suggestedWeight,
        biSetId: currentExercise.biSetId || null,
        side: state.currentSide || null
    };

    const newWeightData = [...state.weightData, setLog];

    // Unilateral Logic
    if (currentExercise.isUnilateral) {
        // If we just finished the FIRST side, we need to transition to the SECOND side.
        // If we just finished the SECOND side, we proceed to Rest.

        // currentSide is what we just finished.
        // nextStartSide is what we started with.
        const startSide = state.nextStartSide || 'LEFT';
        const otherSide = startSide === 'LEFT' ? 'RIGHT' : 'LEFT';

        if (state.currentSide === startSide) {
            // Finished first side. Transition to Other Side.
            const transitionTime = currentExercise.unilateralTransition || 5;

            return {
                ...state,
                weightData: newWeightData,
                phase: PHASE.PREP, // Reuse PREP as transition
                timeLeft: transitionTime,
                phaseDuration: transitionTime,
                currentSide: otherSide, // Set side for next phase
                repNumber: 0,
                actualReps: 0,
                // setNumber STAYS SAME
            };
        }
        // Else: We finished the second side (state.currentSide === otherSide).
        // Proceed to Rest normally.
        // We will reset currentSide to the *next* set's start side when we come back?
        // Or keep it null during rest.
    }

    const isExerciseDone = setNumber >= currentExercise.sets;

    // Common Next State (Rest or Finish)
    const nextStateBase = {
        weightData: newWeightData,
        repNumber: 0,
        actualReps: 0,
        currentSide: null // Reset side during rest/finish
    };

    // Bi-Set Logic Step 1: Check if starting a bi-set transition (Ex 1 -> Ex 2)
    const isBiSetStart = currentExercise.biSetId &&
        workout.exercises[exerciseIndex + 1]?.biSetId === currentExercise.biSetId;

    if (isBiSetStart) {
        // Ex 1 Finished -> Go to Ex 2
        const nextExercise = workout.exercises[exerciseIndex + 1];
        const transitionTime = nextExercise.prepTime || 5;
        const nextSide = nextExercise.isUnilateral ? (state.nextStartSide || 'LEFT') : null; // Should Bi-Set share start side? Probably.

        return {
            ...state,
            ...nextStateBase,
            exerciseIndex: exerciseIndex + 1,
            phase: PHASE.PREP,
            timeLeft: transitionTime,
            phaseDuration: transitionTime,
            setNumber: setNumber, // Keep set number for Bi-Set
            currentSide: nextSide
        };
    }

    if (isExerciseDone) {
        if (exerciseIndex >= workout.exercises.length - 1) {
            // Workout Done
            return {
                ...state,
                ...nextStateBase,
                phase: PHASE.FINISHED,
                status: 'FINISHED',
                timeLeft: 0,
                finishTime: Date.now()
            };
        } else {
            // Next Exercise
            return {
                ...state,
                ...nextStateBase,
                phase: PHASE.REST_EXERCISE,
                timeLeft: currentExercise.restExercise,
                phaseDuration: currentExercise.restExercise
            };
        }
    } else {
        // Next Set
        return {
            ...state,
            ...nextStateBase,
            phase: PHASE.REST_SET,
            timeLeft: currentExercise.restSet,
            phaseDuration: currentExercise.restSet,
            setNumber: setNumber + 1
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

    // When finishing workout, we might need to "finish" the currently running set if it wasn't done?
    // Usually user clicks "Finish" after last set is done (in Summary view logic).
    // But if they force finish:
    const finishWorkout = useCallback(() => dispatch({ type: 'FINISH_WORKOUT' }), []);

    const logSetData = useCallback((exerciseId, setNumber, reps, weight, time, side = null) => {
        dispatch({ type: 'LOG_SET_DATA', payload: { exerciseId, setNumber, reps, weight, time, side } });
    }, []);

    const setStartSide = useCallback((side) => dispatch({ type: 'SET_START_SIDE', payload: side }), []);

    return {
        state,
        start,
        pause,
        resume,
        skip,
        registerFailure,
        finishWorkout,
        logSetData,
        setStartSide
    };
};
