import React from 'react';

export default function DashedTimer({
    progress = 1, // 0 to 1
    duration = 0, // Used for the label
    size = 280,
    strokeWidth = 14,
    color = "white",
    bgColor = "rgba(255,255,255,0.2)",
    dashCount = 60,
    children
}) {
    const center = size / 2;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;

    // Calculate dashed array based on count
    const dashLength = circumference / dashCount;
    // We want a gap between dashes. Let's make the dash 60% of the segment, gap 40%
    const dash = dashLength * 0.6;
    const gap = dashLength * 0.4;

    // The total length of the stroke that should be visible based on progress
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
                {/* Background Full Dashed Circle */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={bgColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dash} ${gap}`}
                    strokeLinecap="round"
                />

                {/* Foreground Progress Dashed Circle */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dash} ${gap}`}
                // To animate the progress, we use stroke-dashoffset on the overall length
                // But combining that with individual dashes requires a mask trick or just
                // a solid stroke with a dashed mask.
                // simpler approach: solid stroke with dashed stroke over it? No, if we want
                // the dashes themselves to disappear one by one, we use a solid stroke with stroke-dashoffset
                // masked by the dashes.
                />
            </svg>
            <div style={{ zIndex: 1, position: 'relative' }}>
                {children}
            </div>
        </div>
    );
}
