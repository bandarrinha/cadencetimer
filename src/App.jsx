import { useState, useEffect } from 'react';
import WorkoutSetup from './components/WorkoutSetup';
import ActiveWorkout from './components/ActiveWorkout';
import WorkoutHistory from './components/WorkoutHistory';
import Settings from './components/Settings';
import { Play, History, Settings as SettingsIcon, Edit } from 'lucide-react';
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

  useEffect(() => {
    localStorage.setItem('active_workout_id', activeWorkoutId);
  }, [activeWorkoutId]);

  // Sync workouts state if updated in Setup
  const handleWorkoutsUpdate = (updatedWorkouts) => {
    setWorkouts(updatedWorkouts);
    localStorage.setItem('cadence_workouts', JSON.stringify(updatedWorkouts));
  };

  const currentWorkout = workouts.find(w => w.id === activeWorkoutId) || workouts[0];

  const startWorkout = () => {
    setActiveWorkout(currentWorkout);
    setView('ACTIVE');
  };

  const handleFinishWorkout = (weightData) => {
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
        biSetId: d.biSetId || null
      };
    });

    const updatedHistory = [...history, ...newEntries];
    localStorage.setItem('cadence_history', JSON.stringify(updatedHistory));

    setActiveWorkout(null);
    setView('HOME');
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
                {workouts.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
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

      {view === 'ACTIVE' && activeWorkout && (
        <ActiveWorkout
          workout={activeWorkout}
          onExit={() => { setActiveWorkout(null); setView('HOME'); }}
          onFinishWorkout={handleFinishWorkout}
        />
      )}

      {view === 'HISTORY' && (
        <WorkoutHistory onBack={() => setView('HOME')} />
      )}
    </div>
  );
}

export default App;
