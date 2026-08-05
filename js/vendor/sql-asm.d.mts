type SqlJsDatabase = {
  run: (sql: string, params?: unknown[]) => void
  exec: (sql: string) => { columns: string[]; values: unknown[][] }[]
  close: () => void
}

type SqlJsStatic = {
  Database: new (data?: ArrayLike<number>) => SqlJsDatabase
}

export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>
