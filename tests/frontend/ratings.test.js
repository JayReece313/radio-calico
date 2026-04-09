/**
 * @jest-environment jsdom
 */

const { votedSongs, songKey, applyCachedVote, applyRatingUI } = require('../../public/ratings');

// Helper: create a minimal rating button pair
function makeButtons() {
  const up   = document.createElement('button');
  const down = document.createElement('button');
  return { up, down };
}

// Helper: create count span elements
function makeCountSpans() {
  const upCount   = document.createElement('span');
  const downCount = document.createElement('span');
  return { upCount, downCount };
}

beforeEach(() => {
  // Clear shared votedSongs cache between tests
  Object.keys(votedSongs).forEach(k => delete votedSongs[k]);
});

describe('applyCachedVote — no prior vote', () => {
  it('leaves both buttons enabled', () => {
    const { up, down } = makeButtons();
    applyCachedVote(up, down, 'Artist', 'Title');
    expect(up.disabled).toBe(false);
    expect(down.disabled).toBe(false);
  });

  it('adds no voted classes', () => {
    const { up, down } = makeButtons();
    applyCachedVote(up, down, 'Artist', 'Title');
    expect(up.classList.contains('voted-up')).toBe(false);
    expect(down.classList.contains('voted-down')).toBe(false);
  });
});

describe('applyCachedVote — thumbs up cached', () => {
  beforeEach(() => {
    votedSongs[songKey('Artist', 'Title')] = 1;
  });

  it('disables the up button', () => {
    const { up, down } = makeButtons();
    applyCachedVote(up, down, 'Artist', 'Title');
    expect(up.disabled).toBe(true);
  });

  it('leaves the down button enabled for vote-changing', () => {
    const { up, down } = makeButtons();
    applyCachedVote(up, down, 'Artist', 'Title');
    expect(down.disabled).toBe(false);
  });

  it('applies voted-up class to up button only', () => {
    const { up, down } = makeButtons();
    applyCachedVote(up, down, 'Artist', 'Title');
    expect(up.classList.contains('voted-up')).toBe(true);
    expect(down.classList.contains('voted-down')).toBe(false);
  });
});

describe('applyCachedVote — thumbs down cached', () => {
  beforeEach(() => {
    votedSongs[songKey('Artist', 'Title')] = -1;
  });

  it('disables the down button', () => {
    const { up, down } = makeButtons();
    applyCachedVote(up, down, 'Artist', 'Title');
    expect(down.disabled).toBe(true);
  });

  it('leaves the up button enabled for vote-changing', () => {
    const { up, down } = makeButtons();
    applyCachedVote(up, down, 'Artist', 'Title');
    expect(up.disabled).toBe(false);
  });

  it('applies voted-down class to down button only', () => {
    const { up, down } = makeButtons();
    applyCachedVote(up, down, 'Artist', 'Title');
    expect(down.classList.contains('voted-down')).toBe(true);
    expect(up.classList.contains('voted-up')).toBe(false);
  });
});

describe('applyCachedVote — clears stale classes on re-render', () => {
  it('removes voted-up when cache is cleared', () => {
    votedSongs[songKey('Artist', 'Title')] = 1;
    const { up, down } = makeButtons();
    applyCachedVote(up, down, 'Artist', 'Title');
    expect(up.classList.contains('voted-up')).toBe(true);

    delete votedSongs[songKey('Artist', 'Title')];
    applyCachedVote(up, down, 'Artist', 'Title');
    expect(up.classList.contains('voted-up')).toBe(false);
    expect(up.disabled).toBe(false);
  });
});

describe('applyRatingUI', () => {
  it('updates count text content', () => {
    const { up, down } = makeButtons();
    const { upCount, downCount } = makeCountSpans();
    const data = { thumbs_up: 5, thumbs_down: 2 };

    applyRatingUI(up, down, upCount, downCount, data, 'Artist', 'Title');
    expect(upCount.textContent).toBe('5');
    expect(downCount.textContent).toBe('2');
  });

  it('calls applyCachedVote — disables correct button when vote cached', () => {
    votedSongs[songKey('Artist', 'Title')] = 1;
    const { up, down } = makeButtons();
    const { upCount, downCount } = makeCountSpans();

    applyRatingUI(up, down, upCount, downCount, { thumbs_up: 3, thumbs_down: 1 }, 'Artist', 'Title');
    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(false);
  });
});
