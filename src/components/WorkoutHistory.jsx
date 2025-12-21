import { Trash2, ArrowLeft } from 'lucide-react';

export default function WorkoutHistory({ onBack }) {
    const history = JSON.parse(localStorage.getItem('cadence_history') || '[]');

    const clearHistory = () => {
        if (confirm('Limpar todo o histórico?')) {
            localStorage.removeItem('cadence_history');
            onBack();
        }
    };

    // Group by "Date - Workout Name"
    const groupedSessions = history.reduce((acc, entry) => {
        const dateStr = new Date(entry.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        const key = `${dateStr} - ${entry.workoutName}`; // Key combining Date and Workout

        if (!acc[key]) acc[key] = { dateWorkout: key, exercises: {} };

        // Group by Exercise within the session
        if (!acc[key].exercises[entry.exerciseName]) {
            acc[key].exercises[entry.exerciseName] = [];
        }

        acc[key].exercises[entry.exerciseName].push(entry);
        return acc;
    }, {});

    // Convert to array for rendering (reverse chronological)
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

                    {/* Exercises */}
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {Object.keys(session.exercises).map((exName, eIdx) => (
                            <div key={eIdx} style={{ background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden' }}>
                                <div style={{ background: '#333', padding: '10px 16px', fontWeight: 'bold' }}>
                                    {exName}
                                </div>
                                <div style={{ padding: '12px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: '0.8em', opacity: 0.6, marginBottom: '8px' }}>
                                        <span>SÉRIE</span>
                                        <span style={{ textAlign: 'center' }}>REALIZADO</span>
                                        <span style={{ textAlign: 'right' }}>CARGA</span>
                                    </div>
                                    {session.exercises[exName].map((set, stIdx) => (
                                        <div key={stIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '6px 0', borderBottom: '1px solid #2a2a2a' }}>
                                            <span>#{set.setNumber}</span>
                                            <span style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                                {set.time !== undefined && set.time > 0 ? `${Math.floor(set.time)}s` : set.reps}
                                            </span>
                                            <span style={{ textAlign: 'right' }}>{set.weight || '-'} kg</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
