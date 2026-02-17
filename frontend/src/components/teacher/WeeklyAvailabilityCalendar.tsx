import { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface WeeklyAvailabilitySlot {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

interface WeeklyAvailabilityCalendarProps {
  value: WeeklyAvailabilitySlot[];
  onChange: (slots: WeeklyAvailabilitySlot[]) => void;
  slotDurationMinutes?: number;
  startHour?: number;
  endHour?: number;
}

const weekDays = [
  { value: "segunda", label: "Seg" },
  { value: "terca", label: "Ter" },
  { value: "quarta", label: "Qua" },
  { value: "quinta", label: "Qui" },
  { value: "sexta", label: "Sex" },
  { value: "sabado", label: "Sab" },
  { value: "domingo", label: "Dom" },
];

export function WeeklyAvailabilityCalendar({
  value,
  onChange,
  slotDurationMinutes = 60,
  startHour = 7,
  endHour = 21,
}: WeeklyAvailabilityCalendarProps) {
  const duration = Number.isFinite(slotDurationMinutes) && slotDurationMinutes > 0
    ? slotDurationMinutes
    : 60;

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    const firstMinute = startHour * 60;
    const lastMinute = endHour * 60;

    for (let minute = firstMinute; minute + duration <= lastMinute; minute += duration) {
      slots.push(minutesToTime(minute));
    }

    return slots;
  }, [duration, endHour, startHour]);

  const selectedKeys = useMemo(() => {
    return new Set(value.map((slot) => `${slot.dayOfWeek}|${slot.startTime}`));
  }, [value]);

  const handleToggleSlot = (dayOfWeek: string, startTime: string) => {
    const key = `${dayOfWeek}|${startTime}`;
    const endTime = addMinutes(startTime, duration);
    const exists = selectedKeys.has(key);

    const nextSlots = exists
      ? value.filter((slot) => !(slot.dayOfWeek === dayOfWeek && slot.startTime === startTime))
      : [...value, { dayOfWeek, startTime, endTime }];

    onChange(sortSlots(nextSlots));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Toque em cada bloco para marcar disponibilidade. Cada bloco representa {duration} minutos.
      </p>

      <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-2">
            <div />
            {weekDays.map((day) => (
              <div
                key={day.value}
                className="text-xs font-semibold text-muted-foreground text-center py-1"
              >
                {day.label}
              </div>
            ))}

            {timeSlots.map((time) => (
              <CalendarRow
                key={time}
                time={time}
                selectedKeys={selectedKeys}
                onToggle={handleToggleSlot}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Blocos selecionados: {value.length}
      </p>
    </div>
  );
}

function CalendarRow({
  time,
  selectedKeys,
  onToggle,
}: {
  time: string;
  selectedKeys: Set<string>;
  onToggle: (dayOfWeek: string, startTime: string) => void;
}) {
  return (
    <>
      <div className="text-xs text-muted-foreground py-2">{time}</div>
      {weekDays.map((day) => {
        const key = `${day.value}|${time}`;
        const isActive = selectedKeys.has(key);

        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(day.value, time)}
            className={cn(
              "h-10 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isActive
                ? "bg-primary border-primary text-primary-foreground"
                : "bg-background border-border hover:bg-muted",
            )}
            aria-pressed={isActive}
            aria-label={`${day.label} ${time}`}
          />
        );
      })}
    </>
  );
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function addMinutes(time: string, minutesToAdd: number) {
  return minutesToTime(timeToMinutes(time) + minutesToAdd);
}

function sortSlots(slots: WeeklyAvailabilitySlot[]) {
  const dayOrder = new Map(weekDays.map((day, index) => [day.value, index]));

  return [...slots].sort((a, b) => {
    const dayDiff = (dayOrder.get(a.dayOfWeek) ?? 99) - (dayOrder.get(b.dayOfWeek) ?? 99);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });
}

