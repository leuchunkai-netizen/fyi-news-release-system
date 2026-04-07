const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

/** GET /api/users/service-info — placeholder for future server-side user/admin hooks. */
router.get("/service-info", userController.getServiceInfo);
router.post("/testimonials/moderate", userController.moderateTestimonial);

module.exports = router;
