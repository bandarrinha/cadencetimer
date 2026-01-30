import { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowLeft, Link, Unlink } from 'lucide-react';


const DEFAULT_EXERCISE = {
    id: 'ex-1',
    name: 'Novo Exercício',
    sets: 3,
    reps: 10,
    repsMin: 8,
    repsMax: 12,
    failureMode: true,
    startConcentric: false,
    isIsometric: false,
    cadence: { eccentric: 3, eccentricPause: 1, concentric: 1, concentricPause: 0 },
    restSet: 45,
    restExercise: 60,
    biSetId: null, // Added for grouping
    prepTime: 5, // Added for configurable prep time
    startSide: 'LEFT' // Added: Default starting side
};

const DEFAULT_WORKOUT = {
    id: 'workout-a',
    name: 'Treino A',
    exercises: [{ ...DEFAULT_EXERCISE, id: crypto.randomUUID(), name: 'Supino Reto' }]
};

export default function WorkoutSetup({ initialWorkoutId, onBack, onUpdateWorkouts }) {
    // We use local state for edits, but sync back to parent
    const [workouts, setWorkouts] = useState(() => {
        const saved = localStorage.getItem('cadence_workouts');
        const parsed = saved ? JSON.parse(saved) : [DEFAULT_WORKOUT];
        // Migration logic preserved
        parsed.forEach(w => w.exercises.forEach(e => {
            if (e.biSetId === undefined) e.biSetId = null;
            if (e.prepTime === undefined) e.prepTime = 5;
            if (e.startSide === undefined) e.startSide = 'LEFT';
            if (e.repsMin === undefined) e.repsMin = e.reps;
            if (e.repsMax === undefined) e.repsMax = e.reps;
        }));
        return parsed;
    });

    const [activeWorkoutId, setActiveWorkoutId] = useState(initialWorkoutId || workouts[0].id);

    const activeWorkout = workouts.find(w => w.id === activeWorkoutId) || workouts[0];

    useEffect(() => {
        onUpdateWorkouts(workouts);
    }, [workouts, onUpdateWorkouts]);

    const updateActiveWorkout = (newWorkout) => {
        setWorkouts(workouts.map(w => w.id === activeWorkoutId ? newWorkout : w));
    };

    const updateExercise = (index, field, value) => {
        const newExercises = [...activeWorkout.exercises];
        const currentEx = newExercises[index];
        newExercises[index] = { ...currentEx, [field]: value };

        // Sync Logic for Bi-Sets
        if (currentEx.biSetId && (field === 'sets' || field === 'restSet')) {
            // Find all exercises with same biSetId
            newExercises.forEach((ex, i) => {
                if (ex.biSetId === currentEx.biSetId && i !== index) {
                    newExercises[i] = { ...newExercises[i], [field]: value };
                }
            });
        }

        updateActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    const updateCadence = (index, field, value) => {
        const newExercises = [...activeWorkout.exercises];
        newExercises[index].cadence[field] = value === '' ? '' : (parseInt(value) || 0);
        updateActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    const addExercise = () => {
        const lastExercise = activeWorkout.exercises[activeWorkout.exercises.length - 1];
        const base = lastExercise ? { ...lastExercise } : DEFAULT_EXERCISE;
        const newEx = {
            ...base,
            id: crypto.randomUUID(),
            name: lastExercise ? `${lastExercise.name} (Copy)` : 'Novo Exercício',
            cadence: { ...base.cadence },
            biSetId: null // Reset biSet linking for new copy
        };

        updateActiveWorkout({
            ...activeWorkout,
            exercises: [...activeWorkout.exercises, newEx]
        });
    };

    const removeExercise = (index) => {
        const newExercises = activeWorkout.exercises.filter((_, i) => i !== index);
        updateActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    const toggleBiSet = (index) => {
        if (index >= activeWorkout.exercises.length - 1) return;

        const newExercises = [...activeWorkout.exercises];
        const current = newExercises[index];
        const next = newExercises[index + 1];

        // Check if already linked
        const isLinked = current.biSetId && current.biSetId === next.biSetId;

        if (isLinked) {
            // Unlink Logic: Split the group
            // We are breaking the link between index and index+1.
            // Items from index+1 onwards that shared the same ID must get a NEW ID (or null if isolated?).
            // For simplicity/robustness: Assign a NEW random ID to the right-side chunk.

            const oldId = current.biSetId;
            const newId = crypto.randomUUID();

            // Iterate forwards from next (index+1)
            for (let i = index + 1; i < newExercises.length; i++) {
                if (newExercises[i].biSetId === oldId) {
                    newExercises[i] = { ...newExercises[i], biSetId: newId };
                } else {
                    // Stop if we hit a different group (shouldn't happen in contiguous block but safe to check)
                    break;
                }
            }
            // Logic note: If the splitting results in a single item groups, usually we keep the ID or set null.
            // But keeping unique IDs for single items is harmless (just won't show UI border logic if neighbor doesn't match).
            // Actually, the UI border logic checks `isLinkedWithNext/Prev`. 
            // If ID is unique to single item, no neighbors match -> no borders. Correct.

        } else {
            // Link Logic: Merge groups
            // We are connecting index and index+1.

            const idToUse = current.biSetId || next.biSetId || crypto.randomUUID();
            const idToReplace = next.biSetId; // If next had a DIFFERENT ID, we need to update all its group members

            // 1. Ensure current has the target ID
            newExercises[index] = { ...current, biSetId: idToUse };

            // 2. Ensure next has the target ID
            newExercises[index + 1] = { ...next, biSetId: idToUse };

            // 3. Propagation
            // Backward propagation (if current was part of a group, essentially all 'current' group is already idToUse unless we just generated it)
            // Forward propagation (if next was part of a group, we must update ALL members of that group to idToUse)

            if (idToReplace && idToReplace !== idToUse) {
                // Next was part of a different group. Find ALL members of that group and merge them.
                for (let i = 0; i < newExercises.length; i++) {
                    if (newExercises[i].biSetId === idToReplace) {
                        newExercises[i] = { ...newExercises[i], biSetId: idToUse };
                    }
                }
            }

            // Also propagate if 'current' just got a NEW ID (was null) but had previous pars? 
            // No, if current was null, it had no group.
            // But if current DID have an id (idToUse), we don't need to change its neighbors, they are already idToUse.
        }

        // Clean up: Optional - finding singletons and setting biSetId to null? 
        // Not strictly necessary but keeps data clean.
        // Let's leave IDs strictly for grouping. UI handles display based on match.

        updateActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    const createWorkout = () => {
        const name = prompt("Nome do novo treino:");
        if (!name) return;
        const newId = crypto.randomUUID();
        const newWorkout = { id: newId, name, exercises: [] };
        setWorkouts([...workouts, newWorkout]);
        setActiveWorkoutId(newId);
    };

    const deleteWorkout = () => {
        if (workouts.length <= 1) {
            alert("Você precisa manter pelo menos um treino. Edite o existente ou crie um novo antes de excluir.");
            return;
        }

        if (confirm(`Tem certeza que deseja excluir o treino "${activeWorkout.name}"? Essa ação não pode ser desfeita.`)) {
            const newWorkouts = workouts.filter(w => w.id !== activeWorkoutId);
            setWorkouts(newWorkouts);
            // Select the previous one or the first one
            setActiveWorkoutId(newWorkouts[0].id);
        }
    };


    return (
        <div className="setup-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'left', paddingBottom: '100px' }}>

            <header style={{ marginBottom: '20px', background: '#1e1e1e', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                    <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#ccc', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <ArrowLeft /> Voltar
                    </button>
                    <h2 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '1.2em' }}>Editar Treino</h2>
                    <div style={{ width: '80px' }}></div> {/* Spacer for alignment */}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, display: 'flex', gap: '8px', marginRight: '8px' }}>
                        <select
                            value={activeWorkoutId}
                            onChange={(e) => setActiveWorkoutId(e.target.value)}
                            style={{ padding: '8px', borderRadius: '8px', background: '#333', color: 'white', border: 'none', fontSize: '1.1em', width: '100%' }}
                        >
                            {workouts.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={createWorkout} style={{ padding: '8px 12px', background: '#333', color: 'white', borderRadius: '6px' }} title="Novo Treino">
                            <Plus size={18} />
                        </button>
                        <button onClick={deleteWorkout} style={{ padding: '8px 12px', background: '#333', color: '#ff4d4d', borderRadius: '6px' }} title="Excluir Treino Atual">
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            </header>

            {activeWorkout.exercises.map((ex, idx) => {
                const isLinkedWithNext = idx < activeWorkout.exercises.length - 1 && ex.biSetId && ex.biSetId === activeWorkout.exercises[idx + 1].biSetId;
                const isLinkedWithPrev = idx > 0 && ex.biSetId && ex.biSetId === activeWorkout.exercises[idx - 1].biSetId;

                return (
                    <div key={ex.id}>
                        <div style={{
                            background: '#1e1e1e',
                            padding: '16px',
                            borderRadius: '12px',
                            marginBottom: isLinkedWithNext ? '0' : '16px',
                            borderBottomLeftRadius: isLinkedWithNext ? '0' : '12px',
                            borderBottomRightRadius: isLinkedWithNext ? '0' : '12px',
                            borderTopLeftRadius: isLinkedWithPrev ? '0' : '12px',
                            borderTopRightRadius: isLinkedWithPrev ? '0' : '12px',
                            borderLeft: isLinkedWithPrev || isLinkedWithNext ? '4px solid #ff9800' : 'none',
                            position: 'relative'
                        }}>
                            {/* Bi-Set Indicator Label */}
                            {/* Bi-Set Indicator Label */}
                            {(isLinkedWithNext && !isLinkedWithPrev) && (() => {
                                // Calculate Group Size
                                const groupSize = activeWorkout.exercises.filter(e => e.biSetId === ex.biSetId).length;
                                let label = "BI-SET";
                                if (groupSize === 3) label = "TRI-SET";
                                if (groupSize > 3) label = "GIANT SET";

                                return (
                                    <div style={{ position: 'absolute', top: '-10px', right: '10px', background: '#ff9800', color: 'black', fontSize: '0.7em', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                                        {label} INÍCIO
                                    </div>
                                );
                            })()}
                            {(isLinkedWithPrev && !isLinkedWithNext) && (() => {
                                // Calculate Group Size
                                const groupSize = activeWorkout.exercises.filter(e => e.biSetId === ex.biSetId).length;
                                let label = "BI-SET";
                                if (groupSize === 3) label = "TRI-SET";
                                if (groupSize > 3) label = "GIANT SET";

                                return (
                                    <div style={{ position: 'absolute', bottom: '-10px', right: '10px', background: '#ff9800', color: 'black', fontSize: '0.7em', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', zIndex: 1 }}>
                                        {label} FIM
                                    </div>
                                );
                            })()}


                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '70%' }}>
                                    <input
                                        value={ex.name}
                                        onChange={(e) => updateExercise(idx, 'name', e.target.value)}
                                        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #444', color: 'white', fontSize: '1.2em', width: '100%', padding: '4px 0' }}
                                        placeholder="Nome do Exercício"
                                    />
                                </div>
                                <button onClick={() => removeExercise(idx)} style={{ background: 'transparent', color: '#ff4d4d', padding: 0 }}><Trash2 /></button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                                    <label style={{ fontSize: '0.9em', color: '#ccc', marginBottom: '6px' }}>Séries</label>
                                    <input
                                        type="number"
                                        value={ex.sets}
                                        onChange={(e) => updateExercise(idx, 'sets', e.target.value === '' ? '' : parseInt(e.target.value))}
                                        style={inputStyle}
                                    />
                                </div>

                                {/* Dynamic Reps/Range Section */}
                                {ex.failureMode ? (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                            <label style={{ fontSize: '0.9em', color: '#ccc', marginBottom: '6px' }}>
                                                {ex.isIsometric ? 'Tempo Min' : 'Reps Min'}
                                            </label>
                                            <input
                                                type="number"
                                                value={ex.repsMin || ex.reps} // Fallback to reps if min undefined
                                                onChange={(e) => updateExercise(idx, 'repsMin', e.target.value === '' ? '' : parseInt(e.target.value))}
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                            <label style={{ fontSize: '0.9em', color: '#ccc', marginBottom: '6px' }}>
                                                {ex.isIsometric ? 'Tempo Max' : 'Reps Max'}
                                            </label>
                                            <input
                                                type="number"
                                                value={ex.repsMax || ex.reps} // Fallback to reps if max undefined
                                                onChange={(e) => updateExercise(idx, 'repsMax', e.target.value === '' ? '' : parseInt(e.target.value))}
                                                style={inputStyle}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                        <label style={{ fontSize: '0.9em', color: '#ccc', marginBottom: '6px' }}>
                                            {ex.isIsometric ? 'Tempo (s)' : 'Reps Alvo'}
                                        </label>
                                        <input
                                            type="number"
                                            value={ex.reps}
                                            onChange={(e) => updateExercise(idx, 'reps', e.target.value === '' ? '' : parseInt(e.target.value))}
                                            style={inputStyle}
                                        />
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em', background: '#2a2a2a', padding: '6px 12px', borderRadius: '20px' }}>
                                    <input type="checkbox" checked={ex.failureMode} onChange={(e) => updateExercise(idx, 'failureMode', e.target.checked)} />
                                    Até a Falha?
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em', background: '#2a2a2a', padding: '6px 12px', borderRadius: '20px' }}>
                                    <input type="checkbox" checked={ex.startConcentric} onChange={(e) => updateExercise(idx, 'startConcentric', e.target.checked)} disabled={ex.isIsometric} />
                                    Começar Concêntrica
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em', background: '#2a2a2a', padding: '6px 12px', borderRadius: '20px' }}>
                                    <input type="checkbox" checked={ex.isIsometric} onChange={(e) => updateExercise(idx, 'isIsometric', e.target.checked)} />
                                    Isometria
                                </label>
                            </div>

                            {!ex.isIsometric && (
                                <>
                                    <h4 style={{ margin: '0 0 8px', color: '#888', fontSize: '0.9em', textTransform: 'uppercase', letterSpacing: '1px' }}>Cadência (Segundos)</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px', textAlign: 'center', background: '#121212', padding: '8px', borderRadius: '8px' }}>
                                        {['eccentric', 'eccentricPause', 'concentric', 'concentricPause'].map(key => (
                                            <div key={key} className="cadence-input">
                                                <label style={{ fontSize: '0.8em', color: key.includes('eccentric') ? 'var(--color-eccentric)' : key.includes('concentric') ? 'var(--color-concentric)' : 'var(--color-isometric)' }}>
                                                    {key === 'eccentric' ? 'Desce' : key === 'concentric' ? 'Sobe' : 'Pausa'}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={ex.cadence[key]}
                                                    onChange={(e) => updateCadence(idx, key, e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            <h4 style={{ margin: '16px 0 8px', color: '#888', fontSize: '0.9em', textTransform: 'uppercase', letterSpacing: '1px' }}>Intervalos (Segundos)</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                <label style={{ fontSize: '0.9em', color: '#ccc' }}>
                                    Preparo
                                    <input type="number" value={ex.prepTime} onChange={(e) => updateExercise(idx, 'prepTime', e.target.value === '' ? '' : parseInt(e.target.value))} style={inputStyle} />
                                </label>
                                <label style={{ fontSize: '0.9em', color: '#ccc' }}>
                                    {isLinkedWithNext || isLinkedWithPrev ? 'Entre Séries (Bi-Set)' : 'Entre Séries'}
                                    <input type="number" value={ex.restSet} onChange={(e) => updateExercise(idx, 'restSet', e.target.value === '' ? '' : parseInt(e.target.value))} style={inputStyle} />
                                </label>
                                {!isLinkedWithNext && (
                                    <label style={{ fontSize: '0.9em', color: '#ccc' }}>
                                        {isLinkedWithNext ? 'Transição (Prep)' : (isLinkedWithPrev ? 'Descanso Final' : 'Entre Exercícios')}
                                        <input type="number" value={ex.restExercise} onChange={(e) => updateExercise(idx, 'restExercise', e.target.value === '' ? '' : parseInt(e.target.value))} style={inputStyle} />
                                    </label>
                                )}
                            </div>

                            {/* Unilateral Settings */}
                            <div style={{ marginTop: '16px', borderTop: '1px solid #333', paddingTop: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em', background: '#2a2a2a', padding: '6px 12px', borderRadius: '20px', border: ex.isUnilateral ? '1px solid var(--color-primary)' : '1px solid transparent' }}>
                                        <input type="checkbox" checked={ex.isUnilateral || false} onChange={(e) => updateExercise(idx, 'isUnilateral', e.target.checked)} />
                                        Ex. Unilateral
                                    </label>

                                    {ex.isUnilateral && (
                                        <>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9em', color: '#ccc' }}>
                                                Transição entre Lados (s):
                                                <input
                                                    type="number"
                                                    value={ex.unilateralTransition === undefined ? 5 : ex.unilateralTransition}
                                                    onChange={(e) => updateExercise(idx, 'unilateralTransition', e.target.value === '' ? '' : parseInt(e.target.value))}
                                                    style={{ ...inputStyle, width: '60px', marginTop: 0 }}
                                                />
                                            </label>

                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9em', color: '#ccc', marginLeft: '12px' }}>
                                                Começar por:
                                                <select
                                                    value={ex.startSide || 'LEFT'}
                                                    onChange={(e) => updateExercise(idx, 'startSide', e.target.value)}
                                                    style={{ ...inputStyle, width: 'auto', marginTop: 0 }}
                                                >
                                                    <option value="LEFT">Esquerda</option>
                                                    <option value="RIGHT">Direita</option>
                                                </select>
                                            </label>
                                        </>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* Link Button between exercises */}
                        {
                            idx < activeWorkout.exercises.length - 1 && (
                                <div style={{ display: 'flex', justifyContent: 'center', margin: isLinkedWithNext ? '-10px 0' : '-8px 0 8px', zIndex: 10, position: 'relative' }}>
                                    <button
                                        onClick={() => toggleBiSet(idx)}
                                        style={{
                                            background: isLinkedWithNext ? '#ff9800' : '#333',
                                            color: isLinkedWithNext ? 'black' : '#888',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '32px',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                            cursor: 'pointer'
                                        }}
                                        title={isLinkedWithNext ? "Desfazer Bi-Set" : "Criar Bi-Set"}
                                    >
                                        {isLinkedWithNext ? <Unlink size={16} /> : <Link size={16} />}
                                    </button>
                                </div>
                            )
                        }
                    </div>
                );
            })}

            <button onClick={addExercise} style={{ width: '100%', padding: '16px', border: '2px dashed #444', background: 'transparent', color: '#888', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <Plus /> Adicionar Exercício
            </button>
        </div >
    );
}

const inputStyle = {
    display: 'block',
    width: '100%',
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #444',
    background: '#2a2a2a',
    color: 'white',
    marginTop: '4px',
    textAlign: 'center',
    fontWeight: 'bold',
    maxWidth: '80px', // Added constraint
    minWidth: 0, // Allow shrinking
    boxSizing: 'border-box' // Include padding in width
};
