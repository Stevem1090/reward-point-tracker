import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="down">
      {toasts.map(function ({ id, title, description, action, duration, variant, ...props }) {
        const computedDuration = duration ?? (variant === "destructive" ? 4000 : 1800)
        return (
          <Toast key={id} duration={computedDuration} variant={variant} {...props}>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
