import React, { useState } from 'react';

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  onSelect?: (value: string) => void;
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
  onSelect?: (value: string) => void;
}

export function Select({ value, onValueChange, children, className = '' }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {React.Children.map(children, child => {
          if (React.isValidElement(child) && child.type === SelectTrigger) {
            return child;
          }
          return null;
        })}
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg">
          {React.Children.map(children, child => {
            if (React.isValidElement(child) && child.type === SelectContent) {
              return React.cloneElement(child as React.ReactElement<SelectContentProps>, {
                onSelect: handleSelect
              });
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

export function SelectTrigger({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={`flex items-center justify-between w-full px-4 py-2 text-sm border rounded-md ${className}`}>
      {children}
      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export function SelectContent({ children, onSelect, className = '' }: SelectContentProps) {
  return (
    <div className={`w-full bg-white ${className}`}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && child.type === SelectItem) {
          return React.cloneElement(child as React.ReactElement<SelectItemProps>, {
            onSelect
          });
        }
        return null;
      })}
    </div>
  );
}

export function SelectValue({ children }: { children: React.ReactNode }) {
  return <span className="block truncate">{children}</span>;
}

export function SelectItem({ value, children, onSelect }: SelectItemProps) {
  return (
    <div 
      className="px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer"
      onClick={() => onSelect?.(value)}
    >
      {children}
    </div>
  );
} 