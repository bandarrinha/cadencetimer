import { useRef, useState, useEffect } from 'react';
import { Download, Upload, ArrowLeft, Sun, X, FileText, Archive } from 'lucide-react';

export default function Settings({ onBack }) {
    const fileInputRef = useRef(null);
    const [keepAwake, setKeepAwake] = useState(true);
    const [showExportModal, setShowExportModal] = useState(false);
    const [importModalData, setImportModalData] = useState(null); // null = hidden, object = parsed JSON with history

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

    // --- Export Logic ---
    const exportData = (mode) => {
        const data = {
            backupType: mode,
            workouts: JSON.parse(localStorage.getItem('cadence_workouts')),
            settings: JSON.parse(localStorage.getItem('cadence_settings') || '{}')
        };

        if (mode === 'full') {
            data.history = JSON.parse(localStorage.getItem('cadence_history'));
        }

        const prefix = mode === 'config' ? 'cadence_config' : 'cadence_backup';
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${prefix}_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportModal(false);
    };

    // --- Import Logic ---
    const applyImport = (data, includeHistory) => {
        if (data.workouts) {
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

        if (data.settings) {
            localStorage.setItem('cadence_settings', JSON.stringify(data.settings));
        }

        if (includeHistory && data.history) {
            localStorage.setItem('cadence_history', JSON.stringify(data.history));
        }

        alert('Dados importados com sucesso! A página será recarregada.');
        window.location.reload();
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);

                if (!data.workouts && !data.history) {
                    throw new Error("Arquivo inválido. O JSON não contém dados de treinos ou histórico.");
                }

                // If backup has history, let user choose what to import
                const hasHistory = !!(data.history && data.history.length > 0);
                if (hasHistory) {
                    setImportModalData(data);
                } else {
                    // Config-only backup: import directly
                    applyImport(data, false);
                }
            } catch (err) {
                alert('Erro ao importar arquivo: ' + err.message);
            } finally {
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        reader.readAsText(file);
    };

    // --- Shared Modal Styles ---
    const overlayStyle = {
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        zIndex: 1000, padding: '20px'
    };

    const cardStyle = {
        width: '100%', maxWidth: '340px', padding: '18px', background: '#2a2a2a',
        borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px',
        cursor: 'pointer', border: '1px solid #444', transition: 'border-color 0.2s, background 0.2s'
    };

    const cancelBtnStyle = {
        marginTop: '8px', padding: '12px 32px', background: 'transparent',
        color: '#888', border: '1px solid #555', borderRadius: '8px', fontSize: '0.95em'
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
                <p style={{ color: '#888', fontSize: '0.9em', margin: 0 }}>Exporte seus dados para manter um backup seguro ou importe para restaurar configurações anteriores.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button onClick={() => setShowExportModal(true)} style={{ padding: '16px', background: '#333', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '1em' }}>
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

            {/* Export Modal */}
            {showExportModal && (
                <div style={overlayStyle}>
                    <h3 style={{ color: 'white', marginBottom: '20px', fontSize: '1.2em' }}>O que deseja exportar?</h3>

                    <button
                        onClick={() => exportData('config')}
                        style={cardStyle}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = '#333'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = '#2a2a2a'; }}
                    >
                        <FileText size={28} color="var(--color-primary)" />
                        <div>
                            <div style={{ color: 'white', fontWeight: 'bold', marginBottom: '4px' }}>Somente Treinos</div>
                            <div style={{ color: '#999', fontSize: '0.85em' }}>Configuração dos treinos e preferências</div>
                        </div>
                    </button>

                    <div style={{ height: '12px' }} />

                    <button
                        onClick={() => exportData('full')}
                        style={cardStyle}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = '#333'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = '#2a2a2a'; }}
                    >
                        <Archive size={28} color="#ff9800" />
                        <div>
                            <div style={{ color: 'white', fontWeight: 'bold', marginBottom: '4px' }}>Backup Completo</div>
                            <div style={{ color: '#999', fontSize: '0.85em' }}>Inclui também todo o histórico de execução</div>
                        </div>
                    </button>

                    <button onClick={() => setShowExportModal(false)} style={cancelBtnStyle}>
                        Cancelar
                    </button>
                </div>
            )}

            {/* Import Modal (shown when importing a backup that contains history) */}
            {importModalData && (
                <div style={overlayStyle}>
                    <h3 style={{ color: 'white', marginBottom: '8px', fontSize: '1.2em' }}>Backup completo detectado</h3>
                    <p style={{ color: '#999', marginBottom: '20px', textAlign: 'center', maxWidth: '340px', fontSize: '0.9em' }}>
                        Este arquivo contém configuração de treinos e histórico. O que deseja importar?
                    </p>

                    <button
                        onClick={() => { applyImport(importModalData, false); setImportModalData(null); }}
                        style={cardStyle}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = '#333'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = '#2a2a2a'; }}
                    >
                        <FileText size={28} color="var(--color-primary)" />
                        <div>
                            <div style={{ color: 'white', fontWeight: 'bold', marginBottom: '4px' }}>Somente Treinos</div>
                            <div style={{ color: '#999', fontSize: '0.85em' }}>Importa apenas a configuração dos treinos</div>
                        </div>
                    </button>

                    <div style={{ height: '12px' }} />

                    <button
                        onClick={() => { applyImport(importModalData, true); setImportModalData(null); }}
                        style={cardStyle}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = '#333'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = '#2a2a2a'; }}
                    >
                        <Archive size={28} color="#ff9800" />
                        <div>
                            <div style={{ color: 'white', fontWeight: 'bold', marginBottom: '4px' }}>Tudo</div>
                            <div style={{ color: '#999', fontSize: '0.85em' }}>Importa configuração + histórico completo</div>
                        </div>
                    </button>

                    <button onClick={() => setImportModalData(null)} style={cancelBtnStyle}>
                        Cancelar
                    </button>
                </div>
            )}
        </div>
    );
}
