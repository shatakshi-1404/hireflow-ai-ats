import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/common/badges";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/features/auth/user-context";
import { ROLE_LABEL, isAdmin } from "@/lib/permissions";
import type { User, UserRole } from "@/types/api";
import { useTeam, useUpdateUser } from "./api";
import { UserFormDialog } from "./user-form-dialog";

const ROLES: UserRole[] = ["ADMIN", "RECRUITER", "VIEWER"];

export function TeamSection() {
  const me = useCurrentUser();
  const admin = isAdmin(me);
  const team = useTeam();
  const update = useUpdateUser();
  const [adding, setAdding] = useState(false);
  const [deactivating, setDeactivating] = useState<User | null>(null);

  function change(u: User, changes: { role?: UserRole; is_active?: boolean }, done?: () => void) {
    update.mutate(
      { id: u.id, changes },
      {
        onSuccess: () => {
          toast.success(changes.role ? `${u.full_name} is now ${ROLE_LABEL[changes.role]}` : "Member updated");
          done?.();
        },
        onError: (e) => {
          toast.error(e.message);
          done?.();
        },
      },
    );
  }

  return (
    <Card className="mt-6 gap-0 py-0">
      <CardHeader className="flex-row items-start justify-between space-y-0 border-b py-4">
        <div>
          <CardTitle>Team</CardTitle>
          <CardDescription>{admin ? "Manage who can access this workspace." : "People in this workspace."}</CardDescription>
        </div>
        {admin && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add member
          </Button>
        )}
      </CardHeader>

      {team.isPending ? (
        <div className="p-4">
          <Skeleton className="h-32 w-full" />
        </div>
      ) : team.isError ? (
        <div className="p-4">
          <ErrorState message={team.error.message} onRetry={() => void team.refetch()} />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              {admin && (
                <TableHead className="w-28">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.data.map((u) => {
              const self = u.id === me.id;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium text-slate-900">
                      {u.full_name}
                      {self && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    {admin && !self ? (
                      <Select value={u.role} disabled={update.isPending} onValueChange={(r) => change(u, { role: r as UserRole })}>
                        <SelectTrigger className="w-36" aria-label={`Role for ${u.full_name}`}>
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
                    ) : (
                      ROLE_LABEL[u.role]
                    )}
                  </TableCell>
                  <TableCell>
                    <Pill className={u.is_active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-zinc-100 text-zinc-600 ring-zinc-200"}>
                      {u.is_active ? "Active" : "Deactivated"}
                    </Pill>
                  </TableCell>
                  {admin && (
                    <TableCell className="text-right">
                      {!self &&
                        (u.is_active ? (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeactivating(u)}>
                            Deactivate
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" disabled={update.isPending} onClick={() => change(u, { is_active: true })}>
                            Reactivate
                          </Button>
                        ))}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <UserFormDialog open={adding} onOpenChange={setAdding} />
      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={`Deactivate ${deactivating?.full_name ?? "this member"}?`}
        description="They are signed out of any active session and can't sign in until you reactivate them. Their records stay."
        confirmLabel="Deactivate"
        destructive
        pending={update.isPending}
        onConfirm={() => deactivating && change(deactivating, { is_active: false }, () => setDeactivating(null))}
      />
    </Card>
  );
}
