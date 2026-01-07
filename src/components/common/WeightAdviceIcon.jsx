import { Weight, Plus, Minus, Check } from 'lucide-react';

const WeightAdviceIcon = ({ advice }) => {
    // Default (No advice)
    if (!advice) {
        return <Weight size={16} color="#888" />;
    }

    let color;
    let OverlayIcon;

    switch (advice) {
        case 'increase':
            color = '#3b82f6'; // Blue
            OverlayIcon = Plus;
            break;
        case 'decrease':
            color = '#ef4444'; // Red
            OverlayIcon = Minus;
            break;
        case 'maintain':
            color = '#22c55e'; // Green
            OverlayIcon = Check;
            break;
        default:
            return <Weight size={16} color="#888" />;
    }

    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Base Weight Icon - slightly transparent to let the overlay pop */}
            <Weight size={22} color={color} strokeWidth={1.5} />
            <div style={{
                position: 'absolute',
                top: '60%', // Lowered vertically to center on the weight body
                left: '50%',
                transform: 'translate(-50%, -50%)',
                // No background as requested
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <OverlayIcon
                    size={advice === 'maintain' ? 14 : 16}
                    color={color}
                    strokeWidth={3}
                    style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.8))' }}
                />
            </div>
        </div>
    );
};

export default WeightAdviceIcon;
