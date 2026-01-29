import { useState } from 'react';
import { Play, ArrowLeft } from 'lucide-react';
import NumberInput from './common/NumberInput';
import WeightAdviceIcon from './common/WeightAdviceIcon';

export default function WorkoutPreview({ workout, onStart, onBack }) {
    const history = JSON.parse(localStorage.getItem('cadence_history') || '[]');

    const [adjustedWeights, setAdjustedWeights] = useState(() => {
        const defaults = {};

        if (workout && workout.exercises) {
            workout.exercises.forEach(ex => {
                // Find last weight for this exercise, searching by ID first then Name
                const entry = history.slice().reverse().find(h =>
                    h.exerciseId === ex.id || h.exerciseName === ex.name
                );
                defaults[ex.id] = entry ? entry.weight : '';
            });
        }
        return defaults;
    });

    const getAdvice = (ex) => {
        if (!ex.failureMode) return null;

        // Filter history for this exercise
        const logs = history.filter(h => h.exerciseId === ex.id);
        if (logs.length === 0) return null;

        // Get the very last log entry
        const lastLog = logs[logs.length - 1];
        if (!lastLog) return null;

        const val = ex.isIsometric ? lastLog.time : lastLog.reps;
        const min = ex.repsMin || ex.reps;
        const max = ex.repsMax || ex.reps;

        // Simple advice logic based on last performance
        if (val < min) return 'decrease';
        if (val > max) return 'increase';
        return 'maintain';
    };

    const handleWeightChange = (exId, val) => {
        setAdjustedWeights(prev => ({
            ...prev,
            [exId]: val
        }));
    };

    const handleStart = () => {
        onStart(adjustedWeights);
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#121212',
            color: 'white',
            padding: '10px', // Reduced outer padding
            maxWidth: '600px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box' // Ensure padding doesn't add to width
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <button onClick={onBack} style={{ background: 'transparent', color: '#ccc', marginRight: '10px', padding: '8px' }}>
                    <ArrowLeft size={24} />
                </button>
                <h1 style={{ fontSize: '1.3rem', margin: 0 }}>Resumo do Treino</h1>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
                <p style={{ color: '#888', marginBottom: '15px', fontSize: '0.9em', lineHeight: '1.3' }}>
                    Confira as cargas.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {workout.exercises.map(ex => {
                        const advice = getAdvice(ex);

                        return (
                            <div key={ex.id} style={{
                                background: '#1e1e1e',
                                padding: '10px', // Compact padding
                                borderRadius: '12px',
                                display: 'grid', // Use Grid for better control
                                gridTemplateColumns: 'minmax(0, 1fr) auto', // Text takes available space, Input takes needed space
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                {/* Text Column */}
                                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{
                                        fontWeight: 'bold',
                                        fontSize: '0.95em',
                                        marginBottom: '4px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        textAlign: 'left' // Explicit left align
                                    }}>
                                        {ex.name}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                        <span style={{ color: '#888', fontSize: '0.85em' }}>
                                            {ex.sets} x {ex.reps}
                                        </span>

                                        {advice && (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                                background: 'rgba(255,255,255,0.08)',
                                                padding: '2px 6px',
                                                borderRadius: '4px'
                                            }}>
                                                <WeightAdviceIcon advice={advice} />
                                                <span style={{
                                                    fontSize: '0.75em',
                                                    fontWeight: 600,
                                                    color: advice === 'increase' ? '#60a5fa' : (advice === 'decrease' ? '#f87171' : '#4ade80')
                                                }}>
                                                    {advice === 'increase' ? 'Subir' : (advice === 'decrease' ? 'Descer' : 'Manter')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Input Column */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.7em', color: '#aaa', marginBottom: '2px' }}>
                                        kg
                                    </label>
                                    <NumberInput
                                        value={adjustedWeights[ex.id] !== undefined ? adjustedWeights[ex.id] : ''}
                                        onChange={(v) => handleWeightChange(ex.id, v)}
                                        placeholder="0"
                                        compact={true}
                                        // Pass style to override width/size details if necessary inside NumberInput
                                        style={{ transform: 'scale(0.85)', transformOrigin: 'center center' }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #333' }}>
                <button
                    onClick={handleStart}
                    className="btn-primary"
                    style={{
                        width: '100%',
                        padding: '14px',
                        fontSize: '1.1em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        borderRadius: '12px',
                        background: 'var(--color-primary)',
                        color: 'black',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    <Play size={22} fill="black" />
                    INICIAR
                </button>
            </div>
        </div>
    );
}
