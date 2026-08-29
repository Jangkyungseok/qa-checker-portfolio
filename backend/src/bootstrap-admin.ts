import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME ?? '관리자';

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  const sslEnabled =
    (process.env.DB_SSL ?? 'false').toLowerCase() === 'true';

  const pool = databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
        ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
      })
    : new Pool({
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME ?? 'qa_checker',
        user: process.env.DB_USER ?? 'qa_checker',
        password: process.env.DB_PASSWORD ?? 'qa_checker_dev',
        ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
      });

  try {
    const existingAdmin = await pool.query(
      `
      SELECT id, email, name, role, status
      FROM users
      WHERE role = 'ADMIN'
      LIMIT 1
      `,
    );

    if (existingAdmin.rowCount && existingAdmin.rowCount > 0) {
      console.log('Admin already exists.');
      console.log(existingAdmin.rows[0]);
      return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const result = await pool.query(
      `
      INSERT INTO users (
        email,
        password_hash,
        name,
        role,
        status
      )
      VALUES ($1, $2, $3, 'ADMIN', 'APPROVED')
      RETURNING id, email, name, role, status
      `,
      [adminEmail, passwordHash, adminName],
    );

    console.log('Admin created.');
    console.log(result.rows[0]);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});