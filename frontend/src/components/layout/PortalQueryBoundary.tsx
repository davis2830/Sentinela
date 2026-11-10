import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  hashKey,
} from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import {
  sessionGeneration,
  subscribeSession,
} from "../../services/sessionScope";

function PrivateCache({
  scope,
  children,
}: {
  scope: string;
  children: ReactNode;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30000,
            gcTime: 300000,
            queryKeyHashFn: (key) => hashKey([scope, key]),
          },
        },
      }),
  );
  useEffect(
    () => () => {
      void client.cancelQueries();
      client.clear();
    },
    [client],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
export default function PortalQueryBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const user = useAuthStore((state) => state.user);
  const generation = useSyncExternalStore(subscribeSession, sessionGeneration);
  const scope = JSON.stringify([user?.id, user?.organization?.id, generation]);
  return (
    <PrivateCache key={scope} scope={scope}>
      {children}
    </PrivateCache>
  );
}
