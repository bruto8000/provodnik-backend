const express = require("express");
const bodyParser = require("body-parser");

const app = express();

const mysql = require("mysql");

///////////////////// CONFIGS ////////////////////////////////
Date.prototype.ddmmyyyy = function () {
  let mm = this.getMonth() + 1; // getMonth() is zero-based
  let dd = this.getDate();

  return [
    (dd > 9 ? "" : "0") + dd,
    (mm > 9 ? "" : "0") + mm,
    this.getFullYear(),
  ].join(" ");
};

Date.prototype.mmyyyy = function () {
  let mm = this.getMonth() + 1; // getMonth() is zero-based

  return [(mm > 9 ? "" : "0") + mm, this.getFullYear()].join(" ");
};

function prepareDatesForMysql(columnsOfDates) {
  return function (req, res, next) {
    columnsOfDates.forEach((column) => {
      let date = req.body[column];
      if (
        !date ||
        !(/\d\d\s\d\d\s\d\d\d\d/.test(date) || /\d\d\s\d\d\d\d/.test(date))
      )
        return;
      if (date.split(" ").length == 2) {
        date = "01 " + date;
      }
      req.body[column] = date.split(" ").reverse().join("-");
      console.log(req.body[column]);
    });

    next();
  };
}
function prepareDatesForClient(columnsOfDates) {
  return function (rows) {
    rows.forEach((row) => {
      columnsOfDates.forEach((column) => {
        if (typeof row[column] != "string" && row[column] != null) {
          if (row.is_month && column === "sdate") {
            row[column] = row[column].mmyyyy();
          } else {
            row[column] = row[column].ddmmyyyy();
          }
        } else if (typeof row[column] == "string") {
          row[column] = "";
        }
      });
    });
  };
}
function prepareArraysForMysql(columnsOfArrays) {
  return function (req, res, next) {
    columnsOfArrays.forEach((column) => {
      if (!req.body[column]) return;
      req.body[column] = JSON.stringify(req.body[column]);
    });
    next();
  };
}
function prepareArraysForClient(columnsOfArrays) {
  return function (rows) {
    rows.forEach((row) => {
      columnsOfArrays.forEach((column) => {
        if (!row[column]) {
          row[column] = [];
          return;
        }
        try {
          row[column] = JSON.parse(row[column]);
        } catch (err) {
          console.log("CANT BE PARSED", row[column]);
          row[column] = [];
        }
      });
    });
  };
}
function clearRequest(columnsNeed) {
  return function (req, res, next) {
    let newReqBody = {};
    console.log(req.body);
    columnsNeed.forEach((column) => {
      newReqBody[column] = req.body[column];
    });
    req.body = newReqBody;
    next();
  };
}
///////////////////// CONFIGS ////////////////////////////////

////// ACTIVITIES ///////
function activitiesMonthCheck(req, res, next) {
  let date = req.sdate;
  if (/^\d\d\s\d\d\d\d$/.test(date)) {
    req.body.is_month = true;
  } else {
    req.body.is_month = false;
  }
  next();
}

const activitiesArrays = [
  "flags",
  "audits",
  "AB",
  "ocenka",
  "statusZapusk",
  "risks",
  "bugs",
  "eGrafiks",
  "tags",
  "zamenas",
];
const activitiesDates = ["sdate", "fdate"];

const activitiesNeedColumnsForEdit = [
  "id",
  "fdate",
  "sdate",
  "nazvanie",
  "opisanieBody",
  "zakazchik",
  "bizness",
  "zapusk",
  "status",
  "soprovod",
  "ocenka",
  "comments",
  "audits",
  "flags",
  "AB",
  "statusZapusk",
  "risks",
  "difficulty",
  "bugs",
  "dopinfo",
  "eGrafiks",
  "tags",
  "zamenas",
];
const activitiesNeedColumnsForAdd = [
  "fdate",
  "sdate",
  "nazvanie",
  "opisanieBody",
  "zakazchik",
  "bizness",
  "zapusk",
  "status",
  "soprovod",
  "audits",
  "flags",
  "risks",
  "difficulty",
];

//// Employees /////

const employeesNeedColumnsForEdit = ["id", "full_name", "login"];

//// INFOQUERIES ////

const infoqueriesArrays = ["statuses"];
const infoqueriesDates = ["sdate", "fdate"];

const infoqueriesNeedColumns = [
  "archived",
  "classification",
  "deleted",
  "fdate",
  "id",
  "inicatior",
  "nazvanie",
  "otchot",
  "otvetfrom",
  "otvetstveniy",
  "problem",
  "produkt",
  "sdate",
  "statuses",
];

let db_config = {
  host: "192.168.0.104",
  user: "root",
  password: "bruto",
  database: "provodnik",
};

let connection;

function handleDisconnect() {
  connection = mysql.createConnection(db_config);

  connection.connect(function (err) {
    if (err) {
      console.log("error when connecting to db:", err);
      setTimeout(handleDisconnect, 2000);
    }
  });

  connection.on("error", function (err) {
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      handleDisconnect();
    } else {
      throw err;
    }
  });
}
handleDisconnect();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// app.use((req, res, next) => {});
app.all("*", (req, res, next) => {
  console.log(`request URL : ${req.url} //\\\\ METHOD IS ${req.method}`);

  next();
});

app.get("/vendor/showEmployees", (req, res) => {
  executeQuery(
    "SELECT * FROM EMPLOYEES WHERE is_deleted = 0 OR is_deleted is null"
  )
    .then((results) => {
      res.end(JSON.stringify(results));
    })
    .catch((err) => {
      console.log(err);
      res.status(500).end("500");
    });
});

app.get("/vendor/showActivities", (req, res) => {
  executeQuery(
    "SELECT * FROM projects WHERE is_deleted = 0 AND is_archived = 0"
  )
    .then((resultRows) => {
      prepareDatesForClient(activitiesDates)(resultRows);
      prepareArraysForClient(activitiesArrays)(resultRows);

      res.end(JSON.stringify(resultRows));
    })
    .catch((err) => {
      console.log(err);
      res.status(500).end("500");
    });
});

app.get("/vendor/showInfoQueries", (req, res) => {
  executeQuery("SELECT * FROM infoQueries")
    .then((resultRows) => {
      prepareDatesForClient(infoqueriesDates)(resultRows);
      prepareArraysForClient(infoqueriesArrays)(resultRows);

      res.end(JSON.stringify(resultRows));
    })
    .catch((err) => {
      console.log(err);
      res.status(500).end("500");
    });
});

app.get("/vendor/showTabel", (req, res) => {
  executeQuery("SELECT * FROM tabel")
    .then((resultRows) => {
      let jsonedColumns = ["body"];
      resultRows.forEach((row, idx) => {
        jsonedColumns.forEach((column) => {
          if (row[column] === null) row[column] = [];
          else {
            try {
              row[column] && (row[column] = JSON.parse(row[column]));
            } catch (err) {
              console.log(row["id"], "cant be parsed");
            }
          }
        });
      });

      res.end(JSON.stringify(resultRows));
    })
    .catch((err) => {
      console.log(err);
      res.status(500).end("500");
    });
});

//ACTIVITIES//

app.post(
  "/vendor/addActivity",
  clearRequest(activitiesNeedColumnsForAdd),
  prepareDatesForMysql(activitiesDates),
  prepareArraysForMysql(activitiesArrays),
  activitiesMonthCheck,
  (req, res) => {
    let sql = mysql.format("INSERT INTO projects SET  ?", req.body);

    executeQuery(sql)
      .then((result) => {
        res.status(404);
        res.end(JSON.stringify(result.insertId));
      })
      .catch((err) => {
        console.log(err);
      });
  }
);

app.post(
  "/vendor/editActivity",
  clearRequest(activitiesNeedColumnsForEdit),
  prepareDatesForMysql(activitiesDates),
  prepareArraysForMysql(activitiesArrays),
  activitiesMonthCheck,
  (req, res, next) => {
    let id = req.body.id;
    delete req.body.id;
    let query = mysql.format("UPDATE  projects SET  ? WHERE id=?", [
      req.body,
      id,
    ]);
    executeQuery(query)
      .then((result) => {
        res.end(JSON.stringify(result.insertId));
      })
      .catch((err) => {
        console.log(err);
        console.log(err);
        res.status(404).end();
      });
  }
);

app.post("/vendor/deleteActivity", (req, res) => {
  console.log(req.body);
  let sql = `UPDATE projects SET is_deleted = true WHERE id=${req.body.id}`;

  executeQuery(sql)
    .then(() => {
      res.end("OK");
    })
    .catch((err) => {
      res.status(500).end(err.toString());
    });
});

app.post("/vendor/changeOcenka", (req, res, next) => {
  let sql = `UPDATE  projects SET  ocenka='${JSON.stringify(
    req.body.ocenka
  )}' WHERE id='${req.body.id}'`;
  executeQuery(sql)
    .then(() => {
      res.end("OK");
    })
    .catch((err) => {
      res.status(400).emd(JSON.stringify(err));
    });
});

// Employees//
app.post("/vendor/deleteEmployee", (req, res) => {
  let sql = `UPDATE  employees SET  is_deleted=true WHERE id='${req.body.id}'`;
  executeQuery(sql)
    .then(() => {
      res.end("OK");
    })
    .catch((err) => {
      res.status(400).end(JSON.stringify(err));
    });
});
app.post("/vendor/addEmployee", (req, res) => {
  console.log("start");
  let sql = `SELECT * FROM employees WHERE nid='${req.body.nid}'`;

  executeQuery(sql)
    .catch((err) => {
      res.status(400).end(err);
    })
    .then((founded) => {
      if (founded.length) {
        res.status(400).end("NID");
      } else {
        let sql = mysql.format("INSERT INTO employees SET  ?", {
          nid: req.body.nid,
          login: req.body.login,
          full_name: req.body.full_name,
        });

        executeQuery(sql)
          .then(() => {
            res.end("OK");
          })

          .catch((err) => {
            res.end(err.toString());
          });
      }
    });
});
app.post(
  "/vendor/editEmployee",
  clearRequest(employeesNeedColumnsForEdit),
  (req, res) => {
    let id = req.body.id;
    delete req.body.id;
    let sql = mysql.format("UPDATE  employees SET  ? WHERE id=?", [
      req.body,
      id,
    ]);
    console.log(sql);
    executeQuery(sql)
      .then(() => {
        res.end("OK");
      })
      .catch((err) => {
        console.log(err);
        res.status(400).end(JSON.stringify(err));
      });
  }
);

//INFOQUERIES//

app.post(
  "/vendor/addInfoQuery",
  clearRequest(infoqueriesNeedColumns),
  prepareDatesForMysql(infoqueriesDates),
  prepareArraysForMysql(infoqueriesArrays),
  (req, res) => {
    let query = mysql.format("INSERT INTO infoqueries SET  ?", req.body);

    executeQuery(query)
      .then((result) => {
        res.end(JSON.stringify(result.insertId));
      })
      .catch((err) => {
        console.log(err);
      });
  }
);

app.post(
  "/vendor/editInfoQuery",
  clearRequest(infoqueriesNeedColumns),
  prepareDatesForMysql(infoqueriesDates),
  prepareArraysForMysql(infoqueriesArrays),

  (req, res, next) => {
    let id = req.body.id;
    delete req.body.id;
    let query = mysql.format("UPDATE  infoqueries SET  ? WHERE id=?", [
      req.body,
      id,
    ]);
    executeQuery(query)
      .then((result) => {
        res.end(JSON.stringify(result.insertId));
      })
      .catch((err) => {
        console.log(err);

        res.status(404).end();
      });
  }
);

app.post("/vendor/deleteInfoQuery", (req, res) => {
  console.log(req.body);
  let sql = `UPDATE infoqueries SET is_deleted = true WHERE id=${req.body.id}`;

  executeQuery(sql)
    .then(() => {
      res.end("OK");
    })
    .catch((err) => {
      res.status(400).end(err.toString());
    });
});

app.all("*", (req, res) => {
  res.status(404).end("NOT FOUND");
});

function executeQuery(query) {
  return new Promise((resolve, reject) => {
    connection.query(query, function (error, result, field) {
      if (error) {
        reject(error);
      }
      resolve(result);
    });
  });
}

app.listen(3000, console.log("server started ON PORT 3000"));
