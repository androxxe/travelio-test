import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <EmptyState
      icon="search"
      title="This page is off the shelf."
      description="The page you're looking for doesn't exist. Head back and start a new search."
      action={
        <Button asChild>
          <Link to="/">Back to search</Link>
        </Button>
      }
    />
  );
}
