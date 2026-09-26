import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { ApiError } from "../api/client";
import { workspacesApi } from "../api/endpoints";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";
import { Button, Field, Input, Modal } from "./ui";

export function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const { refreshWorkspaces, selectWorkspace } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: (wName: string) => {
      const slug =
        wName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "workspace";
      return workspacesApi.create({ name: wName, slug });
    },
    onSuccess: async (created) => {
      toast.success("Workspace created", `Switched to ${created.name ?? name}`);
      await refreshWorkspaces();
      await selectWorkspace(created.id);
      onClose();
    },
    onError: (err) => {
      toast.error(
        "Could not create workspace",
        err instanceof ApiError ? err.message : undefined,
      );
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) mutation.mutate(name.trim());
  };

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Building2 size={15} className="text-brand" aria-hidden />
          Create New Workspace
        </span>
      }
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="create-workspace-form"
            disabled={!name.trim()}
            loading={mutation.isPending}
          >
            Create Workspace
          </Button>
        </>
      }
    >
      <form id="create-workspace-form" onSubmit={submit} className="space-y-4">
        <Field
          label="Workspace name"
          hint="A slug is generated automatically from the name."
        >
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Engineering, APAC Operations"
            maxLength={120}
          />
        </Field>
      </form>
    </Modal>
  );
}
