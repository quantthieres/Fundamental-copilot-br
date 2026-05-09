import { Suspense } from "react";
import DashboardPageClient from "@/components/dashboard/DashboardPageClient";

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardPageClient />
    </Suspense>
  );
}
