import { useEffect, useRef, useState } from 'react';
import { useCadenceTimer, PHASE } from '../hooks/useCadenceTimer';
import { useTTS } from '../hooks/useTTS';
import { Pause, Play, SkipForward, X, AlertTriangle } from 'lucide-react';

export default function ActiveWorkout({ workout, onExit, onFinishWorkout }) {
    const { state, start, pause, resume, skip, registerFailure, logSetData } = useCadenceTimer();
    const { speak, playBeep } = useTTS();
    const prevPhaseRef = useRef(state.phase);
    const prevTimeRef = useRef(state.timeLeft);

    // Local state for weight input during rest
    // Local state for weight input during rest
    const [weightInput, setWeightInput] = useState('');
    const weightInputRef = useRef(weightInput); // To access current value in effects without stale closures
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    // Sync ref
    useEffect(() => { weightInputRef.current = weightInput; }, [weightInput]);

    // Start on mount
    useEffect(() => {
        if (workout) {
            start(workout);
        }
    }, [workout, start]);

    // Handle Workout Finish
    useEffect(() => {
        if (state.status === 'FINISHED' && onFinishWorkout) {
            // Pass the collected weightData back up
            onFinishWorkout(state.weightData);
        }
    }, [state.status, state.weightData, onFinishWorkout]);

    // Audio Logic
    useEffect(() => {
        if (state.phase !== prevPhaseRef.current) {

            const p = state.phase;
            const prevP = prevPhaseRef.current;

            // Auto-save Weight when LEAVING Rest
            if (prevP === PHASE.REST_SET || prevP === PHASE.REST_EXERCISE) {
                const val = parseFloat(weightInputRef.current);
                // Check if it's a valid number (even 0 is valid, but empty string is not NaN but parseFloat('') is NaN)
                if (!isNaN(val)) {
                    // Update the last entry in history (which corresponds to the set just finished before this rest)
                    const lastEntry = state.weightData[state.weightData.length - 1];
                    if (lastEntry) {
                        logSetData(lastEntry.exerciseId, lastEntry.setNumber, lastEntry.reps, val);
                    }
                }
            }

            // Reset weight input on new rest phase
            if (p === PHASE.REST_SET || p === PHASE.REST_EXERCISE) {
                // Find last weight for THIS exercise
                // We access current exercise from props/state? We need workout from props.
                // But we are inside effect. state.exerciseIndex is current.
                // Note: If we just finished set 1, we want set 1's weight? 
                // NO. The user wants to "repeat the same weight in the NEXT set".
                // So if I just did 10kg, I want 10kg to appear so I can just confirm or change.

                // We need the weight of the *previous* set of *this* exercise.
                // Or if it's the first set of this exercise? Maybe default to 0.

                // Let's look at weightData.
                // If we are in REST_SET (going to set 2), we want Set 1's weight.
                // If we are in REST_EXERCISE (going to next ex), wait. 
                // The User said: "Within a SAME exercise, if charge was informed in last set, repeat it in next".

                // So if I am in Rest 1->2. Look for Set 1.
                // weightData has Set 1.
                // But weightData might NOT have it yet if I haven't typed it?
                // Ah, I type it in the CURRENT rest.

                // Wait. The requirement: "If charge was informed in LAST set".
                // Set 1 -> Rest. I type 10kg.
                // Set 2 -> Rest. I want 10kg to appear (from Set 1).

                // So when I enter Rest Set 2 (after finishing Set 2), I want to see what I lifted in Set 1?
                // OR does the user mean: "I lifted 10kg in Set 1. Now I am in Rest. I input 10kg."?
                // NO. "Repeat the same charge in the NEXT."

                // Interpretation:
                // Set 1 Done. Rest Screen Appears. Input is empty. I type 10kg.
                // Set 2 Starts. Set 2 Done. Rest Screen Appears. Input should be "10kg" (pre-filled).

                // So when entering Rest (for Set N), lookup weight for Set N-1.
                // Correct.

                const currentExId = workout.exercises[state.exerciseIndex].id;
                // Wait. state.setNumber in REST_SET is already N+1 (the next set).
                // Example: Finish Set 1. Call finishSet. setNumber becomes 2. Phase REST_SET.
                // So state.setNumber is 2. We want weight from Set 1.
                // So target set to find = state.setNumber - 1.

                // Search weightData for currentExerciseId
                const exerciseLogs = state.weightData.filter(w => w.exerciseId === currentExId);

                // We want the weight from the PREVIOUS set (not the one just finished/added which is 0)
                // If we just finished Set 2 (rest phase), logs has [Set1, Set2]. We want Set1.
                // If we just finished Set 1, logs has [Set1]. We want nothing (or previous history if we eventually add that).

                let suggestedWeight = '';
                if (exerciseLogs.length >= 2) {
                    const prevSetLog = exerciseLogs[exerciseLogs.length - 2];
                    if (prevSetLog && prevSetLog.weight) {
                        suggestedWeight = prevSetLog.weight;
                    }
                }

                // Use setTimeout to avoid direct state update during render cycle/effect
                setTimeout(() => {
                    setWeightInput(suggestedWeight);
                }, 0);
            }

            switch (p) {
                case PHASE.PREP:
                    speak("Preparar", 1.2);
                    break;
                case PHASE.ECCENTRIC:
                    speak("Desce", 1.3);
                    break;
                case PHASE.CONCENTRIC:
                    speak("Sobe", 1.3);
                    break;
                case PHASE.BOTTOM_HOLD:
                case PHASE.TOP_HOLD:
                case PHASE.ISOMETRIC_WORK:
                    speak("Segura", 1.2);
                    break;
                case PHASE.REST_SET:
                case PHASE.REST_EXERCISE:
                    speak("Descansa");
                    break;
                case PHASE.FINISHED:
                    speak("Treino Concluído");
                    break;
            }
            prevPhaseRef.current = p;
        }

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

    }, [state.phase, state.timeLeft, state.phaseDuration, speak, playBeep]);

    // Autosave weight when user types (debounced or on blur? let's do blur or convenient button)
    const handleWeightSave = () => {
        // We need to identify WHICH set to update.
        // If we switched Exercise, setNumber is 1. We need the LAST exercise set.

        // Let's look at state.weightData last entry.
        const lastEntry = state.weightData[state.weightData.length - 1];
        if (lastEntry) {
            logSetData(lastEntry.exerciseId, lastEntry.setNumber, lastEntry.reps, parseFloat(weightInput));
        }
    };

    // Visuals
    const currentExercise = workout.exercises[state.exerciseIndex];

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

    return (
        <div className="active-workout" style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: getPhaseColor(),
            color: '#000',
            transition: 'background-color 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100
        }}>

            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: (state.phase === PHASE.PREP || state.phase === PHASE.FINISHED) ? 'white' : 'black'
            }}>

                {/* Header Info */}
                <div style={{ position: 'absolute', top: 20, left: 0, right: 0, padding: '0 20px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '1.2em', fontWeight: 600 }}>{currentExercise.name}</span>
                    <span style={{ fontSize: '1.2em' }}>Série {state.setNumber}/{currentExercise.sets}</span>
                </div>

                {/* Main Counter */}
                {!isResting && (
                    <div style={{ fontSize: '12rem', fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {currentExercise.isIsometric && currentExercise.failureMode && state.timeLeft > 60
                            ? Math.floor(state.isometricTime) // Count UP using Floor (0, 1, 2...)
                            : Math.ceil(state.timeLeft) // Otherwise count down
                        }
                    </div>
                )}

                {/* Rest UI with Weight Input */}
                {isResting && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                        <div style={{ fontSize: '8rem', fontWeight: 900 }}>{Math.ceil(state.timeLeft)}</div>
                        <div style={{ background: 'rgba(255,255,255,0.9)', padding: '20px', borderRadius: '16px', color: 'black' }}>
                            <label style={{ display: 'block', fontSize: '1.2rem', marginBottom: '8px' }}>Carga Realizada (kg)</label>
                            <input
                                type="number"
                                value={weightInput}
                                onChange={(e) => setWeightInput(e.target.value)}
                                onBlur={handleWeightSave}
                                placeholder="0"
                                style={{ fontSize: '2rem', width: '120px', textAlign: 'center', padding: '10px', borderRadius: '8px', border: '2px solid #333' }}
                            />
                        </div>
                    </div>
                )}

                <div style={{ fontSize: '2rem', fontWeight: 700, opacity: 0.8, marginTop: '20px' }}>
                    {getPhaseName()}
                </div>

                {/* Rep Counter (Actual vs Target) */}
                {!isResting && state.phase !== PHASE.FINISHED && (
                    <div style={{ fontSize: '2.5rem', marginTop: '20px' }}>
                        {currentExercise.isIsometric ? (
                            <span>Tempo: {Math.floor(state.isometricTime)}s</span>
                        ) : (
                            <span>Rep {state.actualReps} <span style={{ fontSize: '0.6em', opacity: 0.6 }}>/ {currentExercise.reps}</span></span>
                        )}
                    </div>
                )}

                {/* Rest Info */}
                {isResting && (
                    <div style={{ fontSize: '1.5rem', marginTop: '20px' }}>
                        Próximo: {state.phase === PHASE.REST_EXERCISE ?
                            workout.exercises[state.exerciseIndex + 1]?.name :
                            `Série ${state.setNumber}`}
                    </div>
                )}

                {/* Failure / Finish Button - Only if enabled for this exercise */}
                {!isResting && state.phase !== PHASE.FINISHED && state.phase !== PHASE.PREP && currentExercise.failureMode && (
                    <button
                        onClick={registerFailure}
                        style={{
                            marginTop: '40px',
                            padding: '20px 40px',
                            fontSize: '1.5rem',
                            background: '#ff4d4d',
                            color: 'white',
                            border: '4px solid white',
                            borderRadius: '50px',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}
                    >
                        <AlertTriangle size={32} />
                        FALHA / ACABEI
                    </button>
                )}

            </div>

            <div style={{
                padding: '30px',
                display: 'flex',
                justifyContent: 'space-around',
                background: 'rgba(0,0,0,0.2)',
                backdropFilter: 'blur(10px)'
            }}>
                <button onClick={() => setShowExitConfirm(true)} style={{ background: 'transparent', color: 'white', border: '1px solid white' }}>
                    <X /> Sair
                </button>

                {state.phase !== PHASE.FINISHED && (
                    <button onClick={state.status === 'RUNNING' ? pause : resume} style={{ background: 'white', color: 'black', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {state.status === 'RUNNING' ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" />}
                    </button>
                )}

                <button onClick={skip} style={{ background: 'transparent', color: 'white', border: '1px solid white' }}>
                    <SkipForward /> Pular
                </button>
            </div>

            {/* Progress Bar */}
            <div style={{
                height: '10px',
                background: 'rgba(0,0,0,0.1)',
                width: '100%',
                position: 'absolute',
                bottom: '124px'
            }}>
                <div style={{
                    height: '100%',
                    background: 'currentColor',
                    width: `${progressPct}%`,
                    transition: 'width 0.1s linear'
                }} />
            </div>



            {/* Exit Confirmation Modal */}
            {
                showExitConfirm && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 200,
                        padding: '20px'
                    }}>
                        <h2 style={{ marginBottom: '30px', color: 'white' }}>Pausar Treino?</h2>

                        <button
                            onClick={() => onFinishWorkout(state.weightData)}
                            style={{ width: '100%', maxWidth: '300px', padding: '16px', marginBottom: '16px', background: 'var(--color-primary)', color: 'black', fontWeight: 'bold' }}
                        >
                            FINALIZAR E SALVAR
                        </button>

                        <button
                            onClick={onExit}
                            style={{ width: '100%', maxWidth: '300px', padding: '16px', marginBottom: '16px', background: '#ff4d4d', color: 'white' }}
                        >
                            SAIR SEM SALVAR
                        </button>

                        <button
                            onClick={() => setShowExitConfirm(false)}
                            style={{ background: 'transparent', color: '#aaa', marginTop: '10px' }}
                        >
                            Cancelar
                        </button>
                    </div>
                )
            }

        </div >
    );
}
