/** Brand logo for an artifact provider, rendered from a vendored svgl asset. */

import type { ArtifactProviderId } from "../../shared/contract";
import claudeLogo from "../assets/providers/claude.svg";
import codexLogo from "../assets/providers/codex.svg";
import opencodeLogo from "../assets/providers/opencode.svg";

const PROVIDER_LOGOS = {
  claude: claudeLogo,
  codex: codexLogo,
  opencode: opencodeLogo,
} satisfies Record<ArtifactProviderId, string>;

interface ProviderLogoProps {
  id: ArtifactProviderId;
  size?: number;
}

export const ProviderLogo = ({ id, size = 16 }: ProviderLogoProps) => (
  <img
    alt=""
    className="shrink-0"
    height={size}
    src={PROVIDER_LOGOS[id]}
    width={size}
  />
);
