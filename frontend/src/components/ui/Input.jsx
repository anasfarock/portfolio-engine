import React from 'react';

export default function Input({ label, id, error, className = '', containerClassName = '', ...props }) {
    return (
        <div className={containerClassName}>
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {label}
                </label>
            )}
            <input
                id={id}
                name={id}
                className={`input-field ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} ${className}`}
                {...props}
            />
            {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
}
