/**
 * Script CLI para cambiar la contraseña del usuario.
 * Uso: npm run cambiar-clave -- <usuario> <nuevaClave>
 */
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const [usuario, nueva] = process.argv.slice(2);
  if (!usuario || !nueva || nueva.length < 8) {
    console.error("Uso: npm run cambiar-clave -- <usuario> <nuevaClave (min 8)>");
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(nueva, 12);
  const u = await prisma.usuario.update({ where: { usuario }, data: { passwordHash } });
  console.log(`✔ Contraseña actualizada para "${u.usuario}"`);
}

main()
  .catch((e) => {
    console.error("✖ Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
