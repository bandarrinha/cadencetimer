import { useRef, useEffect } from 'react';

export const useWakeLock = (enabled = true) => {
    const wakeLockRef = useRef(null);

    useEffect(() => {
        if (!enabled) return;

        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLockRef.current = await navigator.wakeLock.request('screen');
                    console.log('Wake Lock active');
                }
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
            }
        };

        const handleVisibilityChange = () => {
            if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
                requestWakeLock();
            }
        };

        requestWakeLock();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLockRef.current) {
                const releasePromise = wakeLockRef.current.release();
                if (releasePromise && typeof releasePromise.then === 'function') {
                    releasePromise.then(() => {
                        wakeLockRef.current = null;
                        console.log('Wake Lock released');
                    });
                } else {
                    wakeLockRef.current = null;
                }
            }
        };
    }, [enabled]);
};
