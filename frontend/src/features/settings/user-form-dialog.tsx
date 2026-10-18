import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field, FormAlert } from "@/components/common/form-field";
import { PasswordInput } from "@/components/common/password-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { ROLE_LABEL } from "@/lib/permissions";
import { useCreateUser } from "./api";

const ROLES = ["ADMIN", "RECRUITER", "VIEWER"] as const;

const schema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120, "Keep it under 120 characters"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(10, "Use at least 10 characters").max(128, "Use at most 128 characters"),
  role: z.enum(ROLES),
});
type Values = z.infer<typeof schema>;

function Form({ onClose }: { onClose: () => void }) {
  const create = useCreateUser();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "", role: "RECRUITER" },
  });

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    create.mutate(
      { ...v, email: v.email.trim(), full_name: v.full_name.trim() },
      {
        onSuccess: () => {
          toast.success("Team member added");
          onClose();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) setError("email", { message: err.message });
          else setFormError(err.message);
        },
      },
    );
  });

  const invalid = (name: keyof Values) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <FormAlert message={formError} />}
      <Field id="member_name" label="Full name" error={errors.full_name?.message}>
        <Input id="member_name" autoComplete="off" {...register("full_name")} aria-invalid={!!errors.full_name} aria-describedby={errors.full_name ? "member_name-error" : undefined} />
      </Field>
      <Field id="email" label="Email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="off" {...invalid("email")} {...register("email")} />
      </Field>
      <Field
        id="password"
        label="Temporary password"
        error={errors.password?.message}
        hint="At least 10 characters. Share it securely. Password changes aren't available yet."
      >
        <PasswordInput id="password" autoComplete="new-password" {...invalid("password")} {...register("password")} />
      </Field>
      <Field id="role" label="Role" error={errors.role?.message}>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Add member
        </Button>
      </DialogFooter>
    </form>
  );
}

export function UserFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            Admins manage the workspace, recruiters manage records, and viewers have read-only access.
          </DialogDescription>
        </DialogHeader>
        <Form onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
