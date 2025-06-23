import React, { lazy, Suspense } from 'react';
import { Copy, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import dynamicIconImports from 'lucide-react/dynamicIconImports';

interface IconCardProps {
  iconName: string;
  onClick: () => void;
  isCopied: boolean;
}

const IconComponent = ({ iconName }: { iconName: string }) => {
  const LucideIcon = lazy(dynamicIconImports[iconName as keyof typeof dynamicIconImports]);

  return (
    <Suspense fallback={<div className="w-6 h-6 bg-muted animate-pulse rounded" />}>
      <LucideIcon size={24} className="text-foreground group-hover:text-primary transition-colors" />
    </Suspense>
  );
};

export const IconCard: React.FC<IconCardProps> = ({
  iconName,
  onClick,
  isCopied,
}) => {
  const displayName = iconName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 border-2 hover:border-primary/20"
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col items-center space-y-3">
        <div className="relative">
          <div className="w-8 h-8 flex items-center justify-center">
            <IconComponent iconName={iconName} />
          </div>

          {/* Copy indicator */}
          <div className={`absolute -top-1 -right-1 transition-all duration-200 ${isCopied ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
            }`}>
            <div className="bg-green-500 text-white rounded-full p-1">
              <Check size={12} />
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Click to copy
          </p>
        </div>

        {/* Copy icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none">
          <Copy size={16} className="text-primary" />
        </div>
      </CardContent>
    </Card>
  );
};