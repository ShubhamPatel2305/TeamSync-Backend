const { Router } = require("express");
const router = Router();

router.get("/", (req, res) => {
    res.send("Admin route");
});


module.exports = router;