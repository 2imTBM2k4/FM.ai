import { parseEntry } from '@pfm/domain';
import { foldSearchText } from '@/data/search-text';

export type ChatRoute = 'transaction' | 'advice' | 'ambiguous' | 'empty';

// Advice and hypothetical questions take priority over financial amounts, without an AI call.
export function routeChatInput(
  input: string,
  ctx: Parameters<typeof parseEntry>[1],
) {
  const parsed = parseEntry(input, ctx);
  const text = ` ${foldSearchText(input).replace(/[^a-z0-9?]+/g, ' ')} `;
  let route: ChatRoute;
  if (!input.trim()) route = 'empty';
  else if (
    text.includes('?') ||
    /\b(tu van|bao nhieu|nen|lam sao|the nao|tai sao|vi sao|phan tich|thong ke|bao cao|tong chi|tong thu|chi tieu thang|tinh (?:giup|khoan vay|lai)|hop ly|co du|co the|du tien|lai suat|ke hoach|neu|du dinh|se mua|dinh mua|muon (?:mua|an|vay)|xoa giao dich|sua giao dich|hoan tac)\b/.test(
      text,
    )
  )
    route = 'advice';
  else if (/\b(khong|chua|huy)\b/.test(text)) route = 'ambiguous';
  else if (
    /\b(ghi giao dich|luu giao dich|them giao dich|ghi thu|ghi chi|tra no|tra tien)\b/.test(
      text,
    ) ||
    parsed.candidates.some(
      (candidate) =>
        candidate.amount.value !== null && candidate.kindConfidence >= 0.8,
    )
  )
    route = 'transaction';
  else if (
    parsed.candidates.some(
      (candidate) =>
        candidate.amount.matchedText !== null ||
        candidate.kindConfidence >= 0.8,
    )
  )
    route = 'ambiguous';
  else route = 'advice';
  return { route, parsed };
}
