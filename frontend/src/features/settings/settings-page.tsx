import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordCard } from "./password-card";
import { TeamSection } from "./team-section";
import { useCurrentUser } from "@/features/auth/user-context";
import { ROLE_LABEL } from "@/lib/permissions";

export function SettingsPage() {
  const user = useCurrentUser();
  const rows: [string, string][] = [
    ["Name", user.full_name],
    ["Email", user.email],
    ["Role", ROLE_LABEL[user.role]],
    ["Member since", new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })],
  ];

  return (
    <>
      <PageHeader title="Settings" description="Your profile and workspace access." />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your role is set by a workspace admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {rows.map(([term, value]) => (
              <div key={term} className="grid grid-cols-3 gap-4 py-3 text-sm">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className="col-span-2 break-words font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <PasswordCard />
      <TeamSection />
    </>
  );
}
