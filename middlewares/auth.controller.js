const { executeQuery } = require("./../utils/utils");
const mysql = require("mysql");
function validateLoginAndPass(req, res, next) {
  let body = req.body;

  if (!body.login || !body.password) {
    res.status(400).json({
      error: "validateError",
      message: "Неправильный логин или пароль",
    });
    return;
  }

  //clean request
  req.body = {
    login: body.login,
    password: body.password,
  };
  next();
}

async function checkIfEmployeeExists(req, res, next) {
  let futureUser = req.body;
  try {
    let users = await executeQuery(
      mysql.format(
        `SELECT * FROM employees WHERE login = ?  limit 1`,
        futureUser.login
      )
    );

    console.log(users);

    if (!users.length) {
      res.status(401).json("Сотрудника с таким логином не существут");
      return;
    }
    let user = users[0];

    if (user.is_deleted) {
      res.status(401).json("Пользователь удален. Обратитесь к разработчику.");
      return;
    }

    next();
  } catch (err) {
    console.log(err);
    res.status(500).json("Ошибка на стороне сервера");
  }
}

async function checkIfUserAlreadyRegistered(req, res, next) {
  let futureUser = req.body;
  try {
    let users = await executeQuery(
      mysql.format(
        `SELECT * FROM users WHERE login = ?  limit 1`,
        futureUser.login
      )
    );

    console.log(users);

    if (users.length) {
      res.status(401).json("Сотрудник с таким логином уже зарегестрирован");
      return;
    }
    let user = users[0];

    next();
  } catch (err) {
    console.log(err);
    res.status(500).json("Ошибка на стороне сервера");
  }
}

async function registerUser(req, res, next) {
  let futureUser = req.body;

  let sql = mysql.format("INSERT INTO users SET  ?", futureUser);

  try {
    let { insertId } = await executeQuery(sql);

    res.status(200).json("Вы успешно зарегестрировались.");
  } catch {}
}
async function checkLoginAndPass(req, res, next) {
  let userFromClient = req.body;

  try {
    let sql = mysql.format(
      "SELECT * FROM users WHERE login = ? AND password = ?",
      [userFromClient.login, userFromClient.password]
    );

    let users = await executeQuery(sql);
    if (!users.length) {
      res.status(401).json("Неверные логин/пароль");
      return;
    } else {
      next();
    }
  } catch (err) {
    console.log(err);
    res.status(500).json("");
  }
}

async function loginUserAndSetRole(req, res, next) {
  let user = req.body;

  try {
    let sql = mysql.format(
      "SELECT * from employees WHERE login = ?",
      user.login
    );
    let employees = await executeQuery(sql);
    if (!employees.length) {
      throw new Error(`employees MUST be in DB. Received ${employees}`);
    }
    let employee = employees[0];
    req.session.role = "admin";
    res.status(200).json({ role: req.session.role });
  } catch (err) {
    console.log(err);
    res.status(500).end();
  }
}

module.exports = {
  validateLoginAndPass,
  checkIfEmployeeExists,
  registerUser,
  checkIfUserAlreadyRegistered,
  checkLoginAndPass,
  loginUserAndSetRole,
};
