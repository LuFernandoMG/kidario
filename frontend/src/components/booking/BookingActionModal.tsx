import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { KidarioButton } from "@/components/ui/KidarioButton";
import type { DayAvailability } from "@/lib/bookingUtils";

export type BookingActionMode = "reschedule" | "cancel";

interface BookingActionModalProps {
  open: boolean;
  mode: BookingActionMode;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: { dateIso?: string; time?: string; reason?: string }) => void;
  availability: DayAvailability[];
  currentDateIso: string;
  currentTime: string;
  isSubmitting?: boolean;
}

export function BookingActionModal({
  open,
  mode,
  onOpenChange,
  onConfirm,
  availability,
  currentDateIso,
  currentTime,
  isSubmitting = false,
}: BookingActionModalProps) {
  const [selectedDateIso, setSelectedDateIso] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (!open) return;

    const hasCurrentDate = availability.some((day) => day.dateIso === currentDateIso);
    const nextDate = hasCurrentDate ? currentDateIso : availability[0]?.dateIso ?? "";
    const slotsForDate = availability.find((day) => day.dateIso === nextDate)?.slots ?? [];
    const hasCurrentTime = slotsForDate.includes(currentTime);
    const nextTime = hasCurrentTime ? currentTime : slotsForDate[0] ?? "";

    setSelectedDateIso(nextDate);
    setSelectedTime(nextTime);
    setCancelReason("");
  }, [availability, currentDateIso, currentTime, open]);

  const timeOptions = useMemo(() => {
    return availability.find((day) => day.dateIso === selectedDateIso)?.slots ?? [];
  }, [availability, selectedDateIso]);

  useEffect(() => {
    if (mode !== "reschedule") return;
    if (timeOptions.length === 0) {
      setSelectedTime("");
      return;
    }
    if (!timeOptions.includes(selectedTime)) {
      setSelectedTime(timeOptions[0]);
    }
  }, [mode, selectedTime, timeOptions]);

  const canConfirm =
    mode === "reschedule"
      ? Boolean(selectedDateIso && selectedTime)
      : Boolean(cancelReason.trim());

  const handleConfirm = () => {
    if (!canConfirm) return;

    if (mode === "reschedule") {
      onConfirm({ dateIso: selectedDateIso, time: selectedTime });
      return;
    }

    onConfirm({ reason: cancelReason.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "reschedule" ? "Reagendar aula" : "Cancelar aula"}
          </DialogTitle>
          <DialogDescription>
            {mode === "reschedule"
              ? "Selecione a nova data e horario para atualizar a reserva."
              : "Informe um motivo para cancelar esta aula."}
          </DialogDescription>
        </DialogHeader>

        {mode === "reschedule" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="reschedule-date" className="text-sm font-medium text-foreground">
                Nova data
              </label>
              <select
                id="reschedule-date"
                value={selectedDateIso}
                onChange={(event) => setSelectedDateIso(event.target.value)}
                className="w-full h-11 px-3 bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {availability.map((day) => (
                  <option key={day.dateIso} value={day.dateIso}>
                    {day.dateLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="reschedule-time" className="text-sm font-medium text-foreground">
                Novo horario
              </label>
              <select
                id="reschedule-time"
                value={selectedTime}
                onChange={(event) => setSelectedTime(event.target.value)}
                className="w-full h-11 px-3 bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={timeOptions.length === 0}
              >
                {timeOptions.length === 0 ? (
                  <option value="">Sem horarios para esta data</option>
                ) : (
                  timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="cancel-reason" className="text-sm font-medium text-foreground">
              Motivo do cancelamento
            </label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Ex.: conflito de horario, imprevisto familiar, etc."
              className="min-h-[120px] bg-muted/50"
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <KidarioButton
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Voltar
          </KidarioButton>
          <KidarioButton
            type="button"
            variant={mode === "cancel" ? "destructive" : "hero"}
            onClick={handleConfirm}
            disabled={!canConfirm || isSubmitting}
          >
            {isSubmitting
              ? "Salvando..."
              : mode === "reschedule"
                ? "Confirmar reagendamento"
                : "Confirmar cancelamento"}
          </KidarioButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
