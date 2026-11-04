import {
  createEncryptedStorageFacade,
  type EncryptedStorageHelpers,
} from './encryptedStorageFacade';
import {
  createLifeOSEncryptedRepositories,
  createLifeOSEncryptedTransactionCoordinator,
  migrateLifeOSRecords,
  type LifeOSRawDatabase,
  type LifeOSDatabaseWithTransactions,
} from './encryptedStorageIntegration';

/**
 * Builds the encrypted storage layer around an existing LifeOS database.
 *
 * Construction does not provision keys, unlock encryption, migrate records,
 * or replace the application's active StorageService.
 */
export function createLifeOSEncryptedRuntime(
  database: LifeOSRawDatabase & LifeOSDatabaseWithTransactions,
  helpers: EncryptedStorageHelpers
) {
  const repositories = createLifeOSEncryptedRepositories(database);
  const transactionCoordinator =
    createLifeOSEncryptedTransactionCoordinator(database, repositories);
  const storage = createEncryptedStorageFacade(
    repositories,
    transactionCoordinator,
    helpers
  );

  return Object.freeze({
    repositories,
    transactionCoordinator,
    storage,
    migrateExistingRecords: () =>
      migrateLifeOSRecords(database, repositories),
  });
}
