import { Trash2, ArrowLeft, Edit2, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import NumberInput from './common/NumberInput';
import WeightAdviceIcon from './common/WeightAdviceIcon';

export default function WorkoutHistory({ onBack, workouts = [] }) {
    const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('cadence_history') || '[]'));
    const [editingIndex, setEditingIndex] = useState(null); // Index of the global history array being edited
    const [editValues, setEditValues] = useState({}); // { weight, reps, time }

    const saveHistory = (newHistory) => {
        setHistory(newHistory);
        localStorage.setItem('cadence_history', JSON.stringify(newHistory));
    };

    const clearHistory = () => {
        if (confirm('Limpar todo o histórico?')) {
            saveHistory([]);
            onBack();
        }
    };

    const startEdit = (entry, index) => {
        setEditingIndex(index);
        setEditValues({
            weight: entry.weight || 0,
            reps: entry.reps || 0,
            time: entry.time || 0
        });
    };

    const cancelEdit = () => {
        setEditingIndex(null);
        setEditValues({});
    };

    const saveEdit = (index) => {
        const newHistory = [...history];
        newHistory[index] = {
            ...newHistory[index],
            weight: editValues.weight,
            reps: editValues.reps,
            time: editValues.time
        };
        saveHistory(newHistory);
        setEditingIndex(null);
    };

    // Helper to find exercise definition to calculate advice
    const getAdvice = (entry) => {
        // Find workout by ID
        const workout = workouts.find(w => w.id === entry.workoutId) || workouts.find(w => w.name === entry.workoutName);
        if (!workout) return null;

        // Find exercise
        const exercise = workout.exercises.find(e => e.id === entry.exerciseId || e.name === entry.exerciseName);

        // If exercise not found or no failure mode, no advice
        if (!exercise || !exercise.failureMode) return null;

        const val = entry.time > 0 ? entry.time : entry.reps;
        const min = exercise.repsMin || exercise.reps;
        const max = exercise.repsMax || exercise.reps;

        if (val < min) return "decrease"; // Decrease Load
        if (val > max) return "increase"; // Increase Load
        return "maintain"; // Maintain
    };

    // We render in reverse chronological order mainly, but we need the original index for updating.
    // Let's iterate the original array but display them grouped.
    // To handle "Index" tracking, we can map the history first to add "originalIndex".

    const historyWithIndex = history.map((h, i) => ({ ...h, originalIndex: i }));

    // Grouping
    const groupedSessions = historyWithIndex.reduce((acc, entry) => {
        const dateStr = new Date(entry.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        const key = `${dateStr} - ${entry.workoutName}`;

        if (!acc[key]) acc[key] = { dateWorkout: key, entries: [] };
        acc[key].entries.push(entry);
        return acc;
    }, {});

    const sortedSessions = Object.values(groupedSessions).reverse();

    const [expandedSessionIndex, setExpandedSessionIndex] = useState(null);

    const toggleSession = (index) => {
        setExpandedSessionIndex(prev => prev === index ? null : index);
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'left', paddingBottom: '100px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button onClick={onBack} style={{ background: 'transparent' }}><ArrowLeft /> Voltar</button>
                <h2>Histórico</h2>
                <button onClick={clearHistory} style={{ background: 'transparent', color: '#ff4d4d' }}><Trash2 size={20} /></button>
            </header>

            {sortedSessions.length === 0 && <p style={{ opacity: 0.5, textAlign: 'center' }}>Nenhum treino registrado.</p>}

            {sortedSessions.map((session, sIdx) => {
                const isExpanded = expandedSessionIndex === sIdx;

                // Group sequential entries
                const entryGroups = [];
                let currentGroup = null;

                session.entries.forEach(entry => {
                    // Use biSetId if present (check for null/undefined to allow 0), else exerciseId
                    const hasBiSet = entry.biSetId !== undefined && entry.biSetId !== null;
                    const key = hasBiSet ? entry.biSetId : (entry.exerciseId || entry.exerciseName);

                    if (!currentGroup || currentGroup.key !== key) {
                        currentGroup = {
                            key,
                            isBiSet: hasBiSet,
                            entries: []
                        };
                        entryGroups.push(currentGroup);
                    }
                    currentGroup.entries.push(entry);
                });

                return (
                    <div key={sIdx} style={{ marginBottom: '16px' }}>
                        <div
                            onClick={() => toggleSession(sIdx)}
                            style={{
                                cursor: 'pointer',
                                background: '#2a2a2a',
                                padding: '16px',
                                borderRadius: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'background 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{session.dateWorkout}</span>
                                {session.entries[0]?.duration > 0 && (
                                    <span style={{ fontSize: '0.8em', opacity: 0.7, background: '#333', padding: '2px 8px', borderRadius: '4px' }}>
                                        ⏱ {new Date(session.entries[0].duration).toISOString().substr(11, 8)}
                                    </span>
                                )}
                            </div>
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>

                        {isExpanded && (
                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px', paddingRight: '8px' }}>
                                {entryGroups.map((group, gIdx) => {
                                    // Inside a group (BiSet or Single), we cluster by Exercise Name (or ID) for display
                                    // Example BiSet: A1, B1, A2, B2 -> { A: [A1, A2], B: [B1, B2] }
                                    // We want to preserve checking order? Usually Ex A comes first.
                                    const exercisesInGroup = {};
                                    const exOrder = [];

                                    group.entries.forEach(e => {
                                        const id = e.exerciseId || e.exerciseName;
                                        if (!exercisesInGroup[id]) {
                                            exercisesInGroup[id] = { name: e.exerciseName, sets: [] };
                                            exOrder.push(id);
                                        }
                                        exercisesInGroup[id].sets.push(e);
                                    });

                                    return (
                                        <div key={gIdx} style={{
                                            border: group.isBiSet ? '1px solid #ff9800' : 'none',
                                            borderRadius: '12px',
                                            padding: group.isBiSet ? '16px' : '0',
                                            position: 'relative',
                                            marginTop: group.isBiSet ? '8px' : '0'
                                        }}>
                                            {group.isBiSet && (
                                                <div style={{
                                                    position: 'absolute', top: '-10px', left: '16px',
                                                    background: '#ff9800', color: 'black', fontSize: '0.7em',
                                                    padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'
                                                }}>
                                                    BI-SET
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                {exOrder.map(exId => {
                                                    const exData = exercisesInGroup[exId];
                                                    return (
                                                        <div key={exId} style={{ background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden' }}>
                                                            <div style={{ background: '#333', padding: '10px 16px', fontWeight: 'bold' }}>
                                                                {exData.name}
                                                            </div>
                                                            <div style={{ padding: '12px' }}>
                                                                <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr auto', fontSize: '0.8em', opacity: 0.6, marginBottom: '8px', gap: '4px' }}>
                                                                    <span>#</span>
                                                                    <span style={{ textAlign: 'center' }}>REALIZADO</span>
                                                                    <span style={{ textAlign: 'center' }}>CARGA</span>
                                                                    <span></span>
                                                                </div>
                                                                {exData.sets.map((set, stIdx) => {
                                                                    const isEditing = editingIndex === set.originalIndex;
                                                                    const advice = getAdvice(set);

                                                                    return (
                                                                        <div key={stIdx} style={{
                                                                            display: 'grid',
                                                                            gridTemplateColumns: isEditing ? '40px 1fr auto' : '40px 1fr 1fr auto',
                                                                            alignItems: 'center',
                                                                            padding: '8px 0',
                                                                            borderBottom: '1px solid #2a2a2a',
                                                                            gap: '4px'
                                                                        }}>
                                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                                                                                <span>{set.setNumber}</span>
                                                                                {set.side && (
                                                                                    <span style={{
                                                                                        fontSize: '0.7em',
                                                                                        color: '#000',
                                                                                        background: set.side === 'LEFT' ? 'var(--color-primary)' : '#ff9800',
                                                                                        fontWeight: 'bold',
                                                                                        padding: '1px 4px',
                                                                                        borderRadius: '3px',
                                                                                        marginTop: '2px'
                                                                                    }}>
                                                                                        {set.side === 'LEFT' ? 'E' : 'D'}
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            {isEditing ? (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                        <span style={{ fontSize: '0.8em', color: '#888', width: '40px', textAlign: 'right' }}>
                                                                                            {editValues.time > 0 ? 'Seg' : 'Reps'}
                                                                                        </span>
                                                                                        <NumberInput
                                                                                            value={editValues.time > 0 ? editValues.time : editValues.reps}
                                                                                            onChange={(v) => setEditValues(prev => ({ ...prev, [editValues.time > 0 ? 'time' : 'reps']: v }))}
                                                                                            compact={true}
                                                                                        />
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                        <span style={{ fontSize: '0.8em', color: '#888', width: '40px', textAlign: 'right' }}>
                                                                                            Kg
                                                                                        </span>
                                                                                        <NumberInput
                                                                                            value={editValues.weight}
                                                                                            onChange={(v) => setEditValues(prev => ({ ...prev, weight: v }))}
                                                                                            compact={true}
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <>
                                                                                    <div style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                                                                        {set.time !== undefined && set.time > 0 ? `${Math.floor(set.time)}s` : set.reps}
                                                                                    </div>
                                                                                    <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                                                        <span>{set.weight || '-'}</span>
                                                                                        <WeightAdviceIcon advice={advice} />
                                                                                    </div>
                                                                                </>
                                                                            )}

                                                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                                                {isEditing ? (
                                                                                    <>
                                                                                        <button
                                                                                            onClick={() => saveEdit(set.originalIndex)}
                                                                                            style={{ padding: '8px', background: 'var(--color-primary)', color: 'black', borderRadius: '4px' }}
                                                                                        >
                                                                                            <Save size={20} />
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={cancelEdit}
                                                                                            style={{ padding: '8px', background: '#333', color: 'white', borderRadius: '4px' }}
                                                                                        >
                                                                                            <X size={20} />
                                                                                        </button>
                                                                                    </>
                                                                                ) : (
                                                                                    <button
                                                                                        onClick={() => startEdit(set, set.originalIndex)}
                                                                                        style={{ padding: '4px', background: 'transparent', color: '#666' }}
                                                                                    >
                                                                                        <Edit2 size={16} />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
