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
    });

    next();
  };
}
function prepareDatesForClient(columnsOfDates) {
  return function (rows) {
    rows.forEach((row) => {
      columnsOfDates.forEach((column) => {
        if (typeof row[column] != "string" && row[column] != null) {
          console.log("step2");
          if (row.is_month && column === "sdate") {
            row[column] = row[column].mmyyyy();
          } else {
            row[column] = row[column].ddmmyyyy();
          }
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
///////////////////// CONFIGS ////////////////////////////////
//\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

////// ACTIVITIES ///////

function monthCheck(req, res, next) {
  let date = req.sdate;
  if (/^\d\d\s\d\d\d\d$/.test(date)) {
    req.body.is_month = true;
  } else {
    req.body.is_month = false;
  }
  next();
}

const activityArrays = [
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
const activityDates = ["sdate", "fdate"];

const activityNeedColumns = [
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

////// ACTIVITIES ///////

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
  console.log("req");
  console.log(req.url);
  next();
});

app.get("/vendor/showEmployees", (req, res) => {
  executeQuery("SELECT * FROM EMPLOYEES WHERE is_deleted = 0") //Да, тут наоборот
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
      prepareDatesForClient(["fdate", "sdate"])(resultRows);
      prepareArraysForClient([
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
      ])(resultRows);

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
      let jsonedColumns = ["statuses"];

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

app.post("/vendor/addEmployee", (req, res) => {
  let query = `SELECT * FROM employees WHERE nid = ${req.nid}`;

  // let query = mysql.format("INSERT INTO employees SET  ?", req.body);
  // executeQuery(query).then(()=>res.end('OK')).catch(()=>{
  //   res.status(404).end('sik')
  // })
  res.status(404).end("sik");
});

app.post(
  "/vendor/addActivity",
  prepareDatesForMysql([activityDates]),
  prepareArraysForMysql(activityArrays),
  monthCheck,
  (req, res) => {
    let query = mysql.format("INSERT INTO projects SET  ?", req.body);

    // res.status(404).end();
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
  "/vendor/editActivity",
  clearRequest(activityNeedColumns),
  prepareDatesForMysql(activityDates),
  prepareArraysForMysql(activityArrays),
  monthCheck,
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

app.post('/vendor/deleteActivity', (req,res)=>{
console.log(req.body)
let sql = `UPDATE projects SET is_deleted = true WHERE id=${req.body.id}`;

executeQuery(sql)
.then(()=>{
  res.end('OK')
})
.catch((err)=>{

  res.status(500).end(err.toString())
})
})

app.all('*',(req,res)=>res.status(400).end(''))
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

app.listen(3000, console.log("server started"));
