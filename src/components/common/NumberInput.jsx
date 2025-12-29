import { Minus, Plus } from 'lucide-react';

export default function NumberInput({ value, onChange, min = 0, max = 999, step = 1, style = {}, placeholder, compact = false }) {
    const handleChange = (e) => {
        let val = e.target.value;
        if (val === '') {
            onChange('');
            return;
        }
        val = parseFloat(val);
        if (isNaN(val)) return;
        onChange(val);
    };

    const increment = () => {
        const current = value === '' ? 0 : parseFloat(value);
        const next = Math.min(current + step, max);
        onChange(next);
    };

    const decrement = () => {
        const current = value === '' ? 0 : parseFloat(value);
        const next = Math.max(current - step, min);
        onChange(next);
    };

    const btnSize = compact ? '32px' : '48px';
    const iconSize = compact ? 16 : 24;
    const inputWidth = compact ? '60px' : '100px';
    const fontSize = compact ? '1.2rem' : '2rem';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...style }}>
            <button
                onClick={decrement}
                style={{
                    background: '#333', color: 'white', border: '1px solid #555',
                    borderRadius: '50%', width: btnSize, height: btnSize,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0
                }}
            >
                <Minus size={iconSize} />
            </button>
            <input
                type="number"
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                style={{
                    fontSize: fontSize,
                    width: inputWidth,
                    textAlign: 'center',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '2px solid #333',
                    background: 'white',
                    color: 'black'
                }}
            />
            <button
                onClick={increment}
                style={{
                    background: '#333', color: 'white', border: '1px solid #555',
                    borderRadius: '50%', width: btnSize, height: btnSize,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0
                }}
            >
                <Plus size={iconSize} />
            </button>
        </div>
    );
}
