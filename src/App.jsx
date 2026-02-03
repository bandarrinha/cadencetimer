import { useState, useEffect } from 'react';
import WorkoutSetup from './components/WorkoutSetup';
import WorkoutPreview from './components/WorkoutPreview';
import ActiveWorkout from './components/ActiveWorkout';
import WorkoutHistory from './components/WorkoutHistory';
import Settings from './components/Settings';
import { Play, History, Settings as SettingsIcon, Edit, AlertTriangle } from 'lucide-react';
import logo from './assets/cadenceTimerDark.svg';

const DEFAULT_WORKOUT = {
  id: 'workout-a',
  name: 'Treino A',
  exercises: [] // Start empty, will be populated if new
};

function App() {
  const [view, setView] = useState('HOME'); // HOME, SETUP, ACTIVE, HISTORY, SETTINGS
  const [activeWorkoutId, setActiveWorkoutId] = useState(() => localStorage.getItem('active_workout_id') || 'workout-a');
  const [workouts, setWorkouts] = useState(() => {
    const saved = localStorage.getItem('cadence_workouts');
    return saved ? JSON.parse(saved) : [DEFAULT_WORKOUT];
  });
  const [activeWorkout, setActiveWorkout] = useState(null); // Actual object for running workout
  const [initialWeights, setInitialWeights] = useState({}); // Weights from preview
  const [recoveryData, setRecoveryData] = useState(() => {
    const saved = localStorage.getItem('cadence_active_recovery');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.status !== 'FINISHED' && parsed.status !== 'IDLE') {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse recovery data", e);
      }
    }
    return null;
  });
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(!!recoveryData);

  useEffect(() => {
    localStorage.setItem('active_workout_id', activeWorkoutId);
  }, [activeWorkoutId]);

  // Check for recovery
  /* Recovery logic moved to initializers to avoid effect */

  // Sync workouts state if updated in Setup
  const handleWorkoutsUpdate = (updatedWorkouts) => {
    setWorkouts(updatedWorkouts);
    localStorage.setItem('cadence_workouts', JSON.stringify(updatedWorkouts));
  };

  const currentWorkout = workouts.find(w => w.id === activeWorkoutId) || workouts[0];

  const startWorkout = () => {
    setActiveWorkout(currentWorkout);
    setView('PREVIEW');
  };

  const handlePreviewStart = (weights) => {
    setInitialWeights(weights);
    setView('ACTIVE');
  };

  const handleFinishWorkout = (weightData, duration) => {
    // Save to History
    const history = JSON.parse(localStorage.getItem('cadence_history') || '[]');
    const date = new Date().toISOString();

    const newEntries = weightData.map(d => {
      const ex = activeWorkout.exercises.find(e => e.id === d.exerciseId);
      return {
        date,
        workoutId: activeWorkout.id,
        workoutName: activeWorkout.name,
        exerciseId: d.exerciseId,
        exerciseName: ex ? ex.name : 'Unknown',
        setNumber: d.setNumber,
        reps: d.reps,
        weight: d.weight,
        time: d.time,
        biSetId: d.biSetId || null,
        side: d.side || null,
        duration: duration || 0
      };
    });

    const updatedHistory = [...history, ...newEntries];
    localStorage.setItem('cadence_history', JSON.stringify(updatedHistory));

    setActiveWorkout(null);
    setView('HOME');
    setRecoveryData(null); // Clear recovery prop
  };

  const handleRecover = () => {
    if (recoveryData && recoveryData.workout) {
      setActiveWorkout(recoveryData.workout);
      setView('ACTIVE');
      setShowRecoveryPrompt(false);
    }
  };

  const handleDiscard = () => {
    localStorage.removeItem('cadence_active_recovery');
    setRecoveryData(null);
    setShowRecoveryPrompt(false);
  };

  return (
    <div className="App full-screen">
      {view === 'HOME' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px' }}>
          {/* Header with Gear */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setView('SETTINGS')} style={{ background: 'transparent', color: '#888', padding: '8px' }}>
              <SettingsIcon />
            </button>
          </div>

          {/* Main Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '30px', maxWidth: '400px', margin: '0 auto', width: '100%' }}>

            <img src={logo} alt="Cadence Timer" style={{ width: '100%', maxWidth: '100%', marginBottom: '20px' }} />

            {/* Workout Selector */}
            <div style={{ width: '100%' }}>
              <select
                value={activeWorkoutId}
                onChange={(e) => setActiveWorkoutId(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: '#333', color: 'white', border: '1px solid #444', fontSize: '1.1em' }}
              >
                {[...workouts].sort((a, b) => a.name.localeCompare(b.name)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
              <button onClick={startWorkout} className="btn-primary" style={{ padding: '16px', fontSize: '1.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'var(--color-primary)', color: 'black', fontWeight: 'bold' }}>
                <Play size={24} /> INICIAR
              </button>

              <button onClick={() => setView('HISTORY')} style={{ padding: '16px', background: '#333', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <History size={20} /> Histórico
              </button>

              <button onClick={() => setView('SETUP')} style={{ padding: '16px', background: '#333', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Edit size={20} /> Configuração do Treino
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'SETTINGS' && (
        <Settings onBack={() => setView('HOME')} />
      )}

      {view === 'SETUP' && (
        <WorkoutSetup
          initialWorkoutId={activeWorkoutId}
          onBack={() => setView('HOME')}
          onUpdateWorkouts={handleWorkoutsUpdate}
        />
      )}

      {view === 'PREVIEW' && activeWorkout && (
        <WorkoutPreview
          workout={activeWorkout}
          onStart={handlePreviewStart}
          onBack={() => setView('HOME')}
        />
      )}

      {view === 'ACTIVE' && activeWorkout && (
        <ActiveWorkout
          workout={activeWorkout}
          initialState={recoveryData}
          initialWeights={initialWeights}
          onExit={() => { setActiveWorkout(null); setView('HOME'); setRecoveryData(null); }}
          onFinishWorkout={handleFinishWorkout}
        />
      )}

      {view === 'HISTORY' && (
        <WorkoutHistory onBack={() => setView('HOME')} workouts={workouts} />
      )}

      {/* Recovery Modal */}
      {showRecoveryPrompt && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <AlertTriangle size={64} color="#ff9800" style={{ marginBottom: '20px' }} />
          <h2 style={{ marginBottom: '10px', color: 'white', textAlign: 'center' }}>Treino Interrompido</h2>
          <p style={{ color: '#ccc', textAlign: 'center', marginBottom: '30px' }}>
            Encontramos um treino que foi fechado inesperadamente. Deseja continuar de onde parou?
          </p>

          <button onClick={handleRecover} style={{ width: '100%', maxWidth: '300px', padding: '16px', marginBottom: '16px', background: 'var(--color-primary)', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '8px', fontSize: '1.1em' }}>
            CONTINUAR TREINO
          </button>

          <button onClick={handleDiscard} style={{ width: '100%', maxWidth: '300px', padding: '16px', background: 'transparent', color: '#ff4d4d', border: '1px solid #ff4d4d', borderRadius: '8px' }}>
            Descartar e Iniciar Novo
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
