import CollectionBinderView from "@/components/collection/CollectionBinderView";

const SharedCollectionBinderPage = ({
  params,
}: {
  params: { token: string };
}) => {
  return <CollectionBinderView shareToken={params.token} />;
};

export default SharedCollectionBinderPage;
