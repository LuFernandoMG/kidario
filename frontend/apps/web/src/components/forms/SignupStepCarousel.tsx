import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SignupStep {
  title: string;
  subtitle: string;
}

interface SignupStepCarouselProps {
  steps: SignupStep[];
  currentStep: number;
}

export function SignupStepCarousel({ steps, currentStep }: SignupStepCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const container = containerRef.current;
    const currentStepElement = stepRefs.current[currentStep];

    if (!container || !currentStepElement) return;

    const containerRect = container.getBoundingClientRect();
    const stepRect = currentStepElement.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    const stepCenter = stepRect.left + stepRect.width / 2;
    const nextScrollLeft = container.scrollLeft + (stepCenter - containerCenter);

    container.scrollTo({
      left: nextScrollLeft,
      behavior: "smooth",
    });
  }, [currentStep]);

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto -mx-6 px-6 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ol className="flex gap-3 min-w-max">
        {steps.map((step, index) => {
          const isDone = index < currentStep;
          const isActive = index === currentStep;

          return (
            <li
              key={step.title}
              ref={(element) => {
                stepRefs.current[index] = element;
              }}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "card-kidario px-4 py-3 min-w-[200px] transition-all",
                isActive && "border-primary/40 shadow-kidario-md",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDone && "bg-primary text-primary-foreground",
                    isActive && "bg-primary/10 text-primary",
                    !isDone && !isActive && "bg-muted text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{step.subtitle}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
