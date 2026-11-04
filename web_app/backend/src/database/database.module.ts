import { Global, Injectable, Logger, Module, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readDatabaseConfig } from "./config.js";
import { DatabaseConnection } from "./connection.js";

@Injectable()
export class DatabaseService extends DatabaseConnection implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const env = Object.fromEntries([
      "NODE_ENV", "DATABASE_URL", "DATABASE_POOL_MAX", "DATABASE_CONNECT_TIMEOUT_MS",
      "DATABASE_IDLE_TIMEOUT_MS", "DATABASE_STATEMENT_TIMEOUT_MS", "DATABASE_LOCK_TIMEOUT_MS",
      "DATABASE_TRANSACTION_IDLE_TIMEOUT_MS",
    ].map((key) => [key, config.get<string>(key)]));
    super(readDatabaseConfig(env), () => Logger.error("An idle PostgreSQL connection failed.", "Database"));
  }

  async onModuleInit() {
    try {
      await this.initialize();
    } catch (error) {
      await this.close();
      // Connection failures can contain credentials; expose only controlled diagnostics.
      if (error instanceof Error && /^(Database schema|Applied migrations|DATABASE_URL)/.test(error.message)) throw error;
      throw new Error("Database initialization failed. Check connection, migrations and runtime grants.");
    }
  }

  async onModuleDestroy() {
    await this.close();
  }
}

@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export default class DatabaseModule {}
