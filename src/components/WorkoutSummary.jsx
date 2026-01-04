import { useState, useMemo } from 'react';
import NumberInput from './common/NumberInput';
import { Save, CheckCircle, Edit2, Clock, ArrowUp, ArrowDown, Minus } from 'lucide-react';

export default function WorkoutSummary({ workout, weightData, onSave, onDiscard, startTime, finishTime }) {
    // weightData is array of { exerciseId, setNumber, reps, weight, time }
    // We want to allow editing this data before saving.
    const [data, setData] = useState(weightData);

    const updateEntry = (index, field, value) => {
        const newData = [...data];
        newData[index] = { ...newData[index], [field]: value };
        setData(newData);
    };

    // Calculate Duration
    // If finishTime isn't set (should be), we can just show 00:00:00 or handle it gracefully.
    // Date.now() inside useMemo is technically impure but often used for defaults. 
    // However, to satisfy linter, let's use a fixed fallback or just rely on passed props.
    // If finishTime is missing, assume 0 duration or handle elsewhere.
    const durationStr = useMemo(() => {
        if (!finishTime || !startTime) return "00:00:00";
        const durationMs = finishTime - startTime;
        return new Date(Math.max(0, durationMs)).toISOString().substr(11, 8);
    }, [startTime, finishTime]);

    // Load Previous History for Comparison
    const previousData = useMemo(() => {
        try {
            const history = JSON.parse(localStorage.getItem('cadence_history') || '[]');

            // Filter entries for this workout ID OR Name (legacy support)
            const workoutEntries = history.filter(h =>
                h.workoutId === workout.id || h.workoutName === workout.name
            );
            if (workoutEntries.length === 0) return null;

            // Find unique session dates
            const dates = [...new Set(workoutEntries.map(e => e.date))].sort();

            // We want the most recent one. 
            // Note: History entries from THIS workout aren't saved yet (that happens after Summary save).
            // So the last date in history IS the previous session.
            const lastDate = dates[dates.length - 1];

            if (!lastDate) return null;

            // Get entries for that last date
            return workoutEntries.filter(e => e.date === lastDate);
        } catch (e) {
            console.error("Error loading history", e);
            return null;
        }
    }, [workout.id, workout.name]);

    const getComparison = (currentEntry) => {
        if (!previousData) return {};

        // Find matching entry: same exerciseId OR exerciseName, and setNumber
        const currentExercise = workout.exercises.find(e => e.id === currentEntry.exerciseId);
        const currentExName = currentExercise ? currentExercise.name : null;

        const prev = previousData.find(p => {
            const sameSet = p.setNumber === currentEntry.setNumber;
            const sameId = p.exerciseId && p.exerciseId === currentEntry.exerciseId;
            const sameName = currentExName && p.exerciseName === currentExName;

            const sameSide = (p.side || null) === (currentEntry.side || null);

            return sameSet && (sameId || sameName) && sameSide;
        });

        if (!prev) return {};

        return {
            weightDiff: (currentEntry.weight || 0) - (prev.weight || 0),
            repsDiff: (currentEntry.time > 0 ? Math.floor(currentEntry.time) : currentEntry.reps) - (prev.time > 0 ? Math.floor(prev.time) : prev.reps)
        };
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center', color: 'white' }}>
            <div style={{ marginBottom: '40px' }}>
                <CheckCircle size={80} color="var(--color-primary)" style={{ marginBottom: '20px' }} />
                <h1 style={{ margin: 0 }}>Parabéns!</h1>
                <p style={{ opacity: 0.8, fontSize: '1.2em' }}>Treino "{workout.name}" Finalizado.</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px', opacity: 0.7 }}>
                    <Clock size={20} />
                    <span style={{ fontSize: '1.2em' }}>Tempo Total: {durationStr}</span>
                </div>
            </div>

            <div style={{ textAlign: 'left', marginBottom: '40px' }}>
                <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '10px' }}>Resumo & Ajustes</h3>
                <p style={{ fontSize: '0.9em', color: '#aaa', marginBottom: '20px' }}>
                    Confira e ajuste as cargas e repetições se necessário.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {(() => {
                        const groups = [];
                        let i = 0;
                        while (i < workout.exercises.length) {
                            const ex = workout.exercises[i];
                            const group = [ex];
                            let j = i + 1;

                            // Check for Bi-Set chain (sequential exercises with same biSetId)
                            if (ex.biSetId) {
                                while (j < workout.exercises.length && workout.exercises[j].biSetId === ex.biSetId) {
                                    group.push(workout.exercises[j]);
                                    j++;
                                }
                            }
                            groups.push(group);
                            i = j;
                        }

                        return groups.map((group, gIdx) => {
                            const isBiSet = group.length > 1;

                            return (
                                <div key={gIdx} style={{
                                    padding: isBiSet ? '16px' : '0',
                                    border: isBiSet ? '1px solid #ff9800' : 'none',
                                    borderRadius: '12px',
                                    position: 'relative',
                                    marginTop: isBiSet ? '24px' : '0'
                                }}>
                                    {isBiSet && (
                                        <div style={{
                                            position: 'absolute', top: '-12px', left: '16px',
                                            background: '#ff9800', color: 'black', fontWeight: 'bold',
                                            padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em'
                                        }}>
                                            BI-SET
                                        </div>
                                    )}

                                    {group.map(exercise => {
                                        const entriesWithIndex = data
                                            .map((entry, idx) => ({ ...entry, originalIndex: idx }))
                                            .filter(e => {
                                                // Ensure correct matching for Bi-Set vs Standalone instances
                                                // exercises with same ID might appear in different Bi-Sets
                                                const targetBiSet = exercise.biSetId || null;
                                                const entryBiSet = e.biSetId || null;
                                                return e.exerciseId === exercise.id && entryBiSet === targetBiSet;
                                            });

                                        if (entriesWithIndex.length === 0) return null;

                                        return (
                                            <div key={exercise.id} style={{ marginBottom: isBiSet ? '16px' : '0' }}>
                                                <div style={{
                                                    fontWeight: 'bold', margin: '20px 0 10px', color: 'var(--color-primary)',
                                                    background: '#222', padding: '8px 12px', borderRadius: '4px'
                                                }}>
                                                    {exercise.name}
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {entriesWithIndex.map((entry) => {
                                                        const comparison = getComparison(entry);
                                                        return (
                                                            <SummaryRow
                                                                key={entry.originalIndex}
                                                                entry={entry}
                                                                idx={entry.originalIndex}
                                                                onUpdate={updateEntry}
                                                                comparison={comparison}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

            <button
                onClick={() => onSave(data)}
                style={{
                    background: 'var(--color-primary)', color: 'black',
                    padding: '16px 32px', fontSize: '1.2em', fontWeight: 'bold',
                    width: '100%', borderRadius: '12px', marginBottom: '16px'
                }}
            >
                <Save size={20} style={{ marginRight: '8px' }} />
                SALVAR E FECHAR
            </button>

            <button
                onClick={onDiscard}
                style={{ background: 'transparent', color: '#666', fontSize: '0.9em' }}
            >
                Descartar sem salvar
            </button>
        </div>
    );
}

function SummaryRow({ entry, idx, onUpdate, comparison }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempWeight, setTempWeight] = useState(entry.weight);
    const [tempReps, setTempReps] = useState(entry.time > 0 ? entry.time : entry.reps);

    const handleSave = () => {
        onUpdate(idx, 'weight', tempWeight);
        onUpdate(idx, entry.time > 0 ? 'time' : 'reps', tempReps);
        setIsEditing(false);
    };

    return (
        <div>
            <div style={{
                background: '#1a1a1a', padding: '12px', borderRadius: '12px',
                display: 'grid',
                // Grid: [#] [Content (Values + Comparison)] [EditBtn]
                gridTemplateColumns: 'min-content 1fr min-content',
                alignItems: 'center', gap: '8px'
            }}>
                <div style={{ fontWeight: 'bold', color: '#666', fontSize: '0.9em', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span>#{entry.setNumber}</span>
                    {entry.side && (
                        <span style={{ fontSize: '0.6em', background: entry.side === 'LEFT' ? 'var(--color-primary)' : '#ff9800', color: 'black', padding: '1px 3px', borderRadius: '2px', fontWeight: 'bold' }}>
                            {entry.side === 'LEFT' ? 'E' : 'D'}
                        </span>
                    )}
                </div>

                {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <NumberInput value={tempWeight} onChange={setTempWeight} compact={true} />
                            <span style={{ fontSize: '0.8em', color: '#888' }}>kg</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <NumberInput value={tempReps} onChange={setTempReps} compact={true} />
                            <span style={{ fontSize: '0.8em', color: '#888' }}>{entry.time > 0 ? 's' : 'reps'}</span>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        {/* Values Row */}
                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'baseline' }}>
                            <div style={{ textAlign: 'center' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '1.2em' }}>{entry.weight}</span>
                                <span style={{ fontSize: '0.7em', color: '#888', marginLeft: '2px' }}>kg</span>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '1.2em' }}>
                                    {entry.time > 0 ? Math.floor(entry.time) : entry.reps}
                                </span>
                                <span style={{ fontSize: '0.7em', color: '#888', marginLeft: '2px' }}>
                                    {entry.time > 0 ? 's' : 'reps'}
                                </span>
                            </div>
                        </div>

                        {/* Comparison Row (Below Values) */}
                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', fontSize: '0.7em', opacity: 0.8 }}>
                            {comparison && comparison.weightDiff !== undefined && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: comparison.weightDiff > 0 ? '#4caf50' : comparison.weightDiff < 0 ? '#ff4d4d' : '#666' }}>
                                    {comparison.weightDiff > 0 ? <ArrowUp size={12} /> : comparison.weightDiff < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}
                                    <span>{Math.abs(comparison.weightDiff)}kg</span>
                                </div>
                            )}
                            {/* Spacer if only one comparison exists to keep alignment effectively? */}
                            {comparison && comparison.repsDiff !== undefined && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: comparison.repsDiff > 0 ? '#4caf50' : comparison.repsDiff < 0 ? '#ff4d4d' : '#666' }}>
                                    {comparison.repsDiff > 0 ? <ArrowUp size={12} /> : comparison.repsDiff < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}
                                    <span>{Math.abs(comparison.repsDiff)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {isEditing ? (
                        <button onClick={handleSave} style={{ background: 'var(--color-primary)', color: 'black', padding: '4px', borderRadius: '4px' }}>
                            <Save size={16} />
                        </button>
                    ) : (
                        <button onClick={() => { setTempWeight(entry.weight); setTempReps(entry.time > 0 ? entry.time : entry.reps); setIsEditing(true); }} style={{ background: 'transparent', color: '#666' }}>
                            <Edit2 size={16} />
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
