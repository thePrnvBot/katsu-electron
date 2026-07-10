declare module "@gorhill/ubo-core" {
  interface MatchRequestDetails {
    url: string;
    originURL: string;
    type: string;
  }

  interface StaticNetFilteringEngine {
    useLists(
      lists: Array<{ name: string; raw: string }>
    ): Promise<void>;
    matchRequest(details: MatchRequestDetails): number;
    serialize(): Promise<string>;
    deserialize(data: string): Promise<void>;
  }

  export const StaticNetFilteringEngine: {
    create(): Promise<StaticNetFilteringEngine>;
  };
}
