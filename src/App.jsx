import { useState } from 'react';
import WorkoutSetup from './components/WorkoutSetup';
import ActiveWorkout from './components/ActiveWorkout';
import WorkoutHistory from './components/WorkoutHistory';

function App() {
  const [view, setView] = useState('SETUP'); // SETUP, ACTIVE, HISTORY
  const [activeWorkout, setActiveWorkout] = useState(null);

  const startWorkout = (workout) => {
    setActiveWorkout(workout);
    setView('ACTIVE');
  };

  const handleFinishWorkout = (weightData) => {
    // Save to History
    const history = JSON.parse(localStorage.getItem('cadence_history') || '[]');
    const date = new Date().toISOString();

    // weightData is array of { exerciseId, setNumber, reps, weight }
    // We need to map exerciseId back to Name
    const newEntries = weightData.map(d => {
      const ex = activeWorkout.exercises.find(e => e.id === d.exerciseId);
      return {
        date,
        workoutId: activeWorkout.id, // Save ID
        workoutName: activeWorkout.name,
        exerciseId: d.exerciseId, // Save ID
        exerciseName: ex ? ex.name : 'Unknown',
        setNumber: d.setNumber,
        reps: d.reps,
        weight: d.weight,
        time: d.time, // New: Save isometric duration
        biSetId: d.biSetId || null // Save Bi-Set ID for grouping
      };
    });

    const updatedHistory = [...history, ...newEntries];
    localStorage.setItem('cadence_history', JSON.stringify(updatedHistory));

    setActiveWorkout(null);
    setView('SETUP');
  };

  return (
    <div className="App full-screen">
      {view === 'SETUP' && (
        <WorkoutSetup
          onStart={startWorkout}
          onViewHistory={() => setView('HISTORY')}
        />
      )}

      {view === 'ACTIVE' && activeWorkout && (
        <ActiveWorkout
          workout={activeWorkout}
          onExit={() => { setActiveWorkout(null); setView('SETUP'); }}
          onFinishWorkout={handleFinishWorkout}
        />
      )}

      {view === 'HISTORY' && (
        <WorkoutHistory onBack={() => setView('SETUP')} />
      )}
    </div>
  );
}

export default App;
