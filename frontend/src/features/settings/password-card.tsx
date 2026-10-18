import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field, FormAlert } from "@/components/common/form-field";
import { PasswordInput } from "@/components/common/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChangePassword } from "@/features/auth/hooks";

const schema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z.string().min(10, "Use at least 10 characters").max(128, "Use at most 128 characters"),
    confirm_password: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords don't match",
  })
  .refine((v) => v.new_password !== v.current_password, {
    path: ["new_password"],
    message: "Choose a password different from your current one",
  });
type Values = z.infer<typeof schema>;

export function PasswordCard() {
  const change = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });

  const onSubmit = handleSubmit((v) =>
    change.mutate(
      { current_password: v.current_password, new_password: v.new_password },
      {
        onSuccess: () => {
          toast.success("Password changed. Your other sessions were signed out.");
          reset();
        },
      },
    ),
  );

  const invalid = (name: keyof Values) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <Card className="mt-6 max-w-2xl">
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Changing it signs you out everywhere else.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="max-w-sm space-y-4">
          {change.error && <FormAlert message={change.error.message} />}
          <Field id="current_password" label="Current password" error={errors.current_password?.message}>
            <PasswordInput id="current_password" autoComplete="current-password" {...invalid("current_password")} {...register("current_password")} />
          </Field>
          <Field id="new_password" label="New password" error={errors.new_password?.message} hint="At least 10 characters.">
            <PasswordInput id="new_password" autoComplete="new-password" {...invalid("new_password")} {...register("new_password")} />
          </Field>
          <Field id="confirm_password" label="Confirm new password" error={errors.confirm_password?.message}>
            <PasswordInput id="confirm_password" autoComplete="new-password" {...invalid("confirm_password")} {...register("confirm_password")} />
          </Field>
          <Button type="submit" disabled={change.isPending}>
            {change.isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Change password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
