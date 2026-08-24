import { Suspense } from "react";
import AdminRegionMatrixClient from "./AdminRegionMatrixClient";

export default function AdminRegionMatrixPage() {
  return (
    <Suspense fallback={null}>
      <AdminRegionMatrixClient />
    </Suspense>
  );
}
