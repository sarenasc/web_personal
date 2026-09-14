import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Uso: node scripts/hash-password.mjs <tu-contraseña>");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log("Hash:", hash);
console.log(
  "\nPégalo en tu .env (Next.js expande '$', así que escapa los signos $ con \\$):"
);
console.log(`ADMIN_PASSWORD_HASH=${hash.replace(/\$/g, "\\$")}`);
