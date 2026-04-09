const { songKey, formatTime, esc } = require('../../public/ratings');

describe('songKey', () => {
  it('joins artist and title with ||', () => {
    expect(songKey('The Stray Cats', 'Rock This Town')).toBe('The Stray Cats||Rock This Town');
  });

  it('handles empty strings', () => {
    expect(songKey('', '')).toBe('||');
  });

  it('handles special characters', () => {
    expect(songKey('AC/DC', 'Back in Black')).toBe('AC/DC||Back in Black');
  });
});

describe('formatTime', () => {
  it('formats seconds under a minute', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(9)).toBe('00:09');
    expect(formatTime(59)).toBe('00:59');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(60)).toBe('01:00');
    expect(formatTime(90)).toBe('01:30');
    expect(formatTime(3599)).toBe('59:59');
  });

  it('includes hours when >= 3600 seconds', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(7384)).toBe('2:03:04');
  });
});

describe('esc', () => {
  it('escapes ampersands', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than and greater-than', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(esc('"quoted"')).toBe('&quot;quoted&quot;');
  });

  it('escapes multiple entities in one string', () => {
    expect(esc('<b class="x">a & b</b>')).toBe('&lt;b class=&quot;x&quot;&gt;a &amp; b&lt;/b&gt;');
  });

  it('returns plain strings unchanged', () => {
    expect(esc('Radio Calico')).toBe('Radio Calico');
  });
});
