// Aplica as migrações do banco (pasta drizzle/) antes de subir o servidor em produção.
// Só cria/altera o que falta; nunca apaga dados.
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./api/database";

await migrate(db, { migrationsFolder: `${import.meta.dirname}/../drizzle` });
console.log("Migrações aplicadas");
