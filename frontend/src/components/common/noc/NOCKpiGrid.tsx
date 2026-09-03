import React from 'react';

export interface NOCKpiGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export default function NOCKpiGrid({
  children,
  columns = 4,
  className = '',
}: NOCKpiGridProps) {
  const getColClass = () => {
    switch (columns) {
      case 2:
        return 'grid-cols-1 sm:grid-cols-2';
      case 3:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      case 5:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5';
      case 4:
      default:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    }
  };

  return (
    <div className={`grid gap-4 ${getColClass()} ${className}`}>
      {children}
    </div>
  );
}
