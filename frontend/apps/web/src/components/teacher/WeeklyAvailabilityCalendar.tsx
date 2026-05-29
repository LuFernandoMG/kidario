import { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface WeeklyAvailabilitySlot {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

interface WeeklyAvailabilityCalendarProps {
  value: WeeklyAvailabilitySlot[];
  onChange?: (slots: WeeklyAvailabilitySlot[]) => void;
  slotDurationMinutes?: number;
  startHour?: number;
  endHour?: number;
  readOnly?: boolean;
}

const weekDays = [
  { value: "segunda", label: "Seg" },
  { value: "terca", label: "Ter" },
  { value: "quarta", label: "Qua" },
  { value: "quinta", label: "Qui" },
  { value: "sexta", label: "Sex" },
  { value: "sabado", label: "Sáb" },
  { value: "domingo", label: "Dom" },
];

export function WeeklyAvailabilityCalendar({
  value,
  onChange,
  slotDurationMinutes = 60,
  startHour = 7,
  endHour = 21,
  readOnly = false,
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
    return new Set(value.map((slot) => `${slot.dayOfWeek}|${normalizeTime(slot.startTime)}`));
  }, [value]);

  const handleToggleSlot = (dayOfWeek: string, startTime: string) => {
    if (readOnly || !onChange) return;

    const key = `${dayOfWeek}|${startTime}`;
    const endTime = addMinutes(startTime, duration);
    const exists = selectedKeys.has(key);

    const nextSlots = exists
      ? value.filter((slot) => !(slot.dayOfWeek === dayOfWeek && normalizeTime(slot.startTime) === startTime))
      : [...value, { dayOfWeek, startTime, endTime }];

    onChange(sortSlots(nextSlots));
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <p className="text-sm text-muted-foreground">
          Toque em cada bloco para marcar disponibilidade. Cada bloco representa {duration} minutos.
        </p>
      )}

      <div className="max-h-[640px] overflow-auto rounded-lg border border-border bg-background">
        <div className="min-w-[760px] p-[5px]">
          <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-2">
            <div className="sticky left-0 top-0 z-30 bg-background" />
            {weekDays.map((day) => (
              <div
                key={day.value}
                className="sticky top-0 z-20 bg-background py-2 text-center text-xs font-semibold text-muted-foreground"
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
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {readOnly ? "Horários cadastrados" : "Blocos selecionados"}: {value.length}
      </p>
    </div>
  );
}

function CalendarRow({
  time,
  selectedKeys,
  onToggle,
  readOnly,
}: {
  time: string;
  selectedKeys: Set<string>;
  onToggle: (dayOfWeek: string, startTime: string) => void;
  readOnly: boolean;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 bg-background py-2 pr-2 text-xs text-muted-foreground">{time}</div>
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
              readOnly && "cursor-default focus-visible:ring-0 focus-visible:ring-offset-0",
              readOnly && !isActive && "hover:bg-background",
            )}
            aria-pressed={isActive}
            aria-label={`${day.label} ${time}`}
            aria-disabled={readOnly}
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
  const [hours, minutes] = normalizeTime(time).split(":").map(Number);
  return hours * 60 + minutes;
}

function addMinutes(time: string, minutesToAdd: number) {
  return minutesToTime(timeToMinutes(time) + minutesToAdd);
}

function normalizeTime(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function sortSlots(slots: WeeklyAvailabilitySlot[]) {
  const dayOrder = new Map(weekDays.map((day, index) => [day.value, index]));

  return [...slots].sort((a, b) => {
    const dayDiff = (dayOrder.get(a.dayOfWeek) ?? 99) - (dayOrder.get(b.dayOfWeek) ?? 99);
    if (dayDiff !== 0) return dayDiff;
    return normalizeTime(a.startTime).localeCompare(normalizeTime(b.startTime));
  });
}
