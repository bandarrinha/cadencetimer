import { useEffect, useRef, useState } from 'react';
import { useCadenceTimer, PHASE } from '../hooks/useCadenceTimer';
import { useTTS } from '../hooks/useTTS';
import { useWakeLock } from '../hooks/useWakeLock';
import { Pause, Play, SkipForward, X, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import NumberInput from './common/NumberInput';
import WorkoutSummary from './WorkoutSummary';
import WeightAdviceIcon from './common/WeightAdviceIcon';

export default function ActiveWorkout({ workout, onExit, onFinishWorkout, initialState, initialWeights }) {
    const { state, start, pause, resume, skip, registerFailure, finishWorkout, logSetData, setStartSide, recover, clearRecovery } = useCadenceTimer();
    const { speak, playBeep } = useTTS();
    const prevPhaseRef = useRef(state.phase);
    const prevTimeRef = useRef(state.timeLeft);
    const hasRecovered = useRef(false);

    // Initial Wake Lock
    // Read settings directly to determine if we should keep awake (default true)
    const settings = JSON.parse(localStorage.getItem('cadence_settings') || '{}');
    const shouldKeepAwake = settings.keepAwake !== undefined ? settings.keepAwake : true;

    useWakeLock(shouldKeepAwake);

    // Local state for inputs during rest (Map: { [exId]: { weight: '', reps: '' } })
    const [inputValues, setInputValues] = useState({});
    const inputValuesRef = useRef({}); // Ref to avoid stale closures in auto-save

    const [showExitConfirm, setShowExitConfirm] = useState(false);

    useEffect(() => { inputValuesRef.current = inputValues; }, [inputValues]);

    // Start on mount
    useEffect(() => {
        if (hasRecovered.current) return;

        if (initialState) {
            recover(initialState);
            hasRecovered.current = true;
        } else if (workout) {
            start(workout, initialWeights);
            hasRecovered.current = true;
            // Seeding removed to prevent dummy history records
        }
    }, [workout, start, initialState, recover, initialWeights]);


    // Audio Logic & Auto-Save Logic on Phase Change
    useEffect(() => {
        if (state.phase !== prevPhaseRef.current) {
            const p = state.phase;
            const prevP = prevPhaseRef.current;

            // LEAVING Rest: Auto-save inputs
            if (prevP === PHASE.REST_SET || prevP === PHASE.REST_EXERCISE) {
                // Iterate over all inputs currently being edited
                Object.entries(inputValuesRef.current).forEach(([exId, vals]) => {
                    const wVal = parseFloat(vals.weight);
                    const rVal = parseInt(vals.reps);

                    // Find existing entry to fallback if invalid input
                    // search by exerciseId AND setNumber (which set? The one just finished)
                    // We assume the inputs were for the set just finished.
                    // But which set number is that?
                    // If we are in REST, state.setNumber is Next Set. So we want Set - 1.
                    // BUT for REST_EXERCISE, setNumber might have reset to 1 (if we switched ex).
                    // Actually, if we are LEAVING Rest, we are transitioning TO Prep (or something).
                    // The `state` here is the NEW state.
                    // If we transition Ex N (Rest) -> Ex N (Prep), setNumber increased.
                    // If we transition Ex N (Rest) -> Ex N+1 (Prep), setNumber becomes 1.

                    // CRITICAL: We need the set number of the entries we are editing.
                    // We can find them in weightData by checking the last entries for these IDs.
                    // NOTE: If we are editing Set 1 and it was just finished, it SHOULD be in weightData.
                    const lastEntry = state.weightData.filter(w => w.exerciseId === exId).pop();

                    if (lastEntry) {
                        const finalWeight = !isNaN(wVal) ? wVal : (lastEntry.weight || 0);

                        const ex = workout.exercises.find(e => e.id === exId);

                        // Unilateral Save
                        if (ex && ex.isUnilateral) {
                            const rLeft = parseInt(vals.repsLeft);
                            const rRight = parseInt(vals.repsRight);

                            // We need to update BOTH entries (Left and Right) for this set.
                            // logSetData handles finding the correct entry by Side.
                            if (!isNaN(rLeft)) logSetData(exId, lastEntry.setNumber, rLeft, finalWeight, 0, 'LEFT');
                            if (!isNaN(rRight)) logSetData(exId, lastEntry.setNumber, rRight, finalWeight, 0, 'RIGHT');
                        } else {
                            // Standard Save
                            const finalReps = !isNaN(rVal) ? rVal : lastEntry.reps;
                            const isIso = ex && ex.isIsometric;
                            logSetData(exId, lastEntry.setNumber, isIso ? 0 : finalReps, finalWeight, isIso ? finalReps : 0);
                        }
                    }
                });
            }

            // ENTERING Rest: Pre-fill inputs
            if (p === PHASE.REST_SET || p === PHASE.REST_EXERCISE) {
                const currentExIndex = state.exerciseIndex;
                const currentEx = workout.exercises[currentExIndex];

                // Identify target exercises to show inputs for
                let targetExercises = [currentEx]; // Default: just current

                // Check for Bi-Set End (Current is 2nd of pair)
                // Note: In REST_SET, exerciseIndex is still at the 2nd exercise.
                // In REST_EXERCISE, exerciseIndex is usually incremented in finishSet?
                // Wait, my timerReducer `finishSet` for REST_EXERCISE returns `timeLeft`...
                // AND it returns `exerciseIndex` UNCHANGED? 
                // Let's check timerReducer logic again.
                // "return { ... phase: REST_EXERCISE ... }" -> exerciseIndex NOT present in return (so unchanged).
                // "transitionPhase" (Rest expired) -> THEN it increments exerciseIndex.
                // So YES, during REST (any type), exerciseIndex points to the exercise just finished.
                // SO:
                if (currentEx.biSetId) {
                    // Find ALL exercises in this group (Tri-Set/Giant Set)
                    targetExercises = workout.exercises.filter(ex => ex.biSetId === currentEx.biSetId);
                }

                const newInputs = {};

                const history = JSON.parse(localStorage.getItem('cadence_history') || '[]');

                targetExercises.forEach(ex => {
                    const logs = state.weightData.filter(w => w.exerciseId === ex.id);

                    const getInitialWeight = () => {
                        // Check initialWeights first
                        if (initialWeights && initialWeights[ex.id] !== undefined && initialWeights[ex.id] !== '') {
                            return initialWeights[ex.id];
                        }
                        // Fallback to history
                        const entry = history.slice().reverse().find(h =>
                            h.exerciseId === ex.id || h.exerciseName === ex.name
                        );
                        return entry ? entry.weight : '';
                    };

                    if (ex.isUnilateral) {
                        // Find last complete set (which has both L and R? or just whatever is last)
                        // We assume specific set we just finished.
                        // But for Unilateral, we might have 2 separate entries for the same set.
                        // We want to load them into 'repsLeft' and 'repsRight'.
                        const lastLog = logs[logs.length - 1];
                        if (lastLog) {
                            const targetSet = lastLog.setNumber; // The set we just finished
                            const setLogs = logs.filter(l => l.setNumber === targetSet);

                            const leftLog = setLogs.find(l => l.side === 'LEFT');
                            const rightLog = setLogs.find(l => l.side === 'RIGHT');

                            // Weight is usually same, take from any
                            let sWeight = leftLog ? leftLog.weight : (rightLog ? rightLog.weight : '');

                            // If weight is missing (0) and it's the first set (or no prev sets in this workout), try intial/history
                            if ((!sWeight || sWeight === 0) && targetSet === 1) {
                                sWeight = getInitialWeight();
                            }
                            // If still 0/empty and we have previous sets in THIS workout, use that (inheriting)
                            // (Logic handled by 'weight' persistence in logSetData usually, but explicit check here:)
                            if ((!sWeight || sWeight === 0) && targetSet > 1) {
                                // Find weight from Set N-1
                                const prevSetLogs = logs.filter(l => l.setNumber === targetSet - 1);
                                const prevEntry = prevSetLogs[0];
                                if (prevEntry) sWeight = prevEntry.weight;
                            }

                            const sRepsLeft = leftLog ? leftLog.reps : '';
                            const sRepsRight = rightLog ? rightLog.reps : '';

                            newInputs[ex.id] = { weight: sWeight || '', repsLeft: sRepsLeft, repsRight: sRepsRight };
                        } else {
                            newInputs[ex.id] = { weight: '', repsLeft: '', repsRight: '' };
                        }
                    } else {
                        const lastLog = logs[logs.length - 1]; // The placeholder added in finishSet
                        let sWeight = '';
                        let sReps = '';

                        if (lastLog) {
                            sWeight = lastLog.weight || '';

                            // 1. If First Set and Empty -> History
                            if ((!sWeight || sWeight === 0) && logs.length === 1) {
                                sWeight = getInitialWeight();
                            }

                            // 2. If Empty and previous sets exist -> Inherit (fallback)
                            if ((!sWeight || sWeight === 0) && logs.length >= 2) {
                                sWeight = logs[logs.length - 2].weight;
                            }
                            sReps = ex.isIsometric ? Math.floor(lastLog.time) : lastLog.reps;
                        }
                        newInputs[ex.id] = { weight: sWeight || '', reps: sReps };
                    }
                });

                setTimeout(() => {
                    setInputValues(newInputs);
                }, 0);
            }

            // Audio Announcements
            switch (p) {
                case PHASE.PREP: speak("Preparar", 1.2); break;
                case PHASE.ECCENTRIC: speak("Desce", 1.3); break;
                case PHASE.CONCENTRIC: speak("Sobe", 1.3); break;
                case PHASE.BOTTOM_HOLD:
                case PHASE.TOP_HOLD:
                case PHASE.ISOMETRIC_WORK: speak("Segura", 1.2); break;
                case PHASE.REST_SET:
                case PHASE.REST_EXERCISE: speak("Descansa"); break;
                case PHASE.FINISHED: speak("Treino Concluído"); break;
            }
            prevPhaseRef.current = p;
        }

        // Beep logic (last 3 seconds)
        const isLongPhase = state.phaseDuration > 3;
        const isRest = state.phase === PHASE.REST_SET || state.phase === PHASE.REST_EXERCISE || state.phase === PHASE.PREP;

        if (isLongPhase || isRest) {
            const currentSec = Math.ceil(state.timeLeft);
            const prevSec = Math.ceil(prevTimeRef.current);
            if (currentSec <= 3 && currentSec > 0 && currentSec !== prevSec) {
                playBeep(600, 0.1, 'triangle');
            }
        }
        prevTimeRef.current = state.timeLeft;

    }, [state.phase, state.timeLeft, state.phaseDuration, speak, playBeep, logSetData, state.weightData, workout.exercises, state.exerciseIndex, initialWeights]);


    // Manual Save Handler
    const handleInputSave = (exId, field, value) => {
        // Update local state
        const newInputs = { ...inputValuesRef.current, [exId]: { ...inputValuesRef.current[exId], [field]: value } };
        setInputValues(newInputs); // Update React state for UI
        inputValuesRef.current = newInputs; // Sync ref immediately

        // Trigger Log Update
        const vals = newInputs[exId];
        const lastEntry = state.weightData.filter(w => w.exerciseId === exId).pop();

        if (lastEntry) {
            const wVal = parseFloat(vals.weight);
            const finalWeight = !isNaN(wVal) ? wVal : lastEntry.weight;

            const ex = workout.exercises.find(e => e.id === exId);

            if (ex && ex.isUnilateral) {
                const rLeft = parseInt(vals.repsLeft);
                const rRight = parseInt(vals.repsRight);

                if (!isNaN(rLeft)) logSetData(exId, lastEntry.setNumber, rLeft, finalWeight, 0, 'LEFT');
                if (!isNaN(rRight)) logSetData(exId, lastEntry.setNumber, rRight, finalWeight, 0, 'RIGHT');
            } else {
                const rVal = parseInt(vals.reps);
                const finalReps = !isNaN(rVal) ? rVal : lastEntry.reps;
                const isIso = ex && ex.isIsometric;

                logSetData(exId, lastEntry.setNumber, isIso ? 0 : finalReps, finalWeight, isIso ? finalReps : 0);
            }
        }
    };


    // Render Helpers
    const currentExercise = workout.exercises[state.exerciseIndex] || {};

    // Determine which set number to display in the header
    // During REST_SET, we want to show the COMPLETED set (current - 1), not the upcoming one.
    const displaySetNumber = state.phase === PHASE.REST_SET
        ? Math.max(1, state.setNumber - 1)
        : state.setNumber;

    const getPhaseColor = () => {
        switch (state.phase) {
            case PHASE.ECCENTRIC: return 'var(--color-eccentric)';
            case PHASE.CONCENTRIC: return 'var(--color-concentric)';
            case PHASE.BOTTOM_HOLD:
            case PHASE.TOP_HOLD:
            case PHASE.ISOMETRIC_WORK: return 'var(--color-isometric)';
            case PHASE.REST_SET:
            case PHASE.REST_EXERCISE: return 'var(--color-rest)';
            case PHASE.PREP: return 'var(--text-secondary)';
            case PHASE.FINISHED: return 'var(--color-primary)';
            default: return '#121212';
        }
    };

    const getPhaseName = () => {
        switch (state.phase) {
            case PHASE.ECCENTRIC: return 'EXCÊNTRICA (Desce)';
            case PHASE.CONCENTRIC: return 'CONCÊNTRICA (Sobe)';
            case PHASE.BOTTOM_HOLD: return 'ISOMETRIA';
            case PHASE.TOP_HOLD: return 'ISOMETRIA';
            case PHASE.REST_SET: return 'DESCANSO';
            case PHASE.REST_EXERCISE: return 'PRÓXIMO EXERCÍCIO';
            case PHASE.PREP: return 'PREPARAR';
            case PHASE.FINISHED: return 'FIM';
            case PHASE.ISOMETRIC_WORK: return 'ISOMETRIA';
            default: return '';
        }
    };

    const progress = (state.phaseDuration - state.timeLeft) / state.phaseDuration;
    const progressPct = state.phaseDuration > 0 ? progress * 100 : 0;
    const isResting = state.phase.includes('REST');

    // Identify exercises to display in Rest
    // Can be multiple (Bi-Set) or single
    // Be safe and recalculate
    // Identify exercises to display in Rest
    // Can be multiple (Bi-Set, Tri-Set, Giant Set) or single
    // Be safe and recalculate
    let activeInputExercises = [currentExercise];
    if (isResting && currentExercise.biSetId) {
        // Find ALL exercises in this group
        // We assume they are in order in the workout list
        activeInputExercises = workout.exercises.filter(ex => ex.biSetId === currentExercise.biSetId);
    }



    // Visual Feedback Logic
    let feedbackStatus = 'BELOW'; // 'BELOW', 'IN_RANGE', 'ABOVE'
    const isExerciseRunning = !isResting && state.phase !== PHASE.FINISHED && state.phase !== PHASE.PREP;

    if (isExerciseRunning && currentExercise.failureMode) {
        const completed = currentExercise.isIsometric ? Math.floor(state.isometricTime) : state.actualReps;

        const min = currentExercise.repsMin || currentExercise.reps || 0;
        const max = currentExercise.repsMax || currentExercise.reps || 0;

        if (completed < min) feedbackStatus = 'BELOW';
        else if (completed <= max) feedbackStatus = 'IN_RANGE';
        else feedbackStatus = 'ABOVE';
    }

    const feedbackStyle = (() => {
        if (!currentExercise.failureMode) return {};
        if (feedbackStatus === 'IN_RANGE') {
            return {
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#2e7d32', // Dark Green
                padding: '4px 30px',
                borderRadius: '50px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
            };
        }
        if (feedbackStatus === 'ABOVE') {
            return {
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#6200ea', // Deep Purple (warning/exceeded)
                padding: '4px 30px',
                borderRadius: '50px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
            };
        }
        return {};
    })();

    // Logic to generate advice for Rest screen
    const getAdvice = (ex) => {
        if (!ex.failureMode) return null;
        const logs = state.weightData.filter(w => w.exerciseId === ex.id);
        const lastLog = logs[logs.length - 1];
        if (!lastLog) return null;

        const val = ex.isIsometric ? lastLog.time : lastLog.reps;
        const min = ex.repsMin || ex.reps;
        const max = ex.repsMax || ex.reps;

        if (val < min) return { text: "Diminuir Carga", type: "decrease" };
        if (val > max) return { text: "Aumentar Carga", type: "increase" };
        return { text: "Manter Carga", type: "maintain" };
    };

    // If Summary is active, render it overlaying everything
    if (state.status === 'FINISHED') {
        return (
            <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#121212', zIndex: 300 }}>
                <WorkoutSummary
                    workout={workout}
                    weightData={state.weightData}
                    onSave={(finalData, duration) => onFinishWorkout(finalData, duration)}
                    onDiscard={onExit}
                    startTime={state.startTime}
                    finishTime={state.finishTime}
                />
            </div>
        );
    }

    return (
        <div className="active-workout" style={{
            position: 'fixed', inset: 0,
            backgroundColor: getPhaseColor(),
            color: '#000',
            transition: 'background-color 0.3s ease',
            display: 'flex', flexDirection: 'column', zIndex: 100
        }}>

            {/* Header Info - Relative & Flex */}
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, color: (state.phase === PHASE.PREP || state.phase === PHASE.FINISHED) ? 'white' : 'black' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.2em', fontWeight: 600 }}>{currentExercise.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2em' }}>Série {displaySetNumber}/{currentExercise.sets}</span>
                        {/* Side Indicator */}
                        {currentExercise.isUnilateral && state.currentSide && (
                            <span style={{
                                fontSize: '1.5em',
                                padding: '4px 12px',
                                background: state.currentSide === 'LEFT' ? 'var(--color-primary)' : '#ff9800',
                                color: 'black',
                                borderRadius: '6px',
                                fontWeight: '900',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                marginLeft: '8px'
                            }}>
                                {state.currentSide === 'LEFT' ? 'LADO ESQ' : 'LADO DIR'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Global Timer */}
                {state.startTime && (
                    <div style={{ fontSize: '1em', opacity: 0.8, fontWeight: 'bold' }}>
                        {(() => {
                            const diff = Math.floor(state.totalWorkoutTime || 0);
                            const m = Math.floor(diff / 60).toString().padStart(2, '0');
                            const s = (diff % 60).toString().padStart(2, '0');
                            return `${m}:${s}`;
                        })()}
                    </div>
                )}
            </div>

            {/* Main Content Area - Scrollable */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                alignItems: 'center',
                flexDirection: 'column',
                width: '100%',
                position: 'relative'
            }}>
                <div style={{
                    margin: 'auto 0',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '20px 0',
                    color: (state.phase === PHASE.PREP || state.phase === PHASE.FINISHED) ? 'white' : 'black'
                }}>

                    {/* Primary Display: Cadence Countdown (Big) */}
                    {/* MODIFIED: PREP Phase is now INCLUDED here */}
                    {(!isResting && state.phase !== PHASE.FINISHED) && (
                        <div style={{
                            fontSize: '12rem', fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                            transition: 'all 0.3s ease',
                            marginBottom: '10px'
                        }}>
                            {currentExercise.isIsometric && currentExercise.failureMode && state.timeLeft <= 0
                                ? '+' + Math.abs(Math.floor(state.timeLeft)) // Overtime Display
                                : Math.ceil(state.timeLeft)
                            }
                        </div>
                    )}

                    {/* Secondary Display: Executed Reps/Time (Small, with Feedback) */}
                    {/* Keep Prep HIDDEN for Reps */}
                    {(!isResting && state.phase !== PHASE.FINISHED && state.phase !== PHASE.PREP) && (
                        <div style={{
                            marginTop: '10px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                        }}>
                            <div style={{
                                fontSize: '3rem', fontWeight: 'bold',
                                transition: 'all 0.3s ease',
                                textAlign: 'center',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                ...feedbackStyle // Highlight applied here
                            }}>
                                {currentExercise.isIsometric
                                    ? Math.floor(state.isometricTime) + 's'
                                    : (
                                        <span>
                                            Rep {state.actualReps + 1}
                                        </span>
                                    )
                                }
                            </div>

                            {/* Meta Info Below Reps */}
                            {(currentExercise.failureMode || !currentExercise.isIsometric) && (
                                <div style={{ opacity: 0.7, fontSize: '1.2em' }}>
                                    {currentExercise.failureMode
                                        ? `Meta: ${currentExercise.repsMin || currentExercise.reps} - ${currentExercise.repsMax || currentExercise.reps}`
                                        : `Meta: ${currentExercise.reps}`
                                    }
                                </div>
                            )}

                            {/* Feedback Label Badge */}
                            {feedbackStatus !== 'BELOW' && currentExercise.failureMode && (
                                <div style={{
                                    fontSize: '1.2rem', fontWeight: 'bold',
                                    color: feedbackStatus === 'IN_RANGE' ? '#1b5e20' : '#4a148c',
                                    background: 'rgba(255,255,255,0.7)',
                                    padding: '2px 12px', borderRadius: '8px'
                                }}>
                                    {feedbackStatus === 'IN_RANGE' ? 'DENTRO DA META' : 'ACIMA DA META'}
                                </div>
                            )}
                        </div>
                    )}


                    {/* Rest UI with Inputs */}
                    {isResting && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '600px', padding: '0 20px' }}>
                            <div style={{ fontSize: '8rem', fontWeight: 900 }}>{Math.ceil(state.timeLeft)}</div>

                            <div style={{
                                display: 'flex',
                                flexDirection: activeInputExercises.length > 1 ? 'row' : 'column',
                                gap: '12px',
                                justifyContent: 'center',
                                width: '100%',
                                flexWrap: 'wrap'
                            }}>
                                {activeInputExercises.map(ex => {
                                    const advice = getAdvice(ex);
                                    return (
                                        <div key={ex.id} style={{
                                            background: 'rgba(255,255,255,0.9)',
                                            padding: '10px',
                                            borderRadius: '16px',
                                            color: 'black',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                            flex: 1,
                                            minWidth: '140px'
                                        }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.9em', textAlign: 'center', marginBottom: '4px', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
                                                {ex.name}
                                            </div>

                                            {/* Advice Badge */}
                                            {advice && (
                                                <div style={{
                                                    textAlign: 'center', fontSize: '1rem',
                                                    background: advice.type === 'maintain' ? '#e8f5e9' : (advice.type === 'decrease' ? '#ffebee' : '#e3f2fd'),
                                                    color: advice.type === 'maintain' ? '#2e7d32' : (advice.type === 'decrease' ? '#c62828' : '#1565c0'),
                                                    padding: '2px', borderRadius: '8px', fontWeight: 'bold',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    <WeightAdviceIcon advice={advice.type} />
                                                    <span>{advice.text}</span>
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <label style={{ fontSize: '0.9rem', marginBottom: '4px' }}>Carga (kg)</label>
                                                <NumberInput
                                                    value={inputValues[ex.id]?.weight || ''}
                                                    onChange={(v) => handleInputSave(ex.id, 'weight', v)}
                                                    placeholder="0"
                                                    compact={true}
                                                />
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <label style={{ fontSize: '0.9rem', marginBottom: '4px' }}>
                                                    {ex.isIsometric ? 'Tempo (s)' : (ex.isUnilateral ? 'Reps (Esq)' : 'Reps')}
                                                </label>
                                                <NumberInput
                                                    value={ex.isUnilateral ? (inputValues[ex.id]?.repsLeft || '') : (inputValues[ex.id]?.reps || '')}
                                                    onChange={(v) => handleInputSave(ex.id, ex.isUnilateral ? 'repsLeft' : 'reps', v)}
                                                    placeholder="0"
                                                    compact={true}
                                                />
                                            </div>

                                            {ex.isUnilateral && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '0.9rem', marginBottom: '4px' }}>
                                                        Reps (Dir)
                                                    </label>
                                                    <NumberInput
                                                        value={inputValues[ex.id]?.repsRight || ''}
                                                        onChange={(v) => handleInputSave(ex.id, 'repsRight', v)}
                                                        placeholder="0"
                                                        compact={true}
                                                    />
                                                </div>
                                            )}

                                            {/* Unilateral Invert Toggle */}
                                            {ex.isUnilateral && (
                                                <button
                                                    onClick={() => setStartSide(state.nextStartSide === 'LEFT' ? 'RIGHT' : 'LEFT')}
                                                    style={{
                                                        marginTop: '8px',
                                                        fontSize: '0.8em',
                                                        padding: '6px 12px',
                                                        background: '#333',
                                                        color: 'white',
                                                        border: '1px solid #555',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <ArrowLeftRight size={14} />
                                                    <span>Próx: {state.nextStartSide === 'LEFT' ? 'Esq' : 'Dir'}</span>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div style={{ fontSize: '2rem', fontWeight: 700, opacity: 0.8, marginTop: '20px' }}>
                        {getPhaseName()}
                    </div>



                    {/* Rest Next Info */}
                    {isResting && (
                        <div style={{ fontSize: '1.5rem', marginTop: '20px' }}>
                            Próximo: {state.phase === PHASE.REST_EXERCISE ?
                                workout.exercises[state.exerciseIndex + 1]?.name :
                                `Série ${state.setNumber}`}
                        </div>
                    )}

                    {/* Failure / Finish Button */}
                    {!isResting && state.phase !== PHASE.FINISHED && state.phase !== PHASE.PREP && currentExercise.failureMode && (
                        <button
                            onClick={registerFailure}
                            style={{
                                marginTop: '40px', padding: '20px 40px', fontSize: '1.5rem',
                                background: '#ff4d4d', color: 'white', border: '4px solid white', borderRadius: '50px',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '10px'
                            }}
                        >
                            <AlertTriangle size={32} />
                            FALHA / ACABEI
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar (Above Controls) */}
            <div style={{ height: '10px', background: 'rgba(0,0,0,0.1)', width: '100%', flexShrink: 0 }}>
                <div style={{ height: '100%', background: 'currentColor', width: `${progressPct}%`, transition: 'width 0.1s linear' }} />
            </div>

            {/* Controls */}
            <div style={{ padding: '30px', display: 'flex', justifyContent: 'space-around', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)', flexShrink: 0 }}>
                <button onClick={() => setShowExitConfirm(true)} style={{ background: 'transparent', color: 'white', border: '1px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px' }}>
                    <X /> Sair
                </button>

                {state.phase !== PHASE.FINISHED && (
                    <button onClick={state.status === 'RUNNING' ? pause : resume} style={{ background: 'white', color: 'black', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {state.status === 'RUNNING' ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" />}
                    </button>
                )}

                <button onClick={skip} style={{ background: 'transparent', color: 'white', border: '1px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px' }}>
                    <SkipForward /> Pular
                </button>
            </div>

            {/* Exit Modal */}
            {showExitConfirm && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 200, padding: '20px' }}>
                    <h2 style={{ marginBottom: '30px', color: 'white' }}>Pausar Treino?</h2>

                    <button onClick={() => { setShowExitConfirm(false); finishWorkout(); }} style={{ width: '100%', maxWidth: '300px', padding: '16px', marginBottom: '16px', background: 'var(--color-primary)', color: 'black', fontWeight: 'bold' }}>
                        FINALIZAR E SALVAR
                    </button>

                    <button onClick={() => { clearRecovery(); onExit(); }} style={{ width: '100%', maxWidth: '300px', padding: '16px', marginBottom: '16px', background: '#ff4d4d', color: 'white' }}>
                        SAIR SEM SALVAR
                    </button>

                    <button onClick={() => setShowExitConfirm(false)} style={{ background: 'transparent', color: '#aaa', marginTop: '10px' }}>Cancel</button>
                </div>
            )}
        </div>
    );
}
