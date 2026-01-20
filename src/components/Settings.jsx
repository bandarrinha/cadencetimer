import { useRef, useState, useEffect } from 'react';
import { Download, Upload, ArrowLeft, Sun } from 'lucide-react';

export default function Settings({ onBack }) {
    const fileInputRef = useRef(null);
    const [keepAwake, setKeepAwake] = useState(true);

    useEffect(() => {
        const settings = JSON.parse(localStorage.getItem('cadence_settings') || '{}');
        if (settings.keepAwake !== undefined) {
            setKeepAwake(settings.keepAwake);
        }
    }, []);

    const toggleKeepAwake = (val) => {
        const newVal = typeof val === 'boolean' ? val : !keepAwake;
        setKeepAwake(newVal);
        const settings = JSON.parse(localStorage.getItem('cadence_settings') || '{}');
        settings.keepAwake = newVal;
        localStorage.setItem('cadence_settings', JSON.stringify(settings));
    };

    // Import/Export Logic
    const exportData = () => {
        const data = {
            workouts: JSON.parse(localStorage.getItem('cadence_workouts')),
            history: JSON.parse(localStorage.getItem('cadence_history')),
            settings: JSON.parse(localStorage.getItem('cadence_settings') || '{}')
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

                if (data.settings) {
                    localStorage.setItem('cadence_settings', JSON.stringify(data.settings));
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

            <div style={{ background: '#1e1e1e', padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '1.2em' }}>Preferências</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sun size={20} color="#ccc" />
                        <span style={{ color: 'white' }}>Manter tela ligada durante o treino</span>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '24px' }}>
                        <input
                            type="checkbox"
                            checked={keepAwake}
                            onChange={(e) => toggleKeepAwake(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: keepAwake ? 'var(--color-primary)' : '#555', transition: '.4s', borderRadius: '34px'
                        }}>
                            <span style={{
                                position: 'absolute', content: '""', height: '16px', width: '16px', left: '4px', bottom: '4px',
                                backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                                transform: keepAwake ? 'translateX(16px)' : 'translateX(0)'
                            }}></span>
                        </span>
                    </label>
                </div>
            </div>

            <div style={{ background: '#1e1e1e', padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '1.2em' }}>Dados e Backup</h3>
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
