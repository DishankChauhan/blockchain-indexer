import * as React from 'react';
import { Toaster as Sonner } from 'sonner';

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

const Toast = ({ title, description, variant = 'default' }: ToastProps) => {
  return (
    <div
      className={`
        rounded-md p-4 
        ${variant === 'destructive' ? 'bg-red-50 text-red-900' : ''}
        ${variant === 'success' ? 'bg-green-50 text-green-900' : ''}
        ${variant === 'default' ? 'bg-gray-50 text-gray-900' : ''}
      `}
    >
      {title && <div className="font-medium">{title}</div>}
      {description && <div className="mt-1 text-sm">{description}</div>}
    </div>
  );
};

export const Toaster = () => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
    />
  );
};

export const useToast = () => {
  const toast = React.useCallback(
    ({ title, description, variant = 'default' }: ToastProps) => {
      return Sonner.toast(<Toast title={title} description={description} variant={variant} />);
    },
    []
  );

  return { toast };
};

export { Toast }; 