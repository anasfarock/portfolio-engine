import React from 'react';

export default function Button({ children, className = '', disabled, isLoading, icon: Icon, ...props }) {
    return (
        <button
            disabled={disabled || isLoading}
            className={`btn-primary flex justify-center items-center gap-2 ${disabled || isLoading ? 'opacity-70 cursor-not-allowed' : ''
                } ${className}`}
            {...props}
        >
            {isLoading ? 'Processing...' : children}
            {(!isLoading && Icon) && <Icon className="w-4 h-4" />}
        </button>
    );
}
