const mysql = require("mysql");
let dbCoinfig = require("./dbCoinfig");

let connection = mysql.createPool(dbCoinfig);

module.exports = { connection };
