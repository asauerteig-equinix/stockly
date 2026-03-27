import { cn } from "@/lib/cn";

type FormFeedbackProps = {
  message: string | null;
  tone?: "error" | "success" | "info";
};

const toneStyles = {
  error: "bg-destructive/10 text-destructive",
  success: "bg-emerald-100 text-emerald-900",
  info: "bg-secondary text-slate-700"
};

export function FormFeedback({ message, tone = "info" }: FormFeedbackProps) {
  if (!message) {
    return null;
  }

  return <p className={cn("rounded-xl px-4 py-3 text-sm", toneStyles[tone])}>{message}</p>;
}
