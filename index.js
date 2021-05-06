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
          } else if (typeof row[column] == "string") {
            row[column] = "";
          }
        });

      settings.kvartal &&
        settings.kvartal.forEach((column) => {
          if (!row.is_kvartal) return;
          if (typeof row[column] == "object") {
            row[column] = row[column].kkyyyy();
          } else if (typeof row[column] == "string") {
            row[column] = "";
          }
        });

        settings.all &&
        settings.all.forEach((column) => {
        
          if (typeof row[column] == "object") {
        
            row[column] = row[column].ddmmyyyy();
          } else if (typeof row[column] == "string") {
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
////// ACTIVITIES ///////
function activitiesMonthCheck(req, res, next) {
  if (/^\d\d\s\d\d\d\d$/.test(req.sdate)) {
    req.sdate = "01 " + req.sdate;
    req.body.is_month = true;
  } else {
    req.body.is_month = false;
  }
  next();
}

const activitiesJsonedColumns = [
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

const infoqueriesJsonedColumns = ["statuses"];
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
//// PROJECTS ////

function projectsMonthKvartalCheck(req, res, next) {
  req.body.is_month = false;
  req.body.is_kvartal = false;
  if (/^\d\d\s\d\d\d\d$/.test(req.sdate)) {
    req.sdate = "01 " + req.sdate;
    req.body.is_month = true;
  } else if (/^i{1,3}V?\s\d\d\d\d$/i.test(req.sdate)) {
    let date = req.sdate.split(" ")[0];
    if (date == "I") {
      date = "01 01";
    } else if (date == "II") {
      date = "01 04";
    } else if (date == "III") {
      date = "01 07";
    } else {
      date = "01 10";
    }
    req.sdate = date + req.sdate.split(" ")[1];
    req.body.is_kvartal = true;
  }
  next();
}

const projectsJsonedColumns = ["efficiency"];
const projectsDates = ["sdate", "fdate"];

const projectsNeedColumns = [
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
      res.status(500).end("500");
    });
});

app.get("/vendor/showActivities", (req, res) => {
  executeQuery(
    "SELECT * FROM activities WHERE is_deleted = 0 AND is_archived = 0"
  )
    .then((resultRows) => {
      prepareDatesForClient({
        all: ["fdate","sdate"],
        month: ["sdate"]
      })(resultRows);
      prepareJsonedColumnsForClient(activitiesJsonedColumns)(resultRows);

      res.end(JSON.stringify(resultRows));
    })
    .catch((err) => {
      res.status(500).end("500");
    });
});

app.get("/vendor/showInfoQueries", (req, res) => {
  executeQuery("SELECT * FROM infoQueries")
    .then((resultRows) => {
      prepareDatesForClient({
        all: ["fdate", "sdate"],
      })(resultRows);
      prepareJsonedColumnsForClient(infoqueriesJsonedColumns)(resultRows);

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
  executeQuery("SELECT * FROM projects WHERE is_deleted = 0")
    .then((resultRows) => {
      prepareDatesForClient({
        all: ["fdate",'sdate'],
        month: ["sdate"],
        kvartal: ["sdate"],
      })(resultRows);
      prepareJsonedColumnsForClient(projectsJsonedColumns)(resultRows);

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
  activitiesMonthCheck,
  prepareDatesForMysql(activitiesDates),
  prepareJsonedColumnsForMysql(activitiesJsonedColumns),
  (req, res, next) => {
    let sql = mysql.format("INSERT INTO activities SET  ?", req.body);

    executeQuery(sql)
      .then((result) => {
        // res.status(404);
        res.end(JSON.stringify(result.insertId));
      })
      .catch((err) => {
        console.log(err);
        res.status(400).end(JSOn.stringify(err));
      });
  }
);

app.post(
  "/vendor/editActivity",
  clearRequest(activitiesNeedColumnsForEdit),
  activitiesMonthCheck,
  prepareDatesForMysql(activitiesDates),
  prepareJsonedColumnsForMysql(activitiesJsonedColumns),
  (req, res, next) => {
    let id = req.body.id;
    delete req.body.id;
    let query = mysql.format("UPDATE  activities SET  ? WHERE id=?", [
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
        res.status(400).end();
      });
  }
);

app.post("/vendor/deleteActivity", (req, res) => {
  console.log(req.body);
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
  prepareJsonedColumnsForMysql(infoqueriesJsonedColumns),
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
  prepareJsonedColumnsForMysql(infoqueriesJsonedColumns),

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

        res.status(400).end();
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

/// projects ///

app.post(
  "/vendor/addProject",
  clearRequest(projectsNeedColumns),
  projectsMonthKvartalCheck,
  prepareDatesForMysql(projectsDates),
  prepareJsonedColumnsForMysql(projectsJsonedColumns),
  (req, res, next) => {
    let sql = mysql.format("INSERT INTO projects SET  ?", req.body);
    executeQuery(sql)
      .then((result) => {
        res.end(JSON.stringify(result.insertId));
      })
      .catch((err) => {
        console.log(err);
        res.status(400).end(JSOn.stringify(err));
      });
  }
);

app.post(
  "/vendor/editProject",
  clearRequest(projectsNeedColumns),
  projectsMonthKvartalCheck,
  prepareDatesForMysql(projectsDates),
  prepareJsonedColumnsForMysql(projectsJsonedColumns),
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
  console.log(req.body);
  let sql = `UPDATE projects SET is_deleted = true WHERE id=${req.body.id}`;

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
