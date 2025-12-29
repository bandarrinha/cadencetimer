import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Play, Download, Upload, History } from 'lucide-react';


const DEFAULT_EXERCISE = {
    id: 'ex-1',
    name: 'Novo Exercício',
    sets: 3,
    reps: 10,
    failureMode: true,
    startConcentric: false,
    isIsometric: false,
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
    const [workouts, setWorkouts] = useState(() => {
        const saved = localStorage.getItem('cadence_workouts');
        return saved ? JSON.parse(saved) : [DEFAULT_WORKOUT];
    });

    const [activeWorkoutId, setActiveWorkoutId] = useState(() => {
        const savedId = localStorage.getItem('active_workout_id');
        return savedId || workouts[0].id;
    });

    const activeWorkout = workouts.find(w => w.id === activeWorkoutId) || workouts[0];
    const fileInputRef = useRef(null);

    useEffect(() => {
        localStorage.setItem('cadence_workouts', JSON.stringify(workouts));
        localStorage.setItem('active_workout_id', activeWorkoutId);
    }, [workouts, activeWorkoutId]);

    const updateActiveWorkout = (newWorkout) => {
        setWorkouts(workouts.map(w => w.id === activeWorkoutId ? newWorkout : w));
    };

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

    const createWorkout = () => {
        const name = prompt("Nome do novo treino:");
        if (!name) return;
        const newId = crypto.randomUUID();
        const newWorkout = { id: newId, name, exercises: [] };
        setWorkouts([...workouts, newWorkout]);
        setActiveWorkoutId(newId);
    };

    // Import/Export
    const exportData = () => {
        const data = {
            workouts: JSON.parse(localStorage.getItem('cadence_workouts')),
            history: JSON.parse(localStorage.getItem('cadence_history'))
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cadence_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.workouts) localStorage.setItem('cadence_workouts', JSON.stringify(data.workouts));
                if (data.history) localStorage.setItem('cadence_history', JSON.stringify(data.history));
                alert('Dados importados com sucesso! A página será recarregada.');
                window.location.reload();
            } catch (err) {
                alert('Erro ao importar arquivo: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="setup-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'left', paddingBottom: '100px' }}>

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
                        <Play size={20} /> INICIAR
                    </button>
                    <button onClick={onViewHistory} style={{ flex: 1, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <History size={18} />
                    </button>
                </div>

                {/* Backup Actions */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button onClick={exportData} style={{ flex: 1, background: '#111', fontSize: '0.8em', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <Download size={14} /> Backup
                    </button>
                    <button onClick={() => fileInputRef.current.click()} style={{ flex: 1, background: '#111', fontSize: '0.8em', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <Upload size={14} /> Restaurar
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".json"
                        onChange={handleImport}
                    />
                </div>
            </header>

            {activeWorkout.exercises.map((ex, idx) => (
                <div key={ex.id} style={{ background: '#1e1e1e', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>

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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.9em', color: '#ccc', marginBottom: '6px' }}>Séries</label>
                            <input
                                type="number"
                                value={ex.sets}
                                onChange={(e) => updateExercise(idx, 'sets', parseInt(e.target.value) || 0)}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.9em', color: '#ccc', marginBottom: '6px' }}>
                                {ex.isIsometric ? 'Tempo (s)' : 'Reps Alvo'}
                            </label>
                            <input
                                type="number"
                                value={ex.reps}
                                onChange={(e) => updateExercise(idx, 'reps', parseInt(e.target.value) || 0)}
                                style={inputStyle}
                            />
                        </div>
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
    fontWeight: 'bold',
    maxWidth: '80px', // Added constraint
    minWidth: 0, // Allow shrinking
    boxSizing: 'border-box' // Include padding in width
};
