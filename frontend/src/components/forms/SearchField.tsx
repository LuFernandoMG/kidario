import { Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SearchFieldProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onFilterClick?: () => void;
  className?: string;
}

export function SearchField({
  placeholder = "Buscar...",
  value,
  onChange,
  onFilterClick,
  className,
}: SearchFieldProps) {
  const [internalValue, setInternalValue] = useState(value || "");
  const currentValue = value !== undefined ? value : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (onChange) {
      onChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={currentValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full h-11 pl-10 pr-4 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
      </div>
      {onFilterClick && (
        <button
          onClick={onFilterClick}
          className="h-11 w-11 flex items-center justify-center bg-muted/50 border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
