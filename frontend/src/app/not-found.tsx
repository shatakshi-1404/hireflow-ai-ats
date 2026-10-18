import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      action={
        <Button asChild>
          <Link to="/">Go to dashboard</Link>
        </Button>
      }
    />
  );
}
