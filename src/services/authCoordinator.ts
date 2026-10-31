export function createAuthCoordinator(authenticate: () => Promise<boolean>) {
  let authenticated = false;
  let pending: Promise<boolean> | null = null;
  let generation = 0;
  return {
    authenticate() {
      if (authenticated) return Promise.resolve(true);
      if (pending) return pending;
      const attemptGeneration = generation;
      pending = Promise.resolve().then(authenticate).then(result => {
        const valid = generation === attemptGeneration && result;
        authenticated = valid;
        return valid;
      }).finally(() => { pending = null; });
      return pending;
    },
    resetForBackground() { generation++; authenticated = false; },
    markAuthenticated() { generation++; authenticated = true; },
    isAuthenticated() { return authenticated; },
  };
}
