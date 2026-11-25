/**
 * Runs `work` atomically: every write it makes through `repos` commits
 * together, or none does. The API builds the repositories on a database
 * transaction (`transactionOn` in plant-catalog-data); a test can pass its
 * fakes straight through.
 */
export type Transaction<Repos> = <T>(work: (repos: Repos) => Promise<T>) => Promise<T>;
