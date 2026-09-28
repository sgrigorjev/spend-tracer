import { config } from "../config.ts";
import { createStore } from "../db.ts";
import { backfillMissingRates } from "../../../shared/src/fx.ts";

async function main(): Promise<void> {
  const store = createStore(config.dbPath);
  try {
    const result = await backfillMissingRates(store, config.baseCurrency);
    process.stdout.write(
      `Base equivalent: filled ${result.filled}, unresolved ${result.unresolved}, of ${result.total} rows.\n`,
    );
  } finally {
    store.close();
  }
}

void main();
