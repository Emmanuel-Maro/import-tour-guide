const pg = (db_name, host, username, password, console) => {
  const db = require("knex")({
    client: "pg",
    connection: {
      host: host,
      port: 5432,
      user: username,
      password: password,
      database: db_name,
    },
  });
  db.q = (sql) => db.raw(sql).then((r) => console.table(r.rows));
  db.describe = (table_name) => {
    return db
      .raw(
        `
select column_name, data_type, character_maximum_length, column_default, is_nullable
from INFORMATION_SCHEMA.COLUMNS where table_name = '${table_name}';`
      )
      .then((r) => console.table(r.rows));
  };
  db.t = (name, schema = "public") =>
    db
      .raw(
        `SELECT * FROM information_schema.tables WHERE table_schema = '${schema}' and table_name ilike '%${name}%'`
      )
      .then((r) => console.table(r.rows));
  db.s = (tb_name, limit = 10) =>
    db
      .raw(`select * from ${tb_name} limit ${limit}`)
      .then((r) => console.table(r.rows));
  db.dbs = (db_name) =>
    db
      .raw(
        `SELECT datname FROM pg_database WHERE datistemplate = false and datname ilike '%${db_name}%'`
      )
      .then((r) => console.table(r.rows));
  return db;
};

const mysql = (db_name, host, username, password, console) => {
  const db = require("knex")({
    client: "mysql2",
    connection: {
      host: host,
      user: username,
      password: password,
      database: db_name,
    },
  });
  db.q = (sql) => db.raw(sql).then((r) => console.table(r[0]));
  db.describe = (table_name) => {
    return db
      .raw(
        `
SELECT * 
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${table_name}' AND TABLE_SCHEMA = DATABASE();`
      )
      .then((r) => console.table(r[0]));
  };
  db.t = (name) =>
    db
      .raw(
        `SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = '${db_name}'  AND TABLE_NAME LIKE '%${name}%'`
      )
      .then((r) => console.table(r[0]));

  db.s = (tb_name, limit = 10) =>
    db
      .raw(`select * from ${tb_name} limit ${limit}`)
      .then((r) => console.table(r.rows));
  return db;
};

module.exports = {
  pg,
  mysql,
};
