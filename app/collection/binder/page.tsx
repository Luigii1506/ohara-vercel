import React from "react";
import CollectionBinderView from "@/components/collection/CollectionBinderView";
import { MainContentSkeleton } from "@/components/skeletons";

const CollectionBinderPage = () => {
  return (
    <React.Suspense
      fallback={
        <div className="h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 w-full">
          <div className="container mx-auto px-4 py-6 h-full">
            <MainContentSkeleton />
          </div>
        </div>
      }
    >
      <CollectionBinderView />
    </React.Suspense>
  );
};

export default CollectionBinderPage;
