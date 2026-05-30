export const brazilianBanks = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "041", name: "Banrisul" },
  { code: "077", name: "Banco Inter" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "197", name: "Stone" },
  { code: "208", name: "BTG Pactual" },
  { code: "212", name: "Banco Original" },
  { code: "218", name: "Banco BS2" },
  { code: "237", name: "Bradesco" },
  { code: "260", name: "Nubank" },
  { code: "290", name: "PagBank" },
  { code: "323", name: "Mercado Pago" },
  { code: "336", name: "C6 Bank" },
  { code: "341", name: "Itaú Unibanco" },
  { code: "348", name: "Banco XP" },
  { code: "422", name: "Banco Safra" },
  { code: "623", name: "Banco Pan" },
  { code: "735", name: "Banco Neon" },
  { code: "748", name: "Sicredi" },
  { code: "756", name: "Sicoob" },
];

export function getBankLabel(bankCode: string) {
  const bank = brazilianBanks.find((item) => item.code === bankCode);
  return bank ? `${bank.name} (${bank.code})` : bankCode;
}
