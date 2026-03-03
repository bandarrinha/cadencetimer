import React from 'react';

export default function DashedTimer({
    progress = 1, // 0 to 1
    size = 280,
    strokeWidth = 12,
    color = "white",
    bgColor = "rgba(255,255,255,0.2)",
    dashCount = 50,
    margin = "10px 0",
    children
}) {
    const center = size / 2;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;

    // Gap vs Dash ratio
    const dashLength = circumference / dashCount;
    const dash = dashLength * 0.6;
    const gap = dashLength * 0.4;

    // The shrinking active bar
    const strokeDashoffset = Math.max(0, circumference * (1 - progress));

    return (
        <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', margin }}>

            {/* Stopwatch Top Knob Detail */}
            <div style={{
                position: 'absolute',
                top: -14,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 20,
                height: 8,
                background: color,
                borderRadius: '4px 4px 0 0',
                opacity: 0.8
            }} />
            <div style={{
                position: 'absolute',
                top: -6,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 12,
                height: 10,
                background: color,
                opacity: 0.8
            }} />

            {/* SVG Ring */}
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
                {/* 1. Define the Dashed Mask */}
                <defs>
                    <mask id="dash-mask">
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke="white"
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${dash} ${gap}`}
                            strokeLinecap="butt"
                        />
                    </mask>
                </defs>

                {/* 2. Background Track (faded dashes) */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={bgColor}
                    strokeWidth={strokeWidth}
                    mask="url(#dash-mask)"
                />

                {/* 3. Foreground Progress (solid stroke masked by dashes) */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="butt"
                    mask="url(#dash-mask)"
                    style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                />
            </svg>
            <div style={{ zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {children}
            </div>
        </div>
    );
}
