import React from 'react';

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}

export function Select({ value, onValueChange, children, className = '' }: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      {children}
    </div>
  );
}

export function SelectTrigger({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <button className={`flex items-center justify-between w-full px-4 py-2 text-sm border rounded-md ${className}`}>
      {children}
      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export function SelectContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg ${className}`}>
      {children}
    </div>
  );
}

export function SelectValue({ placeholder }: { placeholder: string }) {
  return <span className="text-gray-500">{placeholder}</span>;
}

export function SelectItem({ value, children }: SelectItemProps) {
  return (
    <div className="px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer">
      {children}
    </div>
  );
} 