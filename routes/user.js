const { Router } = require("express");
const router = Router();

router.get("/", (req, res) => {
    res.send("User route");
});


module.exports = router;