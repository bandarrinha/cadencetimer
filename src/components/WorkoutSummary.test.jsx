import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WorkoutSummary from './WorkoutSummary';

describe('WorkoutSummary', () => {
    const mockWorkout = {
        id: 'w1',
        name: 'Test Workout',
        exercises: [
            { id: 'e1', name: 'Bench Press' }
        ]
    };

    const mockWeightData = [
        { exerciseId: 'e1', setNumber: 1, weight: 50, reps: 10, time: 0 }
    ];

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        localStorage.clear();
        vi.useRealTimers();
    });

    it('displays total workout time', () => {
        // Start: 10:00:00, Finish: 10:05:30 (5m 30s)
        const start = 1600000000000;
        const finish = 1600000330000;

        render(
            <WorkoutSummary
                workout={mockWorkout}
                weightData={mockWeightData}
                onSave={vi.fn()}
                onDiscard={vi.fn()}
                startTime={start}
                finishTime={finish}
            />
        );

        // 5m 30s = 00:05:30
        expect(screen.getByText(/Tempo Total: 00:05:30/)).toBeInTheDocument();
    });

    it('displays comparison indicators', () => {
        // Setup history
        const history = [
            {
                workoutId: 'w1',
                date: '2023-01-01',
                exerciseId: 'e1',
                setNumber: 1,
                weight: 45, // Previous was 45, current is 50 (+5)
                reps: 10 // Same reps
            }
        ];
        localStorage.setItem('cadence_history', JSON.stringify(history));

        render(
            <WorkoutSummary
                workout={mockWorkout}
                weightData={mockWeightData}
                onSave={vi.fn()}
                onDiscard={vi.fn()}
            />
        );

        // Find diff text
        expect(screen.getByText('5kg')).toBeInTheDocument(); // Absolute diff
        // Should indicate positive change (green color or arrow)
        // Testing color/icon is hard, but presence of text confirms logic ran.

        // Reps diff is 0, might show "0 reps" or depend on logic.
        // My logic: if diff !== undefined, show it.
        // weightDiff: 5, repsDiff: 0.
        // weightDiff: 5, repsDiff: 0.
        // The current UI renders just the number for reps comparison to save space
        expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('displays comparison using Names for legacy history', () => {
        // Setup history with names only (simulating old data)
        const history = [
            {
                workoutName: 'Test Workout', // Matches mockWorkout.name
                date: '2023-01-01',
                exerciseName: 'Bench Press', // Matches exercise name
                setNumber: 1,
                weight: 40,
                reps: 10
            }
        ];
        localStorage.setItem('cadence_history', JSON.stringify(history));

        render(
            <WorkoutSummary
                workout={mockWorkout}
                weightData={mockWeightData}
                onSave={vi.fn()}
                onDiscard={vi.fn()}
            />
        );

        // Current: 50kg. Previous: 40kg. Diff: +10kg.
        expect(screen.getByText('10kg')).toBeInTheDocument();
    });

    it('handles missing history gracefully', () => {
        localStorage.clear();
        render(
            <WorkoutSummary
                workout={mockWorkout}
                weightData={mockWeightData}
                onSave={vi.fn()}
                onDiscard={vi.fn()}
            />
        );

        // Should NOT see comparisons
        expect(screen.queryByText(/kg/i, { selector: '.comparison' })).not.toBeInTheDocument(); // Using loose check
        // Or simply check that no "0kg" or "NaN" is shown in comparison area.
        // The comparison area is conditioned on comparison.weightDiff !== undefined.
        // If history is empty, getComparison returns {}. weightDiff is undefined.
        // So no indicator should render.

        // Ensure standard weight text is there
        expect(screen.getByText('50')).toBeInTheDocument();
    });
    it('renders bi-set grouping', () => {
        const biSetWorkout = {
            id: 'w2',
            name: 'BiSet Workout',
            exercises: [
                { id: 'e1', name: 'Ex 1', biSetId: 'g1' },
                { id: 'e2', name: 'Ex 2', biSetId: 'g1' }
            ]
        };
        const biSetData = [
            { exerciseId: 'e1', setNumber: 1, weight: 10, reps: 10, biSetId: 'g1' },
            { exerciseId: 'e2', setNumber: 1, weight: 10, reps: 10, biSetId: 'g1' }
        ];

        render(
            <WorkoutSummary
                workout={biSetWorkout}
                weightData={biSetData}
                onSave={vi.fn()}
                onDiscard={vi.fn()}
            />
        );

        // Check for Bi-Set Label
        expect(screen.getByText('BI-SET')).toBeInTheDocument();
        // Check for both exercises
        expect(screen.getByText('Ex 1')).toBeInTheDocument();
        expect(screen.getByText('Ex 2')).toBeInTheDocument();
    });
});
