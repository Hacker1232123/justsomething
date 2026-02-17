interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps): JSX.Element | null {
  if (!message) {
    return null;
  }

  return (
    <div className="toast-shell" role="status" aria-live="polite">
      {message}
    </div>
  );
}
