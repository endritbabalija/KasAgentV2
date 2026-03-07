export interface Token {
  address: `0x${string}` | null;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  isNative?: boolean;
}

export const KAS_NATIVE: Token = {
  address: null,
  symbol: "KAS",
  name: "Kaspa",
  decimals: 18,
  logoURI: "/tokens/kas.png",
  isNative: true,
};

export const TOKEN_LOGOS: Record<string, string> = {
  "0x2c2ae87ba178f48637acae54b87c3924f544a83e": "/tokens/wkas.png",
  "0xb7a95035618354d9adfc49eca49f38586b624040": "/tokens/zeal.png",
  "0x9a5a144290dffa24c6c7aa8ca9a62319e60973d8": "/tokens/nacho.png",
  "0x1f3ce97f8118035dba7fbcd5398005491cf45603": "/tokens/kasper.png",
};
