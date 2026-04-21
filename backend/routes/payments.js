const express = require("express");
const paymentController = require("../controllers/paymentController");

const router = express.Router();

router.post("/checkout-session", paymentController.createCheckoutSession);
router.post("/confirm-checkout", paymentController.confirmCheckoutAndUpgrade);

module.exports = router;
