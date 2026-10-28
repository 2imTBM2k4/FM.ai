import { describe, expect, it } from 'vitest';
import { routeChatInput } from './intent';
const ctx = {
  clock: {
    now: () => new Date('2026-10-23T09:00:00+07:00'),
    timeZone: 'Asia/Ho_Chi_Minh',
  },
  knownCounterparties: ['Hùng', 'Lan'],
};

describe('local chat routing before any write', () => {
  it.each([
    ['ăn sáng 30k', 'transaction'],
    ['khách trả tiền hàng 50k', 'transaction'],
    ['cf 30k bánh 20k', 'transaction'],
    ['ăn sáng 30', 'transaction'],
    ['  AN SANG  30K 😀', 'transaction'],
    ['chuyển ví 200k', 'transaction'],
    ['cho Lan mượn 1tr', 'transaction'],
    ['trả nợ Hùng 500k', 'transaction'],
    ['bạn trả tiền ăn 100k', 'transaction'],
    ['ghi giao dịch gửi xe', 'transaction'],
    ['Tháng này tôi chi bao nhiêu?', 'advice'],
    ['Tôi có nên mua điện thoại 15tr?', 'advice'],
    ['có nên cho Lan mượn 1tr', 'advice'],
    ['vay 20tr lãi suất 12% thì trả bao nhiêu', 'advice'],
    ['vay 20tr lãi suất 12%', 'advice'],
    ['có thể vay 500k không', 'advice'],
    ['kế hoạch tiết kiệm 2tr mỗi tháng', 'advice'],
    ['tính khoản vay 20tr', 'advice'],
    ['nếu vay Hùng 500k thì sao', 'advice'],
    ['dự định mua điện thoại 15tr', 'advice'],
    ['toi muon mua dien thoai 15tr', 'advice'],
    ['tôi muốn ăn sáng 30k', 'advice'],
    ['phân tích chi tiêu tháng này', 'advice'],
    ['tổng chi hôm qua', 'advice'],
    ['xóa giao dịch ăn sáng 30k', 'advice'],
    ['hoàn tác khoản chi 30k', 'advice'],
    ['xin chào', 'advice'],
    ['giúp tôi', 'advice'],
    ['', 'empty'],
    ['  \n', 'empty'],
    ['500k', 'ambiguous'],
    ['mua điện thoại 15tr', 'ambiguous'],
    ['không chi ăn sáng 30k', 'ambiguous'],
    ['chưa trả nợ Hùng 500k', 'ambiguous'],
  ])('%s → %s', (input, route) =>
    expect(routeChatInput(input, ctx).route).toBe(route),
  );

  it('never sums amounts or invents a kind while routing', () => {
    const multiple = routeChatInput('cf 30k bánh 20k', ctx);
    expect(multiple.parsed.candidates.map((c) => c.amount.value)).toEqual([
      30000, 20000,
    ]);
    expect(
      routeChatInput('bạn trả tiền ăn 100k', ctx).parsed.candidates[0].kind,
    ).toBe('unknown');
    expect(routeChatInput('ăn sáng 30', ctx).parsed.warnings).toContain(
      'ASSUMED_THOUSANDS',
    );
  });

  it('keeps financial parameters in advice without promoting them to a recorded expense', () => {
    const result = routeChatInput('có nên mua điện thoại 15tr', ctx);
    expect(result.route).toBe('advice');
    expect(result.parsed.candidates[0].amount.value).toBe(15000000);
  });

  it('is deterministic and handles Unicode without changing raw input', () => {
    for (const text of [
      '😀 ăn sáng 30k',
      '\ud800',
      '９９９',
      '  CF\u00a025K  ',
    ]) {
      const result = routeChatInput(text, ctx);
      expect(result).toEqual(routeChatInput(text, ctx));
      expect(result.parsed.raw).toBe(text);
    }
  });
});
