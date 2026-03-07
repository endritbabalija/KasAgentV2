export interface Token {
  address: `0x${string}` | null;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  isNative?: boolean;
}

export const KASPLEX_TOKENS: Token[] = [
  {
    address: null,
    symbol: "KAS",
    name: "Kaspa",
    decimals: 18,
    logoURI: "/tokens/kas.png",
    isNative: true,
  },
  {
    address: "0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e",
    symbol: "WKAS",
    name: "Wrapped KAS",
    decimals: 18,
    logoURI: "/tokens/wkas.png",
  },
  {
    address: "0xb7a95035618354D9ADFC49Eca49F38586B624040",
    symbol: "ZEAL",
    name: "Zealous",
    decimals: 18,
    logoURI: "/tokens/zeal.png",
  },
  {
    address: "0x9a5a144290dffA24C6c7Aa8cA9A62319E60973D8",
    symbol: "NACHO",
    name: "Nacho",
    decimals: 18,
    logoURI: "/tokens/nacho.png",
  },
  {
    address: "0x1F3Ce97f8118035dba7FBCd5398005491Cf45603",
    symbol: "KASPER",
    name: "Kasper",
    decimals: 18,
    logoURI: "/tokens/kasper.png",
  },
];
