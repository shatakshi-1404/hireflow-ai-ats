import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Field, FormAlert } from "@/components/common/form-field";
import { PasswordInput } from "@/components/common/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { AuthShell } from "./auth-shell";
import { useRegister } from "./hooks";

const schema = z.object({
  full_name: z.string().trim().min(1, "Your name is required").max(120, "Keep it under 120 characters"),
  workspace_name: z.string().trim().min(1, "Workspace name is required").max(120, "Keep it under 120 characters"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(10, "Use at least 10 characters").max(128, "Use at most 128 characters"),
});
type Values = z.infer<typeof schema>;

export function RegisterPage() {
  const signup = useRegister();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", workspace_name: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) =>
    signup.mutate(values, {
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) setError("email", { message: err.message });
      },
    }),
  );

  const generalError =
    signup.error && !(signup.error instanceof ApiError && signup.error.status === 409)
      ? signup.error.message
      : null;

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="You'll be the admin and can invite teammates afterwards."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {generalError && <FormAlert message={generalError} />}
        <Field id="full_name" label="Your name" error={errors.full_name?.message}>
          <Input
            id="full_name"
            autoComplete="name"
            aria-invalid={!!errors.full_name}
            aria-describedby={errors.full_name ? "full_name-error" : undefined}
            {...register("full_name")}
          />
        </Field>
        <Field id="workspace_name" label="Workspace name" error={errors.workspace_name?.message}>
          <Input
            id="workspace_name"
            autoComplete="organization"
            aria-invalid={!!errors.workspace_name}
            aria-describedby={errors.workspace_name ? "workspace_name-error" : undefined}
            {...register("workspace_name")}
          />
        </Field>
        <Field id="email" label="Work email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
        </Field>
        <Field id="password" label="Password" error={errors.password?.message} hint="At least 10 characters.">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={signup.isPending}>
          {signup.isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Create workspace
        </Button>
      </form>
    </AuthShell>
  );
}
