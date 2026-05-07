const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log("[DB] Conectado ao PostgreSQL!");
  } finally {
    client.release();
  }
}

// API compatível com o resto do código
const db = {
  // Executa query e retorna todas as linhas
  prepare: (sql) => ({
    all:  (...params) => query(sql, flatParams(params)),
    get:  (...params) => queryOne(sql, flatParams(params)),
    run:  (...params) => execute(sql, flatParams(params)),
  }),
  exec: (sql) => pool.query(sql),
};

function flatParams(params) {
  if (!params.length) return [];
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

async function query(sql, params = []) {
  const pgSql = toPgSql(sql);
  const res = await pool.query(pgSql, params);
  return res.rows;
}

async function queryOne(sql, params = []) {
  const pgSql = toPgSql(sql);
  const res = await pool.query(pgSql, params);
  return res.rows[0];
}

async function execute(sql, params = []) {
  const pgSql = toPgSql(sql);
  const res = await pool.query(pgSql, params);
  return {
    changes: res.rowCount,
    lastInsertRowid: res.rows[0]?.id ?? null,
  };
}

// Converte ? para $1, $2... (sintaxe PostgreSQL)
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

module.exports = { db, pool, initDatabase, query, queryOne, execute };
