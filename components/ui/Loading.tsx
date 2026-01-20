'use client';

/**
 * Loading spinner component
 */
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sizeClasses = {
        sm: 'w-5 h-5 border-2',
        md: 'w-10 h-10 border-3',
        lg: 'w-12 h-12 border-4',
    };

    return (
        <div
            className={`${sizeClasses[size]} border-[var(--border)] rounded-full animate-spin`}
            style={{ borderTopColor: 'var(--brand-yellow)' }}
        />
    );
}

/**
 * Loading state with centered spinner and optional text
 */
export function LoadingState({ text = 'Caricamento...' }: { text?: string }) {
    return (
        <div className="loading-center">
            <Spinner />
            <p className="text-muted text-sm">{text}</p>
        </div>
    );
}

/**
 * Skeleton loader for content placeholders
 */
export function Skeleton({ className = '' }: { className?: string }) {
    return (
        <div
            className={`bg-[var(--bg-tertiary)] rounded animate-pulse ${className}`}
            style={{ minHeight: '1rem' }}
        />
    );
}

/**
 * Card skeleton for appointment list
 */
export function CardSkeleton() {
    return (
        <div className="card card-body space-y-3">
            <div className="flex justify-between">
                <Skeleton className="w-32 h-5" />
                <Skeleton className="w-16 h-5" />
            </div>
            <Skeleton className="w-24 h-4" />
            <Skeleton className="w-20 h-4" />
        </div>
    );
}
