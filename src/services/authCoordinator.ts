export function createAuthCoordinator(authenticate: () => Promise<boolean>) {
  let authenticated = false;
  let pending: Promise<boolean> | null = null;
  let generation = 0;
  return {
    authenticate() {
      if (authenticated) return Promise.resolve(true);
      if (pending) return pending;
      const attemptGeneration = generation;
      let attempt: Promise<boolean>;
      attempt = Promise.resolve().then(authenticate).then(result => {
        if (generation !== attemptGeneration) return false;
        authenticated = result;
        return result;
      }).finally(() => {
        if (pending === attempt) pending = null;
      });
      pending = attempt;
      return attempt;
    },
    resetForBackground() { generation++; authenticated = false; pending = null; },
    markAuthenticated() { generation++; authenticated = true; pending = null; },
    isAuthenticated() { return authenticated; },
  };
}
