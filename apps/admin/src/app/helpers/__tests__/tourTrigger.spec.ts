import {
  requestTourAfterSignIn,
  TOUR_PENDING_KEY,
  TOUR_SKIP_KEY,
  takeTourRequest,
} from '../tourTrigger';

describe('tour trigger (every sign-in, once; never a reload or a restored session)', () => {
  it('a sign-in asks for the tour once: the first read takes it, the next (a reload) finds none', () => {
    requestTourAfterSignIn(window.sessionStorage);
    expect(window.sessionStorage.getItem(TOUR_PENDING_KEY)).toBe('1');
    expect(takeTourRequest(window.sessionStorage)).toBe(true);
    expect(takeTourRequest(window.sessionStorage)).toBe(false);
  });

  it('without a sign-in (a session restored by the refresh cookie) there is no tour', () => {
    expect(takeTourRequest(window.sessionStorage)).toBe(false);
  });

  it('a second sign-in (sign out, sign in) asks again', () => {
    requestTourAfterSignIn(window.sessionStorage);
    takeTourRequest(window.sessionStorage);
    requestTourAfterSignIn(window.sessionStorage);
    expect(takeTourRequest(window.sessionStorage)).toBe(true);
  });

  it('the E2E bypass keeps it closed and still consumes the request', () => {
    window.sessionStorage.setItem(TOUR_SKIP_KEY, '1');
    requestTourAfterSignIn(window.sessionStorage);
    expect(takeTourRequest(window.sessionStorage)).toBe(false);
    expect(window.sessionStorage.getItem(TOUR_PENDING_KEY)).toBeNull();
  });

  it('blocked storage never throws and never starts a tour', () => {
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => requestTourAfterSignIn(blocked)).not.toThrow();
    expect(takeTourRequest(blocked)).toBe(false);
  });
});
