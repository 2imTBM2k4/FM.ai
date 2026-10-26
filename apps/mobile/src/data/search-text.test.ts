import { expect, it } from 'vitest';
import { foldSearchText } from './search-text';

it('folds all Vietnamese vowel accents, uppercase and decomposed forms while retaining literal punctuation', () => {
  const groups = {
    a: 'aàáảãạăằắẳẵặâầấẩẫậ',
    e: 'eèéẻẽẹêềếểễệ',
    i: 'iìíỉĩị',
    o: 'oòóỏõọôồốổỗộơờớởỡợ',
    u: 'uùúủũụưừứửữự',
    y: 'yỳýỷỹỵ',
    d: 'dđ',
  };
  for (const [expected, letters] of Object.entries(groups)) {
    for (const letter of letters) {
      expect(foldSearchText(letter)).toBe(expected);
      expect(foldSearchText(letter.toUpperCase().normalize('NFD'))).toBe(
        expected,
      );
    }
  }
  expect(foldSearchText('  ĂN\t SÁNG\n ĐIỆN  %_  🥣 ')).toBe(
    'an sang dien %_ 🥣',
  );
  expect(foldSearchText('')).toBe('');
});
