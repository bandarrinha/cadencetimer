import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ActiveWorkout from '../components/ActiveWorkout';
import { PHASE } from '../hooks/useCadenceTimer';

const { mockUseCadenceTimer } = vi.hoisted(() => {
    return {
        mockUseCadenceTimer: {
            state: {
                status: 'RUNNING',
                phase: 'ECCENTRIC',
                timeLeft: 3,
                phaseDuration: 3,
                setNumber: 1,
                actualReps: 0,
                isometricTime: 0,
                exerciseIndex: 0,
                workout: null,
                weightData: []
            },
            start: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
            skip: vi.fn(),
            registerFailure: vi.fn(),
            finishWorkout: vi.fn(),
            logSetData: vi.fn()
        }
    };
});

vi.mock('../hooks/useCadenceTimer', () => ({
    useCadenceTimer: () => mockUseCadenceTimer,
    PHASE: {
        IDLE: 'IDLE',
        PREP: 'PREP',
        ECCENTRIC: 'ECCENTRIC',
        BOTTOM_HOLD: 'BOTTOM_HOLD',
        CONCENTRIC: 'CONCENTRIC',
        TOP_HOLD: 'TOP_HOLD',
        REST_SET: 'REST_SET',
        REST_EXERCISE: 'REST_EXERCISE',
        FINISHED: 'FINISHED',
        ISOMETRIC_WORK: 'ISOMETRIC_WORK'
    }
}));

vi.mock('../hooks/useTTS', () => ({
    useTTS: () => ({
        speak: vi.fn(),
        playBeep: vi.fn()
    })
}));

vi.mock('../components/WorkoutSummary', () => ({
    default: ({ onSave }) => (
        <div data-testid="workout-summary">
            Summary Screen
            <button onClick={() => onSave([])}>Finish</button>
        </div>
    )
}));

const mockWorkout = {
    id: 'test',
    name: 'Test Workout',
    exercises: [
        {
            id: 'e1',
            name: 'Bench Press',
            sets: 3,
            reps: 10,
            failureMode: true,
            isIsometric: false,
            cadence: { eccentric: 3, eccentricPause: 1, concentric: 1, concentricPause: 0 },
            restSet: 45,
            restExercise: 60
        }
    ]
};

describe('ActiveWorkout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock Wake Lock
        Object.defineProperty(navigator, 'wakeLock', {
            writable: true,
            value: {
                request: vi.fn().mockResolvedValue({ release: vi.fn() })
            }
        });
    });

    it('renders current phase and exercise info', () => {
        render(<ActiveWorkout workout={mockWorkout} />);

        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Série 1/3')).toBeInTheDocument();
        expect(screen.getByText(/excêntrica/i)).toBeInTheDocument(); // Loose match for casing/accents
    });

    it('requests wake lock on mount', () => {
        render(<ActiveWorkout workout={mockWorkout} />);
        expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
    });

    it('shows inputs during rest', async () => {
        mockUseCadenceTimer.state.phase = PHASE.REST_SET;
        mockUseCadenceTimer.state.timeLeft = 45;

        render(<ActiveWorkout workout={mockWorkout} />);

        expect(await screen.findByText(/DESCANSO/)).toBeInTheDocument();

        expect(screen.getAllByPlaceholderText('0')).toHaveLength(2); // Inputs for Weight and Reps
    });

    it('shows summary when finished', () => {
        mockUseCadenceTimer.state.status = 'FINISHED';

        render(<ActiveWorkout workout={mockWorkout} />);

        expect(screen.getByTestId('workout-summary')).toBeInTheDocument();
    });
});
