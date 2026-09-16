import Button from './Button.jsx';

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded border border-danger/30 bg-danger/5 p-4 text-sm text-ink">
      <p className="font-medium text-danger">Something went wrong</p>
      <p className="mt-1 text-ink-muted">{message}</p>
      {onRetry && (
        <Button type="button" variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
