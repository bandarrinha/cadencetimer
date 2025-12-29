import { Trash2, ArrowLeft, Edit2, Save, X } from 'lucide-react';
import { useState } from 'react';
import NumberInput from './common/NumberInput';

export default function WorkoutHistory({ onBack }) {
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

    // We render in reverse chronological order mainly, but we need the original index for updating.
    // Let's iterate the original array but display them grouped.
    // To handle "Index" tracking, we can map the history first to add "originalIndex".

    const historyWithIndex = history.map((h, i) => ({ ...h, originalIndex: i }));

    // Grouping
    const groupedSessions = historyWithIndex.reduce((acc, entry) => {
        const dateStr = new Date(entry.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        const key = `${dateStr} - ${entry.workoutName}`;

        if (!acc[key]) acc[key] = { dateWorkout: key, exercises: {} };

        if (!acc[key].exercises[entry.exerciseName]) {
            acc[key].exercises[entry.exerciseName] = [];
        }

        acc[key].exercises[entry.exerciseName].push(entry);
        return acc;
    }, {});

    const sortedSessions = Object.values(groupedSessions).reverse();

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'left', paddingBottom: '100px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button onClick={onBack} style={{ background: 'transparent' }}><ArrowLeft /> Voltar</button>
                <h2>Histórico</h2>
                <button onClick={clearHistory} style={{ background: 'transparent', color: '#ff4d4d' }}><Trash2 size={20} /></button>
            </header>

            {sortedSessions.length === 0 && <p style={{ opacity: 0.5, textAlign: 'center' }}>Nenhum treino registrado.</p>}

            {sortedSessions.map((session, sIdx) => (
                <div key={sIdx} style={{ marginBottom: '32px' }}>
                    <h3 style={{
                        borderBottom: '2px solid var(--color-primary)',
                        paddingBottom: '8px',
                        marginBottom: '16px',
                        color: 'white',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        fontSize: '1em'
                    }}>
                        {session.dateWorkout}
                    </h3>

                    <div style={{ display: 'grid', gap: '16px' }}>
                        {Object.keys(session.exercises).map((exName, eIdx) => (
                            <div key={eIdx} style={{ background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden' }}>
                                <div style={{ background: '#333', padding: '10px 16px', fontWeight: 'bold' }}>
                                    {exName}
                                </div>
                                <div style={{ padding: '12px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr auto', fontSize: '0.8em', opacity: 0.6, marginBottom: '8px', gap: '4px' }}>
                                        <span>SÉRIE</span>
                                        <span style={{ textAlign: 'center' }}>REALIZADO</span>
                                        <span style={{ textAlign: 'center' }}>CARGA</span>
                                        <span></span>
                                    </div>
                                    {session.exercises[exName].map((set, stIdx) => {
                                        const isEditing = editingIndex === set.originalIndex;

                                        return (
                                            <div key={stIdx} style={{
                                                display: 'grid',
                                                gridTemplateColumns: isEditing ? '30px 1fr auto' : '30px 1fr 1fr auto',
                                                alignItems: 'center',
                                                padding: '8px 0',
                                                borderBottom: '1px solid #2a2a2a',
                                                gap: '4px'
                                            }}>
                                                <span>#{set.setNumber}</span>

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
                                                        <div style={{ textAlign: 'center' }}>
                                                            {`${set.weight || '-'} kg`}
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
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
