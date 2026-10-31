export function createAuthCoordinator(authenticate: () => Promise<boolean>) {
  let authenticated = false;
  let pending: Promise<boolean> | null = null;
  let generation = 0;
  return {
    authenticate() {
      if (authenticated) return Promise.resolve(true);
      if (pending) return pending;
      const attemptGeneration = generation;
      const currentFlight = Promise.resolve().then(authenticate).then(result => {
        const valid = generation === attemptGeneration && Boolean(result);
        authenticated = valid;
        return valid;
      }).finally(() => {
        if (pending === currentFlight) {
          pending = null;
        }
      });
      pending = currentFlight;
      return currentFlight;
    },
    resetForBackground() { generation++; authenticated = false; pending = null; },
    markAuthenticated() { generation++; authenticated = true; pending = null; },
    isAuthenticated() { return authenticated; },
    getGeneration() { return generation; },
  };
}
