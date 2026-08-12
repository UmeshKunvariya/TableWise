"use client";

import { useActionState } from "react";

import { removeMenu, uploadMenu, type MenuState } from "@/app/actions/menu";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";

export function MenuManager({
  hasMenu,
  menuUrl,
}: {
  hasMenu: boolean;
  menuUrl: string | null;
}) {
  const [state, formAction] = useActionState<MenuState, FormData>(
    uploadMenu,
    {},
  );
  const [removeState, removeAction] = useActionState<MenuState, FormData>(
    async () => removeMenu(),
    {},
  );

  const message = state.error ?? removeState.error;
  const success = state.success ?? removeState.success;

  return (
    <div className="flex flex-col gap-4">
      {message ? <Alert tone="danger">{message}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <Card>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="menu" className="text-sm font-medium text-ink">
              {hasMenu ? "Replace your menu PDF" : "Upload your menu PDF"}
            </label>
            <input
              id="menu"
              name="menu"
              type="file"
              accept="application/pdf"
              required
              className="min-h-12 w-full rounded-control border border-border-strong bg-surface-raised px-3 py-2 text-base text-ink file:mr-3 file:rounded file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
            />
            <p className="text-sm text-ink-muted">
              PDF only, up to 10 MB. A photo of your printed menu saved as a PDF
              works fine.
            </p>
          </div>

          <SubmitButton pendingLabel="Uploading…">
            {hasMenu ? "Replace menu" : "Upload menu"}
          </SubmitButton>
        </form>
      </Card>

      {hasMenu && menuUrl ? (
        <Card className="flex flex-col gap-3">
          <p className="font-medium text-ink">Your menu is live</p>
          <p className="text-sm text-ink-muted">
            Customers see a Menu link on your queue page.
          </p>
          <a
            href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-border-strong bg-surface-raised px-4 font-medium text-ink"
          >
            Preview it
          </a>
          <form action={removeAction}>
            <SubmitButton variant="ghost" pendingLabel="Removing…">
              Remove menu
            </SubmitButton>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
