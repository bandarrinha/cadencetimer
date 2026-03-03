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
    ISOMETRIC_WORK: 'ISOMETRIC_WORK',
    PEAK_CONTRACTION: 'PEAK_CONTRACTION'
};

const STORAGE_KEY = 'cadence_active_recovery';

const initialState = {
    status: 'IDLE', // IDLE, RUNNING, PAUSED
    exerciseIndex: 0,
    setNumber: 1, // 1-based
    repNumber: 0, // Completed reps
    actualReps: 0, // Actual reps performed (for failure mode)
    phase: PHASE.IDLE,
    timeLeft: 0,
    phaseDuration: 0, // To calc progress
    initialWeights: {}, // Weights from preview
    workout: null, // Will be populated on start
    startTime: null, // Timestamp when workout started
    finishTime: null, // Timestamp when workout finished
    totalWorkoutTime: 0, // Duration in seconds
    currentSide: null, // 'LEFT', 'RIGHT' or null (for non-unilateral or rest)
    nextStartSide: 'LEFT', // Usage: which side to start with on next set
    peakContractionDone: false // Track if mid-concentric peak contraction has fired this rep
};

export function timerReducer(state, action) {
    switch (action.type) {
        case 'INIT': {
            const { workout, initialWeights } = action.payload;
            return {
                ...initialState,
                status: 'IDLE',
                workout: workout,
                initialWeights: initialWeights || {},
                weightData: []
            };
        }

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
                currentSide: state.workout.exercises[0].isUnilateral ? (state.workout.exercises[0].startSide || 'LEFT') : null,
                nextStartSide: state.workout.exercises[0].isUnilateral ? (state.workout.exercises[0].startSide || 'LEFT') : 'LEFT'
            };
        case 'PAUSE':
            return { ...state, status: 'PAUSED' };
        case 'RESUME':
            return { ...state, status: 'RUNNING' };
        case 'TICK': {
            if (state.status !== 'RUNNING') return state;
            const delta = typeof action.payload === 'number' && !isNaN(action.payload) ? action.payload : 0;
            const newTime = state.timeLeft - delta;

            // Isometric Logic
            let newIsoTime = state.isometricTime;
            const currentEx = state.workout?.exercises[state.exerciseIndex];
            const isIsoWork = state.phase === PHASE.ISOMETRIC_WORK;

            if (isIsoWork) {
                newIsoTime += action.payload;
            }

            // If time is up...
            if (newTime <= 0) {
                // Check if we should prevent transition (Isometric + Failure Mode)
                if (isIsoWork && currentEx && currentEx.failureMode) {
                    // Do NOT transition. Just update times.
                    // We allow timeLeft to go negative, or just stay at 0?
                    // User wants to see "overtime". 
                    // Actually logic elsewhere (ActiveWorkout) handles display.
                    // The requirement is: "contagem regressiva grande quando chegar a zero nao deveria voltar para 60".
                    // If we don't transition, it won't go to rest (60s).
                    return {
                        ...state,
                        timeLeft: newTime, // Allow negative
                        isometricTime: newIsoTime,
                        totalWorkoutTime: state.totalWorkoutTime + action.payload
                    };
                }

                // Normal transition
                return transitionPhase({ ...state, isometricTime: newIsoTime, totalWorkoutTime: state.totalWorkoutTime + action.payload });
            }

            return { ...state, timeLeft: newTime, isometricTime: newIsoTime, totalWorkoutTime: state.totalWorkoutTime + action.payload };
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


        case 'RECOVER':
            return {
                ...initialState,
                ...action.payload,
                status: 'PAUSED'
            };

        case 'FINISH_WORKOUT':
            return {
                ...state,
                phase: PHASE.FINISHED,
                status: 'FINISHED',
                timeLeft: 0,
                finishTime: Date.now()
            };

        case 'CLEAR_RECOVERY':
            // localStorage removal is handled in the action creator (hook) for reliability
            return {
                ...state,
                status: 'IDLE'
            };

        default:
            return state;
    }
}

// Build the phase order for an exercise, inserting PEAK_CONTRACTION as needed
function buildPhaseOrder(exercise, peakContractionDone) {
    const startConcentric = exercise.startConcentric || false;
    const orderStd = [PHASE.ECCENTRIC, PHASE.BOTTOM_HOLD, PHASE.CONCENTRIC, PHASE.TOP_HOLD];
    const orderInv = [PHASE.CONCENTRIC, PHASE.TOP_HOLD, PHASE.ECCENTRIC, PHASE.BOTTOM_HOLD];
    const baseOrder = startConcentric ? [...orderInv] : [...orderStd];

    const pc = exercise.peakContraction;
    if (!pc || !pc.enabled || !pc.duration) return baseOrder;

    const conIdx = baseOrder.indexOf(PHASE.CONCENTRIC);
    if (conIdx === -1) return baseOrder;

    if (pc.position === 'before_concentric') {
        // Insert PEAK before CONCENTRIC
        baseOrder.splice(conIdx, 0, PHASE.PEAK_CONTRACTION);
    } else if (pc.position === 'after_concentric') {
        // Insert PEAK after CONCENTRIC
        baseOrder.splice(conIdx + 1, 0, PHASE.PEAK_CONTRACTION);
    } else if (pc.position === 'mid_concentric') {
        // For mid: CON -> PEAK -> CON (second half)
        // On first pass (!peakContractionDone): CON(half) then PEAK, then CON(half)
        // We represent this as CON -> PEAK -> CON in the order
        // The duration logic in getDurationForPhase handles the half-split
        if (!peakContractionDone) {
            baseOrder.splice(conIdx + 1, 0, PHASE.PEAK_CONTRACTION, PHASE.CONCENTRIC);
        }
        // If peakContractionDone, we are in the second concentric half — normal order, no extra insertion
    }

    return baseOrder;
}

// Get the duration of a phase for a given exercise, considering peak contraction mid-split
function getDurationForPhase(phase, exercise, orderList, phaseIdx, peakContractionDone) {
    const cadence = exercise.cadence;
    const pc = exercise.peakContraction;

    if (phase === PHASE.PEAK_CONTRACTION) {
        return pc ? pc.duration : 0;
    }

    if (phase === PHASE.ECCENTRIC) return cadence.eccentric;
    if (phase === PHASE.BOTTOM_HOLD) return cadence.eccentricPause;
    if (phase === PHASE.TOP_HOLD) return cadence.concentricPause;

    if (phase === PHASE.CONCENTRIC) {
        // Check if mid_concentric split is active
        if (pc && pc.enabled && pc.position === 'mid_concentric' && !peakContractionDone) {
            // This is the first concentric half
            return cadence.concentric / 2;
        }
        if (pc && pc.enabled && pc.position === 'mid_concentric' && peakContractionDone) {
            // This is the second concentric half
            return cadence.concentric / 2;
        }
        return cadence.concentric;
    }

    return 0;
}

function transitionPhase(state) {
    const { workout, exerciseIndex, phase } = state;
    if (!workout || !workout.exercises || !workout.exercises[exerciseIndex]) {
        console.error("Invalid state in transitionPhase", state);
        return state;
    }
    const currentExercise = workout.exercises[exerciseIndex];
    const cadence = currentExercise.cadence;
    const startConcentric = currentExercise.startConcentric || false;

    // Helper: map phase enum to cadence duration value (legacy, used for non-peak-contraction contexts)
    const getDuration = (p) => {
        switch (p) {
            case PHASE.ECCENTRIC: return cadence.eccentric;
            case PHASE.BOTTOM_HOLD: return cadence.eccentricPause;
            case PHASE.CONCENTRIC: return cadence.concentric;
            case PHASE.TOP_HOLD: return cadence.concentricPause;
            default: return 0;
        }
    };

    // Determine Order (legacy, used for transitions from rest/prep to other exercises)
    const orderStd = [PHASE.ECCENTRIC, PHASE.BOTTOM_HOLD, PHASE.CONCENTRIC, PHASE.TOP_HOLD];
    const orderInv = [PHASE.CONCENTRIC, PHASE.TOP_HOLD, PHASE.ECCENTRIC, PHASE.BOTTOM_HOLD];

    // Build the full order including peak contraction for current exercise
    const order = buildPhaseOrder(currentExercise, state.peakContractionDone);

    if (phase === PHASE.REST_EXERCISE) {
        // Transition to Next Exercise -> SKIP PREP (Go directly to Work)
        const nextExercise = workout.exercises[exerciseIndex + 1];

        // We need to calculate the initial phase for the next exercise
        const nextOrder = buildPhaseOrder(nextExercise, false);
        const firstPhase = nextOrder[0];

        // Need cadence for next exercise to determine duration
        const nextDur = getDurationForPhase(firstPhase, nextExercise, nextOrder, 0, false);

        return {
            ...state,
            exerciseIndex: exerciseIndex + 1,
            phase: firstPhase, // Direct to work phase
            timeLeft: nextDur,
            phaseDuration: nextDur,
            setNumber: 1,
            repNumber: 0,
            actualReps: 0,
            peakContractionDone: false,
            currentSide: nextExercise.isUnilateral ? (nextExercise.startSide || 'LEFT') : null,
            nextStartSide: nextExercise.isUnilateral ? (nextExercise.startSide || 'LEFT') : 'LEFT'
        };
    }

    if (phase === PHASE.PREP || phase.includes('REST')) {
        // Bi-Set (or Tri-Set/Group) Loop Back Logic
        // If we are coming from REST_SET, check if we are at the end of a grouped set loop.
        if (phase === PHASE.REST_SET) {
            // Check if current exercise is part of a group
            if (currentExercise.biSetId) {
                // Find all exercises in this group (assuming sequential order for simplicity)
                // We want to know:
                // 1. Is this the LAST exercise of the group?
                // 2. What is the FIRST exercise of the group?

                const groupExercises = [];
                let firstIndex = -1;

                workout.exercises.forEach((ex, idx) => {
                    if (ex.biSetId === currentExercise.biSetId) {
                        groupExercises.push(ex);
                        if (firstIndex === -1) firstIndex = idx;
                    }
                });

                const isLastInGroup = workout.exercises[exerciseIndex + 1]?.biSetId !== currentExercise.biSetId;

                if (isLastInGroup && groupExercises.length > 1) {
                    // Loop back to the first exercise of the Group -> SKIP PREP (Direct to work)
                    const targetExercise = workout.exercises[firstIndex];

                    // Calculate initial phase for target exercise
                    const targetOrder = buildPhaseOrder(targetExercise, false);
                    const firstPhaseTarget = targetOrder[0];
                    const targetDur = getDurationForPhase(firstPhaseTarget, targetExercise, targetOrder, 0, false);

                    return {
                        ...state,
                        exerciseIndex: firstIndex,
                        phase: firstPhaseTarget, // Direct to work
                        timeLeft: targetDur,
                        phaseDuration: targetDur,
                        // setNumber is already correct (N+1)
                        repNumber: 0,
                        actualReps: 0,
                        peakContractionDone: false,
                        currentSide: targetExercise.isUnilateral ? (targetExercise.startSide || 'LEFT') : null,
                        nextStartSide: targetExercise.isUnilateral ? (targetExercise.startSide || 'LEFT') : 'LEFT'
                    };
                }
            }
        }

        // Start flow logic

        // Check if Isometric Exercise
        if (currentExercise.isIsometric) {
            // Isometric Flow: PREP -> ISOMETRIC_WORK -> REST
            // Duration is target reps (interpreted as seconds)
            // But if failure mode is on, we might set duration to infinity or large number
            const targetDuration = currentExercise.repsMax || currentExercise.reps; // Use repsMax as target (reps as fallback)

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

        const freshOrder = buildPhaseOrder(currentExercise, false);
        const firstDur = getDurationForPhase(freshOrder[0], currentExercise, freshOrder, 0, false);
        return enterPhase({ ...state, currentSide: nextSide, peakContractionDone: false }, freshOrder[0], firstDur, freshOrder);
    }

    // Handle PEAK_CONTRACTION completion -> update peakContractionDone flag
    if (phase === PHASE.PEAK_CONTRACTION) {
        const pc = currentExercise.peakContraction;
        if (pc && pc.position === 'mid_concentric') {
            // After peak, we need to enter the second half of concentric
            // Rebuild order with peakContractionDone = true (no extra PEAK/CON insertion)
            const newState = { ...state, peakContractionDone: true };
            const newOrder = buildPhaseOrder(currentExercise, true);
            const conDur = getDurationForPhase(PHASE.CONCENTRIC, currentExercise, newOrder, 0, true);
            return enterPhase(newState, PHASE.CONCENTRIC, conDur, newOrder);
        }
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
        // PEAK_CONTRACTION for before/after positions
        if (phase === PHASE.PEAK_CONTRACTION) {
            // Find PEAK in order and continue to next
            const peakIdx = order.indexOf(PHASE.PEAK_CONTRACTION);
            if (peakIdx !== -1 && peakIdx < order.length - 1) {
                const nextP = order[peakIdx + 1];
                const nextDur = getDurationForPhase(nextP, currentExercise, order, peakIdx + 1, state.peakContractionDone);
                return enterPhase(state, nextP, nextDur, order);
            }
            // Fallback: end of chain
            return completeRep(state, order);
        }
        return state;
    }

    // Next in chain?
    if (idx < order.length - 1) {
        const nextP = order[idx + 1];
        const nextDur = getDurationForPhase(nextP, currentExercise, order, idx + 1, state.peakContractionDone);
        return enterPhase(state, nextP, nextDur, order);
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
        const exercise = state.workout.exercises[state.exerciseIndex];
        const nextDur = getDurationForPhase(nextP, exercise, orderList, idx + 1, state.peakContractionDone);
        return enterPhase(state, nextP, nextDur, orderList);
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
    let suggestedWeight = previousSetData ? previousSetData.weight : 0;

    // Use initialWeights if no previous data for this exercise
    if (!previousSetData && state.initialWeights && state.initialWeights[currentExercise.id] !== undefined) {
        const initW = parseFloat(state.initialWeights[currentExercise.id]);
        if (!isNaN(initW)) suggestedWeight = initW;
    }

    const setLog = {
        exerciseId: currentExercise.id,
        setNumber,
        reps: currentExercise.isIsometric ? 0 : actualReps,
        time: currentExercise.isIsometric ? Math.floor(state.isometricTime) : 0,

        weight: suggestedWeight,
        biSetId: currentExercise.biSetId || null,
        side: state.currentSide || null
    };

    // Upsert Logic for finishSet
    let newWeightData = [...state.weightData];
    const existingIndex = newWeightData.findIndex(w =>
        w.exerciseId === currentExercise.id &&
        w.setNumber === setNumber &&
        (w.side === (state.currentSide || null))
    );

    if (existingIndex >= 0) {
        // Update existing
        newWeightData[existingIndex] = {
            ...newWeightData[existingIndex],
            ...setLog
        };
    } else {
        // Append new
        newWeightData.push(setLog);
    }

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
        const nextSide = nextExercise.isUnilateral ? (nextExercise.startSide || 'LEFT') : null;

        return {
            ...state,
            ...nextStateBase,
            exerciseIndex: exerciseIndex + 1,
            phase: PHASE.PREP,
            timeLeft: transitionTime,
            phaseDuration: transitionTime,
            setNumber: setNumber, // Keep set number for Bi-Set
            currentSide: nextSide,
            nextStartSide: nextExercise.isUnilateral ? (nextExercise.startSide || 'LEFT') : 'LEFT'
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

    // Loop — rebuild fresh order for next rep (reset peakContractionDone)
    const freshOrder = buildPhaseOrder(currentExercise, false);
    const firstPhase = freshOrder[0];
    const firstDur = getDurationForPhase(firstPhase, currentExercise, freshOrder, 0, false);

    return enterPhase({
        ...state,
        repNumber: newRepCount,
        actualReps: newActualReps,
        peakContractionDone: false
    }, firstPhase, firstDur, freshOrder);
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



    useEffect(() => {
        if (state.status === 'IDLE' || state.status === 'FINISHED') {
            if (state.status === 'FINISHED') {
                localStorage.removeItem(STORAGE_KEY);
            }
            return;
        }

        const now = Date.now();
        const lastSave = lastTimeRef.currentSave || 0;

        // Save every 2 seconds or if important changes happen (phase change/set completion) 
        // For simplicity here, we just throttle 2s. 
        // However, we want to ensure we don't lose the very last update, so we might need a timeout.

        // Actually, let's just use a simple timeout to debounce/throttle
        const save = () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            lastTimeRef.currentSave = Date.now();
        };

        if (now - lastSave > 2000) {
            save();
        } else {
            const timer = setTimeout(save, 2000);
            return () => clearTimeout(timer);
        }
    }, [state]);

    const recover = useCallback((savedState) => {
        dispatch({ type: 'RECOVER', payload: savedState });
    }, []);

    const clearRecovery = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        dispatch({ type: 'CLEAR_RECOVERY' });
    }, []);

    const start = useCallback((workout, initialWeights = {}) => {
        dispatch({ type: 'INIT', payload: { workout, initialWeights } });
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
        setStartSide,
        recover,
        clearRecovery
    };
};
