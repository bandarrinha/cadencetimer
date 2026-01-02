import { useRef } from 'react';
import { Download, Upload, ArrowLeft } from 'lucide-react';

export default function Settings({ onBack }) {
    const fileInputRef = useRef(null);

    // Import/Export Logic
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

                // Validation: Check if it looks like a valid backup
                if (!data.workouts && !data.history) {
                    throw new Error("Arquivo inválido. O JSON não contém dados de treinos ou histórico.");
                }

                if (data.workouts) {
                    // Ensure biSetId and prepTime presence for compatibility
                    data.workouts.forEach(w => {
                        if (w.exercises) {
                            w.exercises.forEach(ex => {
                                if (ex.biSetId === undefined) ex.biSetId = null;
                                if (ex.prepTime === undefined) ex.prepTime = 5;
                            });
                        }
                    });
                    localStorage.setItem('cadence_workouts', JSON.stringify(data.workouts));
                }

                if (data.history) {
                    localStorage.setItem('cadence_history', JSON.stringify(data.history));
                }

                alert('Dados importados com sucesso! A página será recarregada.');
                window.location.reload();
            } catch (err) {
                alert('Erro ao importar arquivo: ' + err.message);
            } finally {
                // Reset input to allow re-selecting the same file if needed
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        reader.readAsText(file);
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <header style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
                <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#ccc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ArrowLeft /> Voltar
                </button>
                <h2 style={{ flex: 1, textAlign: 'center', margin: 0 }}>Configurações</h2>
            </header>

            <div style={{ background: '#1e1e1e', padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ margin: 0, color: '#white', fontSize: '1.2em' }}>Dados e Backup</h3>
                <p style={{ color: '#888', fontSize: '0.9em', margin: 0 }}>Exporte seus dados para manter um backup seguro ou import para restaurar configurações anteriores.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button onClick={exportData} style={{ padding: '16px', background: '#333', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '1em' }}>
                        <Download /> Fazer Backup (Exportar)
                    </button>

                    <button onClick={() => fileInputRef.current.click()} style={{ padding: '16px', background: '#333', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '1em' }}>
                        <Upload /> Restaurar Backup (Importar)
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".json"
                        onChange={handleImport}
                    />
                </div>
            </div>
        </div>
    );
}
