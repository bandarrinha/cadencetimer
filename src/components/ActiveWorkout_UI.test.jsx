import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ActiveWorkout from './ActiveWorkout';
import * as useCadenceTimerModule from '../hooks/useCadenceTimer';

// Mock useTTS to avoid errors
vi.mock('../hooks/useTTS', () => ({
    useTTS: () => ({ speak: vi.fn(), playBeep: vi.fn() })
}));

// Mock useCadenceTimer to control state
const mockUseCadenceTimer = {
    state: {
        status: 'IDLE',
        phase: 'IDLE',
        timeLeft: 0,
        phaseDuration: 0,
        setNumber: 1,
        repNumber: 0,
        actualReps: 0,
        isometricTime: 0,
        exerciseIndex: 0,
        startTime: null,
        finishTime: null,
        totalWorkoutTime: 0,
        weightData: []
    },
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    skip: vi.fn(),
    registerFailure: vi.fn(),
    finishWorkout: vi.fn(),
    logSetData: vi.fn()
};

describe('ActiveWorkout UI Refinements', () => {
    const mockWorkout = {
        id: 'w1',
        name: 'Test Workout',
        exercises: [
            { id: 'e1', name: 'Regular Exercise', sets: 3, reps: 10, cadence: {}, isIsometric: false },
            { id: 'e2', name: 'Iso Exercise', sets: 3, reps: 30, cadence: {}, isIsometric: true },
        ]
    };

    beforeEach(() => {
        vi.spyOn(useCadenceTimerModule, 'useCadenceTimer').mockReturnValue(mockUseCadenceTimer);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows global timer when workout is active', () => {
        mockUseCadenceTimer.state = {
            ...mockUseCadenceTimer.state,
            startTime: Date.now(),
            totalWorkoutTime: 65, // 1m 05s
            status: 'RUNNING'
        };

        render(<ActiveWorkout workout={mockWorkout} onExit={vi.fn()} onFinishWorkout={vi.fn()} />);

        // Should show "01:05"
        expect(screen.getByText('01:05')).toBeInTheDocument();
    });

    it('hides rep counter during PREP phase', () => {
        mockUseCadenceTimer.state = {
            ...mockUseCadenceTimer.state,
            phase: 'PREP',
            status: 'RUNNING'
        };

        render(<ActiveWorkout workout={mockWorkout} onExit={vi.fn()} onFinishWorkout={vi.fn()} />);

        // Should NOT see "Rep 1 / 10"
        expect(screen.queryByText(/Rep 1/)).not.toBeInTheDocument();
    });

    it('shows "Tempo (s)" input label for Isometric exercise during Rest', () => {
        // We need to simulate being in REST_SET after an Isometric exercise.
        // The logic looks at the PREVIOUS exercise (or current if just finishing).
        // If we are in REST_SET, we just finished the current exercise index.

        mockUseCadenceTimer.state = {
            ...mockUseCadenceTimer.state,
            exerciseIndex: 1, // 'Iso Exercise'
            phase: 'REST_SET',
            status: 'RUNNING',
            weightData: [{ exerciseId: 'e2', setNumber: 1, reps: 0, weight: 10, time: 30 }] // Last entry for logic
        };

        render(<ActiveWorkout workout={mockWorkout} onExit={vi.fn()} onFinishWorkout={vi.fn()} />);

        expect(screen.getByText('Tempo (s)')).toBeInTheDocument();
        expect(screen.queryByText('Reps')).not.toBeInTheDocument();
    });

    it('shows "Reps Feitas" input label for Regular exercise during Rest', () => {
        mockUseCadenceTimer.state = {
            ...mockUseCadenceTimer.state,
            exerciseIndex: 0, // 'Regular Exercise'
            phase: 'REST_SET',
            status: 'RUNNING',
            weightData: [{ exerciseId: 'e1', setNumber: 1, reps: 10, weight: 50 }]
        };

        render(<ActiveWorkout workout={mockWorkout} onExit={vi.fn()} onFinishWorkout={vi.fn()} />);

        expect(screen.getByText('Reps')).toBeInTheDocument();
        expect(screen.queryByText('Tempo (s)')).not.toBeInTheDocument();
    });
});
