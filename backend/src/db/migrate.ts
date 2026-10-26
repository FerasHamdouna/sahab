// `npm run migrate`: create the database and apply migrations without starting the server.
import { config } from '../config.js';
import { connectDb } from './db.js';

const pool = await connectDb(config.databaseUrl);
if (!pool) process.exit(1);
await pool.end();
