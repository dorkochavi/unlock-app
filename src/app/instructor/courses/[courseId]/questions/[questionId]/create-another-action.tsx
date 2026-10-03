import { Button } from "@/components/button";

/** "Create another Question" action + its error (PREVIEW-QA-FIX-001). Visibility is decided by the caller. */
export function CreateAnotherAction({
  creating,
  error,
  onCreate,
  label,
  creatingLabel,
}: {
  creating: boolean;
  error: string | null;
  onCreate: () => void;
  label: string;
  creatingLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button variant="secondary" onClick={onCreate} disabled={creating}>
          {creating ? creatingLabel : label}
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
