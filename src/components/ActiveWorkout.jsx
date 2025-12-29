import { useEffect, useRef, useState } from 'react';
import { useCadenceTimer, PHASE } from '../hooks/useCadenceTimer';
import { useTTS } from '../hooks/useTTS';
import { Pause, Play, SkipForward, X, AlertTriangle } from 'lucide-react';
import NumberInput from './common/NumberInput';
import WorkoutSummary from './WorkoutSummary';

export default function ActiveWorkout({ workout, onExit, onFinishWorkout }) {
    const { state, start, pause, resume, skip, registerFailure, finishWorkout, logSetData } = useCadenceTimer();
    const { speak, playBeep } = useTTS();
    const prevPhaseRef = useRef(state.phase);
    const prevTimeRef = useRef(state.timeLeft);

    // Initial Wake Lock
    useEffect(() => {
        let wakeLock = null;
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                }
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
            }
        };
        requestWakeLock();
        return () => {
            if (wakeLock)
                wakeLock.release();
        };
    }, []);

    // Local state for inputs during rest
    const [weightInput, setWeightInput] = useState('');
    const [repsInput, setRepsInput] = useState('');

    // Refs to avoid stale closures in effects
    const weightInputRef = useRef(weightInput);
    const repsInputRef = useRef(repsInput);

    const [showExitConfirm, setShowExitConfirm] = useState(false);

    useEffect(() => { weightInputRef.current = weightInput; }, [weightInput]);
    useEffect(() => { repsInputRef.current = repsInput; }, [repsInput]);

    // Start on mount
    useEffect(() => {
        if (workout) {
            start(workout);
        }
    }, [workout, start]);


    // Audio Logic & Auto-Save Logic on Phase Change
    useEffect(() => {
        if (state.phase !== prevPhaseRef.current) {
            const p = state.phase;
            const prevP = prevPhaseRef.current;

            // LEAVING Rest: Auto-save Weight & Reps
            if (prevP === PHASE.REST_SET || prevP === PHASE.REST_EXERCISE) {
                const wVal = parseFloat(weightInputRef.current);
                const rVal = parseInt(repsInputRef.current);

                // Update the last entry (the set just finished before this rest)
                const lastEntry = state.weightData[state.weightData.length - 1];
                if (lastEntry) {
                    const finalWeight = !isNaN(wVal) ? wVal : (lastEntry.weight || 0);
                    const finalReps = !isNaN(rVal) ? rVal : lastEntry.reps;

                    // Determine if we are saving Reps or Time
                    // We need to look up current exercise ISOMETRIC status.
                    // But 'state.exerciseIndex' might have advanced if rest is over?
                    // No, transition happens AFTER this effect hook. This hook runs ON change.
                    // The 'state' here is the NEW state.
                    // If we just entered PREP (from Rest), state.exerciseIndex might be next exercise.
                    // So we must use lastEntry.exerciseId to find exercise.
                    const ex = workout.exercises.find(e => e.id === lastEntry.exerciseId);
                    const isIso = ex && ex.isIsometric;

                    // If Isometric, rVal is TIME. pass as 'time'. Reps should be 0 or ignored.
                    logSetData(lastEntry.exerciseId, lastEntry.setNumber, isIso ? 0 : finalReps, finalWeight, isIso ? finalReps : 0);
                }
            }

            // ENTERING Rest: Pre-fill inputs
            if (p === PHASE.REST_SET || p === PHASE.REST_EXERCISE) {
                const currentExId = workout.exercises[state.exerciseIndex].id;
                const exerciseLogs = state.weightData.filter(w => w.exerciseId === currentExId);

                // The last global entry is the set just completed
                const lastGlobalEntry = state.weightData[state.weightData.length - 1];

                let suggestedWeight = '';
                let suggestedReps = '';

                if (lastGlobalEntry) {
                    const ex = workout.exercises.find(e => e.id === lastGlobalEntry.exerciseId);
                    const isIso = ex && ex.isIsometric;

                    suggestedWeight = lastGlobalEntry.weight || '';
                    // If weight is 0, maybe try to find previous set to suggest?
                    if (!suggestedWeight && exerciseLogs.length >= 2) {
                        // Try set before this one (index - 2 because index-1 is the just finished one)
                        suggestedWeight = exerciseLogs[exerciseLogs.length - 2].weight;
                    }

                    suggestedReps = isIso ? Math.floor(lastGlobalEntry.time) : lastGlobalEntry.reps;
                }

                // Use setTimeout to update state
                setTimeout(() => {
                    setWeightInput(suggestedWeight);
                    setRepsInput(suggestedReps);
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

    }, [state.phase, state.timeLeft, state.phaseDuration, speak, playBeep, logSetData, state.weightData, workout.exercises, state.exerciseIndex]);


    // Manual Save Handler (onBlur or onChange)
    const handleInputSave = () => {
        const lastEntry = state.weightData[state.weightData.length - 1];
        if (lastEntry) {
            const wVal = parseFloat(weightInputRef.current); // Use Ref to rely on latest
            const rVal = parseInt(repsInputRef.current);

            const finalWeight = !isNaN(wVal) ? wVal : lastEntry.weight;
            const finalReps = !isNaN(rVal) ? rVal : lastEntry.reps;

            const ex = workout.exercises.find(e => e.id === lastEntry.exerciseId);
            const isIso = ex && ex.isIsometric;

            logSetData(lastEntry.exerciseId, lastEntry.setNumber, isIso ? 0 : finalReps, finalWeight, isIso ? finalReps : 0);
        }
    };


    // Render Helpers
    const currentExercise = workout.exercises[state.exerciseIndex] || {};

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

    // If Summary is active, render it overlaying everything
    if (state.status === 'FINISHED') {
        return (
            <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#121212', zIndex: 300 }}>
                <WorkoutSummary
                    workout={workout}
                    weightData={state.weightData}
                    onSave={(finalData) => onFinishWorkout(finalData)}
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

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: (state.phase === PHASE.PREP || state.phase === PHASE.FINISHED) ? 'white' : 'black' }}>

                {/* Header Info */}
                {/* Header Info */}
                <div style={{ position: 'absolute', top: 20, left: 0, right: 0, padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '1.2em', fontWeight: 600 }}>{currentExercise.name}</span>
                        <span style={{ fontSize: '1.2em' }}>Série {state.setNumber}/{currentExercise.sets}</span>
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

                {/* Main Counter */}
                {!isResting && (
                    <div style={{ fontSize: '12rem', fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {currentExercise.isIsometric && currentExercise.failureMode && state.timeLeft > 60
                            ? Math.floor(state.isometricTime)
                            : Math.ceil(state.timeLeft)
                        }
                    </div>
                )}

                {/* Rest UI with Inputs */}
                {isResting && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                        <div style={{ fontSize: '8rem', fontWeight: 900 }}>{Math.ceil(state.timeLeft)}</div>
                        <div style={{ background: 'rgba(255,255,255,0.9)', padding: '20px', borderRadius: '16px', color: 'black', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <label style={{ fontSize: '1rem', marginBottom: '8px' }}>Carga (kg)</label>
                                <NumberInput
                                    value={weightInput}
                                    onChange={(v) => { setWeightInput(v); handleInputSave(); }}
                                    placeholder="0"
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <label style={{ fontSize: '1rem', marginBottom: '8px' }}>
                                    {/* Detect if PREVIOUS exercise (the one we are resting after) was Isometric */}
                                    {(() => {
                                        // We need the exercise corresponding to the inputs, which is the LAST entry logged.
                                        // Or simply check currentExercise if we assume we are resting AFTER it?
                                        // If PHASE is REST_SET, we are resting after 'currentExercise'.
                                        // If PHASE is REST_EXERCISE, we are resting after a generic "prev" exercise. 
                                        // Actually state.exerciseIndex points to the NEXT exercise in REST_EXERCISE phase (logic in transitionPhase: exerciseIndex + 1).
                                        // So if REST_EXERCISE, look at index - 1.

                                        const refIndex = state.phase === PHASE.REST_EXERCISE ? state.exerciseIndex - 1 : state.exerciseIndex;
                                        const refEx = workout.exercises[refIndex];
                                        return (refEx && refEx.isIsometric) ? 'Tempo (s)' : 'Reps Feitas';
                                    })()}
                                </label>
                                <NumberInput
                                    value={repsInput}
                                    onChange={(v) => { setRepsInput(v); handleInputSave(); }}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ fontSize: '2rem', fontWeight: 700, opacity: 0.8, marginTop: '20px' }}>
                    {getPhaseName()}
                </div>

                {/* Rep Counter */}
                {!isResting && state.phase !== PHASE.FINISHED && state.phase !== PHASE.PREP && (
                    <div style={{ fontSize: '2.5rem', marginTop: '20px' }}>
                        {currentExercise.isIsometric ? (
                            <span>Tempo: {Math.floor(state.isometricTime)}s</span>
                        ) : (
                            // Start at 1. If 0 completed, show 1.
                            <span>Rep {state.actualReps + 1} <span style={{ fontSize: '0.6em', opacity: 0.6 }}>/ {currentExercise.reps}</span></span>
                        )}
                    </div>
                )}

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

            {/* Controls */}
            <div style={{ padding: '30px', display: 'flex', justifyContent: 'space-around', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)' }}>
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

            {/* Progress Bar */}
            <div style={{ height: '10px', background: 'rgba(0,0,0,0.1)', width: '100%', position: 'absolute', bottom: '124px' }}>
                <div style={{ height: '100%', background: 'currentColor', width: `${progressPct}%`, transition: 'width 0.1s linear' }} />
            </div>

            {/* Exit Modal */}
            {showExitConfirm && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 200, padding: '20px' }}>
                    <h2 style={{ marginBottom: '30px', color: 'white' }}>Pausar Treino?</h2>

                    <button onClick={() => { setShowExitConfirm(false); finishWorkout(); }} style={{ width: '100%', maxWidth: '300px', padding: '16px', marginBottom: '16px', background: 'var(--color-primary)', color: 'black', fontWeight: 'bold' }}>
                        FINALIZAR E SALVAR
                    </button>

                    <button onClick={onExit} style={{ width: '100%', maxWidth: '300px', padding: '16px', marginBottom: '16px', background: '#ff4d4d', color: 'white' }}>
                        SAIR SEM SALVAR
                    </button>

                    <button onClick={() => setShowExitConfirm(false)} style={{ background: 'transparent', color: '#aaa', marginTop: '10px' }}>Cancel</button>
                </div>
            )}
        </div>
    );
}
