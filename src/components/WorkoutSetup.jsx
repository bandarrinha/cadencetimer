import { useState, useEffect } from 'react';
import { Plus, Trash2, Play, Save, Settings, ChevronDown, ChevronUp } from 'lucide-react';

const DEFAULT_EXERCISE = {
    id: 'ex-1', // Placeholder ID to be replaced
    name: 'Novo Exercício',
    sets: 3,
    reps: 10,
    failureMode: true,
    startConcentric: false,
    isIsometric: false, // New: Isometric Mode
    cadence: { eccentric: 3, eccentricPause: 1, concentric: 1, concentricPause: 0 },
    restSet: 45,
    restExercise: 60
};

const DEFAULT_WORKOUT = {
    id: 'workout-a',
    name: 'Treino A',
    exercises: [{ ...DEFAULT_EXERCISE, id: crypto.randomUUID(), name: 'Supino Reto' }]
};

export default function WorkoutSetup({ onStart, onViewHistory }) {
    // Workouts List
    const [workouts, setWorkouts] = useState(() => {
        const saved = localStorage.getItem('cadence_workouts');
        return saved ? JSON.parse(saved) : [DEFAULT_WORKOUT];
    });

    const [activeWorkoutId, setActiveWorkoutId] = useState(() => {
        const savedId = localStorage.getItem('active_workout_id');
        return savedId || workouts[0].id;
    });

    const activeWorkout = workouts.find(w => w.id === activeWorkoutId) || workouts[0];

    useEffect(() => {
        localStorage.setItem('cadence_workouts', JSON.stringify(workouts));
        localStorage.setItem('active_workout_id', activeWorkoutId);
    }, [workouts, activeWorkoutId]);

    const updateActiveWorkout = (newWorkout) => {
        setWorkouts(workouts.map(w => w.id === activeWorkoutId ? newWorkout : w));
    };

    // Exercise Handlers
    const updateExercise = (index, field, value) => {
        const newExercises = [...activeWorkout.exercises];
        newExercises[index] = { ...newExercises[index], [field]: value };
        updateActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    const updateCadence = (index, field, value) => {
        const newExercises = [...activeWorkout.exercises];
        newExercises[index].cadence[field] = parseInt(value) || 0;
        updateActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    const addExercise = () => {
        const lastExercise = activeWorkout.exercises[activeWorkout.exercises.length - 1];
        const base = lastExercise ? { ...lastExercise } : DEFAULT_EXERCISE;
        // Ensure deep copy of cadence
        const newEx = {
            ...base,
            id: crypto.randomUUID(),
            name: lastExercise ? `${lastExercise.name} (Copy)` : 'Novo Exercício',
            cadence: { ...base.cadence }
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

    // Workout Management Handlers
    const createWorkout = () => {
        const name = prompt("Nome do novo treino:");
        if (!name) return;
        const newId = crypto.randomUUID();
        const newWorkout = { id: newId, name, exercises: [] };
        setWorkouts([...workouts, newWorkout]);
        setActiveWorkoutId(newId);
    };

    return (
        <div className="setup-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'left', paddingBottom: '100px' }}>

            {/* Top Bar: Selector & Primary Actions */}
            <header style={{ marginBottom: '20px', background: '#1e1e1e', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <select
                        value={activeWorkoutId}
                        onChange={(e) => setActiveWorkoutId(e.target.value)}
                        style={{ padding: '8px', borderRadius: '8px', background: '#333', color: 'white', border: 'none', fontSize: '1.1em', flex: 1, marginRight: '8px' }}
                    >
                        {workouts.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <button onClick={createWorkout} style={{ padding: '8px 12px' }}><Plus size={18} /></button>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => onStart(activeWorkout)} className="btn-primary" style={{ flex: 2, display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', background: 'var(--color-primary)', color: 'black', fontWeight: 'bold' }}>
                        <Play size={20} /> INICIAR {activeWorkout.name.toUpperCase()}
                    </button>
                    <button onClick={onViewHistory} style={{ flex: 1, background: '#333' }}>
                        Histórico
                    </button>
                </div>
            </header>

            {/* Exercises List */}
            {activeWorkout.exercises.map((ex, idx) => (
                <div key={ex.id} style={{ background: '#1e1e1e', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                    {/* Header of Card */}
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

                    {/* Main Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <label>
                            Séries
                            <input type="number" value={ex.sets} onChange={(e) => updateExercise(idx, 'sets', parseInt(e.target.value))} style={inputStyle} />
                        </label>
                        <label>
                            {ex.isIsometric ? 'Tempo Alvo (s)' : 'Repetições Alvo'}
                            <input type="number" value={ex.reps} onChange={(e) => updateExercise(idx, 'reps', parseInt(e.target.value))} style={inputStyle} />
                        </label>
                    </div>

                    {/* Advanced Toggles */}
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', textAlign: 'center', background: '#121212', padding: '12px', borderRadius: '8px' }}>
                                <div className="cadence-input">
                                    <label style={{ color: 'var(--color-eccentric)', fontSize: '0.8em' }}>Desce</label>
                                    <input type="number" value={ex.cadence.eccentric} onChange={(e) => updateCadence(idx, 'eccentric', e.target.value)} style={inputStyle} />
                                </div>
                                <div className="cadence-input">
                                    <label style={{ color: 'var(--color-isometric)', fontSize: '0.8em' }}>Pausa</label>
                                    <input type="number" value={ex.cadence.eccentricPause} onChange={(e) => updateCadence(idx, 'eccentricPause', e.target.value)} style={inputStyle} />
                                </div>
                                <div className="cadence-input">
                                    <label style={{ color: 'var(--color-concentric)', fontSize: '0.8em' }}>Sobe</label>
                                    <input type="number" value={ex.cadence.concentric} onChange={(e) => updateCadence(idx, 'concentric', e.target.value)} style={inputStyle} />
                                </div>
                                <div className="cadence-input">
                                    <label style={{ color: 'var(--color-isometric)', fontSize: '0.8em' }}>Pausa</label>
                                    <input type="number" value={ex.cadence.concentricPause} onChange={(e) => updateCadence(idx, 'concentricPause', e.target.value)} style={inputStyle} />
                                </div>
                            </div>
                        </>
                    )}

                    <h4 style={{ margin: '16px 0 8px', color: '#888', fontSize: '0.9em', textTransform: 'uppercase', letterSpacing: '1px' }}>Intervalos (Segundos)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <label style={{ fontSize: '0.9em', color: '#ccc' }}>
                            Entre Séries
                            <input type="number" value={ex.restSet} onChange={(e) => updateExercise(idx, 'restSet', parseInt(e.target.value))} style={inputStyle} />
                        </label>
                        <label style={{ fontSize: '0.9em', color: '#ccc' }}>
                            Entre Exercícios
                            <input type="number" value={ex.restExercise} onChange={(e) => updateExercise(idx, 'restExercise', parseInt(e.target.value))} style={inputStyle} />
                        </label>
                    </div>
                </div>
            ))}

            <button onClick={addExercise} style={{ width: '100%', padding: '16px', border: '2px dashed #444', background: 'transparent', color: '#888', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <Plus /> Adicionar Exercício
            </button>
        </div>
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
    fontWeight: 'bold'
};
