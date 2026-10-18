import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Field, FormAlert } from "@/components/common/form-field";
import { PasswordInput } from "@/components/common/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "./auth-shell";
import { useLogin } from "./hooks";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit((values) => login.mutate(values));

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Enter your details to continue."
      footer={
        <>
          New to HireFlow?{" "}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Create a workspace
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {login.error && <FormAlert message={login.error.message} />}
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
        </Field>
        <Field id="password" label="Password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Sign in
        </Button>
        {import.meta.env.DEV && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              // Local development only (matches `python -m app.seed`); stripped from production builds.
              setValue("email", "demo-admin@example.com");
              setValue("password", "demo-password-2026");
            }}
          >
            Fill demo admin (dev only)
          </Button>
        )}
      </form>
    </AuthShell>
  );
}
