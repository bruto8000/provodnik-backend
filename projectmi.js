const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const mysql = require("mysql");
const cors = require("cors");
console.log(__dirname);
const https = require("https");
const { authRouter } = require("./auth");
const app = express();

// .createServer(credentials);
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
Date.prototype.kkyyyy = function () {
  let mm = this.getMonth() + 1; // getMonth() is zero-based
  let kk = null;
  if (mm <= 3) {
    kk = "I";
  } else if (mm <= 6) {
    kk = "II";
  } else if (mm <= 9) {
    kk = "III";
  } else {
    kk = "IV";
  }

  return [kk, this.getFullYear()].join(" ");
};
const { executeQuery } = require("./utils/utils");
function prepareDatesForMysql(columnsOfDates) {
  return function (req, res, next) {
    columnsOfDates.forEach((column) => {
      let date = req.body[column];
      if (!date || !/\d\d\s\d\d\s\d\d\d\d/.test(date)) return;
      req.body[column] = date.split(" ").reverse().join("-");
    });

    next();
  };
}
function prepareDatesForClient(settings) {
  //   {
  //     all : ['fdate'],
  //     month: ['sdate']
  // kvartal: []
  //   }
  return function (rows) {
    rows.forEach((row) => {
      settings.month &&
        settings.month.forEach((column) => {
          if (!row.is_month) return;
          if (typeof row[column] == "object") {
            row[column] = row[column].mmyyyy();
          }
        });

      settings.kvartal &&
        settings.kvartal.forEach((column) => {
          if (!row.is_kvartal) return;
          if (typeof row[column] == "object") {
            row[column] = row[column].kkyyyy();
          }
        });

      settings.all &&
        settings.all.forEach((column) => {
          if (typeof row[column] == "object") {
            row[column] = row[column].ddmmyyyy();
          } else if (
            typeof row[column] == "string" &&
            /\d\d\d\d\-\d\d\-\d\d/.test(row[column])
          ) {
            row[column] = "";
          }
        });
    });
  };
}
function prepareJsonedColumnsForMysql(jsonedColumns) {
  return function (req, res, next) {
    jsonedColumns.forEach((column) => {
      if (!req.body[column]) return;
      req.body[column] = JSON.stringify(req.body[column]);
    });
    next();
  };
}
function prepareJsonedColumnsForClient(jsonedColumns) {
  return function (rows) {
    rows.forEach((row) => {
      jsonedColumns.forEach((column) => {
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
    columnsNeed.forEach((column) => {
      newReqBody[column] = req.body[column];
    });
    req.body = newReqBody;
    next();
  };
}

function convertDateToMysqlFormat(date) {
  return [
    date.getFullYear(),
    date.getMonth() > 8 ? date.getMonth() + 1 : "0" + (date.getMonth() + 1),
    date.getDate() > 9 ? date.getDate() : "0" + date.getDate(),
  ].join("-");
}

function getDateDaysAgo(days) {
  return new Date(new Date().getTime() - 60 * 60 * 24 * days * 1000);
}

function convertStringDateToNormalDate(stringDate, seperator = " ") {
  let splitted = stringDate.split(seperator);
  if (splitted.length != 3 || !/\d\d.\d\d.\d\d\d\d/.test(splitted)) {
    throw new Error(
      "StringDate Must be in 3 parts AND format is :  dd mm yyyy"
    );
  }

  return new Date(splitted[2], splitted[1] - 1, splitted[0]);
}

const schemas = {
  activities: {
    jsonedColumns: [
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
    ],
    dates: ["sdate", "fdate"],
    needColumns: [
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
    ],
    dateParseOptions: {
      all: ["fdate", "sdate"],
      month: ["sdate"],
    },
  },
  infoQueries: {
    jsonedColumns: ["statuses"],
    dates: ["sdate", "fdate"],
    needColumns: [
      "classification",
      "is_deleted",
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
    ],
    dateParseOptions: {
      all: ["fdate", "sdate"],
    },
  },
  projects: {
    jsonedColumns: ["efficiency", "workGroup"],
    dates: ["sdate", "fdate"],
    needColumns: [
      "id",
      "accompanying",
      "fdate",
      "sdate",
      "title",
      "description",
      "businessType",
      "workGroup",
      "status",
      "CA",
      "projectType",
      "efficiency",
      "comment",
    ],
    dateParseOptions: {
      all: ["fdate", "sdate"],
      month: ["sdate"],
      kvartal: ["sdate"],
    },
  },
  employees: {
    needColumns: ["id", "full_name", "login"],
  },
};

////// ACTIVITIES ///////
function activitiesMonthCheck(req, res, next) {
  if (/^\d\d\s\d\d\d\d$/.test(req.body.sdate)) {
    req.body.sdate = "01 " + req.body.sdate;
    req.body.is_month = true;
  } else {
    req.body.is_month = false;
  }
  next();
}

//// PROJECTS ////

function projectsMonthKvartalCheck(req, res, next) {
  req.body.is_month = false;
  req.body.is_kvartal = false;
  if (/^\d\d\s\d\d\d\d$/.test(req.body.sdate)) {
    req.body.sdate = "01 " + req.body.sdate;
    req.body.is_month = true;
  } else if (/^i{1,3}V?\s\d\d\d\d$/i.test(req.body.sdate)) {
    let date = req.body.sdate.split(" ")[0];
    if (date == "I") {
      date = "01 01";
    } else if (date == "II") {
      date = "01 04";
    } else if (date == "III") {
      date = "01 07";
    } else {
      date = "01 10";
    }
    req.body.sdate = [date, req.body.sdate.split(" ")[1]].join(" ");
    req.body.is_kvartal = true;
  }
  next();
}

app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));
app.use(cors());

let session = require("express-session");
let MySQLStore = require("express-mysql-session")(session);
// or mysql.createPool(options);

const { connection } = require("./connection");
let sessionStore = new MySQLStore(
  { expiration: 365 * 24 * 60 * 60 * 1000 } /* session store options */,
  connection
);

app.use(
  session({
    key: "project_mi_session",
    secret: "projectmiVerySecretKeyByBruto",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  })
);

app.all("*", (req, res, next) => {
  console.log(`request URL : ${req.url} //\\\\ METHOD IS ${req.method}`);
  next();
});

app.get("/vendor/archived", (req, res) => {
  let dataType = req.query.dataType;
  let fdate = req.query.fdate;
  let sdate = req.query.sdate;
  console.log(dataType, fdate, sdate);
  if (!schemas[dataType] || !fdate || !sdate) {
    res.status(400).end("BAD REQUEST");
    return;
  }

  let sql = `SELECT * from ${dataType} where fdate between '${convertDateToMysqlFormat(
    convertStringDateToNormalDate(fdate)
  )}' AND '${convertDateToMysqlFormat(convertStringDateToNormalDate(sdate))}'`;

  executeQuery(sql)
    .then((resultRows) => {
      prepareDatesForClient(schemas[dataType].dateParseOptions)(resultRows);
      prepareJsonedColumnsForClient(schemas[dataType].jsonedColumns)(
        resultRows
      );

      res.end(JSON.stringify(resultRows));
    })
    .catch((err) => {
      console.log(err);
      res.status(500).end("500");
    });
});

app.get("/vendor/showHolidays", (req, res) => {
  fs.readFile(
    path.resolve(__dirname, "./holidays.txt"),
    "utf-8",
    (err, data) => {
      if (err) {
        console.log(err);
        res.status(500).end("500");
        return;
      }

      res.end(data);
    }
  );
});

app.get("/vendor/showEmployees", (req, res) => {
  executeQuery(
    "SELECT * FROM EMPLOYEES WHERE is_deleted = 0 OR is_deleted is null ORDER BY full_name DESC"
  )
    .then((results) => {
      res.end(JSON.stringify(results));
    })
    .catch((err) => {
      res.status(500).end("500");
    });
});

app.get("/vendor/showActivities", (req, res) => {
  executeQuery(
    `SELECT * FROM activities WHERE is_deleted = 0 AND is_archived = 0 AND fdate > '${convertDateToMysqlFormat(
      getDateDaysAgo(180)
    )}'`
  )
    .then((resultRows) => {
      prepareDatesForClient({
        all: ["fdate", "sdate"],
        month: ["sdate"],
      })(resultRows);
      prepareJsonedColumnsForClient(schemas.activities.jsonedColumns)(
        resultRows
      );

      res.end(JSON.stringify(resultRows) || []);
    })
    .catch((err) => {
      res.status(500).end("500");
    });
});

app.get("/vendor/showInfoQueries", (req, res) => {
  executeQuery(
    `SELECT * FROM infoQueries WHERE fdate > '${convertDateToMysqlFormat(
      getDateDaysAgo(180)
    )}' OR fdate = '0000-00-00'`
  )
    .then((resultRows) => {
      prepareDatesForClient({
        all: ["fdate", "sdate"],
      })(resultRows);
      prepareJsonedColumnsForClient(schemas.infoQueries.jsonedColumns)(
        resultRows
      );

      res.end(JSON.stringify(resultRows));
    })
    .catch((err) => {
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

app.get("/vendor/showProjects", (req, res) => {
  executeQuery(
    `SELECT * FROM projects WHERE  fdate > '${convertDateToMysqlFormat(
      getDateDaysAgo(180)
    )}' AND is_deleted = 0 OR is_deleted is NULL `
  )
    .then((resultRows) => {
      prepareDatesForClient({
        all: ["fdate", "sdate"],
        month: ["sdate"],
        kvartal: ["sdate"],
      })(resultRows);
      prepareJsonedColumnsForClient(schemas.projects.jsonedColumns)(resultRows);

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
  clearRequest(schemas.activities.needColumns),
  activitiesMonthCheck,
  prepareDatesForMysql(schemas.activities.dates),
  prepareJsonedColumnsForMysql(schemas.activities.jsonedColumns),
  (req, res, next) => {
    let sql = mysql.format("INSERT INTO activities SET  ?", req.body);

    executeQuery(sql)
      .then((result) => {
        // res.status(404);
        res.end(JSON.stringify(result.insertId));
      })
      .catch((err) => {
        console.log(err);
        res.status(400).end(JSON.stringify(err));
      });
  }
);

app.post(
  "/vendor/editActivity",
  clearRequest(schemas.activities.needColumns),
  activitiesMonthCheck,
  prepareDatesForMysql(schemas.activities.dates),
  prepareJsonedColumnsForMysql(schemas.activities.jsonedColumns),
  (req, res, next) => {
    let id = req.body.id;
    delete req.body.id;
    let query = mysql.format("UPDATE  activities SET  ? WHERE id=?", [
      req.body,
      id,
    ]);

    console.log(JSON.stringify(req.body, null, 4));

    executeQuery(query)
      .then((result) => {
        res.end(JSON.stringify(result.insertId));
      })
      .catch((err) => {
        console.log(err);
        res.status(500).end();
      });
  }
);

app.post("/vendor/deleteActivity", (req, res) => {
  let sql = `UPDATE activities SET is_deleted = true WHERE id=${req.body.id}`;

  executeQuery(sql)
    .then(() => {
      res.end("OK");
    })
    .catch((err) => {
      res.status(500).end(err.toString());
    });
});

app.post("/vendor/changeOcenka", (req, res, next) => {
  let sql = `UPDATE  activities SET  ocenka='${JSON.stringify(
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
  let sql = `SELECT * FROM employees WHERE nid='${req.body.nid}' OR login ='${req.body.login}'`;

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
  clearRequest(schemas.employees.needColumns),
  (req, res) => {
    let id = req.body.id;
    delete req.body.id;
    let sql = mysql.format("UPDATE  employees SET  ? WHERE id=?", [
      req.body,
      id,
    ]);

    executeQuery(sql)
      .then(() => {
        res.end("OK");
      })
      .catch((err) => {
        res.status(400).end(JSON.stringify(err));
      });
  }
);

//INFOQUERIES//

app.post(
  "/vendor/addInfoQuery",
  clearRequest(schemas.infoQueries.needColumns),
  prepareDatesForMysql(schemas.infoQueries.dates),
  prepareJsonedColumnsForMysql(schemas.infoQueries.jsonedColumns),
  (req, res) => {
    let query = mysql.format("INSERT INTO infoQueries SET  ?", req.body);

    executeQuery(query)
      .then((result) => {
        res.end(JSON.stringify(result.insertId));
      })
      .catch((err) => {
        console.log(err);
        res.status(400).end(JSON.stringify(err));
      });
  }
);

app.post(
  "/vendor/editInfoQuery",
  clearRequest(schemas.infoQueries.needColumns),
  prepareDatesForMysql(schemas.infoQueries.dates),
  prepareJsonedColumnsForMysql(schemas.infoQueries.jsonedColumns),

  (req, res, next) => {
    let id = req.body.id;
    delete req.body.id;
    let query = mysql.format("UPDATE  infoQueries SET  ? WHERE id=?", [
      req.body,
      id,
    ]);
    executeQuery(query)
      .then((result) => {
        res.end(JSON.stringify(result.insertId));
      })
      .catch((err) => {
        res.status(400).end();
      });
  }
);

app.post("/vendor/deleteInfoQuery", (req, res) => {
  let sql = `UPDATE infoQueries SET is_deleted = true WHERE id=${req.body.id}`;

  executeQuery(sql)
    .then(() => {
      res.end("OK");
    })
    .catch((err) => {
      res.status(400).end(err.toString());
    });
});

/// projects ///

app.post(
  "/vendor/addProject",
  clearRequest(schemas.projects.needColumns),
  projectsMonthKvartalCheck,
  prepareDatesForMysql(schemas.projects.dates),
  prepareJsonedColumnsForMysql(schemas.projects.jsonedColumns),
  (req, res, next) => {
    let sql = mysql.format("INSERT INTO projects SET  ?", req.body);
    executeQuery(sql)
      .then((result) => {
        res.end(JSON.stringify(result.insertId));
      })
      .catch((err) => {
        res.status(400).end(JSOn.stringify(err));
      });
  }
);

app.post(
  "/vendor/editProject",
  clearRequest(schemas.projects.needColumns),
  projectsMonthKvartalCheck,
  prepareDatesForMysql(schemas.projects.dates),
  prepareJsonedColumnsForMysql(schemas.projects.jsonedColumns),
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
        res.status(400).end();
      });
  }
);
app.post("/vendor/deleteProject", (req, res) => {
  let sql = `UPDATE projects SET is_deleted = true WHERE id=${req.body.id}`;

  executeQuery(sql)
    .then(() => {
      res.end("OK");
    })
    .catch((err) => {
      res.status(400).end(err.toString());
    });
});

app.post("/vendor/saveTabel", (req, res) => {
  let isErrorGetted = false;
  let completedQueries = 0;
  req.body.forEach((day, idxOfDay) => {
    if (isErrorGetted) return;
    let sql = `UPDATE tabel SET body='${JSON.stringify(day.body)}' WHERE id=${
      day.id
    }`;
    executeQuery(sql)
      .then(() => {
        completedQueries++;
        if (isErrorGetted) return;
        if (completedQueries === req.body.length - 1) {
          res.end("OK");
        }
      })
      .catch((err) => {
        isErrorGetted = true;
        console.log("ERROR", err);
        res.status(500).end(err.toString());
      });
  });
});

app.use("/vendor/auth", authRouter);

app.all("*", (req, res) => {
  res.status(404).end("NOT FOUND");
});

// let httpsServer = https.createServer(credentials, app);
app.listen(3002, console.log("server started ON PORT 3002"));
