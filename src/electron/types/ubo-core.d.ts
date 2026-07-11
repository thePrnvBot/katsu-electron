declare module "@gorhill/ubo-core" {
  interface MatchRequestDetails {
    url: string;
    originURL: string;
    type: string;
  }

  export const StaticNetFilteringEngine: {
    create: () => Promise<{
      useLists: (lists: { name: string; raw: string }[]) => Promise<void>;
      matchRequest: (details: MatchRequestDetails) => number;
      serialize: () => Promise<string>;
      deserialize: (data: string) => Promise<void>;
    }>;
  };
}
