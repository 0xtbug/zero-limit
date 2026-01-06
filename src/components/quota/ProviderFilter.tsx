
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface ProviderFilterItem {
  id: string;
  label: string;
  count: number;
  icon?: string;
}

interface ProviderFilterProps {
  items: ProviderFilterItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function ProviderFilter({ items, activeId, onSelect }: ProviderFilterProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
      {items.map((item) => {
        const isActive = activeId === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex min-w-fit items-center gap-2 rounded-lg border px-4 py-2.5 transition-all duration-200",
              isActive
                ? "border-primary/50 bg-accent text-accent-foreground shadow-lg shadow-primary/10"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.icon && (
               <img src={item.icon} alt={item.label} className="h-4 w-4 object-contain" />
            )}

            <span className="text-sm font-medium">{item.label}</span>

            {item.count > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  "ml-1 h-5 min-w-[1.25rem] justify-center px-1",
                  isActive
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {item.count}
              </Badge>
            )}

            {isActive && (
                <div className="ml-1 h-1.5 w-1.5 rounded-full bg-green-500"></div>
            )}
          </button>
        );
      })}
    </div>
  );
}
