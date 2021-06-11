const router = require("express").Router();
const authController = require("./middlewares/auth.controller");

router.post(
  "/login",
  authController.validateLoginAndPass,
  authController.checkLoginAndPass,
  authController.loginUserAndSetRole
);
router.post(
  "/register",
  authController.validateLoginAndPass,
  authController.checkIfEmployeeExists,
  authController.checkIfUserAlreadyRegistered,
  authController.registerUser
);
router.get("/role", (req, res) => {
  console.log("role");
  res.status(200).json({ role: req.session.role });
});

module.exports = { authRouter: router };
