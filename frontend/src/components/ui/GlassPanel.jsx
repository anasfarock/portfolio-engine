import React from 'react';

export default function GlassPanel({ children, className = '' }) {
    return (
        <div className={`glass-panel p-8 sm:rounded-2xl sm:px-10 ${className}`}>
            {children}
        </div>
    );
}
